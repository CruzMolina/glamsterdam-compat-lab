import type {
  ChangedFinding,
  ComparisonDirection,
  ComparisonFindingReference,
  ComparisonReport,
  CompatibilityFinding,
  CompatibilityReport
} from "./reportTypes.js";

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

export function renderMarkdownComparisonReport(report: ComparisonReport): string {
  const lines: string[] = [];

  lines.push("# Glamsterdam Compatibility Comparison");
  lines.push("");
  lines.push(`Baseline: ${formatReportReference(report.comparison.baseline)}`);
  lines.push(`Candidate: ${formatReportReference(report.comparison.candidate)}`);
  lines.push(`Tool version: ${report.toolVersion}`);
  lines.push(`Fork registry: ${report.fork}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(
    `Overall risk: ${formatInlineSeverity(report.summary.riskChange.from)} -> ${formatInlineSeverity(report.summary.riskChange.to)} (${formatDirection(report.summary.riskChange.direction)})`
  );
  lines.push(
    `Findings: ${report.summary.findingCount.baseline} baseline, ${report.summary.findingCount.candidate} candidate, delta ${formatSignedNumber(report.summary.findingCount.delta)}`
  );
  lines.push(
    `Changes: ${report.summary.addedCount} added, ${report.summary.removedCount} removed, ${report.summary.changedCount} changed, ${report.summary.unchangedCount} unchanged`
  );
  lines.push(
    `Severity changes: ${report.summary.severityIncreasedCount} increased, ${report.summary.severityDecreasedCount} decreased, ${report.summary.severityChangedCount} changed`
  );
  lines.push(
    `Confidence changes: ${report.summary.confidenceIncreasedCount} increased, ${report.summary.confidenceDecreasedCount} decreased, ${report.summary.confidenceChangedCount} changed`
  );
  lines.push("");

  renderFindingReferenceSection(lines, "Added Findings", report.changes.added, "No findings were added.");
  renderFindingReferenceSection(lines, "Removed Findings", report.changes.removed, "No findings were removed.");
  renderChangedFindingSection(lines, report.changes.changed);
  renderFindingReferenceSection(lines, "Unchanged Findings", report.changes.unchanged, "No findings were unchanged.");

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

function renderFindingReferenceSection(
  lines: string[],
  title: string,
  findings: ComparisonFindingReference[],
  emptyText: string
): void {
  lines.push(`## ${title}`);
  lines.push("");

  if (findings.length === 0) {
    lines.push(emptyText);
    lines.push("");
    return;
  }

  for (const finding of findings) {
    lines.push(`- ${finding.key}: ${finding.title} (${formatInlineSeverity(finding.severity)}, confidence ${finding.confidence})`);
  }
  lines.push("");
}

function renderChangedFindingSection(lines: string[], findings: ChangedFinding[]): void {
  lines.push("## Changed Findings");
  lines.push("");

  if (findings.length === 0) {
    lines.push("No findings changed.");
    lines.push("");
    return;
  }

  findings.forEach((finding, index) => {
    lines.push(`### ${index + 1}. ${finding.key}: ${finding.candidate.title}`);
    lines.push("");
    lines.push(`Changed fields: ${finding.changedFields.join(", ")}`);
    if (finding.severityChange) {
      lines.push(
        `Severity: ${formatInlineSeverity(finding.severityChange.from)} -> ${formatInlineSeverity(finding.severityChange.to)} (${formatDirection(finding.severityChange.direction)})`
      );
    }
    if (finding.confidenceChange) {
      lines.push(
        `Confidence: ${finding.confidenceChange.from} -> ${finding.confidenceChange.to} (${formatDirection(finding.confidenceChange.direction)})`
      );
    }
    lines.push("");
  });
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

function formatReportReference(report: ComparisonReport["comparison"]["baseline"]): string {
  return `${report.target.kind} ${report.target.name} (${report.summary.risk} risk, ${report.summary.findingCount} findings)`;
}

function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function formatDirection(direction: ComparisonDirection): string {
  return direction;
}
