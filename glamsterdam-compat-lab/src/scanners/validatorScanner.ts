import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { detectEpbsBuilderReadiness } from "../detectors/epbsDetectors.js";
import { domains, makeFinding } from "../detectors/types.js";
import { loadEipRegistry } from "../registry/eipRegistry.js";
import type { EipRegistry } from "../registry/schemas.js";
import { makeReport, type CompatibilityFinding, type CompatibilityReport } from "../reports/reportTypes.js";
import { loadStructuredFile } from "../utils/files.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));

const clientVersionSchema = z.object({
  version: z.string(),
  status: z.enum(["compatible", "incompatible", "partial", "unknown"]),
  notes: z.string().optional()
});

const clientEntrySchema = z.object({
  name: z.string(),
  role: z.enum(["execution", "consensus", "validator"]),
  versions: z.array(clientVersionSchema)
});

const clientMatrixSchema = z.object({
  fork: z.string(),
  lastUpdated: z.string(),
  sources: z.array(z.string()).default([]),
  clients: z.array(clientEntrySchema).default([])
});

type ClientMatrix = z.infer<typeof clientMatrixSchema>;
type ClientRole = "execution" | "consensus" | "validator";

export interface ValidatorScanOptions {
  registry?: EipRegistry;
  registryPath?: string;
  clientMatrixPath?: string;
  targetName?: string;
}

export function defaultClientMatrixPath(): string {
  return resolve(moduleDir, "../../data/client-compat/clients.example.json");
}

export function scanValidatorConfig(configPath: string, options: ValidatorScanOptions = {}): CompatibilityReport {
  const registry = options.registry ?? loadEipRegistry(options.registryPath);
  const config = loadStructuredFile(configPath);
  const matrix = loadClientMatrix(options.clientMatrixPath ?? defaultClientMatrixPath());
  const context = {
    registry,
    targetName: options.targetName ?? configPath
  };

  const findings: CompatibilityFinding[] = [
    ...detectClientMetadata(config, matrix),
    ...detectEpbsBuilderReadiness(
      {
        builderEnabled: getPath(config, ["builder", "enabled"]),
        builderEndpoint: getPath(config, ["builder", "endpoint"])
      },
      context
    ),
    ...detectMonitoringMetadata(config),
    ...detectTestnetMetadata(config)
  ];

  return makeReport({
    fork: registry.fork,
    target: {
      kind: "validator",
      name: options.targetName ?? configPath
    },
    findings,
    assumptions: [
      "Validator/operator readiness was checked from a local JSON/YAML config only.",
      `Client compatibility was compared against ${options.clientMatrixPath ?? defaultClientMatrixPath()}. Unknown entries are reported without guessing.`,
      `The loaded registry is dated ${registry.lastUpdated}. Glamsterdam scope and gas parameters may change.`
    ],
    limitations: [
      "This scanner does not verify live node state, command-line flags, environment variables, firewall rules, or remote service health.",
      "Client compatibility must come from a maintained matrix with explicit source links.",
      "A clean report does not replace devnet/testnet participation or operational drills."
    ]
  });
}

export function loadClientMatrix(matrixPath: string): ClientMatrix {
  const raw = readFileSync(matrixPath, "utf8");
  return clientMatrixSchema.parse(JSON.parse(raw));
}

function detectClientMetadata(config: unknown, matrix: ClientMatrix): CompatibilityFinding[] {
  const findings: CompatibilityFinding[] = [];

  const clients: Array<{ role: ClientRole; path: string[]; label: string }> = [
    { role: "execution", path: ["executionClient"], label: "execution client" },
    { role: "consensus", path: ["consensusClient"], label: "consensus client" },
    { role: "validator", path: ["validatorClient"], label: "validator client" }
  ];

  for (const client of clients) {
    const value = getPath(config, client.path);
    const name = getPath(config, [...client.path, "name"]);
    const version = getPath(config, [...client.path, "version"]);

    if (!isRecord(value) || typeof name !== "string" || name.trim() === "") {
      findings.push(
        makeFinding({
          id: `validator.missing-${client.role}-client-name`,
          title: `Missing ${client.label} metadata`,
          severity: "medium",
          confidence: "high",
          domain: domains("validator"),
          relatedEips: ["EIP-7732"],
          description:
            `The config does not include a ${client.label} name. Operator readiness reports need explicit client metadata so compatibility can be tracked without guessing.`,
          evidence: { path: client.path.join(".") },
          recommendation:
            `Add ${client.path.join(".")}.name and ${client.path.join(".")}.version to the operator config or document where this metadata is managed.`
        })
      );
      continue;
    }

    if (typeof version !== "string" || version.trim() === "") {
      findings.push(
        makeFinding({
          id: `validator.missing-${client.role}-client-version`,
          title: `Missing ${client.label} version`,
          severity: "medium",
          confidence: "high",
          domain: domains("validator"),
          relatedEips: ["EIP-7732"],
          description:
            `The config names ${name} as the ${client.label}, but does not include a version. Compatibility cannot be assessed without explicit version metadata.`,
          evidence: { name, version },
          recommendation:
            `Add ${client.path.join(".")}.version and keep it updated from deployment automation or release inventory.`
        })
      );
      continue;
    }

    const matrixEntry = findClientMatrixEntry(matrix, client.role, name, version);
    if (!matrixEntry) {
      findings.push(
        makeFinding({
          id: `validator.unknown-${client.role}-client-compatibility`,
          title: `Unknown Glamsterdam compatibility for ${client.label}`,
          severity: "unknown",
          confidence: "high",
          domain: domains("validator"),
          relatedEips: ["EIP-7732"],
          description:
            `The compatibility matrix does not contain a sourced status for ${name} ${version} as a ${client.label}. The scanner will not infer compatibility from client name alone.`,
          evidence: { role: client.role, name, version, matrixLastUpdated: matrix.lastUpdated },
          recommendation:
            "Update the client compatibility matrix with sourced release/devnet information, or treat this as a manual-readiness checklist item."
        })
      );
      continue;
    }

    if (matrixEntry.status !== "compatible") {
      findings.push(
        makeFinding({
          id: `validator.${client.role}-client-status-${matrixEntry.status}`,
          title: `${client.label} compatibility is ${matrixEntry.status}`,
          severity: matrixEntry.status === "incompatible" ? "high" : "unknown",
          confidence: "high",
          domain: domains("validator"),
          relatedEips: ["EIP-7732"],
          description:
            `The compatibility matrix reports ${matrixEntry.status} for ${name} ${version}. The scanner reports the matrix value without trying to override it.`,
          evidence: { role: client.role, name, version, matrixEntry },
          recommendation:
            "Review the matrix source notes, update the client, or validate the status through testnet/devnet participation."
        })
      );
    }
  }

  return findings;
}

function detectMonitoringMetadata(config: unknown): CompatibilityFinding[] {
  const prometheus = getPath(config, ["monitoring", "prometheus"]);
  const grafana = getPath(config, ["monitoring", "grafana"]);

  if (truthyString(prometheus) && truthyString(grafana)) {
    return [];
  }

  return [
    makeFinding({
      id: "validator.missing-monitoring-endpoints",
      title: "Monitoring endpoint metadata is incomplete",
      severity: "medium",
      confidence: "high",
      domain: domains("validator", "monitoring"),
      relatedEips: ["EIP-7732", "EIP-7928"],
      description:
        "The config does not include both Prometheus and Grafana monitoring metadata. Glamsterdam readiness should include observable EL, CL, validator, builder, and fork-specific metrics.",
      evidence: { prometheus, grafana },
      recommendation:
        "Record monitoring endpoints or dashboards and add alert coverage for devnet/testnet participation, missed duties, builder/API health, and sync status."
    })
  ];
}

function detectTestnetMetadata(config: unknown): CompatibilityFinding[] {
  const participation = getPath(config, ["networks", "testnetParticipation"]);
  const hasParticipation = Array.isArray(participation)
    ? participation.length > 0
    : truthyString(participation);

  if (hasParticipation) {
    return [];
  }

  return [
    makeFinding({
      id: "validator.missing-testnet-participation",
      title: "No testnet or devnet participation metadata found",
      severity: "medium",
      confidence: "high",
      domain: domains("validator", "monitoring"),
      relatedEips: ["EIP-7732", "EIP-7928"],
      description:
        "The config does not list Glamsterdam-oriented testnet or devnet participation. Operator readiness should be validated before mainnet activation timing is final.",
      evidence: { testnetParticipation: participation },
      recommendation:
        "Add planned or completed testnet/devnet participation, including client versions, dates, observed issues, and rollback notes."
    })
  ];
}

function findClientMatrixEntry(
  matrix: ClientMatrix,
  role: ClientRole,
  name: string,
  version: string
): { version: string; status: "compatible" | "incompatible" | "partial" | "unknown"; notes?: string } | undefined {
  const normalizedName = name.toLowerCase();
  const client = matrix.clients.find(
    (entry) => entry.role === role && entry.name.toLowerCase() === normalizedName
  );
  if (!client) {
    return undefined;
  }

  return client.versions.find((entry) => entry.version === version)
    ?? client.versions.find((entry) => entry.version === "*");
}

function getPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function truthyString(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}
