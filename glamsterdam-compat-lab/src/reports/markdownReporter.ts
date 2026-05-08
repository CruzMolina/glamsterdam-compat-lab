import type { CompatibilityFinding, CompatibilityReport } from "./reportTypes.js";

export function renderMarkdownReport(report: CompatibilityReport): string {
  const lines: string[] = [];

  lines.push("# Glamsterdam Compatibility Report");
  lines.push("");
  lines.push(`Target: ${report.target.kind} ${report.target.name}`);
  lines.push(`Tool version: ${report.toolVersion}`);
  lines.push(`Fork registry: ${report.fork}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`Overall risk: ${formatInlineSeverity(report.summary.risk)}`);
  lines.push(
    `Findings: ${report.summary.findingCount} total, ${report.summary.highCount} high, ${report.summary.mediumCount} medium, ${report.summary.lowCount} low, ${report.summary.unknownCount} unknown`
  );
  lines.push("");
  lines.push("## Findings");
  lines.push("");

  if (report.findings.length === 0) {
    lines.push("No findings were produced by this scanner.");
    lines.push("");
  } else {
    report.findings.forEach((finding, index) => {
      lines.push(renderFinding(finding, index + 1));
    });
  }

  lines.push("## Assumptions");
  lines.push("");
  pushList(lines, report.assumptions, "No explicit assumptions were recorded.");
  lines.push("");
  lines.push("## Limitations");
  lines.push("");
  pushList(lines, report.limitations, "No limitations were recorded.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderFinding(finding: CompatibilityFinding, index: number): string {
  const lines: string[] = [];
  lines.push(`### ${index}. ${finding.title}`);
  lines.push("");
  lines.push(`Severity: ${formatInlineSeverity(finding.severity)}`);
  lines.push(`Confidence: ${finding.confidence}`);
  lines.push(`Domains: ${finding.domain.join(", ")}`);
  lines.push(`Related EIPs: ${finding.relatedEips.length > 0 ? finding.relatedEips.join(", ") : "none"}`);
  lines.push("");
  lines.push(finding.description);
  lines.push("");

  if (finding.evidence.length > 0) {
    lines.push("Evidence:");
    for (const item of finding.evidence) {
      lines.push(`- ${formatEvidence(item)}`);
    }
    lines.push("");
  }

  lines.push(`Recommendation: ${finding.recommendation}`);
  lines.push("");
  return lines.join("\n");
}

function pushList(lines: string[], items: string[], emptyText: string): void {
  if (items.length === 0) {
    lines.push(emptyText);
    return;
  }

  for (const item of items) {
    lines.push(`- ${item}`);
  }
}

function formatEvidence(item: unknown): string {
  if (typeof item === "string") {
    return item;
  }
  return JSON.stringify(item);
}

function formatInlineSeverity(value: string): string {
  return value.toUpperCase();
}
