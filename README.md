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

```sh
pnpm install
pnpm test
pnpm build
pnpm glamsterdam eips
pnpm glamsterdam scan-bytecode fixtures/bytecode/storage-heavy.hex
```

The default output format is Markdown. Use `--format json` for machine-readable reports.

## CLI commands

```sh
pnpm glamsterdam eips
pnpm glamsterdam scan-bytecode fixtures/bytecode/storage-heavy.hex --format markdown
pnpm glamsterdam scan-traces fixtures/traces/storage-heavy-trace.json --format json
pnpm glamsterdam scan-indexer fixtures/indexers/subgraph.yaml --format markdown
pnpm glamsterdam scan-validator --config fixtures/validator/operator-config.yaml --format markdown
pnpm glamsterdam report report-a.json report-b.json --format markdown
```

Each scanner accepts `--registry <path>` and `--thresholds <path>` so EIP metadata and detector thresholds can be updated without editing detector code.

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

It also accepts common `debug_traceTransaction`-style objects with `structLogs`, JSON-RPC result wrappers, simple arrays of steps, Erigon/parity-style action traces, and call-tracer-like trees with `calls`.

`scan-indexer` parses JSON and YAML, including `subgraph.yaml`-style configs. It flags event-only indexing assumptions, missing fork/EIP compatibility metadata, missing replay or testnet plans, missing BAL review metadata, and native ETH transfer log readiness as heuristic findings.

`scan-validator` parses JSON and YAML operator configs. It checks for execution, consensus, validator, builder/API, monitoring, and testnet/devnet metadata. It compares client names and versions against `data/client-compat/clients.example.json` or a user-provided matrix, but it does not guess compatibility.

## Report model

Each scanner returns a `CompatibilityReport`:

```json
{
  "toolVersion": "0.1.0",
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

## Updating the EIP registry

Edit `data/eips/glamsterdam.json`.

Each entry includes an ID, name, status, domain, detector modules, and notes. Keep uncertain protocol details in the registry notes and external data files. Detector code should not invent exact gas deltas or final fork behavior.

## Updating detector thresholds

Edit `data/detectors/thresholds.json`.

Thresholds are conservative scanner heuristics, not protocol parameters. When changing thresholds, add or update fixtures and run:

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

## CI and issue triage

The GitHub Actions workflow runs install, tests, and build from the package directory. Issue templates are included for detector requests, registry updates, and false-positive/false-negative reports.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned phases. Phase 0 is released as `v0.1.0`; Phase 1 starts with broader trace support and replay-oriented fixtures.

## Disclaimer

Glamsterdam scope and gas parameters may change. Reports are compatibility prompts, not predictions of breakage. Always replay representative transactions against a relevant devnet, testnet, local fork configuration, or client release when available.
