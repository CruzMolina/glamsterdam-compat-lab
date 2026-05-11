import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const moduleDir = dirname(fileURLToPath(import.meta.url));

const fixturePathSchema = z.string()
  .min(1)
  .refine(
    (path) => path.startsWith("fixtures/") && !path.startsWith("/") && !path.includes("..") && !path.includes("\\"),
    "Fixture paths must be relative paths under fixtures/."
  );

export const fixtureProvenanceKindSchema = z.enum(["bytecode", "trace", "indexer", "validator", "report"]);
export const fixtureSourceTypeSchema = z.enum([
  "synthetic",
  "public-chain",
  "public-repo",
  "anonymized-internal",
  "generated-example"
]);
export const fixtureCompletenessSchema = z.enum(["complete", "partial", "focused-minimal"]);
export const fixtureRedactionStatusSchema = z.enum(["not-needed", "redacted", "synthetic-placeholder"]);

export const fixtureProvenanceEntrySchema = z.object({
  path: fixturePathSchema,
  kind: fixtureProvenanceKindSchema,
  description: z.string().min(1),
  source: z.object({
    type: fixtureSourceTypeSchema,
    name: z.string().min(1),
    url: z.string().url().optional(),
    license: z.string().min(1).optional(),
    notes: z.array(z.string().min(1)).default([])
  }),
  capture: z.object({
    tool: z.string().min(1),
    version: z.string().min(1).optional(),
    command: z.string().min(1).optional(),
    mode: z.string().min(1).optional()
  }).optional(),
  network: z.object({
    name: z.string().min(1),
    chainId: z.number().int().positive().optional(),
    transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional()
  }).optional(),
  completeness: fixtureCompletenessSchema,
  redaction: z.object({
    status: fixtureRedactionStatusSchema,
    notes: z.array(z.string().min(1)).default([])
  }),
  expectedFindingIds: z.array(z.string().min(1)).default([]),
  relatedEips: z.array(z.string().min(1)).default([])
}).strict();

export const fixtureProvenanceManifestSchema = z.object({
  schemaVersion: z.literal(1),
  lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.array(z.string().min(1)).default([]),
  fixtures: z.array(fixtureProvenanceEntrySchema).min(1)
}).strict().superRefine((manifest, context) => {
  const seen = new Set<string>();

  for (const [index, fixture] of manifest.fixtures.entries()) {
    if (seen.has(fixture.path)) {
      context.addIssue({
        code: "custom",
        path: ["fixtures", index, "path"],
        message: `Duplicate fixture provenance path: ${fixture.path}`
      });
    }
    seen.add(fixture.path);
  }
});

export type FixtureProvenanceKind = z.infer<typeof fixtureProvenanceKindSchema>;
export type FixtureSourceType = z.infer<typeof fixtureSourceTypeSchema>;
export type FixtureCompleteness = z.infer<typeof fixtureCompletenessSchema>;
export type FixtureRedactionStatus = z.infer<typeof fixtureRedactionStatusSchema>;
export type FixtureProvenanceEntry = z.infer<typeof fixtureProvenanceEntrySchema>;
export type FixtureProvenanceManifest = z.infer<typeof fixtureProvenanceManifestSchema>;

export function defaultFixtureProvenancePath(): string {
  return resolve(moduleDir, "../../fixtures/provenance.json");
}

export function loadFixtureProvenance(
  manifestPath = defaultFixtureProvenancePath()
): FixtureProvenanceManifest {
  if (!existsSync(manifestPath)) {
    throw new Error(`Fixture provenance manifest not found: ${manifestPath}`);
  }

  return validateFixtureProvenance(JSON.parse(readFileSync(manifestPath, "utf8")));
}

export function validateFixtureProvenance(value: unknown): FixtureProvenanceManifest {
  return fixtureProvenanceManifestSchema.parse(value);
}
