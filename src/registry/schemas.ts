import { z } from "zod";

export const eipStatusSchema = z.enum([
  "scheduled",
  "considered",
  "proposed",
  "declined",
  "superseded",
  "unknown"
]);

export const eipDomainSchema = z.enum([
  "execution",
  "consensus",
  "networking",
  "tooling",
  "monitoring",
  "indexer",
  "validator",
  "builder",
  "contracts"
]);

export const eipEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: eipStatusSchema,
  domain: z.array(eipDomainSchema).min(1),
  detectors: z.array(z.string()).default([]),
  notes: z.string().optional()
});

export const eipRegistrySourceSchema = z.object({
  type: z.enum([
    "meta-eip",
    "ethereum-roadmap",
    "forkcast",
    "protocol-blog",
    "devnet-spec",
    "spec-release"
  ]),
  url: z.string().url(),
  sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  retrievedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  claim: z.string().min(1),
  notes: z.string().optional()
}).strict();

export const eipRegistrySchema = z.object({
  fork: z.string().min(1),
  lastUpdated: z.string().min(1),
  sources: z.array(eipRegistrySourceSchema).default([]),
  eips: z.array(eipEntrySchema)
});

export type EipStatus = z.infer<typeof eipStatusSchema>;
export type EipDomain = z.infer<typeof eipDomainSchema>;
export type EipEntry = z.infer<typeof eipEntrySchema>;
export type EipRegistrySource = z.infer<typeof eipRegistrySourceSchema>;
export type EipRegistry = z.infer<typeof eipRegistrySchema>;
