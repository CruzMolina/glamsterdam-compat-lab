# Release Runbook

This project publishes GitHub releases and npm packages separately. A release is not complete until both the GitHub release exists and npm shows the expected package version.

## Current npm package

- Package: `glamsterdam-compat-lab`
- Latest published release tag: `v0.3.3`
- Latest published npm version: `0.3.3`
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

`pnpm pack:dry-run` runs `npm publish --dry-run`. If the current package version is already published on npm, the helper treats npm's previously-published version response as a version-state signal after local publish checks have run.

Confirm the package state for the target version. A new release version should not already be published:

```sh
npm view glamsterdam-compat-lab@<version> version --json
```

You can also run the release readiness helper, which checks the npm registry, local npm login state, absence of local or GitHub npm token credentials, and the publish workflow's OIDC shape:

```sh
pnpm release:check-npm
```

## Preferred path: npm Trusted Publishing

npm Trusted Publishing uses GitHub Actions OIDC instead of a long-lived npm token. The `Publish npm` workflow is configured for this path with a GitHub-hosted runner, Node 24, and `npm publish --provenance`.

The workflow is intentionally tokenless. Keep repository-level and `npm-publish` environment `NPM_TOKEN` secrets absent. Dependency install, tests, build, and package checks run in a read-only `preflight` job without `id-token: write`; only the isolated `publish` job has `id-token: write`, and that job only downloads the preflight tarball and invokes npm publish.

Keep both release jobs on Node 24 and keep artifact transfer on Node 24-ready action majors: `actions/upload-artifact@v7` or newer for the preflight tarball upload, and `actions/download-artifact@v8` or newer for the isolated publish job. The readiness helper enforces these minimums so future workflow edits do not reintroduce the GitHub Actions Node 20 deprecation warning path.

As of the latest dry-run verification, `actions/download-artifact@v8` may still emit an upstream Node `Buffer()` deprecation warning internally. Treat that as distinct from the GitHub Actions Node 20 deprecation annotation; keep watching upstream action releases, but do not downgrade artifact actions to suppress it.

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

If a dry run is repeated for a version already published on npm, the workflow preflights that exact package version after install, tests, build, and packed-install checks. It exits successfully with an `Already published` notice instead of invoking `npm publish --dry-run`, because npm rejects previously published versions even in dry-run mode.

If the logs show `Signed provenance statement` followed by `npm error 404 Not Found - PUT`, OIDC/provenance is working, but npm has not authorized this workflow or account to publish the package name. Verify the Trusted Publishing package grant.

## Token fallback policy

The release workflow does not support `NPM_TOKEN`. If Trusted Publishing becomes unavailable, pause the release and fix the npm trusted-publisher configuration. A token-based emergency publish should be treated as a deliberate, temporary workflow change with a short-lived token, immediate GitHub secret removal, and npm token revocation afterward.

## Done criteria

An npm release is done when all of these are true:

- npm shows the expected version for the release tag.
- The `latest` dist-tag points at the expected version, unless intentionally publishing under another tag.
- A fresh install smoke from the registry runs `glamsterdam --version` and a simple CLI command such as `glamsterdam eips --format json`.
- The GitHub release notes or release task are updated with the successful publish and verification evidence.
