import { describe, expect, it } from "vitest";
import { renderJsonReport } from "../src/reports/jsonReporter.js";
import { renderMarkdownReport } from "../src/reports/markdownReporter.js";
import { makeReport, validateCompatibilityReport } from "../src/reports/reportTypes.js";

describe("reporters", () => {
  const report = makeReport({
    target: {
      kind: "bytecode",
      name: "inline-bytecode"
    },
    findings: [
      {
        id: "test.finding",
        title: "Test finding",
        severity: "medium",
        confidence: "high",
        domain: ["contracts"],
        relatedEips: ["GAS-REPRICING"],
        description: "A deterministic test finding.",
        evidence: [{ value: 1 }],
        recommendation: "Run the test."
      }
    ],
    assumptions: ["Assumption one."],
    limitations: ["Limitation one."]
  });

  it("renders Markdown with summary, findings, assumptions, and limitations", () => {
    const markdown = renderMarkdownReport(report);

    expect(markdown).toContain("## Summary");
    expect(markdown).toContain("## Findings");
    expect(markdown).toContain("## Assumptions");
    expect(markdown).toContain("## Limitations");
    expect(markdown).toContain("Test finding");
  });

  it("renders valid JSON report schema", () => {
    const json = renderJsonReport(report);
    const parsed = validateCompatibilityReport(JSON.parse(json));

    expect(parsed.summary.risk).toBe("medium");
    expect(parsed.findings).toHaveLength(1);
  });
});
