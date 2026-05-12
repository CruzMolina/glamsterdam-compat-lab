#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

const registry = "https://registry.npmjs.org/";
const repo = "CruzMolina/glamsterdam-compat-lab";
const environment = "npm-publish";
const workflowFile = ".github/workflows/npm-publish.yml";
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

function npmViewExpectedVersion() {
  const result = run("npm", ["view", `${packageName}@${expectedVersion}`, "version", "--json", `--registry=${registry}`]);

  if (!result.ok) {
    return { ok: false, version: null, detail: firstUsefulLine(result.stderr) || "target version not visible on npm" };
  }

  try {
    return { ok: true, version: JSON.parse(result.stdout), detail: "" };
  } catch {
    return { ok: true, version: result.stdout.replace(/^"|"$/g, ""), detail: "" };
  }
}

function npmViewDistTags() {
  const result = run("npm", ["view", packageName, "dist-tags", "--json", `--registry=${registry}`]);

  if (!result.ok) {
    return { ok: false, latest: null, detail: firstUsefulLine(result.stderr) || "dist-tags not visible on npm" };
  }

  try {
    const tags = JSON.parse(result.stdout);
    return { ok: true, latest: typeof tags.latest === "string" ? tags.latest : null, detail: "" };
  } catch {
    return { ok: false, latest: null, detail: "could not parse npm dist-tags" };
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

function absenceIcon(absent) {
  return absent ? "ok" : "unexpected";
}

function hasEnvToken(name) {
  return Boolean(process.env[name]?.trim());
}

function checkWorkflowShape() {
  let workflow;
  try {
    workflow = parseYaml(readFileSync(new URL(`../${workflowFile}`, import.meta.url), "utf8"));
  } catch (error) {
    return {
      ok: false,
      detail: `failed to read ${workflowFile}: ${error instanceof Error ? error.message : String(error)}`
    };
  }

  const workflowText = readFileSync(new URL(`../${workflowFile}`, import.meta.url), "utf8");
  const preflightJob = workflow?.jobs?.preflight;
  const publishJob = workflow?.jobs?.publish;
  const preflightSteps = preflightJob?.steps ?? [];
  const publishSteps = publishJob?.steps ?? [];
  const preflightSetupNodeStep = preflightSteps.find((step) => String(step?.uses ?? "").startsWith("actions/setup-node@"));
  const publishSetupNodeStep = publishSteps.find((step) => String(step?.uses ?? "").startsWith("actions/setup-node@"));
  const uploadArtifactStep = preflightSteps.find((step) => String(step?.uses ?? "").startsWith("actions/upload-artifact@"));
  const downloadArtifactStep = publishSteps.find((step) => String(step?.uses ?? "").startsWith("actions/download-artifact@"));
  const publishStep = publishJob?.steps?.find((step) => step?.name === "Publish");
  const dryRunStep = publishJob?.steps?.find((step) => step?.name === "Dry-run publish");
  const dryRunPackageVersionStep = preflightJob?.steps?.find((step) => step?.name === "Check dry-run package version");
  const preflightRuns = preflightSteps.map((step) => String(step?.run ?? "")).join("\n");
  const publishRuns = publishSteps.map((step) => String(step?.run ?? "")).join("\n");
  const publishRun = String(publishStep?.run ?? "");
  const dryRun = String(dryRunStep?.run ?? "");
  const dryRunPackageVersionRun = String(dryRunPackageVersionStep?.run ?? "");
  const problems = [];

  if (workflow?.permissions?.["id-token"] === "write") {
    problems.push("top-level permissions grants id-token: write");
  }
  if (workflow?.permissions?.contents !== "read") {
    problems.push("top-level permissions.contents is not read");
  }
  if (preflightJob?.permissions?.["id-token"] === "write") {
    problems.push("preflight job grants id-token: write");
  }
  if (preflightJob?.permissions?.contents !== "read") {
    problems.push("preflight job permissions.contents is not read");
  }
  if (publishJob?.permissions?.["id-token"] !== "write") {
    problems.push("publish job is missing permissions.id-token: write");
  }
  if (publishJob?.permissions?.contents !== "read") {
    problems.push("publish job permissions.contents is not read");
  }
  if (publishJob?.environment !== environment) {
    problems.push(`publish job environment is not ${environment}`);
  }
  if (!preflightSetupNodeStep) {
    problems.push("preflight job does not set up Node.js");
  }
  if (!publishSetupNodeStep) {
    problems.push("publish job does not set up Node.js");
  }
  if (!preflightRuns.includes("pnpm install --frozen-lockfile")) {
    problems.push("preflight job does not install dependencies");
  }
  if (!preflightRuns.includes("pnpm test")) {
    problems.push("preflight job does not run tests");
  }
  if (!preflightRuns.includes("pnpm build")) {
    problems.push("preflight job does not build");
  }
  if (!preflightRuns.includes("npm pack")) {
    problems.push("preflight job does not pack the npm artifact");
  }
  if (!uploadArtifactStep) {
    problems.push("preflight job does not upload the package artifact");
  }
  if (!downloadArtifactStep) {
    problems.push("publish job does not download the package artifact");
  }
  if (publishRuns.includes("pnpm install") || publishRuns.includes("pnpm test") || publishRuns.includes("pnpm build")) {
    problems.push("publish job runs dependency install, tests, or build");
  }
  if (!publishRun.includes("npm publish") || !publishRun.includes("--provenance")) {
    problems.push("Publish step does not run npm publish --provenance");
  }
  if (!dryRun.includes("npm publish") || !dryRun.includes("--dry-run")) {
    problems.push("Dry-run publish step does not run npm publish --dry-run");
  }
  if (
    !dryRunPackageVersionRun.includes("npm view") ||
    !dryRunPackageVersionRun.includes("already_published=true")
  ) {
    problems.push("Dry-run publish does not preflight already-published versions");
  }
  if (workflowText.includes("secrets.NPM_TOKEN") || workflowText.includes("NODE_AUTH_TOKEN")) {
    problems.push("publish workflow still references npm token credentials");
  }

  return {
    ok: problems.length === 0,
    detail: problems.join("; ")
  };
}

const published = npmViewExpectedVersion();
const distTags = npmViewDistTags();
const whoami = npmWhoami();
const repoSecrets = ghSecrets([]);
const envSecrets = ghSecrets(["--env", environment]);
const localNpmToken = hasEnvToken("NPM_TOKEN");
const localNodeAuthToken = hasEnvToken("NODE_AUTH_TOKEN");
const workflowShape = checkWorkflowShape();
const isExpectedVersion = published.ok && published.version === expectedVersion;
const isExpectedLatest = distTags.ok && distTags.latest === expectedVersion;
const tokenHygieneOk = !localNpmToken && !localNodeAuthToken && !repoSecrets.hasToken && !envSecrets.hasToken;

console.log(`npm release readiness for ${packageName}@${expectedVersion}`);
console.log("");
console.log(`${statusIcon(isExpectedVersion)} npm registry version: ${published.version ?? "not published"}`);
if (published.detail) {
  console.log(`   ${published.detail}`);
}
console.log(`${statusIcon(isExpectedLatest)} npm latest dist-tag: ${distTags.latest ?? "not visible"}`);
if (distTags.detail) {
  console.log(`   ${distTags.detail}`);
}
console.log(`ok local npm session: ${whoami.user ?? "not logged in (not required for workflow publish)"}`);
if (whoami.detail) {
  console.log(`   ${whoami.detail}`);
}
console.log(`${absenceIcon(!localNpmToken)} local NPM_TOKEN env: ${localNpmToken ? "present" : "absent"}`);
console.log(`${absenceIcon(!localNodeAuthToken)} local NODE_AUTH_TOKEN env: ${localNodeAuthToken ? "present" : "absent"}`);
console.log(`${absenceIcon(!repoSecrets.hasToken)} repo NPM_TOKEN secret: ${repoSecrets.hasToken ? "present" : "absent"}`);
if (repoSecrets.detail) {
  console.log(`   ${repoSecrets.detail}`);
}
console.log(`${absenceIcon(!envSecrets.hasToken)} ${environment} NPM_TOKEN secret: ${envSecrets.hasToken ? "present" : "absent"}`);
if (envSecrets.detail) {
  console.log(`   ${envSecrets.detail}`);
}
console.log(`${statusIcon(workflowShape.ok)} publish workflow OIDC shape: ${workflowShape.ok ? "ready" : "needs attention"}`);
if (workflowShape.detail) {
  console.log(`   ${workflowShape.detail}`);
}
console.log("");

if (isExpectedVersion && isExpectedLatest && workflowShape.ok && tokenHygieneOk) {
  console.log("Release is visible on npm at the expected version.");
  process.exit(0);
}

console.log("Release is not complete yet.");
console.log("");
console.log("Next options:");
if (!workflowShape.ok) {
  console.log(`1. Fix ${workflowFile}:`);
  console.log("   keep install/test/build in a read-only preflight job and grant id-token: write only to the isolated publish job");
  console.log("2. Then rerun:");
  console.log("   pnpm release:check-npm");
  process.exit(1);
}
if (!tokenHygieneOk) {
  console.log("1. Remove npm token residue:");
  console.log(`   delete repository and ${environment} environment NPM_TOKEN secrets, and unset local NPM_TOKEN/NODE_AUTH_TOKEN env vars`);
  console.log("2. Then rerun:");
  console.log("   pnpm release:check-npm");
  process.exit(1);
}

console.log(`1. Confirm npm Trusted Publishing for ${packageName}:`);
console.log(`   npx --yes npm@11.14.0 trust github ${packageName} --repo ${repo} --file npm-publish.yml --env ${environment} --dry-run --json`);
if (!whoami.ok) {
  console.log("   Use npmjs.com or an npm owner session if the trust configuration needs to be changed.");
}
console.log("2. Then run the release workflow:");
console.log(`   gh workflow run npm-publish.yml --ref main -f release_tag=v${expectedVersion} -f dry_run=true -f tag=latest`);
if (!published.ok || !isExpectedLatest) {
  console.log("3. If the dry run passes for an unpublished version, run:");
  console.log(`   gh workflow run npm-publish.yml --ref main -f release_tag=v${expectedVersion} -f dry_run=false -f tag=latest`);
}

process.exit(1);
