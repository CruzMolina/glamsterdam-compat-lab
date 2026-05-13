import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderJsonReport } from "../src/reports/jsonReporter.js";
import { renderMarkdownReport } from "../src/reports/markdownReporter.js";
import { scanBytecode } from "../src/scanners/bytecodeScanner.js";
import { scanIndexer } from "../src/scanners/indexerScanner.js";
import { scanTraceFile } from "../src/scanners/traceScanner.js";
import { scanValidatorConfig } from "../src/scanners/validatorScanner.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("golden report snapshots", () => {
  it("keeps bytecode Markdown report wording stable", () => {
    const report = scanBytecode(resolve(rootDir, "fixtures/bytecode/storage-heavy.hex"), {
      targetName: "fixtures/bytecode/storage-heavy.hex"
    });

    expect(renderMarkdownReport(report)).toMatchSnapshot();
  });

  it("keeps ENS Registry runtime bytecode JSON report structure stable", () => {
    expectBytecodeJsonSnapshot("ens-registry-mainnet-runtime.hex");
  });

  it("keeps Multicall3 runtime bytecode JSON report structure stable", () => {
    expectBytecodeJsonSnapshot("multicall3-mainnet-runtime.hex");
  });

  it("keeps ERC-4337 EntryPoint runtime bytecode JSON report structure stable", () => {
    expectBytecodeJsonSnapshot("erc4337-entrypoint-v06-mainnet-runtime.hex");
  });

  it("keeps Uniswap V2 Factory runtime bytecode JSON report structure stable", () => {
    expectBytecodeJsonSnapshot("uniswap-v2-factory-mainnet-runtime.hex");
  });

  it("keeps USDC proxy runtime bytecode JSON report structure stable", () => {
    expectBytecodeJsonSnapshot("usdc-proxy-mainnet-runtime.hex");
  });

  it("keeps Safe Proxy Factory runtime bytecode JSON report structure stable", () => {
    expectBytecodeJsonSnapshot("safe-proxy-factory-v130-mainnet-runtime.hex");
  });

  it("keeps WETH9 runtime bytecode JSON report structure stable", () => {
    expectBytecodeJsonSnapshot("weth9-mainnet-runtime.hex");
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

  it("keeps real geth Tracoor trace JSON report structure stable", () => {
    expectTraceJsonSnapshot("geth-mainnet-tracoor-debug-structlogs.json");
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

  it("keeps real reth Tracoor trace JSON report structure stable", () => {
    expectTraceJsonSnapshot("reth-mainnet-tracoor-debug-structlogs.json");
  });

  it("keeps real dRPC call-tracer JSON report structure stable", () => {
    expectTraceJsonSnapshot("drpc-call-tracer-real.json");
  });

  it("keeps mixed explorer indexer JSON report structure stable", () => {
    const targetName = "fixtures/indexers/explorer-replay-indexer.json";
    const report = scanIndexer(resolve(rootDir, targetName), { targetName });

    expect(renderJsonReport(report)).toMatchSnapshot();
  });

  it("keeps reduced public subgraph indexer JSON report structure stable", () => {
    const targetName = "fixtures/indexers/graph-network-subgraph-reduced.yaml";
    const report = scanIndexer(resolve(rootDir, targetName), { targetName });

    expect(renderJsonReport(report)).toMatchSnapshot();
  });

  it("keeps complete validator config JSON report structure stable", () => {
    const targetName = "fixtures/validator/operator-config-complete.yaml";
    const report = scanValidatorConfig(resolve(rootDir, targetName), { targetName });

    expect(renderJsonReport(report)).toMatchSnapshot();
  });

  it("keeps public devnet validator config JSON report structure stable", () => {
    const targetName = "fixtures/validator/glamsterdam-devnet-operator-public.yaml";
    const report = scanValidatorConfig(resolve(rootDir, targetName), { targetName });

    expect(renderJsonReport(report)).toMatchSnapshot();
  });

  it("keeps validator builder-gap JSON report structure stable", () => {
    const targetName = "fixtures/validator/operator-config-builder-gap.yaml";
    const report = scanValidatorConfig(resolve(rootDir, targetName), { targetName });

    expect(renderJsonReport(report)).toMatchSnapshot();
  });
});

function expectTraceJsonSnapshot(fixtureName: string): void {
  const targetName = `fixtures/traces/${fixtureName}`;
  const report = scanTraceFile(resolve(rootDir, targetName), { targetName });

  expect(renderJsonReport(report)).toMatchSnapshot();
}

function expectBytecodeJsonSnapshot(fixtureName: string): void {
  const targetName = `fixtures/bytecode/${fixtureName}`;
  const report = scanBytecode(resolve(rootDir, targetName), { targetName });

  expect(renderJsonReport(report)).toMatchSnapshot();
}
