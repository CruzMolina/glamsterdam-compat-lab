import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadDetectorThresholds } from "../src/detectors/thresholds.js";
import { compareCompatibilityReports } from "../src/reports/compareReports.js";
import { renderJsonComparisonReport } from "../src/reports/jsonReporter.js";
import { renderMarkdownComparisonReport } from "../src/reports/markdownReporter.js";
import { validateCompatibilityReport, validateComparisonReport } from "../src/reports/reportTypes.js";
import { scanTrace } from "../src/scanners/traceScanner.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("comparison reports", () => {
  it("compares added, removed, changed, and unchanged findings deterministically", () => {
    const baseline = loadReport("fixtures/reports/baseline-default-report.json");
    const candidate = loadReport("fixtures/reports/candidate-research-report.json");

    const comparison = compareCompatibilityReports(baseline, candidate);

    expect(comparison.summary.riskChange).toEqual({
      from: "medium",
      to: "high",
      direction: "increased"
    });
    expect(comparison.summary.addedCount).toBe(1);
    expect(comparison.summary.removedCount).toBe(1);
    expect(comparison.summary.changedCount).toBe(2);
    expect(comparison.summary.unchangedCount).toBe(1);
    expect(comparison.changes.added.map((finding) => finding.id)).toEqual(["trace.logs-calls-visible"]);
    expect(comparison.changes.removed.map((finding) => finding.id)).toEqual(["trace.calldata-heavy-execution"]);
    expect(comparison.changes.changed.map((finding) => finding.id)).toEqual([
      "trace.partial-evidence",
      "trace.state-heavy-execution"
    ]);
    expect(comparison.changes.unchanged.map((finding) => finding.id)).toEqual([
      "trace.contract-creation-executed"
    ]);
  });

  it("renders stable JSON comparison output", () => {
    const comparison = compareCompatibilityReports(
      loadReport("fixtures/reports/baseline-default-report.json"),
      loadReport("fixtures/reports/candidate-research-report.json")
    );

    const json = renderJsonComparisonReport(comparison);
    expect(validateComparisonReport(JSON.parse(json)).summary.changedCount).toBe(2);
    expect(json).toMatchSnapshot();
  });

  it("renders stable Markdown comparison output", () => {
    const comparison = compareCompatibilityReports(
      loadReport("fixtures/reports/baseline-default-report.json"),
      loadReport("fixtures/reports/candidate-research-report.json")
    );

    expect(renderMarkdownComparisonReport(comparison)).toMatchSnapshot();
  });

  it("compares threshold-profile report output without gas deltas", () => {
    const defaultProfile = loadDetectorThresholds(resolve(rootDir, "data/detectors/thresholds.json"));
    const researchProfile = loadDetectorThresholds(resolve(rootDir, "data/detectors/thresholds.research.json"));
    const trace = {
      steps: [
        { op: "CALL", depth: 1, gasCost: 700, calldataBytes: 2048 }
      ]
    };

    const defaultReport = scanTrace(trace, {
      thresholds: defaultProfile,
      targetName: "threshold-profile/default"
    });
    const researchReport = scanTrace(trace, {
      thresholds: researchProfile,
      targetName: "threshold-profile/research"
    });
    const comparison = compareCompatibilityReports(defaultReport, researchReport);

    expect(comparison.changes.added.map((finding) => finding.id)).toContain("trace.calldata-heavy-execution");
    expect(renderJsonComparisonReport(comparison)).not.toContain("gasDelta");
    expect(renderMarkdownComparisonReport(comparison)).not.toContain("Gas delta:");
  });
});

function loadReport(path: string) {
  return validateCompatibilityReport(JSON.parse(readFileSync(resolve(rootDir, path), "utf8")));
}
