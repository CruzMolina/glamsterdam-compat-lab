#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const requiredEntries = [
  "package/package.json",
  "package/dist/cli.js",
  "package/fixtures/traces/drpc-call-tracer-real.json"
];

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      npm_config_loglevel: "silent"
    },
    ...options
  }).trim();
}

function fail(message) {
  throw new Error(message);
}

function glamsterdamBin(prefixDir) {
  return process.platform === "win32"
    ? join(prefixDir, "glamsterdam.cmd")
    : join(prefixDir, "bin", "glamsterdam");
}

const packDir = mkdtempSync(join(tmpdir(), "glamsterdam-pack-"));
const prefixDir = mkdtempSync(join(tmpdir(), "glamsterdam-install-"));

try {
  const packOutput = run("pnpm", ["pack", "--pack-destination", packDir]);
  const tarball = packOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.endsWith(".tgz"));

  if (!tarball) {
    fail(`Could not find packed tarball in pnpm pack output:\n${packOutput}`);
  }

  const entries = new Set(run("tar", ["-tzf", tarball]).split(/\r?\n/));
  for (const entry of requiredEntries) {
    if (!entries.has(entry)) {
      fail(`Packed tarball is missing ${entry}.`);
    }
  }

  const cliListing = run("tar", ["-tvf", tarball, "package/dist/cli.js"]);
  if (!cliListing.startsWith("-rwx")) {
    fail(`Packed CLI is not executable:\n${cliListing}`);
  }

  run("npm", ["install", "-g", "--prefix", prefixDir, tarball]);

  const bin = glamsterdamBin(prefixDir);
  const version = run(bin, ["--version"]);
  if (version !== packageJson.version) {
    fail(`Expected glamsterdam --version ${packageJson.version}, got ${version}.`);
  }

  const eipsOutput = run(bin, ["eips", "--format", "json"]);
  const eipsReport = JSON.parse(eipsOutput);
  if (!Array.isArray(eipsReport.eips) || eipsReport.eips.length === 0) {
    fail("Packed glamsterdam eips --format json did not return any EIPs.");
  }

  console.log(`Packed install check passed for ${packageJson.name}@${packageJson.version}.`);
  console.log(`Verified ${eipsReport.eips.length} EIPs and ${requiredEntries.length} package entries.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  rmSync(packDir, { recursive: true, force: true });
  rmSync(prefixDir, { recursive: true, force: true });
}
