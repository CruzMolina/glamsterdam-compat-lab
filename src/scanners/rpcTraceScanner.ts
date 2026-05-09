import { scanTrace, type TraceScanOptions } from "./traceScanner.js";
import type { CompatibilityReport } from "../reports/reportTypes.js";

export type DebugTraceMode = "structLogs" | "callTracer";
export type RpcFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface FetchDebugTraceOptions {
  rpcUrl: string;
  txHash: string;
  tracer?: DebugTraceMode;
  traceTimeout?: string;
  rpcTimeoutMs?: number;
  fetch?: RpcFetch;
}

export interface ScanTransactionTraceOptions extends TraceScanOptions, FetchDebugTraceOptions {}

interface JsonRpcError {
  code?: number;
  message?: string;
  data?: unknown;
}

interface JsonRpcEnvelope {
  jsonrpc?: string;
  id?: unknown;
  result?: unknown;
  error?: JsonRpcError;
}

const defaultTraceTimeout = "30s";
const defaultRpcTimeoutMs = 30_000;

export async function scanTransactionTrace(options: ScanTransactionTraceOptions): Promise<CompatibilityReport> {
  const traceEnvelope = await fetchDebugTraceTransaction(options);
  const tracer = options.tracer ?? "structLogs";
  const report = scanTrace(traceEnvelope, {
    ...options,
    targetName: options.targetName ?? `tx ${options.txHash}`
  });

  return {
    ...report,
    assumptions: [
      `Trace was fetched with debug_traceTransaction using ${tracer} mode.`,
      ...report.assumptions
    ],
    limitations: [
      ...report.limitations,
      "RPC trace availability, tracer names, and returned fields vary by execution client and node configuration.",
      "The RPC URL is intentionally not included in the report target or evidence."
    ]
  };
}

export async function fetchDebugTraceTransaction(options: FetchDebugTraceOptions): Promise<JsonRpcEnvelope> {
  const txHash = normalizeTxHash(options.txHash);
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    throw new Error("No fetch implementation is available. Use Node.js 20+ or provide a fetch implementation.");
  }

  const controller = new AbortController();
  const timeoutMs = options.rpcTimeoutMs ?? defaultRpcTimeoutMs;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(options.rpcUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "debug_traceTransaction",
        params: [txHash, traceConfig(options.tracer ?? "structLogs", options.traceTimeout ?? defaultTraceTimeout)]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`RPC request failed with HTTP ${response.status}.`);
    }

    const payload = await response.json() as JsonRpcEnvelope;
    if (payload.error) {
      const code = typeof payload.error.code === "number" ? ` ${payload.error.code}` : "";
      const message = payload.error.message ?? "Unknown JSON-RPC error";
      throw new Error(`RPC debug_traceTransaction failed${code}: ${message}`);
    }

    if (!("result" in payload) || payload.result === null || payload.result === undefined) {
      throw new Error("RPC debug_traceTransaction returned no trace result.");
    }

    return {
      jsonrpc: payload.jsonrpc ?? "2.0",
      id: payload.id ?? 1,
      result: payload.result
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`RPC request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeTxHash(txHash: string): string {
  const normalized = txHash.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Transaction hash must be a 0x-prefixed 32-byte hex string.");
  }
  return normalized;
}

export function parseDebugTraceMode(value: string): DebugTraceMode {
  if (value === "structLogs" || value === "callTracer") {
    return value;
  }
  throw new Error(`Unsupported trace mode "${value}". Use "structLogs" or "callTracer".`);
}

function traceConfig(tracer: DebugTraceMode, timeout: string): Record<string, unknown> {
  if (tracer === "callTracer") {
    return {
      tracer: "callTracer",
      timeout
    };
  }

  return {
    disableStack: true,
    disableStorage: true,
    enableMemory: false,
    enableReturnData: false,
    timeout
  };
}
