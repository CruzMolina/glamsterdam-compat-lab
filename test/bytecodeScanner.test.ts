import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scanBytecode } from "../src/scanners/bytecodeScanner.js";
import { countOpcodeNames, disassembleBytecode, normalizeBytecode } from "../src/utils/bytecode.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("bytecode utilities", () => {
  it("normalizes bytecode hex", () => {
    expect(normalizeBytecode("  0X60 00 55\n")).toBe("0x600055");
    expect(normalizeBytecode("abc")).toBe("0x0abc");
  });

  it("counts opcodes while skipping PUSH data", () => {
    const opcodes = disassembleBytecode("0x6055600055");
    const counts = countOpcodeNames(opcodes);

    expect(counts.PUSH1).toBe(2);
    expect(counts.SSTORE).toBe(1);
  });
});

describe("scanBytecode", () => {
  it("produces storage and creation findings for the fixture", () => {
    const fixture = resolve(rootDir, "fixtures/bytecode/storage-heavy.hex");
    const report = scanBytecode(fixture);

    expect(report.target.kind).toBe("bytecode");
    expect(report.summary.findingCount).toBeGreaterThan(0);
    expect(report.findings.some((finding) => finding.id === "bytecode.storage-heavy-pattern")).toBe(true);
    expect(report.findings.some((finding) => finding.id === "bytecode.contract-creation-opcodes")).toBe(true);
  });

  it.each([
    {
      fixture: "ens-registry-mainnet-runtime.hex",
      expectedFindingIds: [
        "bytecode.state-account-opcode-exposure",
        "bytecode.storage-heavy-pattern",
        "bytecode.log-opcodes-present"
      ]
    },
    {
      fixture: "multicall3-mainnet-runtime.hex",
      expectedFindingIds: [
        "bytecode.calldata-copy-exposure",
        "bytecode.log-opcodes-present"
      ]
    },
    {
      fixture: "erc4337-entrypoint-v06-mainnet-runtime.hex",
      expectedFindingIds: [
        "bytecode.contract-size-near-current-limit",
        "bytecode.state-account-opcode-exposure",
        "bytecode.calldata-copy-exposure",
        "bytecode.storage-heavy-pattern",
        "bytecode.log-opcodes-present"
      ]
    },
    {
      fixture: "uniswap-v2-factory-mainnet-runtime.hex",
      expectedFindingIds: [
        "bytecode.state-account-opcode-exposure",
        "bytecode.calldata-copy-exposure",
        "bytecode.contract-creation-opcodes",
        "bytecode.storage-heavy-pattern",
        "bytecode.log-opcodes-present"
      ]
    },
    {
      fixture: "usdc-proxy-mainnet-runtime.hex",
      expectedFindingIds: [
        "bytecode.state-account-opcode-exposure",
        "bytecode.calldata-copy-exposure",
        "bytecode.log-opcodes-present"
      ]
    },
    {
      fixture: "safe-proxy-factory-v130-mainnet-runtime.hex",
      expectedFindingIds: [
        "bytecode.state-account-opcode-exposure",
        "bytecode.calldata-copy-exposure",
        "bytecode.contract-creation-opcodes",
        "bytecode.log-opcodes-present"
      ]
    },
    {
      fixture: "weth9-mainnet-runtime.hex",
      expectedFindingIds: [
        "bytecode.state-account-opcode-exposure",
        "bytecode.storage-heavy-pattern",
        "bytecode.log-opcodes-present"
      ]
    }
  ])("scans public mainnet runtime bytecode fixture $fixture", ({ fixture, expectedFindingIds }) => {
    const report = scanBytecode(resolve(rootDir, "fixtures/bytecode", fixture));
    const findingIds = report.findings.map((finding) => finding.id);

    expect(report.target.kind).toBe("bytecode");
    expect(findingIds).toContain("bytecode.manual-review-required");
    for (const expectedFindingId of expectedFindingIds) {
      expect(findingIds).toContain(expectedFindingId);
    }
  });
});
