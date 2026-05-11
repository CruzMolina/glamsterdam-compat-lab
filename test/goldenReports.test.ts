import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderJsonReport } from "../src/reports/jsonReporter.js";
import { renderMarkdownReport } from "../src/reports/markdownReporter.js";
import { scanBytecode } from "../src/scanners/bytecodeScanner.js";
import { scanTraceFile } from "../src/scanners/traceScanner.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("golden report snapshots", () => {
  it("keeps bytecode Markdown report wording stable", () => {
    const report = scanBytecode(resolve(rootDir, "fixtures/bytecode/storage-heavy.hex"), {
      targetName: "fixtures/bytecode/storage-heavy.hex"
    });

    expect(renderMarkdownReport(report)).toMatchSnapshot();
  });

  it("keeps trace JSON report structure stable", () => {
    const report = scanTraceFile(resolve(rootDir, "fixtures/traces/storage-heavy-trace.json"), {
      targetName: "fixtures/traces/storage-heavy-trace.json"
    });

    expect(renderJsonReport(report)).toMatchSnapshot();
  });

  it("keeps Foundry trace JSON report structure stable", () => {
    expectTraceJsonSnapshot("foundry-json-trace.json");
  });

  it("keeps Hardhat trace JSON report structure stable", () => {
    expectTraceJsonSnapshot("hardhat-debug-trace.json");
  });

  it("keeps geth structLogs JSON report structure stable", () => {
    expectTraceJsonSnapshot("geth-json-rpc-structlogs.json");
  });

  it("keeps call-tracer tree JSON report structure stable", () => {
    expectTraceJsonSnapshot("call-tracer-tree.json");
  });

  it("keeps Besu-style trace JSON report structure stable", () => {
    expectTraceJsonSnapshot("besu-debug-structlogs.json");
  });

  it("keeps real Besu Tracoor trace JSON report structure stable", () => {
    expectTraceJsonSnapshot("besu-mainnet-tracoor-debug-structlogs.json");
  });

  it("keeps Nethermind-style trace JSON report structure stable", () => {
    expectTraceJsonSnapshot("nethermind-debug-structlogs.json");
  });

  it("keeps real Nethermind Tracoor trace JSON report structure stable", () => {
    expectTraceJsonSnapshot("nethermind-mainnet-tracoor-debug-structlogs.json");
  });

  it("keeps real dRPC call-tracer JSON report structure stable", () => {
    expectTraceJsonSnapshot("drpc-call-tracer-real.json");
  });
});

function expectTraceJsonSnapshot(fixtureName: string): void {
  const targetName = `fixtures/traces/${fixtureName}`;
  const report = scanTraceFile(resolve(rootDir, targetName), { targetName });

  expect(renderJsonReport(report)).toMatchSnapshot();
}
