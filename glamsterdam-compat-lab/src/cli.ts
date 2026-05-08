#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import {
  combineReports,
  defaultClientMatrixPath,
  loadEipRegistry,
  renderJsonReport,
  renderMarkdownReport,
  scanBytecode,
  scanIndexer,
  scanTraceFile,
  scanValidatorConfig,
  validateCompatibilityReport,
  type CompatibilityReport
} from "./index.js";
import type { EipRegistry } from "./registry/schemas.js";
import { TOOL_VERSION } from "./reports/reportTypes.js";

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
  .description("Analyze EVM bytecode for conservative Glamsterdam compatibility prompts")
  .action((pathOrHex: string, options: { format: string; registry?: string }) => {
    const report = scanBytecode(pathOrHex, { registryPath: options.registry });
    writeReport(report, parseFormat(options.format));
  });

program
  .command("scan-traces")
  .argument("<trace-json-file>", "Trace JSON file")
  .option("--format <format>", "Output format: markdown or json", "markdown")
  .option("--registry <path>", "Path to Glamsterdam EIP registry JSON")
  .description("Analyze transaction traces for state-heavy, creation-heavy, calldata, log, and call patterns")
  .action((traceFile: string, options: { format: string; registry?: string }) => {
    const report = scanTraceFile(traceFile, { registryPath: options.registry });
    writeReport(report, parseFormat(options.format));
  });

program
  .command("scan-indexer")
  .argument("<path>", "Indexer, explorer, or subgraph config path")
  .option("--format <format>", "Output format: markdown or json", "markdown")
  .option("--registry <path>", "Path to Glamsterdam EIP registry JSON")
  .description("Analyze JSON/YAML indexer configuration with heuristic compatibility checks")
  .action((path: string, options: { format: string; registry?: string }) => {
    const report = scanIndexer(path, { registryPath: options.registry });
    writeReport(report, parseFormat(options.format));
  });

program
  .command("scan-validator")
  .requiredOption("--config <path>", "Validator/operator config JSON or YAML")
  .option("--client-matrix <path>", "Client compatibility matrix JSON", defaultClientMatrixPath())
  .option("--format <format>", "Output format: markdown or json", "markdown")
  .option("--registry <path>", "Path to Glamsterdam EIP registry JSON")
  .description("Analyze validator/operator readiness from local config and user-editable compatibility data")
  .action((options: { config: string; clientMatrix: string; format: string; registry?: string }) => {
    const report = scanValidatorConfig(options.config, {
      registryPath: options.registry,
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

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});

function writeReport(report: CompatibilityReport, format: OutputFormat): void {
  process.stdout.write(format === "json" ? renderJsonReport(report) : renderMarkdownReport(report));
}

function parseFormat(format: string): OutputFormat {
  if (format === "markdown" || format === "json") {
    return format;
  }

  throw new Error(`Unsupported format "${format}". Use "markdown" or "json".`);
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
