type IsoDateTime = string | null;

export type NotificationPrefs = {
  inAppTaskAssigned: boolean;
  inAppTaskDue: boolean;
  inAppReminder: boolean;
  emailTaskAssigned: boolean;
  emailTaskDue: boolean;
  emailReminder: boolean;
};

export const PERSONAL_WORKSPACE_DEFAULT_ROUTE = "/dashboard/mi-trabajo";

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  inAppTaskAssigned: true,
  inAppTaskDue: true,
  inAppReminder: true,
  emailTaskAssigned: false,
  emailTaskDue: false,
  emailReminder: false,
};

export const THEME_OPTIONS = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
] as const;

export const CALENDAR_VIEW_OPTIONS = [
  { value: "month", label: "Mes" },
  { value: "agenda", label: "Agenda" },
] as const;

export const TASK_VIEW_OPTIONS = [
  { value: "today", label: "Hoy" },
  { value: "list", label: "Lista" },
] as const;

export const TASK_STATUS_OPTIONS = [
  { value: "todo", label: "Por hacer" },
  { value: "in_progress", label: "En progreso" },
  { value: "blocked", label: "Bloqueada" },
  { value: "done", label: "Hecha" },
] as const;

export const TASK_PRIORITY_OPTIONS = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Normal" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
] as const;

export const REMINDER_STATUS_OPTIONS = [
  { value: "pending", label: "Pendiente" },
  { value: "sent", label: "Enviado" },
  { value: "read", label: "Leido" },
  { value: "canceled", label: "Cancelado" },
] as const;

export type PersonalWorkspaceProfile = {
  authUserId: string;
  displayName: string;
  avatarUrl: string | null;
  bioText: string | null;
  localeCode: string;
  timezoneName: string;
  themeCode: string;
  defaultRoute: string;
  defaultCalendarViewCode: string;
  defaultTaskViewCode: string;
  weekStartIso: number;
  contactEmail: string | null;
  notificationPrefs: NotificationPrefs;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type PersonalWorkspaceSpace = {
  spaceId: string;
  authUserId: string;
  spaceName: string;
  spaceSlug: string;
  colorToken: string;
  sortOrder: number;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type PersonalWorkspaceTask = {
  taskId: string;
  authUserId: string;
  spaceId: string;
  spaceName: string | null;
  colorToken: string | null;
  titleText: string;
  descriptionText: string | null;
  statusCode: string;
  priorityCode: string;
  startAt: IsoDateTime;
  dueAt: IsoDateTime;
  completedAt: IsoDateTime;
  isStarred: boolean;
  archivedAt: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type PersonalWorkspaceEvent = {
  eventId: string;
  authUserId: string;
  spaceId: string;
  spaceName: string | null;
  colorToken: string | null;
  linkedTaskId: string | null;
  titleText: string;
  descriptionText: string | null;
  startAt: IsoDateTime;
  endAt: IsoDateTime;
  allDay: boolean;
  isBusy: boolean;
  locationText: string | null;
  archivedAt: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type PersonalWorkspaceReminder = {
  reminderId: string;
  authUserId: string;
  linkedTaskId: string | null;
  linkedEventId: string | null;
  remindAt: IsoDateTime;
  channelCode: string;
  statusCode: string;
  noteText: string | null;
  titleText: string | null;
  sentAt: IsoDateTime;
  readAt: IsoDateTime;
  canceledAt: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type PersonalWorkspaceCalendarItem = {
  itemKind: "task" | "event";
  itemId: string;
  authUserId: string;
  spaceId: string | null;
  spaceName: string | null;
  colorToken: string | null;
  titleText: string;
  descriptionText: string | null;
  statusCode: string | null;
  priorityCode: string | null;
  startAt: IsoDateTime;
  endAt: IsoDateTime;
  allDay: boolean;
  isBusy: boolean;
  locationText: string | null;
  linkedTaskId: string | null;
  sourceAt: IsoDateTime;
};

export type PersonalWorkSummary = {
  pendingToday: number;
  overdue: number;
  inProgress: number;
  nextSevenDays: number;
  nextEventTitle: string | null;
  nextEventAt: IsoDateTime;
  upcomingReminders: number;
};

export type MyAccountPageData = {
  profile: PersonalWorkspaceProfile;
  summary: PersonalWorkSummary;
};

export type MyWorkPageData = {
  profile: PersonalWorkspaceProfile;
  spaces: PersonalWorkspaceSpace[];
  summary: PersonalWorkSummary;
  tasks: PersonalWorkspaceTask[];
  agendaItems: PersonalWorkspaceCalendarItem[];
  reminders: PersonalWorkspaceReminder[];
  calendarItems: PersonalWorkspaceCalendarItem[];
};

function toIsoString(value: unknown): IsoDateTime {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

export function normalizeNotificationPrefs(value: unknown): NotificationPrefs {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};

  return {
    inAppTaskAssigned: source.inAppTaskAssigned === undefined
      ? toBoolean(source.in_app_task_assigned ?? DEFAULT_NOTIFICATION_PREFS.inAppTaskAssigned)
      : toBoolean(source.inAppTaskAssigned),
    inAppTaskDue: source.inAppTaskDue === undefined
      ? toBoolean(source.in_app_task_due ?? DEFAULT_NOTIFICATION_PREFS.inAppTaskDue)
      : toBoolean(source.inAppTaskDue),
    inAppReminder: source.inAppReminder === undefined
      ? toBoolean(source.in_app_reminder ?? DEFAULT_NOTIFICATION_PREFS.inAppReminder)
      : toBoolean(source.inAppReminder),
    emailTaskAssigned: source.emailTaskAssigned === undefined
      ? toBoolean(source.email_task_assigned ?? DEFAULT_NOTIFICATION_PREFS.emailTaskAssigned)
      : toBoolean(source.emailTaskAssigned),
    emailTaskDue: source.emailTaskDue === undefined
      ? toBoolean(source.email_task_due ?? DEFAULT_NOTIFICATION_PREFS.emailTaskDue)
      : toBoolean(source.emailTaskDue),
    emailReminder: source.emailReminder === undefined
      ? toBoolean(source.email_reminder ?? DEFAULT_NOTIFICATION_PREFS.emailReminder)
      : toBoolean(source.emailReminder),
  };
}

export function notificationPrefsToJson(value: NotificationPrefs) {
  return {
    in_app_task_assigned: value.inAppTaskAssigned,
    in_app_task_due: value.inAppTaskDue,
    in_app_reminder: value.inAppReminder,
    email_task_assigned: value.emailTaskAssigned,
    email_task_due: value.emailTaskDue,
    email_reminder: value.emailReminder,
  };
}

export function mapWorkspaceProfileRow(row: Record<string, unknown>): PersonalWorkspaceProfile {
  return {
    authUserId: String(row.auth_user_id ?? ""),
    displayName: String(row.display_name ?? ""),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    bioText: row.bio_text ? String(row.bio_text) : null,
    localeCode: String(row.locale_code ?? "es-EC"),
    timezoneName: String(row.timezone_name ?? "America/Guayaquil"),
    themeCode: String(row.theme_code ?? "system"),
    defaultRoute: String(row.default_route ?? PERSONAL_WORKSPACE_DEFAULT_ROUTE),
    defaultCalendarViewCode: String(row.default_calendar_view_code ?? "month"),
    defaultTaskViewCode: String(row.default_task_view_code ?? "today"),
    weekStartIso: toNumber(row.week_start_iso, 1),
    contactEmail: row.contact_email ? String(row.contact_email) : null,
    notificationPrefs: normalizeNotificationPrefs(row.notification_prefs_jsonb),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export function mapWorkspaceSpaceRow(row: Record<string, unknown>): PersonalWorkspaceSpace {
  return {
    spaceId: String(row.space_id ?? ""),
    authUserId: String(row.auth_user_id ?? ""),
    spaceName: String(row.space_name ?? ""),
    spaceSlug: String(row.space_slug ?? ""),
    colorToken: String(row.color_token ?? "slate"),
    sortOrder: toNumber(row.sort_order, 0),
    isDefault: toBoolean(row.is_default),
    isArchived: toBoolean(row.is_archived),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export function mapWorkspaceTaskRow(row: Record<string, unknown>): PersonalWorkspaceTask {
  return {
    taskId: String(row.task_id ?? ""),
    authUserId: String(row.auth_user_id ?? ""),
    spaceId: String(row.space_id ?? ""),
    spaceName: row.space_name ? String(row.space_name) : null,
    colorToken: row.color_token ? String(row.color_token) : null,
    titleText: String(row.title ?? row.title_text ?? ""),
    descriptionText: row.description_text ? String(row.description_text) : null,
    statusCode: String(row.status_code ?? "todo"),
    priorityCode: String(row.priority_code ?? "medium"),
    startAt: toIsoString(row.start_at),
    dueAt: toIsoString(row.due_at),
    completedAt: toIsoString(row.completed_at),
    isStarred: toBoolean(row.is_starred),
    archivedAt: toIsoString(row.archived_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export function mapWorkspaceEventRow(row: Record<string, unknown>): PersonalWorkspaceEvent {
  return {
    eventId: String(row.event_id ?? ""),
    authUserId: String(row.auth_user_id ?? ""),
    spaceId: String(row.space_id ?? ""),
    spaceName: row.space_name ? String(row.space_name) : null,
    colorToken: row.color_token ? String(row.color_token) : null,
    linkedTaskId: row.linked_task_id ? String(row.linked_task_id) : null,
    titleText: String(row.title ?? row.title_text ?? ""),
    descriptionText: row.description_text ? String(row.description_text) : null,
    startAt: toIsoString(row.starts_at ?? row.start_at),
    endAt: toIsoString(row.ends_at ?? row.end_at),
    allDay: toBoolean(row.all_day),
    isBusy: row.is_busy === undefined ? true : toBoolean(row.is_busy),
    locationText: row.location_text ? String(row.location_text) : null,
    archivedAt: toIsoString(row.archived_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export function mapWorkspaceReminderRow(row: Record<string, unknown>): PersonalWorkspaceReminder {
  return {
    reminderId: String(row.reminder_id ?? ""),
    authUserId: String(row.auth_user_id ?? ""),
    linkedTaskId: row.task_id ? String(row.task_id) : null,
    linkedEventId: row.event_id ? String(row.event_id) : null,
    remindAt: toIsoString(row.remind_at),
    channelCode: String(row.channel_code ?? "in_app"),
    statusCode: String(row.status_code ?? "pending"),
    noteText: null,
    titleText: row.linked_title ? String(row.linked_title) : null,
    sentAt: toIsoString(row.sent_at),
    readAt: toIsoString(row.read_at),
    canceledAt: null,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export function mapWorkspaceCalendarItemRow(row: Record<string, unknown>): PersonalWorkspaceCalendarItem {
  return {
    itemKind: (row.item_type ?? row.item_kind) === "event" ? "event" : "task",
    itemId: String(row.item_id ?? ""),
    authUserId: String(row.auth_user_id ?? ""),
    spaceId: row.space_id ? String(row.space_id) : null,
    spaceName: row.space_name ? String(row.space_name) : null,
    colorToken: row.color_token ? String(row.color_token) : null,
    titleText: String(row.title ?? row.title_text ?? ""),
    descriptionText: row.description_text ? String(row.description_text) : null,
    statusCode: row.status_code ? String(row.status_code) : null,
    priorityCode: row.priority_code ? String(row.priority_code) : null,
    startAt: toIsoString(row.starts_at ?? row.start_at),
    endAt: toIsoString(row.ends_at ?? row.end_at),
    allDay: toBoolean(row.all_day),
    isBusy: row.is_busy === undefined ? false : toBoolean(row.is_busy),
    locationText: row.location_text ? String(row.location_text) : null,
    linkedTaskId: (row.task_id ?? row.linked_task_id) ? String(row.task_id ?? row.linked_task_id) : null,
    sourceAt: toIsoString(row.starts_at ?? row.source_at),
  };
}
