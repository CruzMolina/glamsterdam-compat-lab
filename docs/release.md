# Release Runbook

This project publishes GitHub releases and npm packages separately. A release is not complete until both the GitHub release exists and npm shows the expected package version.

## Current npm target

- Package: `glamsterdam-compat-lab`
- Current release tag: `v0.2.2`
- Expected npm version: `0.2.2`
- Publish workflow: `.github/workflows/npm-publish.yml`

## Preflight

Run these checks before publishing:

```sh
pnpm test
pnpm build
pnpm pack:dry-run
```

Confirm the package is not already published at the target version:

```sh
npm view glamsterdam-compat-lab version --json
```

## Preferred path: npm Trusted Publishing

npm Trusted Publishing uses GitHub Actions OIDC instead of a long-lived npm token. The `Publish npm` workflow is configured for this path with a GitHub-hosted runner, Node 24, `id-token: write`, and `npm publish --provenance`.

Configure npm with:

- Provider: GitHub Actions
- Owner or organization: `CruzMolina`
- Repository: `glamsterdam-compat-lab`
- Workflow file: `npm-publish.yml`

The workflow uses the GitHub Environment `npm-publish`, which is restricted to protected branches. If you require manual approval or environment-scoped secrets for publishing, configure them on that environment.

Then run the workflow from `main`:

```sh
gh workflow run npm-publish.yml \
  --ref main \
  -f release_tag=v0.2.2 \
  -f dry_run=true \
  -f tag=latest
```

If the dry run passes, run the real publish:

```sh
gh workflow run npm-publish.yml \
  --ref main \
  -f release_tag=v0.2.2 \
  -f dry_run=false \
  -f tag=latest
```

If the real publish fails with `ENEEDAUTH`, verify the npm Trusted Publishing configuration first. The workflow filename and repository fields are case-sensitive.

If the logs show `Signed provenance statement` followed by `npm error 404 Not Found - PUT`, OIDC/provenance is working, but npm has not authorized this workflow or account to publish the package name. Verify the Trusted Publishing package grant. If npm does not allow Trusted Publishing to be configured before the first publish of this unscoped package, use the token fallback below for the first publish, then switch the package to Trusted Publishing afterward.

## Fallback path: npm token

Create an npm token with permission to publish `glamsterdam-compat-lab`, then add it as the `NPM_TOKEN` secret on the `npm-publish` environment or as a repository secret.

Rerun the same workflow:

```sh
gh workflow run npm-publish.yml \
  --ref main \
  -f release_tag=v0.2.2 \
  -f dry_run=false \
  -f tag=latest
```

After a successful token-based publish, configure Trusted Publishing for future releases and revoke unused publish tokens.

## Done criteria

The npm release is done when all of these are true:

- The `Publish npm` workflow completed successfully for `release_tag=v0.2.2`.
- `npm view glamsterdam-compat-lab version --json` returns `"0.2.2"`.
- Issue #17 is closed with the successful workflow run link.
