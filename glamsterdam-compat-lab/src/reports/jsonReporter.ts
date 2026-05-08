import { compatibilityReportSchema, type CompatibilityReport } from "./reportTypes.js";

export function renderJsonReport(report: CompatibilityReport): string {
  return `${JSON.stringify(compatibilityReportSchema.parse(report), null, 2)}\n`;
}
