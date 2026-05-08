import { domains, makeFinding, relatedEipsForDetector, type DetectorContext } from "./types.js";
import type { CompatibilityFinding } from "../reports/reportTypes.js";

export function detectMissingBalIndexerPlan(configText: string, context: DetectorContext): CompatibilityFinding[] {
  const lower = configText.toLowerCase();
  const mentionsBal = lower.includes("block-level access")
    || lower.includes("block level access")
    || lower.includes("blocklevelaccess")
    || lower.includes("eip-7928")
    || /\bbals?\b/.test(lower);

  if (mentionsBal) {
    return [];
  }

  return [
    makeFinding({
      id: "indexer.missing-bal-readiness-metadata",
      title: "No explicit Block-Level Access List readiness metadata found",
      severity: "medium",
      confidence: "medium",
      domain: domains("indexer", "monitoring"),
      relatedEips: relatedEipsForDetector(context.registry, "balDetectors", ["EIP-7928"]),
      description:
        "The configuration does not mention BALs or EIP-7928. Static config cannot prove whether the indexer is incompatible, but explorer and indexer teams should explicitly track BAL ingestion and monitoring assumptions.",
      evidence: ["No BAL/EIP-7928 marker found in configuration text."],
      recommendation:
        "Add fork-readiness metadata documenting whether BAL-related block data is ignored, stored, displayed, monitored, or replay-tested."
    })
  ];
}
