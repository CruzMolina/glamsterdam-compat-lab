#!/usr/bin/env tsx

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  compareDatasetDirectories,
  formatDatasetDiff
} from "./check-public-dataset.js";
import { generatePublicSite } from "./generate-public-site.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const committedSiteDir = resolve(rootDir, "site/public-seed");

function main(): void {
  const tempRoot = mkdtempSync(join(tmpdir(), "glamsterdam-public-site-"));
  const generatedDir = resolve(tempRoot, "public-seed-site");

  try {
    generatePublicSite({ outputDir: generatedDir, quiet: true });
    const diffs = compareDatasetDirectories(committedSiteDir, generatedDir);

    console.log("public seed site freshness check");
    console.log(`committed: ${committedSiteDir}`);
    console.log(`generated: ${generatedDir}`);

    if (diffs.length > 0) {
      console.log("");
      console.log(`site is stale (${diffs.length} difference${diffs.length === 1 ? "" : "s"}):`);
      for (const diff of diffs.slice(0, 30)) {
        console.log(`- ${formatDatasetDiff(diff)}`);
      }
      if (diffs.length > 30) {
        console.log(`- ... ${diffs.length - 30} more difference${diffs.length - 30 === 1 ? "" : "s"}`);
      }
      console.log("");
      console.log("Run pnpm site:generate and commit the updated site/public-seed artifacts.");
      process.exit(1);
    }

    console.log("");
    console.log("public seed site is fresh.");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
