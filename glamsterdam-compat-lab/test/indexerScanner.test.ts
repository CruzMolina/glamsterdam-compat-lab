import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scanIndexer, summarizeHandlers } from "../src/scanners/indexerScanner.js";
import { loadStructuredFile } from "../src/utils/files.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("scanIndexer", () => {
  it("parses a subgraph fixture and flags event-only assumptions", () => {
    const fixture = resolve(rootDir, "fixtures/indexers/subgraph.yaml");
    const config = loadStructuredFile(fixture);
    const summary = summarizeHandlers(config);
    const report = scanIndexer(fixture);

    expect(summary.eventHandlers).toBe(1);
    expect(summary.callHandlers).toBe(0);
    expect(report.findings.some((finding) => finding.id === "indexer.event-only-assumption")).toBe(true);
    expect(report.findings.some((finding) => finding.id === "indexer.missing-replay-plan")).toBe(true);
  });

  it("flags balance-diff based native transfer assumptions", () => {
    const fixture = resolve(rootDir, "fixtures/indexers/balance-diff-indexer.json");
    const report = scanIndexer(fixture);

    expect(report.findings.some((finding) => finding.id === "indexer.balance-diff-native-transfer-assumption")).toBe(true);
    expect(report.findings.some((finding) => finding.id === "indexer.native-eth-transfer-review-missing")).toBe(false);
  });
});
