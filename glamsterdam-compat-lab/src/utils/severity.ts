import type { Severity } from "../reports/reportTypes.js";

const severityRank: Record<Severity, number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3
};

export function highestSeverity(values: Severity[]): Severity {
  if (values.length === 0) {
    return "low";
  }

  return values.reduce((highest, current) =>
    severityRank[current] > severityRank[highest] ? current : highest
  );
}
