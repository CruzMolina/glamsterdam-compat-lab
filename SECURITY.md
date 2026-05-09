# Security Policy

## Supported versions

This project is pre-1.0 compatibility tooling. Security fixes will target the default branch until release branches exist.

## Reporting a vulnerability

Please use GitHub private vulnerability reporting if it is enabled on the repository. If private reporting is unavailable, open a minimal issue that avoids exposing exploit details and ask for a maintainer contact path.

Do not include private keys, RPC credentials, validator secrets, production endpoint credentials, or non-public trace data in issues, pull requests, fixtures, or screenshots.

The `scan-tx` command accepts RPC URLs through `--rpc-url` or `ETH_RPC_URL`. Reports intentionally omit the RPC URL, but shell history, CI logs, and issue text may not. Prefer environment variables or local secret management for private endpoints.

When using `scan-tx --trace-out`, review the saved trace before sharing or committing it. Execution traces can contain calldata, addresses, storage keys, revert data, and other sensitive operational context.

## Scanner output

Compatibility reports are advisory and deterministic. They are not security audits and should not be treated as proof that a contract, indexer, or validator setup is safe.
