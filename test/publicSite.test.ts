import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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
      const reportDetailHtml = readFileSync(resolve(outputDir, reportDetailPath), "utf8");
      const comparisonDetailHtml = readFileSync(resolve(outputDir, comparisonDetailPath), "utf8");

      expect(existsSync(htmlPath)).toBe(true);
      expect(result.reportCount).toBe(manifest.reports.length);
      expect(result.comparisonCount).toBe(manifest.comparisons.length);
      for (const entry of manifest.reports) {
        expect(existsSync(resolve(outputDir, htmlPathForDatasetPath(entry.report)))).toBe(true);
      }
      for (const entry of manifest.comparisons) {
        expect(existsSync(resolve(outputDir, htmlPathForDatasetPath(entry.comparison)))).toBe(true);
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
      expect(html).toContain("../../datasets/public-seed/comparisons/");
      expect(html).toContain("../../fixtures/provenance.json");
      expect(html).not.toMatch(/<script\b[^>]*\bsrc=/i);
      expect(html).not.toMatch(/<link\b[^>]*\bhref=/i);

      expect(reportDetailHtml).toContain(`Report: ${reportEntry.sourceFixture}`);
      expect(reportDetailHtml).toContain("report json");
      expect(reportDetailHtml).toContain(`../../../datasets/public-seed/${reportEntry.report}`);
      expect(reportDetailHtml).toContain("../index.html?risk=");
      expect(reportDetailHtml).toContain("Recommendation");
      expect(reportDetailHtml).not.toMatch(/<script\b[^>]*\bsrc=/i);
      expect(reportDetailHtml).not.toMatch(/<link\b[^>]*\bhref=/i);

      expect(comparisonDetailHtml).toContain(`Comparison: ${comparisonEntry.sourceFixture}`);
      expect(comparisonDetailHtml).toContain("comparison json");
      expect(comparisonDetailHtml).toContain(`../../../datasets/public-seed/${comparisonEntry.comparison}`);
      expect(comparisonDetailHtml).toContain("../reports/");
      expect(comparisonDetailHtml).not.toMatch(/<script\b[^>]*\bsrc=/i);
      expect(comparisonDetailHtml).not.toMatch(/<link\b[^>]*\bhref=/i);
    });
  });
});

function htmlPathForDatasetPath(path: string): string {
  return path.replace(/\.json$/, ".html");
}

function withTempSite(run: (outputDir: string) => void): void {
  const tempDir = mkdtempSync(resolve(tmpdir(), "glamsterdam-public-site-test-"));

  try {
    run(resolve(tempDir, "site"));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
