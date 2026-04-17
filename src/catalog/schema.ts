import { z } from "zod";

export const ServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(["download", "indexer", "arr", "subtitle", "media", "request", "proxy", "dns", "ddns", "utility"]),
  image: z.string(),
  tag: z.string().default("latest"),
  ports: z.array(z.number()),
  adminPort: z.number().optional(),
  configPath: z.string().default("/config"),
  mounts: z.record(z.string(), z.string()).default({}),
  envVars: z.record(z.string(), z.string()).default({}),
  dependsOn: z.array(z.string()).default([]),
  health: z
    .object({
      type: z.enum(["http", "tcp"]),
      path: z.string().optional(),
      port: z.number(),
    })
    .optional(),
  default: z.boolean().default(false),
  requiresAdminAuth: z.boolean().default(false),
  apiKeyEnv: z.string().optional(),
  hwaccelSupport: z.boolean().default(false),
  networkMode: z.string().optional(),
});

export type Service = z.infer<typeof ServiceSchema>;

export const CatalogSchema = z.object({
  version: z.number(),
  services: z.array(ServiceSchema),
});

export type Catalog = z.infer<typeof CatalogSchema>;
