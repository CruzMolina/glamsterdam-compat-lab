# Release Runbook

This project publishes GitHub releases and npm packages separately. A release is not complete until both the GitHub release exists and npm shows the expected package version.

## Current npm package

- Package: `glamsterdam-compat-lab`
- Latest published release tag: `v0.2.2`
- Latest published npm version: `0.2.2`
- Publish workflow: `.github/workflows/npm-publish.yml`
- Trusted Publishing: configured for repository `CruzMolina/glamsterdam-compat-lab`, workflow `npm-publish.yml`, and environment `npm-publish`

## Preflight

Run these checks before publishing:

```sh
pnpm test
pnpm build
pnpm pack:dry-run
pnpm release:check-pack
```

`pnpm release:check-pack` packs the current build, installs the tarball into a temporary global prefix, verifies the `glamsterdam` bin, and confirms the real public trace fixture is included.

Confirm the package state for the target version. A new release version should not already be published:

```sh
npm view glamsterdam-compat-lab@<version> version --json
```

You can also run the release readiness helper, which checks the npm registry, local npm login state, local `NPM_TOKEN` or `NODE_AUTH_TOKEN` environment presence, GitHub `NPM_TOKEN` secret presence, and the publish workflow's OIDC shape:

```sh
pnpm release:check-npm
```

## Preferred path: npm Trusted Publishing

npm Trusted Publishing uses GitHub Actions OIDC instead of a long-lived npm token. The `Publish npm` workflow is configured for this path with a GitHub-hosted runner, Node 24, `id-token: write`, `actions/setup-node` registry setup for `https://registry.npmjs.org`, and `npm publish --provenance`.

The steady-state OIDC path does not require an npm token secret. Keep repository-level and `npm-publish` environment `NPM_TOKEN` secrets absent unless an emergency fallback is in use. If `NPM_TOKEN` is present, the workflow writes a temporary `.npmrc` only for that token fallback.

The package is configured on npm with:

- Provider: GitHub Actions
- Owner or organization: `CruzMolina`
- Repository: `glamsterdam-compat-lab`
- Workflow file: `npm-publish.yml`
- Environment: `npm-publish`

The workflow uses the GitHub Environment `npm-publish`, which is restricted to protected branches. If you require manual approval or environment-scoped secrets for publishing, configure them on that environment.

If your local npm session has package write access, the equivalent CLI setup is:

```sh
npx --yes npm@11.14.0 trust github glamsterdam-compat-lab \
  --repo CruzMolina/glamsterdam-compat-lab \
  --file npm-publish.yml \
  --env npm-publish
```

npm documents `npm trust` as the command-line equivalent of managing trusted publisher configurations on npmjs.com. It requires npm 11.10.0 or newer, an npm owner or publisher login, write permission on the package, and 2FA when the account requires it. If the command fails with `E401` and says you must be logged in to publish packages, authenticate with the npm owner or publisher account before retrying.

Trusted Publishing also validates repository metadata during publish. Keep `package.json` `repository.url` aligned with `git+https://github.com/CruzMolina/glamsterdam-compat-lab.git`.

You can verify the trusted-publisher shape without writing to npm:

```sh
npx --yes npm@11.14.0 trust github glamsterdam-compat-lab \
  --repo CruzMolina/glamsterdam-compat-lab \
  --file npm-publish.yml \
  --env npm-publish \
  --dry-run --json
```

Then run the workflow from `main`:

```sh
gh workflow run npm-publish.yml \
  --ref main \
  -f release_tag=vX.Y.Z \
  -f dry_run=true \
  -f tag=latest
```

If the dry run passes for a new release version, run the real publish:

```sh
gh workflow run npm-publish.yml \
  --ref main \
  -f release_tag=vX.Y.Z \
  -f dry_run=false \
  -f tag=latest
```

If the real publish fails with `ENEEDAUTH`, verify the npm Trusted Publishing configuration first. The workflow filename and repository fields are case-sensitive.

If a dry run is repeated for a version already published on npm, npm may fail with `You cannot publish over the previously published versions`. Treat that as a version-state signal, not a build/test failure, after confirming the workflow reached the npm publish dry-run step.

If the logs show `Signed provenance statement` followed by `npm error 404 Not Found - PUT`, OIDC/provenance is working, but npm has not authorized this workflow or account to publish the package name. Verify the Trusted Publishing package grant.

## Emergency fallback: npm token

Use a token only if Trusted Publishing is unavailable and a release must be unblocked. Create a granular npm access token with read/write package permission for `glamsterdam-compat-lab` or all packages the npm owner can publish. If the npm account or package requires 2FA, enable the token's bypass-2FA option for non-interactive CI publishing. Then add the token as the `NPM_TOKEN` secret on the `npm-publish` environment or as a repository secret.

If the token is available in your shell as `NPM_TOKEN` or `NODE_AUTH_TOKEN`, set the environment secret without printing the token value:

```sh
NPM_TOKEN="${NPM_TOKEN:-${NODE_AUTH_TOKEN:-}}"
test -n "${NPM_TOKEN:-}" || { echo "Set NPM_TOKEN or NODE_AUTH_TOKEN first"; exit 1; }
gh secret set NPM_TOKEN --repo CruzMolina/glamsterdam-compat-lab --env npm-publish --body "$NPM_TOKEN"
```

When this secret is present, the workflow exports it as `NODE_AUTH_TOKEN` and writes a temporary npm user config for the publish step. When the secret is absent, the workflow leaves token auth unset and relies on Trusted Publishing/OIDC.

Rerun the same workflow:

```sh
gh workflow run npm-publish.yml \
  --ref main \
  -f release_tag=vX.Y.Z \
  -f dry_run=false \
  -f tag=latest
```

After any token-based publish, remove the GitHub `NPM_TOKEN` secret, revoke the npm token, and return the package to Trusted Publishing.

## Done criteria

An npm release is done when all of these are true:

- npm shows the expected version for the release tag.
- The `latest` dist-tag points at the expected version, unless intentionally publishing under another tag.
- A fresh install smoke from the registry runs `glamsterdam --version` and a simple CLI command such as `glamsterdam eips --format json`.
- The GitHub release notes or release task are updated with the successful publish and verification evidence.
