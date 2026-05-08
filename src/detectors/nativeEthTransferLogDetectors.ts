import { domains, makeFinding, relatedEipsForDetector, type DetectorContext } from "./types.js";
import type { CompatibilityFinding } from "../reports/reportTypes.js";

export interface IndexerHandlerSummary {
  eventHandlers: number;
  callHandlers: number;
  blockHandlers: number;
}

export function detectNativeEthTransferLogReadiness(
  summary: IndexerHandlerSummary,
  configText: string,
  context: DetectorContext
): CompatibilityFinding[] {
  const lower = configText.toLowerCase();
  const mentionsBalanceDiff = lower.includes("balance diff")
    || lower.includes("balance-diff")
    || lower.includes("balancediff");
  const mentionsNativeTransfers = lower.includes("native eth")
    || lower.includes("eth transfer")
    || lower.includes("eip-7708")
    || mentionsBalanceDiff;

  const findings: CompatibilityFinding[] = [];
  const relatedEips = relatedEipsForDetector(context.registry, "nativeEthTransferLogDetectors", ["EIP-7708"]);

  if (summary.eventHandlers > 0 && summary.callHandlers === 0 && summary.blockHandlers === 0) {
    findings.push(
      makeFinding({
        id: "indexer.event-only-assumption",
        title: "Indexer appears to rely on event-only handlers",
        severity: "medium",
        confidence: "medium",
        domain: domains("indexer"),
        relatedEips,
        description:
          "This looks like an event-only indexer configuration. Event-only pipelines should be reviewed for native ETH transfer visibility, balance-diff assumptions, and fork-specific log semantics if related EIPs remain active or considered.",
        evidence: summary,
        recommendation:
          "Document how native ETH transfers are represented today, how they would be represented if transfer-log proposals are included, and how historical replay would be validated."
      })
    );
  }

  if (mentionsBalanceDiff) {
    findings.push(
      makeFinding({
        id: "indexer.balance-diff-native-transfer-assumption",
        title: "Indexer mentions balance-diff based native transfer handling",
        severity: "medium",
        confidence: "medium",
        domain: domains("indexer", "monitoring"),
        relatedEips,
        description:
          "The configuration mentions balance-diff based transfer handling. That can be a valid design, but it should be reviewed if native ETH transfer log proposals remain active or considered.",
        evidence: ["Balance-diff marker found in configuration text."],
        recommendation:
          "Document whether native ETH transfers come from logs, balance diffs, traces, receipts, or a combined pipeline, and add replay tests for representative transfer cases."
      })
    );
  }

  if (!mentionsNativeTransfers) {
    findings.push(
      makeFinding({
        id: "indexer.native-eth-transfer-review-missing",
        title: "No native ETH transfer handling metadata found",
        severity: "unknown",
        confidence: "low",
        domain: domains("indexer", "monitoring"),
        relatedEips,
        description:
          "The configuration does not mention native ETH transfers, balance diffs, or EIP-7708. Static config cannot determine whether the runtime indexer already handles this elsewhere.",
        evidence: ["No native-transfer marker found in configuration text."],
        recommendation:
          "Add an explicit compatibility note or test plan for native ETH transfers, especially if dashboards or alerts currently infer transfers from balance diffs."
      })
    );
  }

  return findings;
}
