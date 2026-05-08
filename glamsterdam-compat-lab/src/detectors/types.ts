import type { EipRegistry } from "../registry/schemas.js";
import type { CompatibilityFinding, ReportDomain } from "../reports/reportTypes.js";

export type FindingInput = Omit<CompatibilityFinding, "relatedEips" | "evidence"> & {
  relatedEips?: string[];
  evidence?: unknown[] | unknown;
};

export interface DetectorContext {
  registry: EipRegistry;
  targetName: string;
}

export function relatedEipsForDetector(
  registry: EipRegistry,
  detectorName: string,
  preferredIds: string[] = []
): string[] {
  const registryIds = registry.eips
    .filter((entry) => entry.detectors.includes(detectorName))
    .map((entry) => entry.id);
  const knownIds = new Set(registry.eips.map((entry) => entry.id));
  return [...new Set([...preferredIds.filter((id) => knownIds.has(id)), ...registryIds])];
}

export function makeFinding(input: FindingInput): CompatibilityFinding {
  const evidence = input.evidence === undefined
    ? []
    : Array.isArray(input.evidence)
      ? input.evidence
      : [input.evidence];

  return {
    ...input,
    evidence,
    relatedEips: input.relatedEips ?? []
  };
}

export function domains(...domains: ReportDomain[]): ReportDomain[] {
  return domains;
}
