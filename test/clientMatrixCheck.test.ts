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
