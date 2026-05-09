import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeTrace, scanTraceFile } from "../src/scanners/traceScanner.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("normalizeTrace", () => {
  it("accepts structLogs-style traces", () => {
    const normalized = normalizeTrace({
      structLogs: [
        { pc: 0, op: "SLOAD", depth: 1, gas: 1000, gasCost: 100 },
        { pc: 1, op: "SSTORE", depth: 1, gas: 900, gasCost: 200 }
      ]
    });

    expect(normalized.steps).toHaveLength(2);
    expect(normalized.steps[0]?.op).toBe("SLOAD");
  });

  it("unwraps JSON-RPC result objects", () => {
    const normalized = normalizeTrace({
      jsonrpc: "2.0",
      result: {
        structLogs: [{ pc: 0, op: "SSTORE", depth: 1, gasCost: 2900 }]
      }
    });

    expect(normalized.steps).toHaveLength(1);
    expect(normalized.steps[0]?.op).toBe("SSTORE");
    expect(normalized.warnings).toContain("Unwrapped JSON-RPC result object.");
  });

  it("normalizes Erigon-style action traces", () => {
    const normalized = normalizeTrace([
      {
        type: "call",
        action: { callType: "delegatecall", input: "0xabcdef" },
        traceAddress: [0]
      }
    ]);

    expect(normalized.steps[0]?.op).toBe("DELEGATECALL");
    expect(normalized.steps[0]?.depth).toBe(2);
    expect(normalized.steps[0]?.calldataBytes).toBe(3);
  });

  it("normalizes Foundry-style nested trace arrays", () => {
    const normalized = normalizeTrace({
      traces: [
        {
          kind: "CALL",
          calldata: "0x12345678",
          children: [
            { kind: "SLOAD", gasCost: 100 },
            { kind: "CREATE2", calldata: "0x6000" }
          ]
        }
      ]
    });

    expect(normalized.steps.map((step) => step.op)).toEqual(["CALL", "SLOAD", "CREATE2"]);
    expect(normalized.steps[0]?.calldataBytes).toBe(4);
  });

  it("normalizes Hardhat-style opcode name fields", () => {
    const normalized = normalizeTrace({
      trace: {
        steps: [
          { opcode: { name: "SLOAD" }, gasCost: 100 },
          { opName: "SSTORE", gasCost: 2900 },
          { instruction: "LOG1", gasCost: 375 }
        ]
      }
    });

    expect(normalized.steps.map((step) => step.op)).toEqual(["SLOAD", "SSTORE", "LOG1"]);
    expect(normalized.warnings).toContain("Unwrapped nested trace object.");
  });
});

describe("scanTraceFile", () => {
  it("produces state-heavy findings for the trace fixture", () => {
    const fixture = resolve(rootDir, "fixtures/traces/storage-heavy-trace.json");
    const report = scanTraceFile(fixture);

    expect(report.target.kind).toBe("trace");
    expect(report.findings.some((finding) => finding.id === "trace.state-heavy-execution-medium")).toBe(true);
    expect(report.findings.some((finding) => finding.id === "trace.contract-creation-executed")).toBe(true);
  });

  it("scans call-tracer trees with nested calls and creation", () => {
    const fixture = resolve(rootDir, "fixtures/traces/call-tracer-tree.json");
    const report = scanTraceFile(fixture);

    expect(report.findings.some((finding) => finding.id === "trace.contract-creation-executed")).toBe(true);
    expect(report.findings.some((finding) => finding.id === "trace.logs-calls-visible")).toBe(true);
  });

  it("scans JSON-RPC wrapped geth structLogs", () => {
    const fixture = resolve(rootDir, "fixtures/traces/geth-json-rpc-structlogs.json");
    const report = scanTraceFile(fixture);

    expect(report.findings.some((finding) => finding.id === "trace.logs-calls-visible")).toBe(true);
    expect(report.assumptions.some((assumption) => assumption.includes("JSON-RPC result wrapper"))).toBe(true);
  });

  it("scans Erigon-style action trace fixtures", () => {
    const fixture = resolve(rootDir, "fixtures/traces/erigon-action-trace.json");
    const report = scanTraceFile(fixture);

    expect(report.findings.some((finding) => finding.id === "trace.contract-creation-executed")).toBe(true);
    expect(report.findings.some((finding) => finding.id === "trace.logs-calls-visible")).toBe(true);
  });

  it("scans Foundry-style trace fixtures", () => {
    const fixture = resolve(rootDir, "fixtures/traces/foundry-json-trace.json");
    const report = scanTraceFile(fixture);

    expect(report.findings.some((finding) => finding.id === "trace.contract-creation-executed")).toBe(true);
    expect(report.findings.some((finding) => finding.id === "trace.logs-calls-visible")).toBe(true);
  });

  it("scans Hardhat-style trace fixtures", () => {
    const fixture = resolve(rootDir, "fixtures/traces/hardhat-debug-trace.json");
    const report = scanTraceFile(fixture);

    expect(report.findings.some((finding) => finding.id === "trace.calldata-heavy-execution")).toBe(true);
    expect(report.findings.some((finding) => finding.id === "trace.logs-calls-visible")).toBe(true);
  });

  it("scans Besu-style debug structLogs fixtures", () => {
    const fixture = resolve(rootDir, "fixtures/traces/besu-debug-structlogs.json");
    const report = scanTraceFile(fixture);

    expect(report.findings.some((finding) => finding.id === "trace.logs-calls-visible")).toBe(true);
  });

  it("scans Nethermind-style debug structLogs fixtures", () => {
    const fixture = resolve(rootDir, "fixtures/traces/nethermind-debug-structlogs.json");
    const report = scanTraceFile(fixture);

    expect(report.findings.some((finding) => finding.id === "trace.calldata-heavy-execution")).toBe(true);
    expect(report.findings.some((finding) => finding.id === "trace.contract-creation-executed")).toBe(true);
  });
});
