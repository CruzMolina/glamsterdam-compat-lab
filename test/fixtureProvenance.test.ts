import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  loadFixtureProvenance,
  scanBytecode,
  scanIndexer,
  scanTraceFile,
  scanValidatorConfig,
  validateCompatibilityReport,
  type CompatibilityReport,
  type FixtureProvenanceEntry
} from "../src/index.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = loadFixtureProvenance(resolve(rootDir, "fixtures/provenance.json"));

describe("fixture provenance", () => {
  it("covers every committed fixture file", () => {
    const manifestPaths = manifest.fixtures.map((fixture) => fixture.path).sort();
    const fixturePaths = listFixtureFiles(resolve(rootDir, "fixtures"))
      .filter((path) => path !== "fixtures/provenance.json")
      .sort();

    expect(manifestPaths).toEqual(fixturePaths);
  });

  it("references readable files and records review metadata", () => {
    for (const fixture of manifest.fixtures) {
      expect(existsSync(resolve(rootDir, fixture.path))).toBe(true);
      expect(fixture.description).not.toEqual("");
      expect(fixture.source.name).not.toEqual("");
      expect(fixture.redaction.notes.length).toBeGreaterThan(0);
    }
  });

  it("keeps expected finding ids aligned with scanner output", () => {
    for (const fixture of manifest.fixtures) {
      const report = reportForFixture(fixture);
      const actualFindingIds = new Set(report.findings.map((finding) => finding.id));

      for (const expectedFindingId of fixture.expectedFindingIds) {
        expect(actualFindingIds.has(expectedFindingId), `${fixture.path} should include ${expectedFindingId}`)
          .toBe(true);
      }
    }
  });

  it("marks public-chain fixtures with network context", () => {
    const publicChainFixtures = manifest.fixtures.filter((fixture) => fixture.source.type === "public-chain");

    expect(publicChainFixtures.length).toBeGreaterThan(0);
    for (const fixture of publicChainFixtures) {
      expect(fixture.network?.name).toBeTruthy();

      if (fixture.kind === "bytecode") {
        expect(fixture.network?.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(fixture.network?.blockNumber).toBeGreaterThan(0);
      }
    }
  });

  it("marks public document and repository fixtures with source URLs", () => {
    const publicSourceFixtures = manifest.fixtures.filter(
      (fixture) => fixture.source.type === "public-doc" || fixture.source.type === "public-repo"
    );

    expect(publicSourceFixtures.length).toBeGreaterThan(0);
    for (const fixture of publicSourceFixtures) {
      expect(fixture.source.url).toMatch(/^https:\/\//);
      expect(fixture.source.license).toBeTruthy();
    }
  });
});

function reportForFixture(fixture: FixtureProvenanceEntry): CompatibilityReport {
  const absolutePath = resolve(rootDir, fixture.path);

  switch (fixture.kind) {
    case "bytecode":
      return scanBytecode(absolutePath, { targetName: fixture.path });
    case "trace":
      return scanTraceFile(absolutePath, { targetName: fixture.path });
    case "indexer":
      return scanIndexer(absolutePath, { targetName: fixture.path });
    case "validator":
      return scanValidatorConfig(absolutePath, { targetName: fixture.path });
    case "report":
      return validateCompatibilityReport(JSON.parse(readFileSync(absolutePath, "utf8")));
  }
}

function listFixtureFiles(dir: string): string[] {
  const entries = readdirSync(dir).flatMap((entry) => {
    const absolutePath = resolve(dir, entry);
    if (statSync(absolutePath).isDirectory()) {
      return listFixtureFiles(absolutePath);
    }

    return [relative(rootDir, absolutePath)];
  });

  return entries.map((entry) => entry.replaceAll("\\", "/"));
}
