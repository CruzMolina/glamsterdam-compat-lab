import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generatePublicSite } from "../scripts/generate-public-site.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("public seed site", () => {
  it("generates an offline HTML browser and detail pages from the committed dataset", () => {
    withTempSite((outputDir) => {
      const result = generatePublicSite({ outputDir, quiet: true });
      const htmlPath = resolve(outputDir, "index.html");
      const html = readFileSync(htmlPath, "utf8");
      const manifest = JSON.parse(readFileSync(resolve(rootDir, "datasets/public-seed/manifest.json"), "utf8"));
      const summary = JSON.parse(readFileSync(resolve(rootDir, "datasets/public-seed/summary.json"), "utf8"));
      const reportEntry = manifest.reports.find((entry: { sourceFixture: string; thresholdProfile: string }) =>
        entry.sourceFixture === "fixtures/bytecode/storage-heavy.hex" && entry.thresholdProfile === "default"
      ) ?? manifest.reports[0];
      const comparisonEntry = manifest.comparisons.find((entry: { sourceFixture: string }) =>
        entry.sourceFixture === reportEntry.sourceFixture
      ) ?? manifest.comparisons[0];
      const reportDetailPath = htmlPathForDatasetPath(reportEntry.report);
      const comparisonDetailPath = htmlPathForDatasetPath(comparisonEntry.comparison);
      const findingId = reportEntry.findingIds[0];
      const findingDetailPath = findingPathForId(findingId);
      const reportDetailHtml = readFileSync(resolve(outputDir, reportDetailPath), "utf8");
      const comparisonDetailHtml = readFileSync(resolve(outputDir, comparisonDetailPath), "utf8");
      const findingDetailHtml = readFileSync(resolve(outputDir, findingDetailPath), "utf8");

      expect(existsSync(htmlPath)).toBe(true);
      expect(result.reportCount).toBe(manifest.reports.length);
      expect(result.comparisonCount).toBe(manifest.comparisons.length);
      expect(result.findingCount).toBe(summary.counts.findingsById.length);
      for (const entry of manifest.reports) {
        expect(existsSync(resolve(outputDir, htmlPathForDatasetPath(entry.report)))).toBe(true);
      }
      for (const entry of manifest.comparisons) {
        expect(existsSync(resolve(outputDir, htmlPathForDatasetPath(entry.comparison)))).toBe(true);
      }
      for (const entry of summary.counts.findingsById) {
        expect(existsSync(resolve(outputDir, findingPathForId(entry.key)))).toBe(true);
      }

      expect(html).toContain("Glamsterdam public seed dataset");
      expect(html).toContain(`${summary.reportCount}</span><span class="stat-label">Reports`);
      expect(html).toContain('id="risk-filter"');
      expect(html).toContain('id="kind-filter"');
      expect(html).toContain('id="report-search"');
      expect(html).toContain('id="share-link"');
      expect(html).toContain("history.replaceState");
      expect(html).toContain("trace.logs-calls-visible");
      expect(html).toContain(reportDetailPath);
      expect(html).toContain(comparisonDetailPath);
      expect(html).toContain(findingDetailPath);
      expect(html).toContain("../../datasets/public-seed/comparisons/");
      expect(html).toContain("../../fixtures/provenance.json");
      expect(html).not.toMatch(/<script\b[^>]*\bsrc=/i);
      expect(html).not.toMatch(/<link\b[^>]*\bhref=/i);

      expect(reportDetailHtml).toContain(`Report: ${reportEntry.sourceFixture}`);
      expect(reportDetailHtml).toContain("report json");
      expect(reportDetailHtml).toContain(`../../../datasets/public-seed/${reportEntry.report}`);
      expect(reportDetailHtml).toContain("../index.html?risk=");
      expect(reportDetailHtml).toContain(`id="${findingAnchorId(findingId)}"`);
      expect(reportDetailHtml).toContain(`../${findingDetailPath}`);
      expect(reportDetailHtml).toContain("Recommendation");
      expect(reportDetailHtml).not.toMatch(/<script\b[^>]*\bsrc=/i);
      expect(reportDetailHtml).not.toMatch(/<link\b[^>]*\bhref=/i);

      expect(comparisonDetailHtml).toContain(`Comparison: ${comparisonEntry.sourceFixture}`);
      expect(comparisonDetailHtml).toContain("comparison json");
      expect(comparisonDetailHtml).toContain(`../../../datasets/public-seed/${comparisonEntry.comparison}`);
      expect(comparisonDetailHtml).toContain("../reports/");
      expect(comparisonDetailHtml).toContain("../findings/");
      expect(comparisonDetailHtml).not.toMatch(/<script\b[^>]*\bsrc=/i);
      expect(comparisonDetailHtml).not.toMatch(/<link\b[^>]*\bhref=/i);

      expect(findingDetailHtml).toContain(`Finding: ${findingId}`);
      expect(findingDetailHtml).toContain("Matching Reports");
      expect(findingDetailHtml).toContain(`../${reportDetailPath}#${findingAnchorId(findingId)}`);
      expect(findingDetailHtml).toContain(`../../../datasets/public-seed/${reportEntry.report}`);
      expect(findingDetailHtml).toContain(`../../../${reportEntry.sourceFixture}`);
      expect(findingDetailHtml).toContain("../comparisons/");
      expect(findingDetailHtml).not.toMatch(/<script\b[^>]*\bsrc=/i);
      expect(findingDetailHtml).not.toMatch(/<link\b[^>]*\bhref=/i);

      expectSiteInternalLinksToResolve(outputDir);
    });
  });
});

function htmlPathForDatasetPath(path: string): string {
  return path.replace(/\.json$/, ".html");
}

function findingPathForId(findingId: string): string {
  return `findings/${slugPathSegment(findingId)}.html`;
}

function findingAnchorId(findingId: string): string {
  return `finding-${slugPathSegment(findingId)}`;
}

function slugPathSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-|-$/g, "");
}

function withTempSite(run: (outputDir: string) => void): void {
  const tempDir = mkdtempSync(resolve(tmpdir(), "glamsterdam-public-site-test-"));

  try {
    run(resolve(tempDir, "site"));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function expectSiteInternalLinksToResolve(outputDir: string): void {
  for (const htmlFile of collectHtmlFiles(outputDir)) {
    const html = readFileSync(htmlFile, "utf8");
    for (const href of html.matchAll(/\bhref="([^"]+)"/g)) {
      const target = siteInternalTarget(htmlFile, href[1]);
      if (!target) {
        continue;
      }

      expect(existsSync(target.path), `${href[1]} from ${htmlFile}`).toBe(true);
      if (target.anchor) {
        const targetHtml = readFileSync(target.path, "utf8");
        expect(targetHtml, `${href[1]} from ${htmlFile}`).toContain(`id="${target.anchor}"`);
      }
    }
  }
}

function collectHtmlFiles(dir: string): string[] {
  const entries = readdirSync(dir).sort();
  const files: string[] = [];

  for (const entry of entries) {
    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...collectHtmlFiles(path));
    } else if (stat.isFile() && path.endsWith(".html")) {
      files.push(path);
    }
  }

  return files;
}

function siteInternalTarget(fromFile: string, href: string): { path: string; anchor?: string } | undefined {
  if (/^[a-z]+:/i.test(href) || href.startsWith("../../")) {
    return undefined;
  }

  const hashIndex = href.indexOf("#");
  const rawAnchor = hashIndex >= 0 ? href.slice(hashIndex + 1) : "";
  const pathAndQuery = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const path = pathAndQuery.split("?")[0];
  if (!path.endsWith(".html")) {
    return undefined;
  }

  return {
    path: resolve(dirname(fromFile), path),
    anchor: rawAnchor ? decodeURIComponent(rawAnchor) : undefined
  };
}
