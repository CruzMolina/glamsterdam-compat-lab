import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  compareDatasetDirectories,
  formatDatasetDiff
} from "../scripts/check-public-dataset.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("public dataset freshness check", () => {
  it("accepts matching directories", () => {
    withDatasetDirs(({ committedDir, generatedDir }) => {
      writeFixtureFile(committedDir, "manifest.json", "{\n  \"ok\": true\n}\n");
      writeFixtureFile(generatedDir, "manifest.json", "{\n  \"ok\": true\n}\n");

      expect(compareDatasetDirectories(committedDir, generatedDir)).toEqual([]);
    });
  });

  it("reports missing, extra, and stale committed dataset files", () => {
    withDatasetDirs(({ committedDir, generatedDir }) => {
      writeFixtureFile(committedDir, "extra.csv", "committed only\n");
      writeFixtureFile(committedDir, "reports/example.json", "{\n  \"risk\": \"low\"\n}\n");
      writeFixtureFile(generatedDir, "missing.csv", "generated only\n");
      writeFixtureFile(generatedDir, "reports/example.json", "{\n  \"risk\": \"medium\"\n}\n");

      const diffs = compareDatasetDirectories(committedDir, generatedDir);

      expect(diffs.map((diff) => diff.type).sort()).toEqual(["extra", "missing", "stale"]);
      expect(diffs.map(formatDatasetDiff)).toEqual([
        "extra committed file: extra.csv",
        "missing committed file: missing.csv",
        "stale committed file: reports/example.json (line 2: committed \"  \\\"risk\\\": \\\"low\\\"\", generated \"  \\\"risk\\\": \\\"medium\\\"\")"
      ]);
    });
  });
});

function withDatasetDirs(run: (dirs: { committedDir: string; generatedDir: string }) => void): void {
  const tempDir = mkdtempSync(resolve(tmpdir(), "glamsterdam-dataset-check-test-"));

  try {
    const committedDir = resolve(tempDir, "committed");
    const generatedDir = resolve(tempDir, "generated");
    mkdirSync(committedDir, { recursive: true });
    mkdirSync(generatedDir, { recursive: true });
    run({ committedDir, generatedDir });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function writeFixtureFile(root: string, path: string, content: string): void {
  const filePath = resolve(root, path);
  if (!filePath.startsWith(rootDir) && !filePath.startsWith(tmpdir())) {
    throw new Error(`Refusing to write outside test temp dir: ${filePath}`);
  }
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}
