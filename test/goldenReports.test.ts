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
});
