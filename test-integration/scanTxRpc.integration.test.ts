import { describe, expect, it } from "vitest";
import { fetchAndScanTransactionTrace, parseDebugTraceMode } from "../src/scanners/rpcTraceScanner.js";

const rpcUrl = process.env.ETH_RPC_URL;
const txHash = process.env.ETH_RPC_TX_HASH ?? process.env.ETH_RPC_TX;
const tracer = parseDebugTraceMode(process.env.ETH_RPC_TRACER ?? "structLogs");
const rpcTimeoutMs = Number(process.env.ETH_RPC_TIMEOUT_MS ?? "30000");
const describeIfConfigured = rpcUrl && txHash ? describe : describe.skip;

describeIfConfigured("scan-tx RPC integration", () => {
  it("fetches a real debug_traceTransaction response and scans it", async () => {
    const result = await fetchAndScanTransactionTrace({
      rpcUrl: rpcUrl!,
      txHash: txHash!,
      tracer,
      rpcTimeoutMs
    });

    expect(result.trace).toMatchObject({ jsonrpc: "2.0" });
    expect(result.report.target.kind).toBe("trace");
    expect(result.report.target.name).toBe(`tx ${txHash}`);
    expect(result.report.assumptions[0]).toContain("debug_traceTransaction");
  });
});
