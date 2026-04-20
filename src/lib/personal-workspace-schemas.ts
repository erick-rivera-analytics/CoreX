import { z } from "zod/v4";

import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/personal-workspace-types";

const trimmed = z.string().trim();

function nullableText(max = 2000) {
  return trimmed.max(max).nullish().transform((value) => value?.trim() || null);
}

/** Acepta cualquier string parseable como fecha (incluye datetime-local sin offset)
 *  y lo normaliza a ISO 8601 UTC. */
function flexibleDateTime() {
  return z.string().trim().transform((val, ctx) => {
    if (!val) return null;
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Fecha invalida." });
      return z.NEVER;
    }
    return d.toISOString();
  });
}

const optionalNullableDateTime = flexibleDateTime().nullable().optional();

export const notificationPrefsSchema = z.object({
  inAppTaskAssigned: z.boolean().default(DEFAULT_NOTIFICATION_PREFS.inAppTaskAssigned),
  inAppTaskDue: z.boolean().default(DEFAULT_NOTIFICATION_PREFS.inAppTaskDue),
  inAppReminder: z.boolean().default(DEFAULT_NOTIFICATION_PREFS.inAppReminder),
  emailTaskAssigned: z.boolean().default(DEFAULT_NOTIFICATION_PREFS.emailTaskAssigned),
  emailTaskDue: z.boolean().default(DEFAULT_NOTIFICATION_PREFS.emailTaskDue),
  emailReminder: z.boolean().default(DEFAULT_NOTIFICATION_PREFS.emailReminder),
});

export const profilePatchSchema = z.object({
  displayName: trimmed.min(1).max(160),
  avatarUrl: nullableText(1000),
  bioText: nullableText(1200),
  localeCode: trimmed.min(2).max(16),
  timezoneName: trimmed.min(2).max(64),
  themeCode: z.enum(["system", "light", "dark"]),
  defaultRoute: trimmed.min(1).max(255),
  defaultCalendarViewCode: z.enum(["month", "agenda"]),
  defaultTaskViewCode: z.enum(["today", "list"]),
  weekStartIso: z.number().int().min(1).max(7),
  contactEmail: trimmed
    .max(320)
    .nullish()
    .transform((value, ctx) => {
      const trimmedValue = value?.trim() ?? "";
      if (!trimmedValue) return null;
      // Validacion simple de email sin dependencia en z.email() para maxima compat
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) {
        ctx.addIssue({ code: "custom", message: "Correo de contacto invalido." });
        return z.NEVER;
      }
      return trimmedValue;
    }),
  notificationPrefs: notificationPrefsSchema,
});

export const createSpaceSchema = z.object({
  spaceName: trimmed.min(1).max(120),
  colorToken: trimmed.min(1).max(32).default("slate"),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const updateSpaceSchema = createSpaceSchema.partial();

export const taskFiltersSchema = z.object({
  spaceId: z.string().trim().optional(),
  statusCode: z.enum(["todo", "in_progress", "blocked", "done"]).optional(),
  priorityCode: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  search: z.string().trim().max(120).optional(),
});

export const createTaskSchema = z.object({
  spaceId: z.string().uuid(),
  titleText: trimmed.min(1).max(200),
  descriptionText: nullableText(2000),
  statusCode: z.enum(["todo", "in_progress", "blocked", "done"]).default("todo"),
  priorityCode: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  startAt: flexibleDateTime().nullish().transform((value) => value ?? null),
  dueAt: flexibleDateTime().nullish().transform((value) => value ?? null),
  isStarred: z.boolean().default(false),
});

export const updateTaskSchema = z.object({
  spaceId: z.string().uuid().optional(),
  titleText: trimmed.min(1).max(200).optional(),
  descriptionText: nullableText(2000).optional(),
  statusCode: z.enum(["todo", "in_progress", "blocked", "done"]).optional(),
  priorityCode: z.enum(["low", "medium", "high", "urgent"]).optional(),
  startAt: optionalNullableDateTime,
  dueAt: optionalNullableDateTime,
  completedAt: optionalNullableDateTime,
  isStarred: z.boolean().optional(),
});

export const eventFiltersSchema = z.object({
  spaceId: z.string().trim().optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

export const createEventSchema = z.object({
  spaceId: z.string().uuid(),
  linkedTaskId: z.string().uuid().nullish().transform((value) => value ?? null),
  titleText: trimmed.min(1).max(200),
  descriptionText: nullableText(2000),
  startAt: flexibleDateTime(),
  endAt: flexibleDateTime(),
  allDay: z.boolean().default(false),
  isBusy: z.boolean().default(true),
  locationText: nullableText(255),
}).refine((value) => new Date(value.endAt).getTime() >= new Date(value.startAt).getTime(), {
  message: "La fecha final no puede ser anterior a la inicial.",
  path: ["endAt"],
});

export const updateEventSchema = z.object({
  spaceId: z.string().uuid().optional(),
  linkedTaskId: z.string().uuid().nullable().optional(),
  titleText: trimmed.min(1).max(200).optional(),
  descriptionText: nullableText(2000).optional(),
  startAt: flexibleDateTime().optional(),
  endAt: flexibleDateTime().optional(),
  allDay: z.boolean().optional(),
  isBusy: z.boolean().optional(),
  locationText: nullableText(255).optional(),
});

export const reminderFiltersSchema = z.object({
  statusCode: z.enum(["pending", "sent", "read", "canceled"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const createReminderSchema = z.object({
  linkedTaskId: z.string().uuid().nullish().transform((value) => value ?? null),
  linkedEventId: z.string().uuid().nullish().transform((value) => value ?? null),
  remindAt: flexibleDateTime(),
  channelCode: z.enum(["in_app", "email"]).default("in_app"),
  noteText: nullableText(255),
}).refine((value) => Number(Boolean(value.linkedTaskId)) + Number(Boolean(value.linkedEventId)) === 1, {
  message: "El recordatorio debe ligarse a una tarea o a un evento.",
  path: ["linkedTaskId"],
});

export const updateReminderSchema = z.object({
  remindAt: flexibleDateTime().optional(),
  channelCode: z.enum(["in_app", "email"]).optional(),
  noteText: nullableText(255).optional(),
  statusCode: z.enum(["pending", "sent", "read", "canceled"]).optional(),
});

export const calendarFiltersSchema = z.object({
  spaceId: z.string().trim().optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;
export type UpdateSpaceInput = z.infer<typeof updateSpaceSchema>;
export type TaskFiltersInput = z.infer<typeof taskFiltersSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type EventFiltersInput = z.infer<typeof eventFiltersSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ReminderFiltersInput = z.infer<typeof reminderFiltersSchema>;
export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
export type CalendarFiltersInput = z.infer<typeof calendarFiltersSchema>;
