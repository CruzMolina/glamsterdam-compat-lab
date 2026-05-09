#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const registry = "https://registry.npmjs.org/";
const repo = "CruzMolina/glamsterdam-compat-lab";
const environment = "npm-publish";
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const packageName = packageJson.name;
const expectedVersion = packageJson.version;

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_loglevel: "silent"
    }
  });

  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };
}

function npmViewVersion() {
  const result = run("npm", ["view", packageName, "version", "--json", `--registry=${registry}`]);

  if (!result.ok) {
    return { ok: false, version: null, detail: firstUsefulLine(result.stderr) || "package not visible on npm" };
  }

  try {
    return { ok: true, version: JSON.parse(result.stdout), detail: "" };
  } catch {
    return { ok: true, version: result.stdout.replace(/^"|"$/g, ""), detail: "" };
  }
}

function npmWhoami() {
  const result = run("npm", ["whoami", `--registry=${registry}`]);
  return {
    ok: result.ok,
    user: result.ok ? result.stdout : null,
    detail: result.ok ? "" : firstUsefulLine(result.stderr) || "not logged in"
  };
}

function ghSecrets(args) {
  const result = run("gh", ["secret", "list", "--repo", repo, ...args]);

  if (!result.ok) {
    return { ok: false, hasToken: false, detail: firstUsefulLine(result.stderr) || "gh secret list failed" };
  }

  return {
    ok: true,
    hasToken: result.stdout
      .split(/\r?\n/)
      .some((line) => line.split(/\s+/)[0] === "NPM_TOKEN"),
    detail: ""
  };
}

function firstUsefulLine(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("npm warn")) ?? "";
}

function statusIcon(pass) {
  return pass ? "ok" : "missing";
}

const published = npmViewVersion();
const whoami = npmWhoami();
const repoSecrets = ghSecrets([]);
const envSecrets = ghSecrets(["--env", environment]);
const isExpectedVersion = published.ok && published.version === expectedVersion;
const hasToken = repoSecrets.hasToken || envSecrets.hasToken;

console.log(`npm release readiness for ${packageName}@${expectedVersion}`);
console.log("");
console.log(`${statusIcon(isExpectedVersion)} npm registry version: ${published.version ?? "not published"}`);
if (published.detail) {
  console.log(`   ${published.detail}`);
}
console.log(`${statusIcon(whoami.ok)} local npm session: ${whoami.user ?? "not logged in"}`);
if (whoami.detail) {
  console.log(`   ${whoami.detail}`);
}
console.log(`${statusIcon(repoSecrets.hasToken)} repo NPM_TOKEN secret: ${repoSecrets.hasToken ? "present" : "absent"}`);
if (repoSecrets.detail) {
  console.log(`   ${repoSecrets.detail}`);
}
console.log(`${statusIcon(envSecrets.hasToken)} ${environment} NPM_TOKEN secret: ${envSecrets.hasToken ? "present" : "absent"}`);
if (envSecrets.detail) {
  console.log(`   ${envSecrets.detail}`);
}
console.log("");

if (isExpectedVersion) {
  console.log("Release is visible on npm at the expected version.");
  process.exit(0);
}

console.log("Release is not complete yet.");
console.log("");
console.log("Next options:");
console.log(`1. Configure npm Trusted Publishing for ${packageName}:`);
console.log(`   npx --yes npm@11.14.0 trust github ${packageName} --repo ${repo} --file npm-publish.yml --env ${environment}`);
console.log("2. Or add an npm publish token:");
console.log(`   gh secret set NPM_TOKEN --repo ${repo} --env ${environment}`);
console.log("3. Then rerun:");
console.log(`   gh workflow run npm-publish.yml --ref main -f release_tag=v${expectedVersion} -f dry_run=false -f tag=latest`);

if (!whoami.ok && !hasToken) {
  process.exit(1);
}

process.exit(2);
