import { z } from "zod";

export const commercialClaimCreateSchema = z.object({
  claimScope: z.enum(["quality", "commercial"]),
  creditNoteApplicability: z.enum(["credit-note", "not-applicable"]),
  customerId: z.string().trim().min(1),
  commercializerId: z.string().trim().min(1),
  accountExecutiveId: z.string().trim().min(1),
  farmId: z.string().trim().min(1),
  varietyId: z.string().trim().min(1),
  processDestinationId: z.string().trim().nullable().optional(),
  processNotApplicable: z.boolean().optional(),
  problemFamilyId: z.string().trim().min(1).nullable().optional(),
  problemId: z.string().trim().min(1),
  referenceOrderNumber: z.string().trim().regex(/^\d{8}$/).nullable().optional(),
  referenceInvoiceNumber: z.string().trim().regex(/^\d{7}$/).nullable().optional(),
  eventDate: z.string().trim().min(1).max(20).nullable().optional(),
  subject: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

export const commercialClaimApprovalSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).nullable().optional(),
});

export const commercialClaimApplicationSchema = z.object({
  note: z.string().trim().max(500).nullable().optional(),
});
