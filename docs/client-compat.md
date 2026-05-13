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
    "retrievedAt": "2026-05-13",
    "claim": "The glamsterdam-devnet-2 Kurtosis example lists geth with image ethpandaops/geth:bal-devnet-6 as the execution-layer participant."
  },
  "notes": "Devnet image only. This is not a production Geth release compatibility claim."
}
```

Supported source types are:

- `public-devnet-spec`
- `public-interop-recap`
- `public-client-release`
- `public-spec-release`
- `synthetic-example`
- `operator-maintained`

For public sources, use stable public URLs and record the date you retrieved the source. Add `sourceDate` when the source has a clear publication or release date. Use `public-devnet-spec` and `public-interop-recap` for devnet image provenance, `public-client-release` for client release-note provenance, and `operator-maintained` for an operator or client team compatibility statement maintained outside release notes.

`public-client-release` can support `partial` only when the release note explicitly mentions Glamsterdam, Amsterdam, Gloas, ePBS, Block Access Lists, or a tracked fork EIP. It can support `compatible` only when the release note explicitly says the version is compatible or ready for the tracked Glamsterdam/Amsterdam/Gloas scope.
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
    "retrievedAt": "2026-05-13",
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

The checker validates schema shape, duplicate client keys, source dates against `lastUpdated`, devnet participant/client-entry consistency, documented participant exclusions, and conservative status rules. Public devnet, interop, and spec-release sources cannot be used as `compatible` client claims; keep those entries `partial` or `unknown` unless an explicit client release or operator-maintained source supports compatibility. Public client releases also need explicit fork-signal text for `partial` and explicit compatibility/readiness wording for `compatible`.

Run the live freshness audit when reviewing whether source records need a new retrieval pass:

```sh
pnpm readiness:freshness
pnpm readiness:freshness --as-of 2026-08-15
```

Generated artifacts classify source retrieval age against `readiness.lastUpdated`: `fresh` is 0-30 days, `watch` is 31-90 days, and `stale` is more than 90 days. The live audit compares the same `retrievedAt` values against the current date by default. `watch` and `stale` are refresh prompts only; they do not mean the client is incompatible.

The public seed dataset also exports matrix visibility into `datasets/public-seed/readiness.json`, `readiness-clients.csv`, `readiness-devnets.csv`, and `readiness-sources.csv`. The readiness JSON and static browser include source-type counts so maintainers can distinguish devnet image provenance, client release-note provenance, spec provenance, synthetic examples, and operator-maintained claims. These exports are audit aids: they show what the matrix says, how old the sources are, and which devnet participants are mirrored by client-version rows. They do not promote devnet participation to production compatibility.

## Source Review Snapshot

The current source-review snapshot is dated `2026-05-13`. Refresh this table when `data/eips/glamsterdam.json`, `data/client-compat/clients.example.json`, or the public readiness sources change.

| URL | Retrieved | Source date | Claim | Conservative note |
| --- | --- | --- | --- | --- |
| `https://eips.ethereum.org/EIPS/eip-7773` | 2026-05-13 | 2024-09-26 | Lists scheduled, considered, declined, and proposed Glamsterdam EIPs; activation rows remain unfilled. | Canonical status grouping for the local registry until the meta EIP changes. |
| `https://ethereum.org/roadmap/glamsterdam/` | 2026-05-13 | 2026-04-13 | Describes Glamsterdam as an upcoming H1 2026 upgrade and points to Forkcast for latest status. | Roadmap context only; use EIP-7773/Forkcast for status grouping. |
| `https://forkcast.org/upgrade/glamsterdam/` | 2026-05-13 | unknown | Public status surface linked from ethereum.org and EF Checkpoint #9. | Keep as a pointer unless structured status is ingested explicitly. |
| `https://blog.ethereum.org/2026/04/10/checkpoint-9` | 2026-05-13 | 2026-04-10 | Explains scheduled and considered Glamsterdam feature expectations and devnet sequencing. | Process/status context, not a client compatibility source. |
| `https://blog.ethereum.org/2026/05/02/soldogn-interop-recap` | 2026-05-13 | 2026-05-02 | Reports stable multi-client Glamsterdam devnet progress and nearly all clients on glamsterdam-devnet-2. | Interop progress is not production release compatibility. |
| `https://notes.ethereum.org/@ethpandaops/glamsterdam-devnet-2` | 2026-05-13 | unknown | Lists glamsterdam-devnet-2 EIPs, spec versions, and Kurtosis participant images. | Devnet participant images remain `partial`. |
| `https://github.com/ethereum/consensus-specs/releases/tag/v1.7.0-alpha.7` | 2026-05-13 | 2026-04-29 | Pre-release with Gloas changes referenced by the devnet spec. | Spec provenance, not a client release. |
| `https://github.com/ethereum/execution-spec-tests/releases/tag/bal%40v5.6.1` | 2026-05-13 | 2026-04-02 | BAL/state-gas pre-release used by devnet testing. | Spec-test provenance, not a client release. |
| `https://github.com/ethereum/go-ethereum/releases/tag/v1.17.3` | 2026-05-13 | 2026-05-11 | Describes continued progress on Amsterdam implementation and lists prerequisites for EIP-7928, EIP-8037, EIP-7976, EIP-7981, EIP-7610, and updated state tests. | Recorded as `partial`; it does not assert complete Glamsterdam production compatibility. |
| `https://github.com/NethermindEth/nethermind/releases/tag/1.37.2` | 2026-05-13 | 2026-05-05 | Describes healthcheck and archive invalid-block fixes for v1.37.1. | Recorded as `unknown`; no explicit Glamsterdam/Amsterdam readiness signal found. |
| `https://github.com/besu-eth/besu/releases/tag/26.5.0` | 2026-05-13 | 2026-05-12 | Lists Block Access List pipeline work, EIP-7928 budget enforcement, Block Access List encoding changes, and EIP-7981 added to Amsterdam. | Recorded as `partial`; it does not assert complete Glamsterdam production compatibility. |
| `https://github.com/paradigmxyz/reth/releases/tag/v2.2.0` | 2026-05-13 | 2026-04-30 | Says the release lays groundwork for Amsterdam EIP-7928 Block Access Lists with BAL store, P2P, builder, and execution-path work. | Recorded as `partial`; groundwork and gated paths are not complete readiness. |
| `https://github.com/sigp/lighthouse/releases/tag/v8.1.3` | 2026-05-13 | 2026-03-26 | Latest Lighthouse release focuses on security fixes, Gnosis Fulu scheduling, and performance fixes. | Recorded as `unknown`; the latest release note does not itself state Glamsterdam/Amsterdam/Gloas readiness. |
| `https://github.com/sigp/lighthouse/releases/tag/v8.1.0` | 2026-05-13 | 2026-02-05 | Lists Gloas gossip, data-column, consensus type, payment-field, and EIP-7732 container/constant work. | Recorded as `partial`; it does not assert complete Glamsterdam production compatibility. |
| `https://github.com/ChainSafe/lodestar/releases/tag/v1.42.0` | 2026-05-13 | 2026-04-13 | Says Lodestar is making great strides toward the Gloas hard fork and lists Gloas/ePBS implementation work. | Recorded as `partial`; it does not assert complete Glamsterdam production compatibility. |
| `https://github.com/OffchainLabs/prysm/releases/tag/v7.1.3` | 2026-05-13 | 2026-03-18 | Describes extensive Gloas groundwork and lists builder, bid, slashing, API, payload attestation, and timing work. | Recorded as `partial`; it does not assert complete Glamsterdam production compatibility. |
| `https://github.com/Consensys/teku/releases/tag/26.4.0` | 2026-05-13 | 2026-03-31 | Adds the PostPtcDuties REST API endpoint for the Gloas API. | Recorded as `partial`; it does not assert complete Glamsterdam production compatibility. |
| `https://github.com/status-im/nimbus-eth2/releases/tag/v26.3.1` | 2026-05-13 | 2026-03-28 | Describes Ethereum column-handling performance, validator robustness, Gnosis Fulu scheduling, and fast-confirmation work. | Recorded as `unknown`; no explicit Glamsterdam/Amsterdam/Gloas readiness signal found. |
| `https://github.com/grandinetech/grandine/releases/tag/2.0.4` | 2026-05-13 | 2026-03-31 | Lists post-Gloas beacon block API publishing, execution payload bid endpoints, payload attestation ticks, and consensus spec tests v1.7.0-alpha.3. | Recorded as `partial`; it does not assert complete Glamsterdam production compatibility. |

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
