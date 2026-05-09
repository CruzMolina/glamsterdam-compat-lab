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
