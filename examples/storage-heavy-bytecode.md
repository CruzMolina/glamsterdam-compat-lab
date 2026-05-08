# Example: storage-heavy bytecode report

Command:

```sh
pnpm glamsterdam scan-bytecode fixtures/bytecode/storage-heavy.hex --format markdown
```

Output excerpt:

```md
# Glamsterdam Compatibility Report

Target: bytecode fixtures/bytecode/storage-heavy.hex
Tool version: 0.1.0
Fork registry: glamsterdam

## Summary

Overall risk: MEDIUM
Findings: 6 total, 0 high, 3 medium, 2 low, 1 unknown

## Findings

### 1. State and account access opcodes are prominent in bytecode

Severity: MEDIUM
Confidence: medium
Domains: contracts, execution
Related EIPs: GAS-REPRICING, EIP-7904, EIP-8038, EIP-7976

This bytecode contains multiple storage, account, or hashing opcodes. Glamsterdam gas repricing candidates may change the cost profile of state-heavy execution, but static bytecode does not prove those paths are hot.

Recommendation: Replay representative transactions and benchmark hot paths once a Glamsterdam client/devnet or local fork configuration is available.

### 3. Contract creation opcodes are present

Severity: MEDIUM
Confidence: high
Domains: contracts, execution
Related EIPs: GAS-REPRICING, EIP-8037

CREATE or CREATE2 appears in the bytecode. State-creation repricing candidates may affect factory, clone, deployment, or account-creation-heavy paths depending on final Glamsterdam scope.

Recommendation: Identify representative deployment/factory transactions and add them to fork-readiness replay tests.

### 6. Manual review is still required for runtime behavior

Severity: UNKNOWN
Confidence: low
Domains: contracts, execution
Related EIPs: GAS-REPRICING

The scanner found static opcode evidence, but exact fork impact depends on executed paths, calldata, storage warmness, account state, compiler output, and final Glamsterdam parameters.

Recommendation: Use this report to choose transactions for trace replay and benchmark them under current and Glamsterdam configurations.
```
