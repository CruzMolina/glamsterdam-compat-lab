import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  checkClientMatrix,
  loadClientMatrix,
  type ClientMatrix
} from "../src/registry/clientMatrix.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultMatrixPath = resolve(rootDir, "data/client-compat/clients.example.json");

describe("client compatibility matrix maintenance check", () => {
  it("accepts the default matrix", () => {
    const result = checkClientMatrix(loadClientMatrix(defaultMatrixPath));

    expect(result).toEqual({ ok: true, errors: [], warnings: [] });
  });

  it("tracks real public release-note rows conservatively", () => {
    const matrix = loadClientMatrix(defaultMatrixPath);
    const versionByClient = new Map(
      matrix.clients.flatMap((client) =>
        client.versions.map((version) => [`${client.role}:${client.name}:${version.version}`, version])
      )
    );

    expect(versionByClient.get("execution:geth:v1.17.3")).toMatchObject({
      status: "partial",
      source: { type: "public-client-release" }
    });
    expect(versionByClient.get("execution:besu:26.5.0")).toMatchObject({
      status: "partial",
      source: { type: "public-client-release" }
    });
    expect(versionByClient.get("execution:reth:v2.2.0")).toMatchObject({
      status: "partial",
      source: { type: "public-client-release" }
    });
    expect(versionByClient.get("execution:nethermind:1.37.2")).toMatchObject({
      status: "unknown",
      source: { type: "public-client-release" }
    });
    expect(versionByClient.get("consensus:nimbus:v26.3.1")).toMatchObject({
      status: "unknown",
      source: { type: "public-client-release" }
    });
  });

  it("rejects duplicate client version entries", () => {
    const matrix = cloneDefaultMatrix();
    const geth = matrix.clients.find((client) => client.role === "execution" && client.name === "geth");

    geth?.versions.push({ ...geth.versions[0] });

    expect(checkClientMatrix(matrix).errors).toContainEqual(
      expect.stringContaining("Duplicate client version entry for execution client geth")
    );
  });

  it("rejects sources newer than matrix lastUpdated", () => {
    const matrix = cloneDefaultMatrix();
    matrix.lastUpdated = "2026-05-01";

    expect(checkClientMatrix(matrix).errors).toContainEqual(
      expect.stringContaining("after matrix lastUpdated 2026-05-01")
    );
  });

  it("rejects devnet participants without client entries or exclusions", () => {
    const matrix = cloneDefaultMatrix();
    matrix.devnets[0]?.participants.push({
      role: "consensus",
      name: "missing-client",
      image: "ethpandaops/missing-client:glamsterdam-devnet",
      status: "partial"
    });

    expect(checkClientMatrix(matrix).errors).toContainEqual(
      expect.stringContaining("is not mirrored by a client version entry or documented exclusion")
    );
  });

  it("accepts documented devnet participant exclusions", () => {
    const matrix = cloneDefaultMatrix();
    matrix.clients = matrix.clients.filter((client) => client.name !== "grandine");
    const grandine = matrix.devnets[0]?.participants.find((participant) => participant.name === "grandine");

    if (grandine) {
      grandine.matrixEntryExclusion = {
        reason: "Tracked as a devnet participant only until a client-version source is added."
      };
    }

    expect(checkClientMatrix(matrix).errors).toEqual([]);
  });

  it("rejects compatible claims from devnet-only sources", () => {
    const matrix = cloneDefaultMatrix();
    const geth = matrix.clients.find((client) => client.role === "execution" && client.name === "geth");

    if (geth?.versions[0]) {
      geth.versions[0].status = "compatible";
    }

    expect(checkClientMatrix(matrix).errors).toContainEqual(
      expect.stringContaining("is compatible from public-devnet-spec")
    );
  });

  it("rejects partial public client release rows without fork signals", () => {
    const matrix = cloneDefaultMatrix();
    const nethermind = matrix.clients.find((client) =>
      client.role === "execution" && client.name === "nethermind"
    );

    if (nethermind?.versions[0]) {
      nethermind.versions[0].status = "partial";
      nethermind.versions[0].source.claim =
        "Nethermind v1.37.2 release notes describe healthcheck and archive invalid-block fixes only.";
    }

    expect(checkClientMatrix(matrix).errors).toContainEqual(
      expect.stringContaining("without an explicit Glamsterdam/Amsterdam/Gloas release-note signal")
    );
  });

  it("requires explicit readiness wording before public client releases can be compatible", () => {
    const matrix = cloneDefaultMatrix();
    const geth = matrix.clients.find((client) => client.role === "execution" && client.name === "geth");
    const publicRelease = geth?.versions.find((version) => version.version === "v1.17.3");

    if (publicRelease) {
      publicRelease.status = "compatible";
    }

    expect(checkClientMatrix(matrix).errors).toContainEqual(
      expect.stringContaining("without an explicit Glamsterdam/Amsterdam/Gloas compatibility or readiness claim")
    );
  });

  it("accepts compatible public client releases when the claim explicitly says so", () => {
    const matrix = cloneDefaultMatrix();
    const geth = matrix.clients.find((client) => client.role === "execution" && client.name === "geth");
    const publicRelease = geth?.versions.find((version) => version.version === "v1.17.3");

    if (publicRelease) {
      publicRelease.status = "compatible";
      publicRelease.source.claim = "Geth v1.17.3 is Glamsterdam compatible and production-ready for Amsterdam operators.";
    }

    expect(checkClientMatrix(matrix).errors).toEqual([]);
  });

  it("rejects compatible devnet participant statuses from devnet sources", () => {
    const matrix = cloneDefaultMatrix();
    const participant = matrix.devnets[0]?.participants[0];

    if (participant) {
      participant.status = "compatible";
    }

    expect(checkClientMatrix(matrix).errors).toContainEqual(
      expect.stringContaining("devnet and interop sources should remain partial/unknown")
    );
  });
});

function cloneDefaultMatrix(): ClientMatrix {
  return structuredClone(loadClientMatrix(defaultMatrixPath));
}
