#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const registry = "https://registry.npmjs.org/";
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

function run(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_loglevel: process.env.npm_config_loglevel ?? "notice"
    }
  });
}

function writeOutput(result) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

function npmViewPublishedVersion() {
  const result = run("npm", [
    "view",
    `${packageJson.name}@${packageJson.version}`,
    "version",
    "--json",
    `--registry=${registry}`
  ]);

  if (result.status !== 0 || !result.stdout.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    return result.stdout.trim().replace(/^"|"$/g, "");
  }
}

const dryRun = run("npm", ["publish", "--dry-run"]);

if (dryRun.status === 0) {
  writeOutput(dryRun);
  process.exit(0);
}

const output = `${dryRun.stdout ?? ""}\n${dryRun.stderr ?? ""}`;
const alreadyPublished = output.includes("previously published versions") || output.includes("cannot publish over");
const publishedVersion = alreadyPublished ? npmViewPublishedVersion() : undefined;

if (publishedVersion === packageJson.version) {
  if (dryRun.stdout) {
    process.stdout.write(dryRun.stdout);
  }
  console.log(
    `${packageJson.name}@${packageJson.version} is already published on npm; ` +
      "the package dry run reached npm's version-state gate after local publish checks."
  );
  process.exit(0);
}

writeOutput(dryRun);
process.exit(dryRun.status ?? 1);
