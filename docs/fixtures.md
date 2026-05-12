# Fixture Contributions

Fixtures are how Glamsterdam Compatibility Lab learns which scanner signals are useful. Prefer small, reviewable examples that exercise one behavior clearly.

## What to Share

- EVM runtime bytecode or init code with enough context to know which one it is.
- Transaction traces from tools such as geth `debug_traceTransaction`, Besu, Nethermind, Foundry, Hardhat, Erigon, or call tracers.
- Indexer and explorer configs, including subgraphs, event/call/block handlers, and replay settings.
- Validator or operator configs with client, builder/API, monitoring, and testnet/devnet metadata.
- Compatibility matrices that are explicitly sourced from client release notes, devnet docs, or maintainer statements.

## Redaction Rules

Remove private keys, seed phrases, auth tokens, RPC credentials, validator keys, fee recipient secrets, internal hostnames, private endpoints, and non-public incident details.

For public-chain examples, addresses and transaction hashes are usually fine if they are already public. For private or internal examples, replace addresses, hashes, hostnames, and organization names with deterministic placeholders.

## Minimum Metadata

When possible, include:

- Source type: synthetic, public-chain, public repo, anonymized internal, or generated example.
- Tool or client name and version.
- Command or API used to produce the fixture.
- Trace mode or tracer name, such as `structLogs` or `callTracer`.
- Network, chain ID, or devnet name.
- Whether the fixture is complete or intentionally partial.
- Expected scanner behavior, including findings that should or should not appear.

## Provenance Manifest

Every committed fixture under `fixtures/` should have a matching entry in `fixtures/provenance.json`.

Each manifest entry records:

- Fixture path and scanner kind.
- Source type, such as synthetic, public-chain, public repo, anonymized internal, or generated example.
- Capture tool, version, command, and trace mode when known.
- Network and transaction hash when the fixture came from public-chain data.
- Contract address and block number when a bytecode fixture came from public-chain `eth_getCode` data.
- Completeness level and redaction posture.
- Expected scanner finding IDs.
- Related EIPs when the fixture is meant to exercise specific compatibility paths.

If older fixture metadata is incomplete, mark it as partial and explain the gap in `source.notes` instead of filling in guesses.

## Licensing

Only contribute fixtures that can be published under this repository's license. If a fixture came from another project, include the source URL and license. When in doubt, open a fixture contribution issue before opening a pull request.

## Snapshot Expectations

If a fixture changes report wording or JSON structure, update golden report snapshots with:

```sh
pnpm test:update
pnpm test
pnpm build
```

Snapshots are part of the product. They protect report language from accidental drift.

Comparison fixtures live under `fixtures/reports/`. They should be small JSON reports that make added, removed, changed, and unchanged findings obvious. Keep them deterministic and avoid embedding inferred gas deltas unless the input report already contains explicit sourced values.

## Public Dataset Seed

The seed dataset in `datasets/public-seed/` is generated from the provenance manifest and current scanner output:

```sh
pnpm dataset:generate
pnpm test
pnpm build
```

The dataset includes default-profile reports for every scannable fixture, default-vs-research comparisons for bytecode and trace fixtures, and a small summary of aggregate counts. Treat the seed as reproducibility scaffolding, not as an aggregate public-chain readiness study.

## Capturing RPC Traces

Use `scan-tx --trace-out` when you have an execution RPC endpoint that supports `debug_traceTransaction`:

```sh
ETH_RPC_URL=https://your-execution-rpc.example \
  pnpm glamsterdam scan-tx \
  --tx 0x0000000000000000000000000000000000000000000000000000000000000000 \
  --trace-out fixtures/traces/example-real-trace.json
```

Review the saved file before committing it. Remove credentials, internal hostnames, private transaction data, and anything that is not safe to publish.

`fixtures/traces/drpc-call-tracer-real.json` is an example of this flow. It was captured from a public Ethereum transaction using a public dRPC endpoint with `--tracer callTracer`; the fixture is public-chain data and should be treated as a normalization sample, not as an endorsement of any RPC provider.

`fixtures/traces/besu-mainnet-tracoor-debug-structlogs.json` and `fixtures/traces/nethermind-mainnet-tracoor-debug-structlogs.json` are public-chain examples extracted from Tracoor execution block trace exports. Keep extracted fixtures small, retain the source export URL in `fixtures/provenance.json`, and do not commit full block-trace downloads unless there is a specific review need.

`fixtures/indexers/explorer-replay-indexer.json` and the validator operator variants under `fixtures/validator/` show public-safe placeholder configs for richer metadata paths. Use reserved names, zero addresses, and `example.invalid` URLs for synthetic fixtures that are meant to model config shape rather than disclose a real deployment.
