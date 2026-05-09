import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  fetchAndScanTransactionTrace,
  fetchDebugTraceTransaction,
  normalizeTxHash,
  parseDebugTraceMode,
  scanTransactionTrace,
  writeFetchedTrace,
  type RpcFetch
} from "../src/scanners/rpcTraceScanner.js";

const txHash = `0x${"1".repeat(64)}`;

describe("scanTransactionTrace", () => {
  it("fetches debug_traceTransaction structLogs and scans the result", async () => {
    let requestBody: unknown;
    const fetchImpl: RpcFetch = async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return jsonResponse({
        jsonrpc: "2.0",
        id: 1,
        result: {
          structLogs: [
            { op: "SLOAD", depth: 1, gasCost: 100 },
            { op: "SSTORE", depth: 1, gasCost: 2900 },
            { op: "CALL", depth: 2, calldataBytes: 256 },
            { op: "LOG1", depth: 1, gasCost: 375 }
          ]
        }
      });
    };

    const report = await scanTransactionTrace({
      rpcUrl: "https://rpc.example.invalid",
      txHash,
      fetch: fetchImpl
    });

    expect(requestBody).toMatchObject({
      jsonrpc: "2.0",
      method: "debug_traceTransaction",
      params: [
        txHash,
        {
          disableStack: true,
          disableStorage: true,
          enableMemory: false,
          enableReturnData: false,
          timeout: "30s"
        }
      ]
    });
    expect(report.target.name).toBe(`tx ${txHash}`);
    expect(report.assumptions[0]).toContain("debug_traceTransaction");
    expect(report.limitations.some((limitation) => limitation.includes("RPC URL"))).toBe(true);
    expect(report.findings.some((finding) => finding.id === "trace.logs-calls-visible")).toBe(true);
  });

  it("supports callTracer mode", async () => {
    let requestBody: unknown;
    const fetchImpl: RpcFetch = async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return jsonResponse({
        jsonrpc: "2.0",
        id: 1,
        result: {
          type: "CALL",
          input: "0x12345678",
          logs: [{}],
          calls: [
            {
              type: "CREATE2",
              input: "0x60006000"
            }
          ]
        }
      });
    };

    const report = await scanTransactionTrace({
      rpcUrl: "https://rpc.example.invalid",
      txHash,
      tracer: "callTracer",
      fetch: fetchImpl
    });

    expect(requestBody).toMatchObject({
      method: "debug_traceTransaction",
      params: [txHash, { tracer: "callTracer", timeout: "30s" }]
    });
    expect(report.findings.some((finding) => finding.id === "trace.contract-creation-executed")).toBe(true);
    expect(report.findings.some((finding) => finding.id === "trace.logs-calls-visible")).toBe(true);
  });

  it("returns the fetched trace when callers need to persist it", async () => {
    const fetchImpl: RpcFetch = async () => jsonResponse({
      jsonrpc: "2.0",
      id: 1,
      result: {
        structLogs: [{ op: "SLOAD", depth: 1, gasCost: 100 }]
      }
    });

    const result = await fetchAndScanTransactionTrace({
      rpcUrl: "https://rpc.example.invalid",
      txHash,
      fetch: fetchImpl
    });

    expect(result.trace).toMatchObject({
      jsonrpc: "2.0",
      result: {
        structLogs: [{ op: "SLOAD", depth: 1, gasCost: 100 }]
      }
    });
    expect(result.report.target.name).toBe(`tx ${txHash}`);
  });
});

describe("fetchDebugTraceTransaction", () => {
  it("surfaces JSON-RPC errors without including the RPC URL", async () => {
    const fetchImpl: RpcFetch = async () => jsonResponse({
      jsonrpc: "2.0",
      id: 1,
      error: {
        code: -32601,
        message: "Method not found"
      }
    });

    await expect(fetchDebugTraceTransaction({
      rpcUrl: "https://secret-token@example.invalid",
      txHash,
      fetch: fetchImpl
    })).rejects.toThrow("RPC debug_traceTransaction failed -32601: Method not found");
  });

  it("validates transaction hashes and trace modes", () => {
    expect(normalizeTxHash(txHash)).toBe(txHash);
    expect(() => normalizeTxHash("0x1234")).toThrow("32-byte hex string");
    expect(parseDebugTraceMode("structLogs")).toBe("structLogs");
    expect(parseDebugTraceMode("callTracer")).toBe("callTracer");
    expect(() => parseDebugTraceMode("prestateTracer")).toThrow("Unsupported trace mode");
  });
});

describe("writeFetchedTrace", () => {
  it("writes formatted JSON and creates parent directories", () => {
    const dir = mkdtempSync(join(tmpdir(), "glamsterdam-trace-"));
    const tracePath = join(dir, "nested", "trace.json");

    try {
      const writtenPath = writeFetchedTrace({ result: { structLogs: [] } }, tracePath);

      expect(writtenPath).toBe(tracePath);
      expect(JSON.parse(readFileSync(tracePath, "utf8"))).toEqual({ result: { structLogs: [] } });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}
