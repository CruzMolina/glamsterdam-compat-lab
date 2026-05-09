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

Status: in progress.

- Triage initial dependency automation
- Collect real-world fixture submissions
- Add contribution paths for detector requests, registry updates, and signal-quality reports
- Keep README focused on usage while roadmap and planning live here

## Phase 1: Trace Replay Support

Goal: make trace scanning useful for contract teams using common development tools.

- Add Foundry and Hardhat trace fixtures
- Normalize common call, opcode, gas, input, and log fields
- Add optional RPC-based transaction trace fetching
- Compare current baseline traces with Glamsterdam-aware client or fork configs when available

## Phase 2: Public Dataset

Goal: publish reproducible compatibility research.

- Scan popular contracts and protocol surfaces
- Publish deterministic report artifacts
- Generate aggregate risk statistics
- Add CSV/notebook/export workflows for researchers

## Phase 3: Devnet Integration

Goal: track moving client and spec readiness without hardcoding guesses.

- Ingest public devnet and client compatibility metadata
- Track spec/client changes against registry entries
- Expand validator/operator compatibility matrix workflows

## Phase 4: Dashboard

Goal: make reports discoverable once the CLI and dataset are trustworthy.

- Static generated site
- Searchable reports
- Machine-readable exports
- Links back to source fixtures, registry data, and detector versions
