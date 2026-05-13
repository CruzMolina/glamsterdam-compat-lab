import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generatePublicSite } from "../scripts/generate-public-site.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("public seed site", () => {
  it("generates a single offline HTML browser from the committed dataset", () => {
    withTempSite((outputDir) => {
      const result = generatePublicSite({ outputDir, quiet: true });
      const htmlPath = resolve(outputDir, "index.html");
      const html = readFileSync(htmlPath, "utf8");
      const manifest = JSON.parse(readFileSync(resolve(rootDir, "datasets/public-seed/manifest.json"), "utf8"));
      const summary = JSON.parse(readFileSync(resolve(rootDir, "datasets/public-seed/summary.json"), "utf8"));

      expect(existsSync(htmlPath)).toBe(true);
      expect(result.reportCount).toBe(manifest.reports.length);
      expect(result.comparisonCount).toBe(manifest.comparisons.length);
      expect(html).toContain("Glamsterdam public seed dataset");
      expect(html).toContain(`${summary.reportCount}</span><span class="stat-label">Reports`);
      expect(html).toContain('id="risk-filter"');
      expect(html).toContain('id="kind-filter"');
      expect(html).toContain('id="report-search"');
      expect(html).toContain("trace.logs-calls-visible");
      expect(html).toContain("../../datasets/public-seed/reports/");
      expect(html).toContain("../../datasets/public-seed/comparisons/");
      expect(html).toContain("../../fixtures/provenance.json");
      expect(html).not.toMatch(/<script\b[^>]*\bsrc=/i);
      expect(html).not.toMatch(/<link\b[^>]*\bhref=/i);
    });
  });
});

function withTempSite(run: (outputDir: string) => void): void {
  const tempDir = mkdtempSync(resolve(tmpdir(), "glamsterdam-public-site-test-"));

  try {
    run(resolve(tempDir, "site"));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
