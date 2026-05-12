# Example: baseline comparison reports

Use `compare-reports` when you have two saved JSON compatibility reports and want to review what changed without hand-diffing large report files.

## Compare bundled report fixtures

Command:

```sh
pnpm --silent glamsterdam compare-reports \
  fixtures/reports/baseline-default-report.json \
  fixtures/reports/candidate-research-report.json \
  --format markdown
```

Output excerpt:

```md
# Glamsterdam Compatibility Comparison

Baseline: trace fixtures/traces/profile-default.json (medium risk, 4 findings)
Candidate: trace fixtures/traces/profile-research.json (high risk, 4 findings)
Tool version: 0.3.2
Fork registry: glamsterdam

## Summary

Overall risk: MEDIUM -> HIGH (increased)
Findings: 4 baseline, 4 candidate, delta 0
Changes: 1 added, 1 removed, 2 changed, 1 unchanged
Severity changes: 1 increased, 0 decreased, 0 changed
Confidence changes: 1 increased, 0 decreased, 0 changed
```

## Compare threshold profiles

This workflow scans the same trace under two threshold profiles, then compares the resulting reports.

```sh
tmp_dir="$(mktemp -d)"

cat > "$tmp_dir/calldata-threshold-trace.json" <<'JSON'
{
  "steps": [
    { "op": "CALL", "depth": 1, "gasCost": 700, "calldataBytes": 2048 }
  ]
}
JSON

pnpm --silent glamsterdam scan-traces "$tmp_dir/calldata-threshold-trace.json" \
  --thresholds data/detectors/thresholds.json \
  --format json > "$tmp_dir/default-report.json"

pnpm --silent glamsterdam scan-traces "$tmp_dir/calldata-threshold-trace.json" \
  --thresholds data/detectors/thresholds.research.json \
  --format json > "$tmp_dir/research-report.json"

pnpm --silent glamsterdam compare-reports \
  "$tmp_dir/default-report.json" \
  "$tmp_dir/research-report.json" \
  --format markdown
```

Expected comparison shape:

```md
Overall risk: LOW -> MEDIUM (increased)
Findings: 1 baseline, 2 candidate, delta +1
Changes: 1 added, 0 removed, 0 changed, 1 unchanged

## Added Findings

- trace.calldata-heavy-execution: Trace includes visible calldata-heavy execution (MEDIUM, confidence high)
```

The comparison reports structural scanner differences only. It does not invent exact gas deltas or final Glamsterdam behavior.
