import {
  compatibilityReportSchema,
  comparisonReportSchema,
  type ComparisonReport,
  type CompatibilityReport
} from "./reportTypes.js";

export function renderJsonReport(report: CompatibilityReport): string {
  return `${JSON.stringify(compatibilityReportSchema.parse(report), null, 2)}\n`;
}

export function renderJsonComparisonReport(report: ComparisonReport): string {
  return `${JSON.stringify(comparisonReportSchema.parse(report), null, 2)}\n`;
}
