import { domains, makeFinding, relatedEipsForDetector, type DetectorContext } from "./types.js";
import type { CompatibilityFinding } from "../reports/reportTypes.js";

export interface BuilderConfigEvidence {
  builderEnabled?: unknown;
  builderEndpoint?: unknown;
}

export function detectEpbsBuilderReadiness(
  evidence: BuilderConfigEvidence,
  context: DetectorContext
): CompatibilityFinding[] {
  const findings: CompatibilityFinding[] = [];
  const relatedEips = relatedEipsForDetector(context.registry, "epbsDetectors", ["EIP-7732"]);

  if (evidence.builderEnabled === undefined) {
    findings.push(
      makeFinding({
        id: "validator.missing-builder-metadata",
        title: "Builder/API configuration metadata is missing",
        severity: "medium",
        confidence: "high",
        domain: domains("validator", "builder", "consensus"),
        relatedEips,
        description:
          "The operator config does not say whether builder/API functionality is enabled. ePBS readiness requires operators to know which builder-related settings are intentional.",
        evidence,
        recommendation:
          "Record whether builder integration is enabled, disabled, or intentionally not applicable, and include the endpoint metadata used in staging/testnet environments."
      })
    );
  }

  if (evidence.builderEnabled === true && !evidence.builderEndpoint) {
    findings.push(
      makeFinding({
        id: "validator.builder-enabled-without-endpoint",
        title: "Builder integration is enabled but no endpoint is configured",
        severity: "medium",
        confidence: "high",
        domain: domains("validator", "builder", "consensus"),
        relatedEips,
        description:
          "The config marks builder integration as enabled but does not include an endpoint. This may simply mean the local config is incomplete, so the scanner treats it as a readiness checklist item.",
        evidence,
        recommendation:
          "Add the intended builder endpoint or document why endpoint configuration is managed elsewhere."
      })
    );
  }

  return findings;
}
