import { domains, makeFinding, relatedEipsForDetector, type DetectorContext } from "./types.js";
import type { CompatibilityFinding } from "../reports/reportTypes.js";

export function detectBytecodeStateCreation(
  opcodeCounts: Record<string, number>,
  context: DetectorContext
): CompatibilityFinding[] {
  const createCount = (opcodeCounts.CREATE ?? 0) + (opcodeCounts.CREATE2 ?? 0);

  if (createCount === 0) {
    return [];
  }

  return [
    makeFinding({
      id: "bytecode.contract-creation-opcodes",
      title: "Contract creation opcodes are present",
      severity: "medium",
      confidence: "high",
      domain: domains("contracts", "execution"),
      relatedEips: relatedEipsForDetector(context.registry, "stateCreationDetectors", [
        "GAS-REPRICING",
        "EIP-8037"
      ]),
      description:
        "CREATE or CREATE2 appears in the bytecode. State-creation repricing candidates may affect factory, clone, deployment, or account-creation-heavy paths depending on final Glamsterdam scope.",
      evidence: { CREATE: opcodeCounts.CREATE ?? 0, CREATE2: opcodeCounts.CREATE2 ?? 0 },
      recommendation:
        "Identify representative deployment/factory transactions and add them to fork-readiness replay tests."
    })
  ];
}

export function detectTraceStateCreation(
  opcodeCounts: Record<string, number>,
  context: DetectorContext
): CompatibilityFinding[] {
  const createCount = (opcodeCounts.CREATE ?? 0) + (opcodeCounts.CREATE2 ?? 0);

  if (createCount === 0) {
    return [];
  }

  return [
    makeFinding({
      id: "trace.contract-creation-executed",
      title: "Trace executed contract creation",
      severity: "medium",
      confidence: "high",
      domain: domains("contracts", "execution"),
      relatedEips: relatedEipsForDetector(context.registry, "stateCreationDetectors", [
        "GAS-REPRICING",
        "EIP-8037"
      ]),
      description:
        "The trace executed CREATE or CREATE2. This is direct evidence that this transaction class exercises state creation.",
      evidence: { CREATE: opcodeCounts.CREATE ?? 0, CREATE2: opcodeCounts.CREATE2 ?? 0 },
      recommendation:
        "Replay creation-heavy flows against Glamsterdam test environments and verify gas budgeting, relayer assumptions, and deployment automation."
    })
  ];
}
