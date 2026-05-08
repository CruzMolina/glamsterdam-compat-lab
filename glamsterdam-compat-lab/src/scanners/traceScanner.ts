import { detectTraceGasRepricingExposure } from "../detectors/gasRepricingDetectors.js";
import { detectTraceStateCreation } from "../detectors/stateCreationDetectors.js";
import { domains, makeFinding } from "../detectors/types.js";
import { loadEipRegistry } from "../registry/eipRegistry.js";
import type { EipRegistry } from "../registry/schemas.js";
import { makeReport, type CompatibilityFinding, type CompatibilityReport } from "../reports/reportTypes.js";
import { loadStructuredFile } from "../utils/files.js";

export interface NormalizedTraceStep {
  op: string;
  depth?: number;
  gas?: number;
  gasCost?: number;
  calldataBytes?: number;
  logs?: number;
}

export interface TraceScanOptions {
  registry?: EipRegistry;
  registryPath?: string;
  targetName?: string;
}

export function scanTraceFile(traceFile: string, options: TraceScanOptions = {}): CompatibilityReport {
  const input = loadStructuredFile(traceFile);
  return scanTrace(input, {
    ...options,
    targetName: options.targetName ?? traceFile
  });
}

export function scanTrace(input: unknown, options: TraceScanOptions = {}): CompatibilityReport {
  const registry = options.registry ?? loadEipRegistry(options.registryPath);
  const normalized = normalizeTrace(input);
  const opcodeCounts = countOps(normalized.steps);
  const calldataBytes = normalized.steps.reduce((total, step) => total + (step.calldataBytes ?? 0), 0);
  const maxDepth = normalized.steps.reduce((max, step) => Math.max(max, step.depth ?? 0), 0);
  const logOps = ["LOG0", "LOG1", "LOG2", "LOG3", "LOG4"].reduce(
    (total, op) => total + (opcodeCounts[op] ?? 0),
    0
  );
  const callOps = ["CALL", "CALLCODE", "DELEGATECALL", "STATICCALL"].reduce(
    (total, op) => total + (opcodeCounts[op] ?? 0),
    0
  );
  const context = {
    registry,
    targetName: options.targetName ?? "trace"
  };

  const findings: CompatibilityFinding[] = [
    ...detectTraceGasRepricingExposure(opcodeCounts, calldataBytes, context),
    ...detectTraceStateCreation(opcodeCounts, context),
    ...detectTraceLogAndCallPattern(logOps, callOps, maxDepth),
    ...detectTraceIncompleteness(normalized)
  ];

  return makeReport({
    fork: registry.fork,
    target: {
      kind: "trace",
      name: options.targetName ?? "trace"
    },
    findings,
    assumptions: [
      "Trace input was normalized from an array of steps, a structLogs object, this project's normalized format, or a call-tracer-like calls tree.",
      `The loaded registry is dated ${registry.lastUpdated}. Glamsterdam scope and gas parameters may change.`
    ],
    limitations: [
      "Trace coverage is only as good as the transaction samples provided.",
      "Some trace formats omit calldata sizes, storage keys, gas costs, logs, or call details.",
      "Findings are compatibility prompts and should be validated through replay or benchmarking."
    ]
  });
}

export function normalizeTrace(input: unknown): { steps: NormalizedTraceStep[]; warnings: string[] } {
  const warnings: string[] = [];

  if (Array.isArray(input)) {
    return { steps: input.map(stepFromUnknown).filter(isStep), warnings };
  }

  if (!isRecord(input)) {
    return {
      steps: [],
      warnings: ["Trace input is not an object or array."]
    };
  }

  if (Array.isArray(input.steps)) {
    return { steps: input.steps.map(stepFromUnknown).filter(isStep), warnings };
  }

  if (Array.isArray(input.structLogs)) {
    return { steps: input.structLogs.map(stepFromUnknown).filter(isStep), warnings };
  }

  if (Array.isArray(input.trace)) {
    return { steps: input.trace.map(stepFromUnknown).filter(isStep), warnings };
  }

  if (Array.isArray(input.calls) || typeof input.type === "string") {
    const steps = flattenCallTree(input);
    if (steps.length === 0) {
      warnings.push("Call tree did not contain recognizable call frames.");
    }
    return { steps, warnings };
  }

  return {
    steps: [],
    warnings: ["No recognized trace steps were found."]
  };
}

function detectTraceLogAndCallPattern(logOps: number, callOps: number, maxDepth: number): CompatibilityFinding[] {
  const findings: CompatibilityFinding[] = [];

  if (logOps > 0 || callOps > 0) {
    findings.push(
      makeFinding({
        id: "trace.logs-calls-visible",
        title: "Trace includes logs or external calls",
        severity: "low",
        confidence: "high",
        domain: domains("contracts", "indexer", "monitoring"),
        relatedEips: ["EIP-7708", "EIP-7928"],
        description:
          "The trace includes log or call activity that may be relevant to indexer, explorer, and monitoring assumptions under Glamsterdam-era changes.",
        evidence: { logOps, callOps, maxDepth },
        recommendation:
          "Use traces like this to test indexer replay, alerting, and explorer display paths alongside contract gas behavior."
      })
    );
  }

  return findings;
}

function detectTraceIncompleteness(normalized: { steps: NormalizedTraceStep[]; warnings: string[] }): CompatibilityFinding[] {
  const findings: CompatibilityFinding[] = [];
  const hasCalldataEvidence = normalized.steps.some((step) => typeof step.calldataBytes === "number");
  const hasGasCostEvidence = normalized.steps.some((step) => typeof step.gasCost === "number");

  if (normalized.steps.length === 0) {
    findings.push(
      makeFinding({
        id: "trace.no-recognized-steps",
        title: "Trace contains no recognized execution steps",
        severity: "unknown",
        confidence: "high",
        domain: domains("contracts", "execution"),
        relatedEips: ["GAS-REPRICING"],
        description:
          "The scanner could not normalize execution steps from this trace input, so it cannot infer opcode-level compatibility risks.",
        evidence: normalized.warnings,
        recommendation:
          "Provide a trace with a `steps`, `structLogs`, `trace`, or call-tracer-like `calls` shape."
      })
    );
  } else if (!hasCalldataEvidence || !hasGasCostEvidence) {
    findings.push(
      makeFinding({
        id: "trace.partial-evidence",
        title: "Trace omits some useful compatibility evidence",
        severity: "unknown",
        confidence: "low",
        domain: domains("contracts", "execution"),
        relatedEips: ["GAS-REPRICING", "EIP-7976"],
        description:
          "The trace was usable, but some formats omit calldata byte counts or per-op gas costs. The scanner reports what it can see and avoids inferring missing data.",
        evidence: { hasCalldataEvidence, hasGasCostEvidence, warnings: normalized.warnings },
        recommendation:
          "Prefer traces that include executed opcodes, depth, calldata/input sizes, and gas costs when comparing current and Glamsterdam behavior."
      })
    );
  }

  return findings;
}

function countOps(steps: NormalizedTraceStep[]): Record<string, number> {
  return steps.reduce<Record<string, number>>((counts, step) => {
    counts[step.op] = (counts[step.op] ?? 0) + 1;
    return counts;
  }, {});
}

function stepFromUnknown(value: unknown): NormalizedTraceStep | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const opRaw = value.op ?? value.opcode ?? value.type ?? value.actionType;
  if (typeof opRaw !== "string") {
    return undefined;
  }

  return {
    op: opRaw.toUpperCase(),
    depth: numberValue(value.depth),
    gas: numberValue(value.gas),
    gasCost: numberValue(value.gasCost ?? value.cost),
    calldataBytes: numberValue(value.calldataBytes ?? value.inputBytes ?? byteLengthFromHex(value.input)),
    logs: Array.isArray(value.logs) ? value.logs.length : numberValue(value.logs)
  };
}

function flattenCallTree(frame: unknown, depth = 0): NormalizedTraceStep[] {
  if (!isRecord(frame)) {
    return [];
  }

  const type = typeof frame.type === "string" ? frame.type.toUpperCase() : "CALL";
  const current = stepFromUnknown({
    ...frame,
    op: type,
    depth,
    calldataBytes: byteLengthFromHex(frame.input)
  });
  const childFrames = Array.isArray(frame.calls) ? frame.calls : [];
  const children = childFrames.flatMap((child) => flattenCallTree(child, depth + 1));
  return current ? [current, ...children] : children;
}

function isStep(value: NormalizedTraceStep | undefined): value is NormalizedTraceStep {
  return value !== undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function byteLengthFromHex(value: unknown): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    return undefined;
  }
  return Math.ceil(hex.length / 2);
}
