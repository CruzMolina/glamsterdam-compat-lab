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

  const publishJob = workflow?.jobs?.publish;
  const setupNodeStep = publishJob?.steps?.find((step) => String(step?.uses ?? "").startsWith("actions/setup-node@"));
  const publishStep = publishJob?.steps?.find((step) => step?.name === "Publish");
  const dryRunStep = publishJob?.steps?.find((step) => step?.name === "Dry-run publish");
  const publishRun = String(publishStep?.run ?? "");
  const dryRun = String(dryRunStep?.run ?? "");
  const problems = [];

  if (workflow?.permissions?.["id-token"] !== "write") {
    problems.push("missing top-level permissions.id-token: write");
  }
  if (publishJob?.environment !== environment) {
    problems.push(`publish job environment is not ${environment}`);
  }
  if (setupNodeStep?.with?.["registry-url"] !== registry.replace(/\/$/, "")) {
    problems.push(`setup-node registry-url is not ${registry.replace(/\/$/, "")}`);
  }
  if (!publishRun.includes("npm publish") || !publishRun.includes("--provenance")) {
    problems.push("Publish step does not run npm publish --provenance");
  }
  if (!dryRun.includes("npm publish") || !dryRun.includes("--dry-run")) {
    problems.push("Dry-run publish step does not run npm publish --dry-run");
  }
  if (publishRun.includes("unset NPM_CONFIG_USERCONFIG") || dryRun.includes("unset NPM_CONFIG_USERCONFIG")) {
    problems.push("tokenless path unsets setup-node npm userconfig");
  }

  return {
    ok: problems.length === 0,
    detail: problems.join("; ")
  };
}

function printTokenSecretCommand() {
  console.log("   Create a granular npm access token with read/write package permission.");
  console.log("   Enable bypass 2FA on the token if npm requires 2FA for non-interactive publishing.");
  console.log('   NPM_TOKEN="${NPM_TOKEN:-${NODE_AUTH_TOKEN:-}}"');
  console.log('   test -n "${NPM_TOKEN:-}" || { echo "Set NPM_TOKEN or NODE_AUTH_TOKEN first"; exit 1; }');
  console.log(`   gh secret set NPM_TOKEN --repo ${repo} --env ${environment} --body "$NPM_TOKEN"`);
}

const published = npmViewVersion();
const whoami = npmWhoami();
const repoSecrets = ghSecrets([]);
const envSecrets = ghSecrets(["--env", environment]);
const localNpmToken = hasEnvToken("NPM_TOKEN");
const localNodeAuthToken = hasEnvToken("NODE_AUTH_TOKEN");
const localToken = localNpmToken || localNodeAuthToken;
const workflowShape = checkWorkflowShape();
const isExpectedVersion = published.ok && published.version === expectedVersion;
const isPackageVisible = published.ok && published.version !== null;
const hasTokenSecret = repoSecrets.hasToken || envSecrets.hasToken;

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
console.log(`${statusIcon(localNpmToken)} local NPM_TOKEN env: ${localNpmToken ? "present" : "absent"}`);
console.log(`${statusIcon(localNodeAuthToken)} local NODE_AUTH_TOKEN env: ${localNodeAuthToken ? "present" : "absent"}`);
console.log(`${statusIcon(repoSecrets.hasToken)} repo NPM_TOKEN secret: ${repoSecrets.hasToken ? "present" : "absent"}`);
if (repoSecrets.detail) {
  console.log(`   ${repoSecrets.detail}`);
}
console.log(`${statusIcon(envSecrets.hasToken)} ${environment} NPM_TOKEN secret: ${envSecrets.hasToken ? "present" : "absent"}`);
if (envSecrets.detail) {
  console.log(`   ${envSecrets.detail}`);
}
console.log(`${statusIcon(workflowShape.ok)} publish workflow OIDC shape: ${workflowShape.ok ? "ready" : "needs attention"}`);
if (workflowShape.detail) {
  console.log(`   ${workflowShape.detail}`);
}
console.log("");

if (isExpectedVersion) {
  console.log("Release is visible on npm at the expected version.");
  process.exit(0);
}

console.log("Release is not complete yet.");
console.log("");
console.log("Next options:");
if (!workflowShape.ok) {
  console.log(`1. Fix ${workflowFile}:`);
  console.log("   ensure id-token: write, setup-node registry-url, npm publish --provenance, and preserved setup-node userconfig");
  console.log("2. Then rerun:");
  console.log("   pnpm release:check-npm");
  process.exit(1);
}
if (isPackageVisible) {
  console.log(`1. Configure npm Trusted Publishing for ${packageName}:`);
  console.log(`   npx --yes npm@11.14.0 trust github ${packageName} --repo ${repo} --file npm-publish.yml --env ${environment}`);
  console.log("2. Or add an npm publish token:");
  printTokenSecretCommand();
  console.log("3. Then rerun:");
  console.log(`   gh workflow run npm-publish.yml --ref main -f release_tag=v${expectedVersion} -f dry_run=false -f tag=latest`);
} else {
  console.log("1. Configure Trusted Publishing with an npm owner or publisher session:");
  console.log(`   npx --yes npm@11.14.0 trust github ${packageName} --repo ${repo} --file npm-publish.yml --env ${environment}`);
  console.log("   Or use npmjs.com if the CLI cannot configure a pre-publish package grant.");
  console.log("2. Or add a publish-capable npm token for the first publish:");
  printTokenSecretCommand();
  console.log("3. Then rerun:");
  console.log(`   gh workflow run npm-publish.yml --ref main -f release_tag=v${expectedVersion} -f dry_run=false -f tag=latest`);
}

if (!whoami.ok && !localToken && !hasTokenSecret) {
  process.exit(1);
}

process.exit(2);
