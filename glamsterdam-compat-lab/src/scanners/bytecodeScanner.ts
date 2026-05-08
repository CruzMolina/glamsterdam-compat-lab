import { detectContractSize } from "../detectors/contractSizeDetectors.js";
import { detectBytecodeGasRepricingExposure } from "../detectors/gasRepricingDetectors.js";
import { detectBytecodeStateCreation } from "../detectors/stateCreationDetectors.js";
import { domains, makeFinding } from "../detectors/types.js";
import { loadEipRegistry } from "../registry/eipRegistry.js";
import type { EipRegistry } from "../registry/schemas.js";
import { makeReport, type CompatibilityFinding, type CompatibilityReport } from "../reports/reportTypes.js";
import { byteLength, countOpcodeNames, disassembleBytecode, normalizeBytecode, opcodeCount } from "../utils/bytecode.js";
import { readPathOrValue } from "../utils/files.js";

export interface BytecodeScanOptions {
  registry?: EipRegistry;
  registryPath?: string;
  targetName?: string;
}

export function scanBytecode(pathOrHex: string, options: BytecodeScanOptions = {}): CompatibilityReport {
  const registry = options.registry ?? loadEipRegistry(options.registryPath);
  const source = readPathOrValue(pathOrHex);
  const normalized = normalizeBytecode(source.text);
  const opcodes = disassembleBytecode(normalized);
  const opcodeCounts = countOpcodeNames(opcodes);
  const sizeBytes = byteLength(normalized);
  const context = {
    registry,
    targetName: options.targetName ?? source.name
  };

  const findings: CompatibilityFinding[] = [
    ...detectContractSize(sizeBytes, context),
    ...detectBytecodeGasRepricingExposure(opcodeCounts, context),
    ...detectBytecodeStateCreation(opcodeCounts, context),
    ...detectStoragePattern(opcodeCounts),
    ...detectLogPattern(opcodeCounts),
    makeManualReviewFinding(sizeBytes, opcodeCounts)
  ];

  return makeReport({
    fork: registry.fork,
    target: {
      kind: "bytecode",
      name: options.targetName ?? source.name
    },
    findings,
    assumptions: [
      "Input was interpreted as EVM bytecode after removing whitespace and an optional 0x prefix.",
      `The loaded registry is dated ${registry.lastUpdated}. Glamsterdam scope and gas parameters may change.`
    ],
    limitations: [
      "Static bytecode scanning cannot determine which branches are executed in production.",
      "Opcode counts are not gas estimates and do not include dynamic call targets, storage keys, calldata sizes, or transaction context.",
      "Findings are compatibility prompts, not predictions that a contract will fail."
    ]
  });
}

function detectStoragePattern(opcodeCounts: Record<string, number>): CompatibilityFinding[] {
  const storageOps = opcodeCount(opcodeCounts, ["SLOAD", "SSTORE"]);

  if (storageOps >= 8) {
    return [
      makeFinding({
        id: "bytecode.storage-heavy-pattern",
        title: "Storage-related opcodes appear frequently",
        severity: "medium",
        confidence: "medium",
        domain: domains("contracts", "execution"),
        relatedEips: ["GAS-REPRICING", "EIP-8038"],
        description:
          "This bytecode contains many storage-related opcodes. Glamsterdam gas repricing candidates may change the cost profile of storage-heavy execution.",
        evidence: { SLOAD: opcodeCounts.SLOAD ?? 0, SSTORE: opcodeCounts.SSTORE ?? 0, storageOps },
        recommendation:
          "Replay representative storage-heavy transactions against a Glamsterdam devnet or fork configuration when available."
      })
    ];
  }

  return [];
}

function detectLogPattern(opcodeCounts: Record<string, number>): CompatibilityFinding[] {
  const logOps = opcodeCount(opcodeCounts, ["LOG0", "LOG1", "LOG2", "LOG3", "LOG4"]);

  if (logOps === 0) {
    return [];
  }

  return [
    makeFinding({
      id: "bytecode.log-opcodes-present",
      title: "Log opcodes are present",
      severity: "low",
      confidence: "medium",
      domain: domains("contracts", "indexer", "monitoring"),
      relatedEips: ["EIP-7708"],
      description:
        "The bytecode can emit logs. Indexers and monitoring systems should include representative log-emitting transactions when testing Glamsterdam-era assumptions.",
      evidence: {
        LOG0: opcodeCounts.LOG0 ?? 0,
        LOG1: opcodeCounts.LOG1 ?? 0,
        LOG2: opcodeCounts.LOG2 ?? 0,
        LOG3: opcodeCounts.LOG3 ?? 0,
        LOG4: opcodeCounts.LOG4 ?? 0
      },
      recommendation:
        "Include log-emitting paths in trace replay and indexer regression tests, especially where native ETH transfer visibility matters."
    })
  ];
}

function makeManualReviewFinding(sizeBytes: number, opcodeCounts: Record<string, number>): CompatibilityFinding {
  return makeFinding({
    id: "bytecode.manual-review-required",
    title: "Manual review is still required for runtime behavior",
    severity: "unknown",
    confidence: "low",
    domain: domains("contracts", "execution"),
    relatedEips: ["GAS-REPRICING"],
    description:
      "The scanner found static opcode evidence, but exact fork impact depends on executed paths, calldata, storage warmness, account state, compiler output, and final Glamsterdam parameters.",
    evidence: { byteLength: sizeBytes, opcodeKinds: Object.keys(opcodeCounts).length },
    recommendation:
      "Use this report to choose transactions for trace replay and benchmark them under current and Glamsterdam configurations."
  });
}
