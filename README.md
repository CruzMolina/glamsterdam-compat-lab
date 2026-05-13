# Glamsterdam Compatibility Lab

Glamsterdam Compatibility Lab is an open-source CLI and TypeScript library for deterministic compatibility checks around Ethereum's upcoming Glamsterdam upgrade.

It helps smart-contract teams, dapp teams, indexers, explorers, infrastructure teams, and validator operators produce human-readable and machine-readable readiness reports from bytecode, traces, indexer configs, and local operator configs.

This is community open-source tooling. It is not official Ethereum Foundation tooling or an endorsement by the Ethereum Foundation.

## Why this exists

The Ethereum Foundation Ecosystem Support Program has a Glamsterdam-focused wishlist that calls out developer tooling, impact analysis, explorer/indexer support, validator tooling, monitoring tooling, and data-driven research. Glamsterdam planning currently includes scheduled work around Block-Level Access Lists and ePBS, plus considered work around gas repricing, native ETH transfer logs, contract-size changes, state creation costs, calldata costs, and related areas.

The final Glamsterdam scope and exact parameters may change. This project keeps assumptions in a versioned EIP registry so detector behavior can be updated without rewriting every scanner.

Useful anchors:

- [ESP Wishlist](https://esp.ethereum.foundation/applicants/wishlist)
- [EIP-7773: Hardfork Meta - Glamsterdam](https://eips.ethereum.org/EIPS/eip-7773)
- [ethereum.org Glamsterdam roadmap](https://ethereum.org/roadmap/glamsterdam/)
- [Protocol priorities update for 2026](https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026)
- [Soldogn interop recap](https://blog.ethereum.org/2026/05/02/soldogn-interop-recap)

## Install and run

For local development from a clone:

```sh
pnpm install
pnpm test
pnpm test:integration # requires ETH_RPC_URL and ETH_RPC_TX_HASH or ETH_RPC_TX
pnpm build
pnpm glamsterdam eips
pnpm glamsterdam scan-bytecode fixtures/bytecode/storage-heavy.hex
```

Install the published CLI from npm:

```sh
npm install -g glamsterdam-compat-lab@0.3.3
glamsterdam eips
```

The v0.3.3 GitHub release tarball remains available as a reproducible release artifact:

```sh
npm install -g https://github.com/CruzMolina/glamsterdam-compat-lab/releases/download/v0.3.3/glamsterdam-compat-lab-0.3.3.tgz
```

See [docs/release.md](docs/release.md) for maintainer release checks and npm publishing notes.

The default output format is Markdown. Use `--format json` for machine-readable reports.

## CLI commands

```sh
pnpm glamsterdam eips
pnpm glamsterdam scan-bytecode fixtures/bytecode/storage-heavy.hex --format markdown
pnpm glamsterdam scan-traces fixtures/traces/storage-heavy-trace.json --format json
ETH_RPC_URL=https://your-execution-rpc.example pnpm glamsterdam scan-tx --tx 0x0000000000000000000000000000000000000000000000000000000000000000 --format markdown
pnpm glamsterdam scan-indexer fixtures/indexers/subgraph.yaml --format markdown
pnpm glamsterdam scan-validator --config fixtures/validator/operator-config.yaml --format markdown
pnpm glamsterdam report report-a.json report-b.json --format markdown
pnpm glamsterdam compare-reports baseline-report.json candidate-report.json --format markdown
```

Each scanner accepts `--registry <path>` and `--thresholds <path>` so EIP metadata and detector thresholds can be updated without editing detector code.

## Examples

- [Storage-heavy bytecode report](examples/storage-heavy-bytecode.md)
- [Baseline comparison reports](examples/baseline-comparison.md)

## Public dataset seed

Fixture provenance lives in [fixtures/provenance.json](fixtures/provenance.json). The first deterministic dataset seed lives in [datasets/public-seed](datasets/public-seed) and includes generated JSON reports, default-vs-research threshold comparisons for bytecode and trace fixtures, a `summary.json` file with aggregate counts, and CSV exports (`reports.csv`, `findings.csv`, `summary.csv`) for spreadsheet and warehouse import.

The static dataset browser lives at [site/public-seed/index.html](site/public-seed/index.html). It is generated entirely from committed dataset files and can be opened directly in a browser for summary charts, report filters, text search, and fixture/provenance links.

See [docs/dataset.md](docs/dataset.md) for the dataset file contract and [examples/public-seed-analysis.md](examples/public-seed-analysis.md) for lightweight analysis snippets.

Regenerate and verify it with:

```sh
pnpm dataset:generate
pnpm dataset:check
pnpm site:generate
pnpm site:check
```

## What the scanners can detect

`scan-bytecode` normalizes EVM bytecode, disassembles opcodes while skipping PUSH data, counts relevant opcodes, and reports conservative risks around contract size, storage/account access, CREATE/CREATE2 usage, calldata copying, logs, and manual-review limits.

`scan-traces` accepts either this project's normalized trace shape:

```json
{
  "format": "glamsterdam-normalized-trace-v0",
  "steps": [
    { "op": "SLOAD", "depth": 1 },
    { "op": "SSTORE", "depth": 1 }
  ]
}
```

It also accepts common `debug_traceTransaction`-style objects with `structLogs`, JSON-RPC result wrappers, simple arrays of steps, Foundry/Hardhat-style JSON trace exports, Besu/Nethermind/geth-style struct logs, Erigon/parity-style action traces, and call-tracer-like trees with `calls` or `children`.

`scan-tx` fetches a transaction trace from an execution RPC endpoint that supports `debug_traceTransaction`, then runs the same deterministic trace scanner:

```sh
ETH_RPC_URL=https://your-execution-rpc.example \
  pnpm glamsterdam scan-tx \
  --tx 0x0000000000000000000000000000000000000000000000000000000000000000 \
  --tracer structLogs \
  --trace-out traces/tx.json \
  --format markdown

pnpm glamsterdam scan-tx \
  --rpc-url https://your-execution-rpc.example \
  --tx 0x0000000000000000000000000000000000000000000000000000000000000000 \
  --tracer callTracer \
  --format json
```

RPC URLs are not included in report targets or evidence. Do not paste private RPC URLs or credentials into issues, fixtures, or reports.

Use `--trace-out <path>` to save the fetched JSON-RPC trace response while also printing a compatibility report. This is the preferred way to turn a live RPC call into a reusable local fixture. Real-RPC integration tests are gated and skipped unless `ETH_RPC_URL` and `ETH_RPC_TX_HASH` or `ETH_RPC_TX` are set.

`scan-indexer` parses JSON and YAML, including `subgraph.yaml`-style configs. It flags event-only indexing assumptions, missing fork/EIP compatibility metadata, missing replay or testnet plans, missing BAL review metadata, and native ETH transfer log readiness as heuristic findings.

`scan-validator` parses JSON and YAML operator configs. It checks for execution, consensus, validator, builder/API, monitoring, and testnet/devnet metadata. It compares client names and versions against `data/client-compat/clients.example.json` or a user-provided matrix, but it does not guess compatibility. See [docs/client-compat.md](docs/client-compat.md) for the sourced matrix format.

`compare-reports` accepts two saved JSON compatibility reports and emits deterministic JSON or Markdown deltas. It compares findings by stable finding ID, reports findings added, removed, changed, and unchanged, and highlights severity and confidence changes. It does not invent exact gas deltas; those must come from explicit input data or future client outputs.

## Report model

Each scanner returns a `CompatibilityReport`:

```json
{
  "toolVersion": "0.3.3",
  "fork": "glamsterdam",
  "target": {
    "kind": "bytecode",
    "name": "fixtures/bytecode/storage-heavy.hex"
  },
  "summary": {
    "risk": "medium",
    "findingCount": 1,
    "highCount": 0,
    "mediumCount": 1,
    "lowCount": 0,
    "unknownCount": 0
  },
  "findings": [],
  "assumptions": [],
  "limitations": []
}
```

Severity means:

- `high`: likely requires action before fork or testnet readiness
- `medium`: likely requires review or testing
- `low`: informational or easy follow-up
- `unknown`: insufficient information; manual review needed

Confidence means:

- `high`: direct evidence from the input
- `medium`: strong heuristic
- `low`: weak heuristic or incomplete input

Comparison reports include baseline and candidate report references, risk and finding-count deltas, added/removed/changed/unchanged finding lists, and comparison assumptions and limitations. This supports workflows such as comparing default, research, and CI threshold-profile outputs:

```sh
pnpm glamsterdam scan-traces fixtures/traces/storage-heavy-trace.json \
  --thresholds data/detectors/thresholds.json \
  --format json > default-report.json

pnpm glamsterdam scan-traces fixtures/traces/storage-heavy-trace.json \
  --thresholds data/detectors/thresholds.research.json \
  --format json > research-report.json

pnpm glamsterdam compare-reports default-report.json research-report.json --format markdown
```

## Updating the EIP registry

Edit `data/eips/glamsterdam.json`.

Each entry includes an ID, name, status, domain, detector modules, and notes. Keep uncertain protocol details in the registry notes and external data files. Detector code should not invent exact gas deltas or final fork behavior.

## Updating detector thresholds

Edit `data/detectors/thresholds.json`.

Thresholds are conservative scanner heuristics, not protocol parameters. The default profile is `data/detectors/thresholds.json`; `data/detectors/thresholds.research.json` is more sensitive for broad data collection, and `data/detectors/thresholds.ci.json` is less sensitive for low-noise automation. When changing thresholds, add or update fixtures and run:

```sh
pnpm test:update
pnpm test
pnpm build
```

The golden report snapshots in `test/__snapshots__` are intentional review artifacts. Update them when report wording or JSON structure changes on purpose.

## Adding detectors

1. Add or update registry entries in `data/eips/glamsterdam.json`.
2. Implement detector logic in `src/detectors`.
3. Call the detector from a scanner in `src/scanners`.
4. Add a fixture that demonstrates the evidence.
5. Add a Vitest test.
6. Keep report language practical and humble.

## Contributing fixtures

Real-world and real-world-shaped fixtures are welcome when they are safe to publish. See [docs/fixtures.md](docs/fixtures.md) for redaction, licensing, metadata, and snapshot expectations.

## CI and issue triage

The GitHub Actions workflow runs install, tests, build, and an npm publish dry run from the package directory. Issue templates are included for detector requests, fixture contributions, registry updates, and false-positive/false-negative reports.

Release publishing notes live in [docs/release.md](docs/release.md).

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned phases. Phase 0 is released as `v0.1.0`; `v0.2.0` starts Phase 1 with RPC transaction trace ingestion and broader trace fixture coverage; `v0.3.0` adds baseline comparison reports; `v0.3.1` expands public-safe fixture and dataset coverage; `v0.3.2` adds packaged CSV dataset exports; `v0.3.3` adds additional public Geth and Reth trace fixture coverage.

## Disclaimer

Glamsterdam scope and gas parameters may change. Reports are compatibility prompts, not predictions of breakage. Always replay representative transactions against a relevant devnet, testnet, local fork configuration, or client release when available.
