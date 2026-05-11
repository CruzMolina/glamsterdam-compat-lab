import {
  TOOL_VERSION,
  comparisonReportSchema,
  compatibilityReportSchema,
  type ChangedFinding,
  type ComparisonDirection,
  type ComparisonField,
  type ComparisonFindingReference,
  type ComparisonReport,
  type CompatibilityFinding,
  type CompatibilityReport,
  type Confidence,
  type Severity
} from "./reportTypes.js";

interface KeyedFinding {
  key: string;
  finding: CompatibilityFinding;
}

const severityRank: Partial<Record<Severity, number>> = {
  low: 0,
  medium: 1,
  high: 2
};

const confidenceRank: Record<Confidence, number> = {
  low: 0,
  medium: 1,
  high: 2
};

export function compareCompatibilityReports(
  baselineInput: CompatibilityReport,
  candidateInput: CompatibilityReport
): ComparisonReport {
  const baseline = compatibilityReportSchema.parse(baselineInput);
  const candidate = compatibilityReportSchema.parse(candidateInput);
  const baselineMap = keyedFindings(baseline.findings);
  const candidateMap = keyedFindings(candidate.findings);
  const keys = [...new Set([...baselineMap.keys(), ...candidateMap.keys()])].sort();

  const added: ComparisonFindingReference[] = [];
  const removed: ComparisonFindingReference[] = [];
  const changed: ChangedFinding[] = [];
  const unchanged: ComparisonFindingReference[] = [];

  for (const key of keys) {
    const baselineFinding = baselineMap.get(key);
    const candidateFinding = candidateMap.get(key);

    if (!baselineFinding && candidateFinding) {
      added.push(toFindingReference(candidateFinding));
      continue;
    }

    if (baselineFinding && !candidateFinding) {
      removed.push(toFindingReference(baselineFinding));
      continue;
    }

    if (!baselineFinding || !candidateFinding) {
      continue;
    }

    const findingChange = compareFinding(baselineFinding, candidateFinding);
    if (findingChange) {
      changed.push(findingChange);
    } else {
      unchanged.push(toFindingReference(candidateFinding));
    }
  }

  const severityChanges = changed.flatMap((finding) => finding.severityChange ? [finding.severityChange] : []);
  const confidenceChanges = changed.flatMap((finding) => finding.confidenceChange ? [finding.confidenceChange] : []);

  return comparisonReportSchema.parse({
    toolVersion: TOOL_VERSION,
    fork: candidate.fork,
    comparison: {
      baseline: toReportReference(baseline),
      candidate: toReportReference(candidate)
    },
    summary: {
      riskChange: {
        from: baseline.summary.risk,
        to: candidate.summary.risk,
        direction: compareSeverity(baseline.summary.risk, candidate.summary.risk)
      },
      findingCount: {
        baseline: baseline.summary.findingCount,
        candidate: candidate.summary.findingCount,
        delta: candidate.summary.findingCount - baseline.summary.findingCount
      },
      addedCount: added.length,
      removedCount: removed.length,
      changedCount: changed.length,
      unchangedCount: unchanged.length,
      severityIncreasedCount: countDirections(severityChanges, "increased"),
      severityDecreasedCount: countDirections(severityChanges, "decreased"),
      severityChangedCount: countDirections(severityChanges, "changed"),
      confidenceIncreasedCount: countDirections(confidenceChanges, "increased"),
      confidenceDecreasedCount: countDirections(confidenceChanges, "decreased"),
      confidenceChangedCount: countDirections(confidenceChanges, "changed")
    },
    changes: {
      added,
      removed,
      changed,
      unchanged
    },
    assumptions: [
      "Reports were compared by finding id. Repeated finding ids are disambiguated with deterministic occurrence suffixes.",
      "Severity and confidence changes are structural report changes, not protocol gas estimates."
    ],
    limitations: [
      "The comparison does not infer exact gas deltas, final Glamsterdam parameters, or current-vs-Glamsterdam client behavior unless those values are already present in the input reports.",
      "Added and removed findings can reflect threshold profile differences, fixture coverage changes, registry updates, or detector changes; review the source reports before treating a diff as a protocol risk change."
    ]
  });
}

function keyedFindings(findings: CompatibilityFinding[]): Map<string, KeyedFinding> {
  const seen = new Map<string, number>();
  const keyed = new Map<string, KeyedFinding>();

  for (const finding of findings) {
    const occurrence = (seen.get(finding.id) ?? 0) + 1;
    seen.set(finding.id, occurrence);
    const key = occurrence === 1 ? finding.id : `${finding.id}#${occurrence}`;
    keyed.set(key, { key, finding });
  }

  return keyed;
}

function compareFinding(baseline: KeyedFinding, candidate: KeyedFinding): ChangedFinding | undefined {
  const changedFields: ComparisonField[] = [];
  const baselineFinding = baseline.finding;
  const candidateFinding = candidate.finding;

  if (baselineFinding.title !== candidateFinding.title) {
    changedFields.push("title");
  }
  if (baselineFinding.severity !== candidateFinding.severity) {
    changedFields.push("severity");
  }
  if (baselineFinding.confidence !== candidateFinding.confidence) {
    changedFields.push("confidence");
  }
  if (!sameStringSet(baselineFinding.domain, candidateFinding.domain)) {
    changedFields.push("domain");
  }
  if (!sameStringSet(baselineFinding.relatedEips, candidateFinding.relatedEips)) {
    changedFields.push("relatedEips");
  }
  if (baselineFinding.description !== candidateFinding.description) {
    changedFields.push("description");
  }
  if (!sameJson(baselineFinding.evidence, candidateFinding.evidence)) {
    changedFields.push("evidence");
  }
  if (baselineFinding.recommendation !== candidateFinding.recommendation) {
    changedFields.push("recommendation");
  }

  if (changedFields.length === 0) {
    return undefined;
  }

  return {
    key: baseline.key,
    id: baselineFinding.id,
    changedFields,
    baseline: toFindingReference(baseline),
    candidate: toFindingReference(candidate),
    severityChange: baselineFinding.severity === candidateFinding.severity
      ? undefined
      : {
          from: baselineFinding.severity,
          to: candidateFinding.severity,
          direction: compareSeverity(baselineFinding.severity, candidateFinding.severity)
        },
    confidenceChange: baselineFinding.confidence === candidateFinding.confidence
      ? undefined
      : {
          from: baselineFinding.confidence,
          to: candidateFinding.confidence,
          direction: compareConfidence(baselineFinding.confidence, candidateFinding.confidence)
        }
  };
}

function toReportReference(report: CompatibilityReport): ComparisonReport["comparison"]["baseline"] {
  return {
    toolVersion: report.toolVersion,
    fork: report.fork,
    target: report.target,
    summary: report.summary
  };
}

function toFindingReference(keyed: KeyedFinding): ComparisonFindingReference {
  const finding = keyed.finding;
  return {
    key: keyed.key,
    id: finding.id,
    title: finding.title,
    severity: finding.severity,
    confidence: finding.confidence,
    domain: finding.domain,
    relatedEips: finding.relatedEips
  };
}

function compareSeverity(from: Severity, to: Severity): ComparisonDirection {
  return compareRank(from, to, severityRank);
}

function compareConfidence(from: Confidence, to: Confidence): ComparisonDirection {
  return compareRank(from, to, confidenceRank);
}

function compareRank<T extends string>(from: T, to: T, ranks: Partial<Record<T, number>>): ComparisonDirection {
  if (from === to) {
    return "unchanged";
  }

  const fromRank = ranks[from];
  const toRank = ranks[to];
  if (fromRank === undefined || toRank === undefined) {
    return "changed";
  }

  return toRank > fromRank ? "increased" : "decreased";
}

function countDirections(changes: { direction: ComparisonDirection }[], direction: ComparisonDirection): number {
  return changes.filter((change) => change.direction === direction).length;
}

function sameStringSet(left: string[], right: string[]): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
