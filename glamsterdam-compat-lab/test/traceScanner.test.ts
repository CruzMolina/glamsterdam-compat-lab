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
});

describe("scanTraceFile", () => {
  it("produces state-heavy findings for the trace fixture", () => {
    const fixture = resolve(rootDir, "fixtures/traces/storage-heavy-trace.json");
    const report = scanTraceFile(fixture);

    expect(report.target.kind).toBe("trace");
    expect(report.findings.some((finding) => finding.id === "trace.state-heavy-execution-medium")).toBe(true);
    expect(report.findings.some((finding) => finding.id === "trace.contract-creation-executed")).toBe(true);
  });
});
