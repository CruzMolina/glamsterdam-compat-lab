import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const clientRoles = ["execution", "consensus", "validator"] as const;
const nonProductionSourceTypes = new Set([
  "public-devnet-spec",
  "public-interop-recap",
  "public-spec-release"
]);

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const clientMatrixSourceSchema = z.object({
  type: z.enum([
    "public-devnet-spec",
    "public-interop-recap",
    "public-client-release",
    "public-spec-release",
    "synthetic-example",
    "operator-maintained"
  ]),
  url: z.string().min(1),
  sourceDate: isoDateSchema.optional(),
  retrievedAt: isoDateSchema,
  claim: z.string().min(1),
  notes: z.string().optional()
}).strict();

export const clientVersionSchema = z.object({
  version: z.string().min(1),
  status: z.enum(["compatible", "incompatible", "partial", "unknown"]),
  source: clientMatrixSourceSchema,
  notes: z.string().optional()
}).strict();

export const clientEntrySchema = z.object({
  name: z.string().min(1),
  role: z.enum(clientRoles),
  versions: z.array(clientVersionSchema).min(1)
}).strict();

export const matrixEntryExclusionSchema = z.object({
  reason: z.string().min(1),
  source: clientMatrixSourceSchema.optional()
}).strict();

export const devnetParticipantSchema = z.object({
  role: z.enum(["execution", "consensus", "validator", "builder", "tooling"]),
  name: z.string().min(1),
  image: z.string().min(1).optional(),
  status: z.enum(["compatible", "incompatible", "partial", "unknown"]),
  notes: z.string().optional(),
  matrixEntryExclusion: matrixEntryExclusionSchema.optional()
}).strict();

export const devnetEntrySchema = z.object({
  name: z.string().min(1),
  status: z.string().min(1),
  source: clientMatrixSourceSchema,
  participants: z.array(devnetParticipantSchema).default([]),
  specVersions: z.array(z.object({
    name: z.string().min(1),
    version: z.string().min(1),
    source: clientMatrixSourceSchema.optional()
  }).strict()).default([]),
  notes: z.string().optional()
}).strict();

export const clientMatrixSchema = z.object({
  fork: z.string().min(1),
  lastUpdated: isoDateSchema,
  sources: z.array(clientMatrixSourceSchema).default([]),
  clients: z.array(clientEntrySchema).default([]),
  devnets: z.array(devnetEntrySchema).default([])
}).strict();

export type ClientMatrixSource = z.infer<typeof clientMatrixSourceSchema>;
export type ClientVersion = z.infer<typeof clientVersionSchema>;
export type ClientEntry = z.infer<typeof clientEntrySchema>;
export type ClientMatrix = z.infer<typeof clientMatrixSchema>;
export type ClientRole = typeof clientRoles[number];

export interface ClientMatrixCheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface ClientMatrixSourceRef {
  label: string;
  source: ClientMatrixSource;
}

export function defaultClientMatrixPath(): string {
  return resolve(moduleDir, "../../data/client-compat/clients.example.json");
}

export function loadClientMatrix(matrixPath = defaultClientMatrixPath()): ClientMatrix {
  if (!existsSync(matrixPath)) {
    throw new Error(`Client compatibility matrix not found: ${matrixPath}`);
  }

  const raw = readFileSync(matrixPath, "utf8");
  return clientMatrixSchema.parse(JSON.parse(raw));
}

export function findClientMatrixEntry(
  matrix: ClientMatrix,
  role: ClientRole,
  name: string,
  version: string
): ClientVersion | undefined {
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

export function checkClientMatrix(matrix: ClientMatrix): ClientMatrixCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  checkDates(matrix, errors);
  const clientVersionKeys = checkDuplicateClients(matrix, errors);
  checkDevnetParticipantResolution(matrix, clientVersionKeys, errors, warnings);
  checkConservativeStatuses(matrix, errors);

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

function checkDates(matrix: ClientMatrix, errors: string[]): void {
  for (const { label, source } of clientMatrixSourceRefs(matrix)) {
    if (source.sourceDate && source.retrievedAt < source.sourceDate) {
      errors.push(`${label} has retrievedAt ${source.retrievedAt} before sourceDate ${source.sourceDate}.`);
    }
    if (matrix.lastUpdated < source.retrievedAt) {
      errors.push(`${label} has retrievedAt ${source.retrievedAt} after matrix lastUpdated ${matrix.lastUpdated}.`);
    }
    if (source.sourceDate && matrix.lastUpdated < source.sourceDate) {
      errors.push(`${label} has sourceDate ${source.sourceDate} after matrix lastUpdated ${matrix.lastUpdated}.`);
    }
  }
}

function checkDuplicateClients(matrix: ClientMatrix, errors: string[]): Set<string> {
  const clientKeys = new Set<string>();
  const versionKeys = new Set<string>();

  for (const client of matrix.clients) {
    const clientKey = `${client.role}:${client.name.toLowerCase()}`;
    if (clientKeys.has(clientKey)) {
      errors.push(`Duplicate client entry for ${client.role} client ${client.name}.`);
    }
    clientKeys.add(clientKey);

    for (const version of client.versions) {
      const versionKey = clientVersionKey(client.role, client.name, version.version);
      if (versionKeys.has(versionKey)) {
        errors.push(`Duplicate client version entry for ${client.role} client ${client.name} ${version.version}.`);
      }
      versionKeys.add(versionKey);
    }
  }

  const devnetKeys = new Set<string>();
  for (const devnet of matrix.devnets) {
    const key = devnet.name.toLowerCase();
    if (devnetKeys.has(key)) {
      errors.push(`Duplicate devnet entry for ${devnet.name}.`);
    }
    devnetKeys.add(key);
  }

  return versionKeys;
}

function checkDevnetParticipantResolution(
  matrix: ClientMatrix,
  clientVersionKeys: Set<string>,
  errors: string[],
  warnings: string[]
): void {
  for (const devnet of matrix.devnets) {
    for (const participant of devnet.participants) {
      if (!participant.image || !isClientRole(participant.role)) {
        continue;
      }

      const participantKey = clientVersionKey(participant.role, participant.name, participant.image);
      const hasClientEntry = clientVersionKeys.has(participantKey);
      const exclusion = participant.matrixEntryExclusion;

      if (!hasClientEntry && !exclusion) {
        errors.push(
          `Devnet ${devnet.name} participant ${participant.role}:${participant.name}:${participant.image} is not mirrored by a client version entry or documented exclusion.`
        );
      }
      if (hasClientEntry && exclusion) {
        warnings.push(
          `Devnet ${devnet.name} participant ${participant.role}:${participant.name}:${participant.image} has a stale matrixEntryExclusion despite a matching client version entry.`
        );
      }
    }
  }
}

function checkConservativeStatuses(matrix: ClientMatrix, errors: string[]): void {
  for (const client of matrix.clients) {
    for (const version of client.versions) {
      if (version.status === "compatible" && nonProductionSourceTypes.has(version.source.type)) {
        errors.push(
          `Client ${client.role}:${client.name}:${version.version} is compatible from ${version.source.type}; use partial/unknown unless an explicit client release or operator-maintained source supports compatibility.`
        );
      }
    }
  }

  for (const devnet of matrix.devnets) {
    for (const participant of devnet.participants) {
      if (participant.status === "compatible" && nonProductionSourceTypes.has(devnet.source.type)) {
        errors.push(
          `Devnet ${devnet.name} participant ${participant.role}:${participant.name} is compatible from ${devnet.source.type}; devnet and interop sources should remain partial/unknown.`
        );
      }
    }
  }
}

export function clientMatrixSourceRefs(matrix: ClientMatrix): ClientMatrixSourceRef[] {
  const refs: ClientMatrixSourceRef[] = matrix.sources.map((source, index) => ({
    label: `sources[${index}]`,
    source
  }));

  for (const client of matrix.clients) {
    for (const version of client.versions) {
      refs.push({
        label: `clients.${client.role}.${client.name}.${version.version}.source`,
        source: version.source
      });
    }
  }

  for (const devnet of matrix.devnets) {
    refs.push({
      label: `devnets.${devnet.name}.source`,
      source: devnet.source
    });
    for (const participant of devnet.participants) {
      if (participant.matrixEntryExclusion?.source) {
        refs.push({
          label: `devnets.${devnet.name}.participants.${participant.name}.matrixEntryExclusion.source`,
          source: participant.matrixEntryExclusion.source
        });
      }
    }
    for (const specVersion of devnet.specVersions) {
      if (specVersion.source) {
        refs.push({
          label: `devnets.${devnet.name}.specVersions.${specVersion.name}.${specVersion.version}.source`,
          source: specVersion.source
        });
      }
    }
  }

  return refs;
}

function clientVersionKey(role: ClientRole, name: string, version: string): string {
  return `${role}:${name.toLowerCase()}:${version}`;
}

function isClientRole(role: string): role is ClientRole {
  return clientRoles.includes(role as ClientRole);
}
