# Client Compatibility Matrix

Validator and operator reports compare declared client metadata against `data/client-compat/clients.example.json` or a user-provided matrix passed with `scan-validator --client-matrix`.

The matrix is intentionally conservative. It records sourced statuses; it does not infer compatibility from a client name, a client family, or participation in older forks.

## Status Values

- `compatible`: the source explicitly says this client version or image is compatible with the tracked Glamsterdam scope.
- `partial`: the source shows devnet participation, test support, prerelease support, or incomplete readiness, but not production release compatibility.
- `incompatible`: the source explicitly says this client version is incompatible or should not be used for the tracked scope.
- `unknown`: no explicit readiness claim is available, or the available source is intentionally inconclusive.

Use `unknown` when a source does not state Glamsterdam readiness. Do not promote an entry to `compatible` because a client appears in a devnet, contains related code, or supports a prior fork.

## Version Entries

Each client version entry must include a source object:

```json
{
  "version": "ethpandaops/geth:bal-devnet-6",
  "status": "partial",
  "source": {
    "type": "public-devnet-spec",
    "url": "https://notes.ethereum.org/@ethpandaops/glamsterdam-devnet-2",
    "retrievedAt": "2026-05-12",
    "claim": "The glamsterdam-devnet-2 Kurtosis example lists geth with image ethpandaops/geth:bal-devnet-6 as the execution-layer participant."
  },
  "notes": "Devnet image only. This is not a production Geth release compatibility claim."
}
```

Supported source types are:

- `public-devnet-spec`
- `public-interop-recap`
- `public-spec-release`
- `synthetic-example`
- `operator-maintained`

For public sources, use stable public URLs and record the date you retrieved the source. Add `sourceDate` when the source has a clear publication or release date.
All matrix dates use `YYYY-MM-DD`.

## Devnet Entries

The matrix can also include `devnets` entries. These are useful for tracking public devnet context separately from production client release compatibility:

```json
{
  "name": "glamsterdam-devnet-2",
  "status": "partial",
  "source": {
    "type": "public-devnet-spec",
    "url": "https://notes.ethereum.org/@ethpandaops/glamsterdam-devnet-2",
    "retrievedAt": "2026-05-12",
    "claim": "The glamsterdam-devnet-2 spec includes a Kurtosis participants matrix with specific EL and CL devnet images."
  },
  "participants": [
    {
      "role": "execution",
      "name": "geth",
      "image": "ethpandaops/geth:bal-devnet-6",
      "status": "partial"
    }
  ]
}
```

Devnet entries should not be treated as production compatibility claims. Use them as provenance for test images, interoperability context, and follow-up review.
Every devnet participant with a concrete `execution`, `consensus`, or `validator` client image should also have a matching client version entry, unless the matrix documents a deliberate exclusion. This keeps operator fixtures from reporting `unknown` for an image that the same matrix already cites as a sourced public devnet participant.
When a devnet entry lists `specVersions`, add a source object for each spec version when a public release page or spec document is available.

## Scanner Behavior

`scan-validator` looks for `executionClient`, `consensusClient`, and `validatorClient` metadata in the operator config. It reports:

- missing client names or versions;
- unknown compatibility when a client/version is absent from the matrix;
- `partial`, `unknown`, or `incompatible` matrix statuses as findings;
- no client compatibility finding when a sourced matrix entry is `compatible`.

The scanner reports the matrix value without trying to override it. Update the matrix from explicit release notes, devnet specs, or operator-maintained source documents when readiness changes.

## Maintenance Check

Run the offline matrix checker after editing `data/client-compat/clients.example.json`:

```sh
pnpm client-matrix:check
```

The checker validates schema shape, duplicate client keys, source dates against `lastUpdated`, devnet participant/client-entry consistency, documented participant exclusions, and conservative status rules. Public devnet, interop, and spec-release sources cannot be used as `compatible` client claims; keep those entries `partial` or `unknown` unless an explicit client release or operator-maintained source supports compatibility.

The public seed dataset also exports matrix visibility into `datasets/public-seed/readiness.json`, `readiness-clients.csv`, `readiness-devnets.csv`, and `readiness-sources.csv`. The static browser renders the same source records at `site/public-seed/readiness.html`. These exports are audit aids: they show what the matrix says, how old the sources are, and which devnet participants are mirrored by client-version rows. They do not promote devnet participation to production compatibility.

## Updating The Matrix

1. Add or update a client version entry in `data/client-compat/clients.example.json`.
2. Include a source URL, retrieval date, and exact claim summary.
3. Prefer `partial` for devnet images and prerelease testing.
4. Prefer `unknown` when the source does not explicitly state readiness.
5. Use `matrixEntryExclusion.reason` on a devnet participant only when a concrete image intentionally should not have a matching client version entry.
6. Regenerate dataset and site artifacts when source records, source dates, client statuses, or devnet participants change.
7. Add scanner tests when a new matrix shape or status path is introduced.
8. Run:

```sh
pnpm client-matrix:check
pnpm dataset:generate
pnpm site:generate
pnpm dataset:check
pnpm site:check
pnpm test
pnpm build
```

If generated validator reports change, also run:

```sh
pnpm dataset:generate
pnpm test:update
```
