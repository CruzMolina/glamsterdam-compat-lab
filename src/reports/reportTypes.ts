import { z } from "zod";

export const TOOL_VERSION = "0.2.2";

export const severitySchema = z.enum(["low", "medium", "high", "unknown"]);
export const confidenceSchema = z.enum(["low", "medium", "high"]);
export const reportDomainSchema = z.enum([
  "contracts",
  "indexer",
  "validator",
  "monitoring",
  "execution",
  "consensus",
  "networking",
  "builder",
  "tooling"
]);

export const targetKindSchema = z.enum([
  "bytecode",
  "trace",
  "indexer",
  "validator",
  "combined"
]);

export const findingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  severity: severitySchema,
  confidence: confidenceSchema,
  domain: z.array(reportDomainSchema).min(1),
  relatedEips: z.array(z.string()).default([]),
  description: z.string().min(1),
  evidence: z.array(z.unknown()).default([]),
  recommendation: z.string().min(1)
});

export const reportSummarySchema = z.object({
  risk: severitySchema,
  findingCount: z.number().int().nonnegative(),
  highCount: z.number().int().nonnegative(),
  mediumCount: z.number().int().nonnegative(),
  lowCount: z.number().int().nonnegative(),
  unknownCount: z.number().int().nonnegative()
});

export const compatibilityReportSchema = z.object({
  toolVersion: z.string().min(1),
  fork: z.string().min(1),
  target: z.object({
    kind: targetKindSchema,
    name: z.string().min(1)
  }),
  summary: reportSummarySchema,
  findings: z.array(findingSchema),
  assumptions: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([])
});

export type Severity = z.infer<typeof severitySchema>;
export type Confidence = z.infer<typeof confidenceSchema>;
export type ReportDomain = z.infer<typeof reportDomainSchema>;
export type TargetKind = z.infer<typeof targetKindSchema>;
export type CompatibilityFinding = z.infer<typeof findingSchema>;
export type CompatibilityReport = z.infer<typeof compatibilityReportSchema>;

export interface MakeReportInput {
  fork?: string;
  target: CompatibilityReport["target"];
  findings: CompatibilityFinding[];
  assumptions?: string[];
  limitations?: string[];
}

export function summarizeFindings(findings: CompatibilityFinding[]): CompatibilityReport["summary"] {
  const highCount = findings.filter((finding) => finding.severity === "high").length;
  const mediumCount = findings.filter((finding) => finding.severity === "medium").length;
  const lowCount = findings.filter((finding) => finding.severity === "low").length;
  const unknownCount = findings.filter((finding) => finding.severity === "unknown").length;
  const risk: Severity = highCount > 0
    ? "high"
    : mediumCount > 0
      ? "medium"
      : lowCount > 0
        ? "low"
        : unknownCount > 0
          ? "unknown"
          : "low";

  return {
    risk,
    findingCount: findings.length,
    highCount,
    mediumCount,
    lowCount,
    unknownCount
  };
}

export function makeReport(input: MakeReportInput): CompatibilityReport {
  return compatibilityReportSchema.parse({
    toolVersion: TOOL_VERSION,
    fork: input.fork ?? "glamsterdam",
    target: input.target,
    summary: summarizeFindings(input.findings),
    findings: input.findings,
    assumptions: input.assumptions ?? [],
    limitations: input.limitations ?? []
  });
}

export function validateCompatibilityReport(value: unknown): CompatibilityReport {
  return compatibilityReportSchema.parse(value);
}

export function combineReports(reports: CompatibilityReport[]): CompatibilityReport {
  const findings = reports.flatMap((report) =>
    report.findings.map((finding) => ({
      ...finding,
      id: `${report.target.kind}.${finding.id}`,
      evidence: [`Source report: ${report.target.kind} ${report.target.name}`, ...finding.evidence]
    }))
  );

  return makeReport({
    fork: reports[0]?.fork ?? "glamsterdam",
    target: {
      kind: "combined",
      name: `${reports.length} report${reports.length === 1 ? "" : "s"}`
    },
    findings,
    assumptions: dedupe(reports.flatMap((report) => report.assumptions)),
    limitations: dedupe(reports.flatMap((report) => report.limitations))
  });
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
