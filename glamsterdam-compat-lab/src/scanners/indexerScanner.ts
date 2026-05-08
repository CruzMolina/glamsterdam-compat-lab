import { detectMissingBalIndexerPlan } from "../detectors/balDetectors.js";
import { detectNativeEthTransferLogReadiness, type IndexerHandlerSummary } from "../detectors/nativeEthTransferLogDetectors.js";
import { domains, makeFinding } from "../detectors/types.js";
import { loadEipRegistry } from "../registry/eipRegistry.js";
import type { EipRegistry } from "../registry/schemas.js";
import { makeReport, type CompatibilityFinding, type CompatibilityReport } from "../reports/reportTypes.js";
import { loadStructuredFile, readTextFile } from "../utils/files.js";

export interface IndexerScanOptions {
  registry?: EipRegistry;
  registryPath?: string;
  targetName?: string;
}

export function scanIndexer(indexerPath: string, options: IndexerScanOptions = {}): CompatibilityReport {
  const registry = options.registry ?? loadEipRegistry(options.registryPath);
  const rawText = readTextFile(indexerPath);
  const parsed = loadStructuredFile(indexerPath);
  const handlerSummary = summarizeHandlers(parsed);
  const context = {
    registry,
    targetName: options.targetName ?? indexerPath
  };

  const findings: CompatibilityFinding[] = [
    ...detectNativeEthTransferLogReadiness(handlerSummary, rawText, context),
    ...detectMissingBalIndexerPlan(rawText, context),
    ...detectMissingCompatibilityMetadata(rawText),
    ...detectMissingReplayPlan(rawText)
  ];

  return makeReport({
    fork: registry.fork,
    target: {
      kind: "indexer",
      name: options.targetName ?? indexerPath
    },
    findings,
    assumptions: [
      "JSON and YAML configs were parsed statically; subgraph-style handler fields were summarized when present.",
      `The loaded registry is dated ${registry.lastUpdated}. Glamsterdam scope and gas parameters may change.`
    ],
    limitations: [
      "Static indexer configuration cannot prove runtime indexing behavior.",
      "Heuristics may miss compatibility logic implemented in code, environment variables, infrastructure manifests, or downstream pipelines.",
      "Findings marked heuristic should be treated as review prompts."
    ]
  });
}

export function summarizeHandlers(config: unknown): IndexerHandlerSummary {
  const dataSources = findArraysByKey(config, "dataSources").flat();
  const templates = findArraysByKey(config, "templates").flat();
  const sources = [...dataSources, ...templates].filter(isRecord);

  if (sources.length === 0) {
    return {
      eventHandlers: countArraysByKey(config, "eventHandlers"),
      callHandlers: countArraysByKey(config, "callHandlers"),
      blockHandlers: countArraysByKey(config, "blockHandlers")
    };
  }

  return sources.reduce<IndexerHandlerSummary>(
    (summary, source) => {
      const mapping = isRecord(source.mapping) ? source.mapping : source;
      summary.eventHandlers += arrayLength(mapping.eventHandlers);
      summary.callHandlers += arrayLength(mapping.callHandlers);
      summary.blockHandlers += arrayLength(mapping.blockHandlers);
      return summary;
    },
    { eventHandlers: 0, callHandlers: 0, blockHandlers: 0 }
  );
}

function detectMissingCompatibilityMetadata(rawText: string): CompatibilityFinding[] {
  const lower = rawText.toLowerCase();
  const hasMetadata = lower.includes("glamsterdam")
    || lower.includes("eip")
    || lower.includes("fork")
    || lower.includes("compatibility");

  if (hasMetadata) {
    return [];
  }

  return [
    makeFinding({
      id: "indexer.missing-fork-compatibility-metadata",
      title: "No explicit fork or EIP compatibility metadata found",
      severity: "medium",
      confidence: "medium",
      domain: domains("indexer", "tooling"),
      relatedEips: ["EIP-7928", "EIP-7708"],
      description:
        "The config does not include explicit Glamsterdam, fork, or EIP compatibility metadata. That may be fine for older configs, but it makes readiness tracking harder.",
      evidence: ["No Glamsterdam/fork/EIP/compatibility marker found in configuration text."],
      recommendation:
        "Add a small compatibility section that records reviewed EIPs, replay status, testnet/devnet coverage, and owner notes."
    })
  ];
}

function detectMissingReplayPlan(rawText: string): CompatibilityFinding[] {
  const lower = rawText.toLowerCase();
  const hasReplayPlan = lower.includes("replay")
    || lower.includes("testnet")
    || lower.includes("devnet")
    || lower.includes("fork test")
    || lower.includes("fork-test");

  if (hasReplayPlan) {
    return [];
  }

  return [
    makeFinding({
      id: "indexer.missing-replay-plan",
      title: "No replay, testnet, or devnet plan found",
      severity: "medium",
      confidence: "medium",
      domain: domains("indexer", "monitoring"),
      relatedEips: ["EIP-7928", "EIP-7708", "GAS-REPRICING"],
      description:
        "The config does not mention a replay or testnet/devnet plan. Indexer compatibility is usually validated by replaying representative data rather than by static config alone.",
      evidence: ["No replay/testnet/devnet marker found in configuration text."],
      recommendation:
        "Add a replay plan that covers historical sync, recent blocks, expected reorg behavior, native ETH transfer handling, and BAL-related block data."
    })
  ];
}

function countArraysByKey(value: unknown, key: string): number {
  return findArraysByKey(value, key).reduce((total, array) => total + array.length, 0);
}

function findArraysByKey(value: unknown, key: string): unknown[][] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => findArraysByKey(item, key));
  }

  if (!isRecord(value)) {
    return [];
  }

  const own = Array.isArray(value[key]) ? [value[key] as unknown[]] : [];
  const nested = Object.values(value).flatMap((child) => findArraysByKey(child, key));
  return [...own, ...nested];
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
