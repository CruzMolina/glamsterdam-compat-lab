# Example: public seed dataset analysis

The public seed dataset includes CSV exports for quick spreadsheet checks and lightweight scripts. These examples use only Node.js standard library APIs and can be run from the repository root after the dataset has been generated.

```sh
pnpm dataset:generate
```

## Load CSV Rows

This helper parses the dataset CSVs and prints their current row counts.

```sh
node --input-type=module <<'JS'
import { readFileSync } from "node:fs";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === "\"" && text[index + 1] === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  return dataRows.map((dataRow) =>
    Object.fromEntries(headers.map((header, index) => [header, dataRow[index] ?? ""]))
  );
}

const reports = parseCsv(readFileSync("datasets/public-seed/reports.csv", "utf8"));
const findings = parseCsv(readFileSync("datasets/public-seed/findings.csv", "utf8"));
const summary = parseCsv(readFileSync("datasets/public-seed/summary.csv", "utf8"));

console.log({
  reportRows: reports.length,
  findingRows: findings.length,
  summaryRows: summary.length
});
JS
```

Current output:

```text
{ reportRows: 40, findingRows: 138, summaryRows: 41 }
```

## Reports by Risk and Fixture Kind

Use `reports.csv` when you want one row per generated report.

```sh
node --input-type=module <<'JS'
import { readFileSync } from "node:fs";

function parseCsv(text) {
  const [headerLine, ...lines] = text.trimEnd().split("\n");
  const headers = headerLine.split(",");
  return lines.map((line) =>
    Object.fromEntries(line.split(",").map((value, index) => [headers[index], value]))
  );
}

function countBy(rows, key) {
  return Object.entries(rows.reduce((totals, row) => {
    totals[row[key]] = (totals[row[key]] ?? 0) + 1;
    return totals;
  }, {})).sort(([left], [right]) => left.localeCompare(right));
}

const reports = parseCsv(readFileSync("datasets/public-seed/reports.csv", "utf8"));

console.log("reportsByRisk", countBy(reports, "risk"));
console.log("reportsByFixtureKind", countBy(reports, "fixtureKind"));
console.log("reportsByThresholdProfile", countBy(reports, "thresholdProfile"));
JS
```

Current output:

```text
reportsByRisk [ [ 'low', 7 ], [ 'medium', 33 ] ]
reportsByFixtureKind [ [ 'bytecode', 12 ], [ 'indexer', 3 ], [ 'trace', 22 ], [ 'validator', 3 ] ]
reportsByThresholdProfile [ [ 'default', 23 ], [ 'research', 17 ] ]
```

## Most Common Finding IDs

Use `summary.csv` when aggregate counts are enough and you do not need to join individual finding rows.

```sh
node --input-type=module <<'JS'
import { readFileSync } from "node:fs";

const topFindings = readFileSync("datasets/public-seed/summary.csv", "utf8")
  .trimEnd()
  .split("\n")
  .slice(1)
  .map((line) => {
    const [category, key, count] = line.split(",");
    return { category, key, count: Number(count) };
  })
  .filter((row) => row.category === "findingsById")
  .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
  .slice(0, 8);

for (const row of topFindings) {
  console.log(`${row.count} ${row.key}`);
}
JS
```

Current output:

```text
22 trace.logs-calls-visible
14 trace.calldata-heavy-execution
12 bytecode.log-opcodes-present
12 bytecode.manual-review-required
12 trace.partial-evidence
10 bytecode.state-account-opcode-exposure
10 trace.contract-creation-executed
9 bytecode.storage-heavy-pattern
```

## Public-chain vs Synthetic Coverage

The same file also carries fixture source-type coverage.

```sh
node --input-type=module <<'JS'
import { readFileSync } from "node:fs";

const rows = readFileSync("datasets/public-seed/summary.csv", "utf8")
  .trimEnd()
  .split("\n")
  .slice(1)
  .map((line) => {
    const [category, key, count] = line.split(",");
    return { category, key, count: Number(count) };
  });

for (const row of rows.filter((row) => row.category === "fixturesBySourceType")) {
  console.log(`${row.key}: ${row.count}`);
}
JS
```

Current output:

```text
public-chain: 8
synthetic: 15
```

The counts are intentionally modest. They show the current fixture mix, not network-wide readiness.
