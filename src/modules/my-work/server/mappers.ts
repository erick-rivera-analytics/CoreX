import type {
  PersonalWorkSummary,
  PersonalWorkspaceCalendarItem,
  PersonalWorkspaceEvent,
  PersonalWorkspaceProfile,
  PersonalWorkspaceReminder,
  PersonalWorkspaceSpace,
  PersonalWorkspaceTask,
} from "@/lib/personal-workspace-types";
import type {
  MyWorkCalendarItem,
  MyWorkEvent,
  MyWorkInitialData,
  MyWorkPriority,
  MyWorkReminder,
  MyWorkReminderStatus,
  MyWorkSpace,
  MyWorkSpaceColor,
  MyWorkSummary,
  MyWorkTask,
  MyWorkTaskStatus,
} from "@/modules/my-work/server/types";

export function toDateTimeInput(value: string | null | undefined) {
  return value ? value.slice(0, 16) : "";
}

export function inputToIso(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value}T00:00`;
  return new Date(normalized).toISOString();
}

export function normalizeColorToken(value: string | null | undefined): MyWorkSpaceColor {
  return value === "sky" || value === "emerald" || value === "amber" || value === "rose" ? value : "slate";
}

export function normalizeTaskStatus(value: string | null | undefined): MyWorkTaskStatus {
  return value === "in_progress" || value === "blocked" || value === "done" ? value : "todo";
}

export function normalizePriority(value: string | null | undefined): MyWorkPriority {
  return value === "low" || value === "high" || value === "urgent" ? value : "medium";
}

export function normalizeReminderStatus(value: string | null | undefined): MyWorkReminderStatus {
  return value === "sent" || value === "read" || value === "canceled" ? value : "pending";
}

export function mapPersonalSpace(space: PersonalWorkspaceSpace): MyWorkSpace {
  return {
    id: space.spaceId,
    name: space.spaceName,
    slug: space.spaceSlug,
    colorToken: normalizeColorToken(space.colorToken),
    sortOrder: space.sortOrder,
    isDefault: space.isDefault,
    isArchived: space.isArchived,
    taskCount: 0,
    eventCount: 0,
  };
}

export function mapPersonalTask(task: PersonalWorkspaceTask): MyWorkTask {
  return {
    id: task.taskId,
    spaceId: task.spaceId,
    title: task.titleText,
    details: task.descriptionText ?? "",
    statusCode: normalizeTaskStatus(task.statusCode),
    priorityCode: normalizePriority(task.priorityCode),
    startAt: task.startAt,
    dueAt: task.dueAt,
    completedAt: task.completedAt,
    isStarred: task.isStarred,
    isArchived: Boolean(task.archivedAt),
    createdAt: task.createdAt ?? new Date().toISOString(),
    updatedAt: task.updatedAt ?? task.createdAt ?? new Date().toISOString(),
  };
}

export function mapPersonalEvent(event: PersonalWorkspaceEvent): MyWorkEvent {
  return {
    id: event.eventId,
    spaceId: event.spaceId,
    title: event.titleText,
    details: event.descriptionText ?? "",
    startAt: event.startAt ?? new Date().toISOString(),
    endAt: event.endAt,
    linkedTaskId: event.linkedTaskId,
    allDay: event.allDay,
    isBusy: event.isBusy,
    locationText: event.locationText ?? "",
    isArchived: Boolean(event.archivedAt),
    createdAt: event.createdAt ?? new Date().toISOString(),
    updatedAt: event.updatedAt ?? event.createdAt ?? new Date().toISOString(),
  };
}

export function mapPersonalReminder(reminder: PersonalWorkspaceReminder, fallbackTitle = "Recordatorio"): MyWorkReminder {
  return {
    id: reminder.reminderId,
    targetType: reminder.linkedTaskId ? "task" : "event",
    targetId: reminder.linkedTaskId ?? reminder.linkedEventId ?? "",
    title: reminder.titleText ?? fallbackTitle,
    remindAt: reminder.remindAt ?? new Date().toISOString(),
    statusCode: normalizeReminderStatus(reminder.statusCode),
    noteText: reminder.noteText ?? "",
  };
}

export function mapPersonalCalendarItem(item: PersonalWorkspaceCalendarItem): MyWorkCalendarItem {
  return {
    id: `${item.itemKind}-${item.itemId}`,
    kind: item.itemKind,
    sourceId: item.itemId,
    spaceId: item.spaceId ?? "sin-espacio",
    title: item.titleText,
    subtitle: item.locationText ?? item.descriptionText ?? (item.itemKind === "event" ? "Evento personal" : "Tarea personal"),
    startAt: item.startAt ?? item.sourceAt ?? new Date().toISOString(),
    endAt: item.endAt,
    allDay: item.allDay,
    priorityCode: item.priorityCode ? normalizePriority(item.priorityCode) : null,
    statusCode: item.statusCode ? normalizeTaskStatus(item.statusCode) : null,
    colorToken: normalizeColorToken(item.colorToken),
  };
}

export function mapPersonalSummary(summary: PersonalWorkSummary): MyWorkSummary {
  return {
    pendingToday: summary.pendingToday,
    overdue: summary.overdue,
    inProgress: summary.inProgress,
    nextSevenDays: summary.nextSevenDays,
    nextEventLabel: summary.nextEventTitle ?? "Sin eventos",
    upcomingReminders: summary.upcomingReminders,
  };
}

export function calendarEventsFromItems(items: PersonalWorkspaceCalendarItem[]): MyWorkEvent[] {
  const events = new Map<string, MyWorkEvent>();

  for (const item of items) {
    if (item.itemKind !== "event" || !item.itemId || events.has(item.itemId)) continue;
    events.set(item.itemId, {
      id: item.itemId,
      spaceId: item.spaceId ?? "sin-espacio",
      title: item.titleText,
      details: item.descriptionText ?? "",
      startAt: item.startAt ?? item.sourceAt ?? new Date().toISOString(),
      endAt: item.endAt,
      linkedTaskId: item.linkedTaskId,
      allDay: item.allDay,
      isBusy: item.isBusy,
      locationText: item.locationText ?? "",
      isArchived: false,
      createdAt: item.sourceAt ?? new Date().toISOString(),
      updatedAt: item.sourceAt ?? new Date().toISOString(),
    });
  }

  return Array.from(events.values());
}

export function mapPersonalWorkPageData(
  data: {
    profile: PersonalWorkspaceProfile;
    spaces: PersonalWorkspaceSpace[];
    summary: PersonalWorkSummary;
    tasks: PersonalWorkspaceTask[];
    reminders: PersonalWorkspaceReminder[];
    calendarItems: PersonalWorkspaceCalendarItem[];
    agendaItems?: PersonalWorkspaceCalendarItem[];
  },
  username: string,
): MyWorkInitialData {
  const eventSourceItems = [...data.calendarItems, ...(data.agendaItems ?? [])];

  return {
    profile: {
      authUserId: data.profile.authUserId,
      username,
      displayName: data.profile.displayName,
      timezoneName: data.profile.timezoneName,
      defaultCalendarViewCode: data.profile.defaultCalendarViewCode,
      defaultTaskViewCode: data.profile.defaultTaskViewCode,
    },
    spaces: data.spaces.map(mapPersonalSpace),
    tasks: data.tasks.map(mapPersonalTask),
    events: calendarEventsFromItems(eventSourceItems),
    reminders: data.reminders.map((reminder) => mapPersonalReminder(reminder)),
    calendarItems: data.calendarItems.map(mapPersonalCalendarItem),
    summary: mapPersonalSummary(data.summary),
  };
}
