import { z } from "zod";

export const commercialAccountExecutiveInputSchema = z.object({
  naPersonalCode: z.boolean(),
  personCode: z.string().trim().max(64).nullable().optional(),
  executiveName: z.string().trim().max(200).nullable().optional(),
  contactEmail: z.string().trim().email().max(200),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean(),
  changeReason: z.string().trim().max(200).nullable().optional(),
});
