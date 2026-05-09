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
pnpm release:check-pack
```

`pnpm release:check-pack` packs the current build, installs the tarball into a temporary global prefix, verifies the `glamsterdam` bin, and confirms the real public trace fixture is included.

Confirm the package is not already published at the target version:

```sh
npm view glamsterdam-compat-lab version --json
```

You can also run the release readiness helper, which checks the npm registry, local npm login state, local `NPM_TOKEN` or `NODE_AUTH_TOKEN` environment presence, and GitHub `NPM_TOKEN` secret presence:

```sh
pnpm release:check-npm
```

## Preferred path: npm Trusted Publishing

npm Trusted Publishing uses GitHub Actions OIDC instead of a long-lived npm token. The `Publish npm` workflow is configured for this path with a GitHub-hosted runner, Node 24, `id-token: write`, and `npm publish --provenance`.

The default OIDC path does not create token-based npm auth config. If `NPM_TOKEN` is present, the workflow writes a temporary `.npmrc` only for that token fallback.

Configure npm with:

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

npm documents `npm trust` as the command-line equivalent of managing trusted publisher configurations on npmjs.com. It requires npm 11.10.0 or newer and write permission on the package. For a first publish of this unscoped package, use an npm owner or publisher session to try the CLI or npmjs.com setup. If npm does not allow the trusted publisher to be configured before the first publish, use the `NPM_TOKEN` fallback below for the first publish and switch back to Trusted Publishing afterward.

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
