#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import {
  combineReports,
  defaultClientMatrixPath,
  defaultThresholdsPath,
  compareCompatibilityReports,
  loadEipRegistry,
  renderJsonComparisonReport,
  renderJsonReport,
  renderMarkdownComparisonReport,
  renderMarkdownReport,
  scanBytecode,
  scanIndexer,
  scanTraceFile,
  scanValidatorConfig,
  validateCompatibilityReport,
  fetchAndScanTransactionTrace,
  writeFetchedTrace,
  type ComparisonReport,
  type CompatibilityReport
} from "./index.js";
import type { EipRegistry } from "./registry/schemas.js";
import { TOOL_VERSION } from "./reports/reportTypes.js";
import { parseDebugTraceMode } from "./scanners/rpcTraceScanner.js";

type OutputFormat = "markdown" | "json";

const program = new Command();

program
  .name("glamsterdam")
  .description("Glamsterdam Compatibility Lab CLI")
  .version(TOOL_VERSION);

program
  .command("scan-bytecode")
  .argument("<path-or-hex>", "EVM bytecode file path or inline hex string")
  .option("--format <format>", "Output format: markdown or json", "markdown")
  .option("--registry <path>", "Path to Glamsterdam EIP registry JSON")
  .option("--thresholds <path>", "Path to detector thresholds JSON", defaultThresholdsPath())
  .description("Analyze EVM bytecode for conservative Glamsterdam compatibility prompts")
  .action((pathOrHex: string, options: { format: string; registry?: string; thresholds: string }) => {
    const report = scanBytecode(pathOrHex, { registryPath: options.registry, thresholdsPath: options.thresholds });
    writeReport(report, parseFormat(options.format));
  });

program
  .command("scan-traces")
  .argument("<trace-json-file>", "Trace JSON file")
  .option("--format <format>", "Output format: markdown or json", "markdown")
  .option("--registry <path>", "Path to Glamsterdam EIP registry JSON")
  .option("--thresholds <path>", "Path to detector thresholds JSON", defaultThresholdsPath())
  .description("Analyze transaction traces for state-heavy, creation-heavy, calldata, log, and call patterns")
  .action((traceFile: string, options: { format: string; registry?: string; thresholds: string }) => {
    const report = scanTraceFile(traceFile, { registryPath: options.registry, thresholdsPath: options.thresholds });
    writeReport(report, parseFormat(options.format));
  });

program
  .command("scan-tx")
  .requiredOption("--tx <hash>", "Transaction hash to fetch with debug_traceTransaction")
  .option("--rpc-url <url>", "Execution RPC URL. Defaults to ETH_RPC_URL when omitted")
  .option("--tracer <mode>", "Trace mode: structLogs or callTracer", "structLogs")
  .option("--trace-timeout <duration>", "Execution client trace timeout hint", "30s")
  .option("--rpc-timeout-ms <ms>", "HTTP RPC timeout in milliseconds", "30000")
  .option("--trace-out <path>", "Write the fetched JSON-RPC trace response to a file")
  .option("--format <format>", "Output format: markdown or json", "markdown")
  .option("--registry <path>", "Path to Glamsterdam EIP registry JSON")
  .option("--thresholds <path>", "Path to detector thresholds JSON", defaultThresholdsPath())
  .description("Fetch debug_traceTransaction from an RPC endpoint and scan the returned trace")
  .action(async (options: {
    tx: string;
    rpcUrl?: string;
    tracer: string;
    traceTimeout: string;
    rpcTimeoutMs: string;
    traceOut?: string;
    format: string;
    registry?: string;
    thresholds: string;
  }) => {
    const rpcUrl = options.rpcUrl ?? process.env.ETH_RPC_URL;
    if (!rpcUrl) {
      throw new Error("Provide --rpc-url or set ETH_RPC_URL.");
    }

    const result = await fetchAndScanTransactionTrace({
      rpcUrl,
      txHash: options.tx,
      tracer: parseDebugTraceMode(options.tracer),
      traceTimeout: options.traceTimeout,
      rpcTimeoutMs: parsePositiveInteger(options.rpcTimeoutMs, "--rpc-timeout-ms"),
      registryPath: options.registry,
      thresholdsPath: options.thresholds
    });
    if (options.traceOut) {
      writeFetchedTrace(result.trace, options.traceOut);
    }
    writeReport(result.report, parseFormat(options.format));
  });

program
  .command("scan-indexer")
  .argument("<path>", "Indexer, explorer, or subgraph config path")
  .option("--format <format>", "Output format: markdown or json", "markdown")
  .option("--registry <path>", "Path to Glamsterdam EIP registry JSON")
  .option("--thresholds <path>", "Path to detector thresholds JSON", defaultThresholdsPath())
  .description("Analyze JSON/YAML indexer configuration with heuristic compatibility checks")
  .action((path: string, options: { format: string; registry?: string; thresholds: string }) => {
    const report = scanIndexer(path, { registryPath: options.registry, thresholdsPath: options.thresholds });
    writeReport(report, parseFormat(options.format));
  });

program
  .command("scan-validator")
  .requiredOption("--config <path>", "Validator/operator config JSON or YAML")
  .option("--client-matrix <path>", "Client compatibility matrix JSON", defaultClientMatrixPath())
  .option("--format <format>", "Output format: markdown or json", "markdown")
  .option("--registry <path>", "Path to Glamsterdam EIP registry JSON")
  .option("--thresholds <path>", "Path to detector thresholds JSON", defaultThresholdsPath())
  .description("Analyze validator/operator readiness from local config and user-editable compatibility data")
  .action((options: { config: string; clientMatrix: string; format: string; registry?: string; thresholds: string }) => {
    const report = scanValidatorConfig(options.config, {
      registryPath: options.registry,
      thresholdsPath: options.thresholds,
      clientMatrixPath: options.clientMatrix
    });
    writeReport(report, parseFormat(options.format));
  });

program
  .command("eips")
  .option("--format <format>", "Output format: markdown or json", "markdown")
  .option("--registry <path>", "Path to Glamsterdam EIP registry JSON")
  .description("Print the loaded Glamsterdam EIP registry")
  .action((options: { format: string; registry?: string }) => {
    const registry = loadEipRegistry(options.registry);
    const format = parseFormat(options.format);
    process.stdout.write(format === "json" ? `${JSON.stringify(registry, null, 2)}\n` : renderEipRegistry(registry));
  });

program
  .command("report")
  .argument("[reports...]", "JSON report files generated with --format json")
  .option("--format <format>", "Output format: markdown or json", "markdown")
  .description("Combine multiple saved JSON scan reports into one report")
  .action((reports: string[], options: { format: string }) => {
    if (reports.length === 0) {
      throw new Error("Provide at least one JSON report file to combine.");
    }

    const parsedReports = reports.map((path) => validateCompatibilityReport(JSON.parse(readFileSync(path, "utf8"))));
    writeReport(combineReports(parsedReports), parseFormat(options.format));
  });

program
  .command("compare-reports")
  .alias("compare")
  .argument("<baseline-report>", "Baseline JSON report generated with --format json")
  .argument("<candidate-report>", "Candidate JSON report generated with --format json")
  .option("--format <format>", "Output format: markdown or json", "markdown")
  .description("Compare two saved JSON compatibility reports")
  .action((baselineReport: string, candidateReport: string, options: { format: string }) => {
    const baseline = validateCompatibilityReport(JSON.parse(readFileSync(baselineReport, "utf8")));
    const candidate = validateCompatibilityReport(JSON.parse(readFileSync(candidateReport, "utf8")));
    const comparison = compareCompatibilityReports(baseline, candidate);
    writeComparisonReport(comparison, parseFormat(options.format));
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});

function writeReport(report: CompatibilityReport, format: OutputFormat): void {
  process.stdout.write(format === "json" ? renderJsonReport(report) : renderMarkdownReport(report));
}

function writeComparisonReport(report: ComparisonReport, format: OutputFormat): void {
  process.stdout.write(format === "json" ? renderJsonComparisonReport(report) : renderMarkdownComparisonReport(report));
}

function parseFormat(format: string): OutputFormat {
  if (format === "markdown" || format === "json") {
    return format;
  }

  throw new Error(`Unsupported format "${format}". Use "markdown" or "json".`);
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function renderEipRegistry(registry: EipRegistry): string {
  const lines: string[] = [];
  lines.push("# Glamsterdam EIP Registry");
  lines.push("");
  lines.push(`Fork: ${registry.fork}`);
  lines.push(`Last updated: ${registry.lastUpdated}`);
  lines.push("");
  lines.push("## Sources");
  lines.push("");
  for (const source of registry.sources) {
    lines.push(`- ${source}`);
  }
  lines.push("");
  lines.push("## Entries");
  lines.push("");

  for (const entry of registry.eips) {
    lines.push(`### ${entry.id}: ${entry.name}`);
    lines.push("");
    lines.push(`Status: ${entry.status}`);
    lines.push(`Domain: ${entry.domain.join(", ")}`);
    lines.push(`Detector modules: ${entry.detectors.length > 0 ? entry.detectors.join(", ") : "none"}`);
    if (entry.notes) {
      lines.push(`Notes: ${entry.notes}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}
