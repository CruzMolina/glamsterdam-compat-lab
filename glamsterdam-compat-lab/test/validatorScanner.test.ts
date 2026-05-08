import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scanValidatorConfig } from "../src/scanners/validatorScanner.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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
});
