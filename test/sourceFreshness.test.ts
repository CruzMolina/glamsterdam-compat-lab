import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  auditSourceFreshness,
  sourceFreshness,
  sourceFreshnessBand
} from "../src/index.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("readiness source freshness policy", () => {
  it("classifies source age into deterministic freshness bands", () => {
    expect(sourceFreshnessBand(0)).toBe("fresh");
    expect(sourceFreshnessBand(30)).toBe("fresh");
    expect(sourceFreshnessBand(31)).toBe("watch");
    expect(sourceFreshnessBand(90)).toBe("watch");
    expect(sourceFreshnessBand(91)).toBe("stale");
    expect(sourceFreshness("2026-05-12", "2026-05-13")).toMatchObject({
      asOf: "2026-05-13",
      retrievedDaysAgo: 1,
      band: "fresh"
    });
  });

  it("fails audits for missing metadata, invalid dates, and future retrieval dates", () => {
    const result = auditSourceFreshness([
      {
        label: "missing",
        source: {
          retrievedAt: "2026-05-13"
        }
      },
      {
        label: "invalid",
        source: {
          url: "https://example.com/invalid",
          retrievedAt: "2026-02-31",
          claim: "Invalid calendar date fixture."
        }
      },
      {
        label: "future",
        source: {
          url: "https://example.com/future",
          retrievedAt: "2026-05-14",
          claim: "Future retrieval fixture."
        }
      }
    ], "2026-05-13");

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("missing is missing url.");
    expect(result.errors).toContain("missing is missing claim.");
    expect(result.errors).toContain("invalid.retrievedAt must be a valid calendar date.");
    expect(result.errors).toContain("future has retrievedAt 2026-05-14 after audit date 2026-05-13.");
  });

  it("warns but exits successfully when the live audit sees stale sources", () => {
    const result = spawnSync(
      "pnpm",
      ["exec", "tsx", "scripts/check-readiness-freshness.ts", "--as-of", "2026-08-15"],
      { cwd: rootDir, encoding: "utf8" }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("warnings:");
    expect(result.stdout).toContain("stale");
    expect(result.stdout).toContain("readiness sources passed the live freshness audit.");
  });

  it("fails the live audit command when source retrieval dates are in the future", () => {
    const result = spawnSync(
      "pnpm",
      ["exec", "tsx", "scripts/check-readiness-freshness.ts", "--as-of", "2026-05-11"],
      { cwd: rootDir, encoding: "utf8" }
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("errors:");
    expect(result.stdout).toContain("after audit date 2026-05-11");
  });
});
