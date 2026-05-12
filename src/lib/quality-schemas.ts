import { z } from "zod";

export const qualitySimpleMasterInputSchema = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).nullable().optional(),
  externalRefCode: z.string().trim().max(120).nullable().optional(),
  contactEmail: z.string().trim().email().max(200).nullable().optional().or(z.literal("")),
  isActive: z.boolean(),
  changeReason: z.string().trim().max(200).nullable().optional(),
});

export const qualityClaimProblemInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  level: z.enum(["family", "subfamily"]),
  scope: z.enum(["quality", "commercial", "all"]),
  parentProblemIds: z.array(z.string().trim().min(1)).max(12).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean(),
  changeReason: z.string().trim().max(200).nullable().optional(),
});
