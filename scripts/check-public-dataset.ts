#!/usr/bin/env tsx

import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generatePublicDataset } from "./generate-public-dataset.js";

export interface DatasetDiff {
  type: "missing" | "extra" | "stale";
  path: string;
  detail?: string;
}

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const committedDatasetDir = resolve(rootDir, "datasets/public-seed");

export function compareDatasetDirectories(committedDir: string, generatedDir: string): DatasetDiff[] {
  const committedFiles = collectFiles(committedDir);
  const generatedFiles = collectFiles(generatedDir);
  const allPaths = [...new Set([...committedFiles.keys(), ...generatedFiles.keys()])].sort();
  const diffs: DatasetDiff[] = [];

  for (const path of allPaths) {
    const committedPath = committedFiles.get(path);
    const generatedPath = generatedFiles.get(path);

    if (!committedPath) {
      diffs.push({ type: "missing", path });
      continue;
    }
    if (!generatedPath) {
      diffs.push({ type: "extra", path });
      continue;
    }

    const committed = readFileSync(committedPath, "utf8");
    const generated = readFileSync(generatedPath, "utf8");
    if (committed !== generated) {
      diffs.push({
        type: "stale",
        path,
        detail: firstTextDifference(committed, generated)
      });
    }
  }

  return diffs;
}

export function formatDatasetDiff(diff: DatasetDiff): string {
  if (diff.type === "missing") {
    return `missing committed file: ${diff.path}`;
  }
  if (diff.type === "extra") {
    return `extra committed file: ${diff.path}`;
  }
  return `stale committed file: ${diff.path}${diff.detail ? ` (${diff.detail})` : ""}`;
}

function main(): void {
  const tempRoot = mkdtempSync(join(tmpdir(), "glamsterdam-public-seed-"));
  const generatedDir = resolve(tempRoot, "public-seed");

  try {
    generatePublicDataset({ outputDir: generatedDir, quiet: true });
    const diffs = compareDatasetDirectories(committedDatasetDir, generatedDir);

    console.log("public seed dataset freshness check");
    console.log(`committed: ${committedDatasetDir}`);
    console.log(`generated: ${generatedDir}`);

    if (diffs.length > 0) {
      console.log("");
      console.log(`dataset is stale (${diffs.length} difference${diffs.length === 1 ? "" : "s"}):`);
      for (const diff of diffs.slice(0, 30)) {
        console.log(`- ${formatDatasetDiff(diff)}`);
      }
      if (diffs.length > 30) {
        console.log(`- ... ${diffs.length - 30} more difference${diffs.length - 30 === 1 ? "" : "s"}`);
      }
      console.log("");
      console.log("Run pnpm dataset:generate and commit the updated datasets/public-seed artifacts.");
      process.exit(1);
    }

    console.log("");
    console.log("public seed dataset is fresh.");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function collectFiles(root: string): Map<string, string> {
  const files = new Map<string, string>();

  if (!existsSync(root)) {
    return files;
  }

  for (const path of walkFiles(root)) {
    files.set(relative(root, path).replaceAll("\\", "/"), path);
  }

  return files;
}

function walkFiles(dir: string): string[] {
  const entries = readdirSync(dir).sort();
  const files: string[] = [];

  for (const entry of entries) {
    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...walkFiles(path));
    } else if (stat.isFile()) {
      files.push(path);
    }
  }

  return files;
}

function firstTextDifference(committed: string, generated: string): string {
  const committedLines = committed.split("\n");
  const generatedLines = generated.split("\n");
  const maxLines = Math.max(committedLines.length, generatedLines.length);

  for (let index = 0; index < maxLines; index += 1) {
    if (committedLines[index] !== generatedLines[index]) {
      return `line ${index + 1}: committed ${quoteLine(committedLines[index])}, generated ${quoteLine(generatedLines[index])}`;
    }
  }

  return "content differs";
}

function quoteLine(value: string | undefined): string {
  if (value === undefined) {
    return "<missing>";
  }
  const trimmed = value.length > 100 ? `${value.slice(0, 97)}...` : value;
  return JSON.stringify(trimmed);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
