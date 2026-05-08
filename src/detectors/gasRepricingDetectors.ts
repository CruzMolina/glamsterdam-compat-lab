import { domains, makeFinding, relatedEipsForDetector, type DetectorContext } from "./types.js";
import type { CompatibilityFinding } from "../reports/reportTypes.js";
import { opcodeCount } from "../utils/bytecode.js";

const stateAndAccountOpcodes = [
  "SLOAD",
  "SSTORE",
  "BALANCE",
  "EXTCODESIZE",
  "EXTCODECOPY",
  "EXTCODEHASH",
  "SELFBALANCE",
  "SHA3"
];

export function detectBytecodeGasRepricingExposure(
  opcodeCounts: Record<string, number>,
  context: DetectorContext
): CompatibilityFinding[] {
  const sensitiveCount = opcodeCount(opcodeCounts, stateAndAccountOpcodes);
  const calldataCopyCount = opcodeCounts.CALLDATACOPY ?? 0;
  const thresholds = context.thresholds.bytecode.stateAccountOpcodeExposure;
  const findings: CompatibilityFinding[] = [];
  const relatedEips = relatedEipsForDetector(context.registry, "gasRepricingDetectors", [
    "GAS-REPRICING",
    "EIP-7904",
    "EIP-8038"
  ]);

  if (sensitiveCount >= thresholds.mediumSensitiveOpcodeCount) {
    findings.push(
      makeFinding({
        id: "bytecode.state-account-opcode-exposure",
        title: "State and account access opcodes are prominent in bytecode",
        severity: "medium",
        confidence: "medium",
        domain: domains("contracts", "execution"),
        relatedEips,
        description:
          "This bytecode contains multiple storage, account, or hashing opcodes. Glamsterdam gas repricing candidates may change the cost profile of state-heavy execution, but static bytecode does not prove those paths are hot.",
        evidence: { sensitiveOpcodeCount: sensitiveCount, opcodeCounts: pick(opcodeCounts, stateAndAccountOpcodes) },
        recommendation:
          "Replay representative transactions and benchmark hot paths once a Glamsterdam client/devnet or local fork configuration is available."
      })
    );
  } else if (sensitiveCount >= thresholds.lowSensitiveOpcodeCount) {
    findings.push(
      makeFinding({
        id: "bytecode.state-account-opcode-presence",
        title: "State and account access opcodes are present",
        severity: "low",
        confidence: "medium",
        domain: domains("contracts", "execution"),
        relatedEips,
        description:
          "This bytecode contains some opcodes that are commonly involved in gas repricing discussions. The scan cannot determine execution frequency.",
        evidence: { sensitiveOpcodeCount: sensitiveCount, opcodeCounts: pick(opcodeCounts, stateAndAccountOpcodes) },
        recommendation:
          "Include transactions that exercise these paths in fork-readiness tests."
      })
    );
  }

  if (calldataCopyCount > 0) {
    findings.push(
      makeFinding({
        id: "bytecode.calldata-copy-exposure",
        title: "Calldata copy opcode is present",
        severity: "low",
        confidence: "medium",
        domain: domains("contracts", "execution"),
        relatedEips: relatedEipsForDetector(context.registry, "gasRepricingDetectors", [
          "GAS-REPRICING",
          "EIP-7976"
        ]),
        description:
          "CALLDATACOPY appears in the bytecode. Calldata-related repricing candidates should be tested if this contract processes large calldata in production.",
        evidence: { CALLDATACOPY: calldataCopyCount },
        recommendation:
          "Add large-calldata cases to benchmarks and trace replay when final Glamsterdam parameters are known."
      })
    );
  }

  return findings;
}

export function detectTraceGasRepricingExposure(
  opcodeCounts: Record<string, number>,
  calldataBytes: number,
  context: DetectorContext
): CompatibilityFinding[] {
  const storageOps = opcodeCount(opcodeCounts, ["SLOAD", "SSTORE"]);
  const sensitiveCount = opcodeCount(opcodeCounts, stateAndAccountOpcodes);
  const stateThresholds = context.thresholds.trace.stateHeavyExecution;
  const calldataThresholds = context.thresholds.trace.calldataHeavy;
  const findings: CompatibilityFinding[] = [];

  if (
    storageOps >= stateThresholds.highStorageOps
    || sensitiveCount >= stateThresholds.highSensitiveOpcodeCount
  ) {
    findings.push(
      makeFinding({
        id: "trace.state-heavy-execution-high",
        title: "Trace shows high state-heavy execution",
        severity: "high",
        confidence: "high",
        domain: domains("contracts", "execution"),
        relatedEips: relatedEipsForDetector(context.registry, "gasRepricingDetectors", [
          "GAS-REPRICING",
          "EIP-7904",
          "EIP-8038"
        ]),
        description:
          "The executed trace contains many storage or state/account access operations. This is direct execution evidence and should be prioritized for fork-readiness benchmarking.",
        evidence: { storageOps, sensitiveOpcodeCount: sensitiveCount, opcodeCounts: pick(opcodeCounts, stateAndAccountOpcodes) },
        recommendation:
          "Replay this transaction class against a Glamsterdam devnet or fork configuration and compare gas, latency, and failure behavior with current mainnet rules."
      })
    );
  } else if (
    storageOps >= stateThresholds.mediumStorageOps
    || sensitiveCount >= stateThresholds.mediumSensitiveOpcodeCount
  ) {
    findings.push(
      makeFinding({
        id: "trace.state-heavy-execution-medium",
        title: "Trace shows state-heavy execution",
        severity: "medium",
        confidence: "high",
        domain: domains("contracts", "execution"),
        relatedEips: relatedEipsForDetector(context.registry, "gasRepricingDetectors", [
          "GAS-REPRICING",
          "EIP-7904",
          "EIP-8038"
        ]),
        description:
          "The executed trace includes repeated storage or state/account access operations. Glamsterdam repricing candidates may affect this cost profile, depending on final fork scope.",
        evidence: { storageOps, sensitiveOpcodeCount: sensitiveCount, opcodeCounts: pick(opcodeCounts, stateAndAccountOpcodes) },
        recommendation:
          "Keep this trace as a regression fixture and replay it when final Glamsterdam client configurations are available."
      })
    );
  }

  if ((opcodeCounts.CALLDATACOPY ?? 0) > 0 || calldataBytes >= calldataThresholds.mediumCalldataBytes) {
    findings.push(
      makeFinding({
        id: "trace.calldata-heavy-execution",
        title: "Trace includes visible calldata-heavy execution",
        severity: calldataBytes >= calldataThresholds.mediumCalldataBytes ? "medium" : "low",
        confidence: calldataBytes > 0 ? "high" : "medium",
        domain: domains("contracts", "execution"),
        relatedEips: relatedEipsForDetector(context.registry, "gasRepricingDetectors", [
          "GAS-REPRICING",
          "EIP-7976"
        ]),
        description:
          "The trace includes CALLDATACOPY or explicit calldata byte counts. Calldata repricing candidates are considered registry items, so large input paths should be tested.",
        evidence: { CALLDATACOPY: opcodeCounts.CALLDATACOPY ?? 0, calldataBytes },
        recommendation:
          "Replay large-input transactions and compare gas envelopes once a Glamsterdam configuration is available."
      })
    );
  }

  return findings;
}

function pick(record: Record<string, number>, keys: string[]): Record<string, number> {
  return keys.reduce<Record<string, number>>((selected, key) => {
    if (record[key] !== undefined) {
      selected[key] = record[key];
    }
    return selected;
  }, {});
}
