import { domains, makeFinding, relatedEipsForDetector, type DetectorContext } from "./types.js";
import type { CompatibilityFinding } from "../reports/reportTypes.js";

const currentRuntimeLimitBytes = 24_576;

export function detectContractSize(byteLength: number, context: DetectorContext): CompatibilityFinding[] {
  const relatedEips = relatedEipsForDetector(context.registry, "contractSizeDetectors", ["EIP-7954"]);

  if (byteLength > currentRuntimeLimitBytes) {
    return [
      makeFinding({
        id: "bytecode.contract-size-over-current-limit",
        title: "Bytecode exceeds the current deployed contract size limit",
        severity: "high",
        confidence: "high",
        domain: domains("contracts", "execution"),
        relatedEips,
        description:
          "The bytecode is larger than the current EIP-170 deployed runtime size limit. Glamsterdam includes considered work around contract-size limits, but this scanner does not assume a final new limit.",
        evidence: [{ byteLength, currentRuntimeLimitBytes }],
        recommendation:
          "Confirm whether this input is runtime bytecode or init code. Track the registry entry for contract-size changes and test deployment/runtime behavior against a Glamsterdam devnet or fork configuration when available."
      })
    ];
  }

  if (byteLength >= 20_000) {
    return [
      makeFinding({
        id: "bytecode.contract-size-near-current-limit",
        title: "Bytecode is near the current deployed contract size limit",
        severity: "medium",
        confidence: "high",
        domain: domains("contracts", "execution"),
        relatedEips,
        description:
          "The bytecode is close to today's deployed runtime size limit. Contract-size proposals may change what is possible, but large bytecode still deserves deployment and tooling review.",
        evidence: [{ byteLength, currentRuntimeLimitBytes }],
        recommendation:
          "Add this contract to fork-readiness tests and verify deployment, verification, explorer, and build-pipeline behavior under any Glamsterdam devnet configuration."
      })
    ];
  }

  return [];
}
