import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadClientMatrix, scanValidatorConfig } from "../src/scanners/validatorScanner.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultMatrixPath = resolve(rootDir, "data/client-compat/clients.example.json");

describe("scanValidatorConfig", () => {
  it("reports unknown compatibility without guessing", () => {
    const fixture = resolve(rootDir, "fixtures/validator/operator-config.yaml");
    const report = scanValidatorConfig(fixture);

    expect(report.target.kind).toBe("validator");
    expect(report.findings.some((finding) => finding.id === "validator.unknown-execution-client-compatibility")).toBe(true);
    expect(report.findings.some((finding) => finding.id === "validator.unknown-consensus-client-compatibility")).toBe(true);
    expect(report.findings.some((finding) => finding.id === "validator.builder-enabled-without-endpoint")).toBe(true);
    expect(report.findings.every((finding) => !finding.description.includes("probably compatible"))).toBe(true);
  });

  it("accepts a complete placeholder operator config without findings", () => {
    const fixture = resolve(rootDir, "fixtures/validator/operator-config-complete.yaml");
    const report = scanValidatorConfig(fixture);

    expect(report.target.kind).toBe("validator");
    expect(report.findings).toEqual([]);
    expect(report.summary.risk).toBe("low");
  });

  it("isolates builder, monitoring, and testnet gaps when client metadata is known", () => {
    const fixture = resolve(rootDir, "fixtures/validator/operator-config-builder-gap.yaml");
    const report = scanValidatorConfig(fixture);
    const findingIds = report.findings.map((finding) => finding.id);

    expect(findingIds).toEqual([
      "validator.builder-enabled-without-endpoint",
      "validator.missing-monitoring-endpoints",
      "validator.missing-testnet-participation"
    ]);
    expect(findingIds.some((id) => id.includes("unknown") || id.includes("missing-execution-client"))).toBe(false);
  });

  it("loads sourced matrix metadata for client and devnet intake", () => {
    const matrix = loadClientMatrix(defaultMatrixPath);
    const sourceTypes = matrix.sources.map((source) => source.type);

    expect(sourceTypes).toContain("public-devnet-spec");
    expect(sourceTypes).toContain("public-interop-recap");
    expect(matrix.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(matrix.devnets.some((devnet) => devnet.name === "glamsterdam-devnet-2")).toBe(true);

    for (const client of matrix.clients) {
      for (const version of client.versions) {
        expect(version.source.url).toMatch(/^https?:\/\//);
        expect(version.source.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(version.source.claim.length).toBeGreaterThan(0);
      }
    }

    for (const devnet of matrix.devnets) {
      expect(devnet.source.url).toMatch(/^https?:\/\//);
      expect(devnet.source.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      for (const specVersion of devnet.specVersions) {
        expect(specVersion.source?.url).toMatch(/^https?:\/\//);
        expect(specVersion.source?.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("reports sourced partial, incompatible, and unknown matrix statuses without guessing", () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), "glamsterdam-validator-"));
    const configPath = resolve(tempDir, "operator-config.json");

    try {
      writeFileSync(configPath, JSON.stringify({
        executionClient: {
          name: "example-execution-client",
          version: "1.1.0-partial"
        },
        consensusClient: {
          name: "example-consensus-client",
          version: "2.0.0-incompatible"
        },
        validatorClient: {
          name: "example-validator-client",
          version: "0.0.0-example"
        },
        builder: {
          enabled: false
        },
        monitoring: {
          prometheus: "https://monitoring.example.invalid/prometheus",
          grafana: "https://monitoring.example.invalid/grafana"
        },
        networks: {
          testnetParticipation: [
            {
              network: "glamsterdam-devnet-placeholder",
              status: "planned"
            }
          ]
        }
      }, null, 2));

      const report = scanValidatorConfig(configPath);
      const findingsById = new Map(report.findings.map((finding) => [finding.id, finding]));

      expect([...findingsById.keys()]).toEqual([
        "validator.execution-client-status-partial",
        "validator.consensus-client-status-incompatible",
        "validator.validator-client-status-unknown"
      ]);
      expect(findingsById.get("validator.execution-client-status-partial")?.severity).toBe("unknown");
      expect(findingsById.get("validator.consensus-client-status-incompatible")?.severity).toBe("high");
      expect(findingsById.get("validator.validator-client-status-unknown")?.evidence[0]).toMatchObject({
        matrixEntry: {
          source: {
            type: "synthetic-example",
            url: expect.stringMatching(/^https?:\/\//),
            retrievedAt: "2026-05-12"
          }
        }
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
