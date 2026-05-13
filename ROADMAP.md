# Roadmap

This roadmap is intentionally practical. Glamsterdam scope and parameters may change, so the project should keep protocol assumptions in data files and make detector output easy to update.

## Phase 0: MVP CLI

Status: released as `v0.1.0`.

- Bytecode, trace, indexer, and validator scanners
- EIP registry
- Detector thresholds in data
- Markdown and JSON reports
- Fixtures, tests, and golden report snapshots
- CI, CodeQL, Dependabot, and issue templates

## Phase 0.1: Launch Stabilization

Status: released as `v0.1.1`.

- Triage initial dependency automation
- Collect real-world fixture submissions
- Add contribution paths for detector requests, registry updates, and signal-quality reports
- Add fixture contribution guidance and issue forms
- Keep README focused on usage while roadmap and planning live here

## Phase 1: Trace Replay Support

Status: started in `v0.2.0`; trace capture support added in `v0.2.1`.

Goal: make trace scanning useful for contract teams using common development tools.

- Add Foundry, Hardhat, geth `structLogs`, Erigon-style action trace, and call-tracer fixtures
- Add Besu and Nethermind-shaped trace fixtures
- Normalize common call, opcode, gas, input, explicit log, and log opcode fields
- Keep golden report snapshots for representative trace formats
- Add RPC-based `debug_traceTransaction` fetching with `scan-tx`
- Add `scan-tx --trace-out` and gated real-RPC integration tests
- Add default, research, and CI threshold profiles
- Compare current baseline traces with Glamsterdam-aware client or fork configs when available

## Phase 1.1: Baseline Comparison

Target release: `v0.3.0`.

Goal: compare compatibility reports across profiles and, later, across current-client and Glamsterdam-aware traces.

- Add `compare-reports` for deterministic JSON and Markdown report comparisons
- Compare one trace against multiple threshold profiles
- Emit report deltas for findings added, removed, or changed in severity or confidence
- Keep comparisons deterministic and JSON-friendly with golden fixtures and snapshots
- Defer fork-specific gas deltas until they are present in explicit data files or client configs

## Phase 2: Public Dataset

Status: seeded after `v0.3.0`; expanded with public-safe trace, indexer, and validator fixture coverage in `v0.3.1`; packaged CSV exports added in `v0.3.2`; additional public Geth and Reth trace fixture coverage added in `v0.3.3`; the static public-seed browser, detail/finding pages, and readiness exports are released in `v0.3.4`.

Goal: publish reproducible compatibility research.

- Track fixture provenance, source type, redaction posture, expected scanner signals, and known metadata gaps
- Generate a deterministic public seed dataset from safe-to-publish fixtures
- Compare default and research threshold profiles for bytecode and trace fixtures
- Scan popular contracts and protocol surfaces
- Publish deterministic report artifacts
- Generate aggregate risk statistics
- Add CSV/notebook/export workflows for researchers

## Phase 3: Devnet Integration

Status: started in `v0.3.4` with sourced readiness exports and static readiness pages; `v0.3.5` adds deterministic source freshness policy, live audit guardrails, and refreshed source-review notes.

Goal: track moving client and spec readiness without hardcoding guesses.

- Ingest public devnet and client compatibility metadata
- Track spec/client changes against registry entries
- Expand validator/operator compatibility matrix workflows
- Export source freshness, EIP status groupings, devnet participants, and matrix rows through the public dataset and static site
- Guard source drift with stable generated freshness bands, current-date freshness audits, and explicit stale-source warnings that do not imply incompatibility

## Phase 4: Dashboard

Goal: make reports discoverable once the CLI and dataset are trustworthy.

- Static generated site
- Searchable reports
- Machine-readable exports
- Links back to source fixtures, registry data, and detector versions
