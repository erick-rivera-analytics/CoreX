export type MyWorkSegment = "today" | "list" | "calendar" | "agenda";
export type MyWorkSpaceColor = "slate" | "sky" | "emerald" | "amber" | "rose";
export type MyWorkTaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type MyWorkPriority = "low" | "medium" | "high" | "urgent";
export type MyWorkReminderStatus = "pending" | "sent" | "read" | "canceled";
export type MyWorkReminderTargetType = "task" | "event";

export type MyWorkProfileSnapshot = {
  authUserId: string;
  username: string;
  displayName: string;
  timezoneName: string;
  defaultCalendarViewCode: string;
  defaultTaskViewCode: string;
};

export type MyWorkSpace = {
  id: string;
  name: string;
  slug: string;
  colorToken: MyWorkSpaceColor;
  sortOrder: number;
  isDefault: boolean;
  isArchived: boolean;
  taskCount: number;
  eventCount: number;
};

export type MyWorkTask = {
  id: string;
  spaceId: string;
  title: string;
  details: string;
  statusCode: MyWorkTaskStatus;
  priorityCode: MyWorkPriority;
  startAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  isStarred: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MyWorkEvent = {
  id: string;
  spaceId: string;
  title: string;
  details: string;
  startAt: string;
  endAt: string | null;
  linkedTaskId: string | null;
  allDay: boolean;
  isBusy: boolean;
  locationText: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MyWorkReminder = {
  id: string;
  targetType: MyWorkReminderTargetType;
  targetId: string;
  title: string;
  remindAt: string;
  statusCode: MyWorkReminderStatus;
  noteText: string;
};

export type MyWorkCalendarItem = {
  id: string;
  kind: "task" | "event";
  sourceId: string;
  spaceId: string;
  title: string;
  subtitle: string;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  priorityCode: MyWorkPriority | null;
  statusCode: MyWorkTaskStatus | null;
  colorToken: MyWorkSpaceColor;
};

export type MyWorkAgendaItem = {
  id: string;
  kind: "task" | "event" | "reminder";
  sourceId: string;
  title: string;
  subtitle: string;
  startsAt: string;
  endsAt: string | null;
  tone: "default" | "warning" | "danger" | "success";
  spaceLabel: string;
};

export type MyWorkSummary = {
  pendingToday: number;
  overdue: number;
  inProgress: number;
  nextSevenDays: number;
  nextEventLabel: string;
  upcomingReminders: number;
};

export type MyWorkInitialData = {
  profile: MyWorkProfileSnapshot;
  spaces: MyWorkSpace[];
  tasks: MyWorkTask[];
  events: MyWorkEvent[];
  reminders: MyWorkReminder[];
  calendarItems?: MyWorkCalendarItem[];
  summary?: MyWorkSummary;
};

export type MyWorkFilters = {
  segment: MyWorkSegment;
  search: string;
  spaceId: string;
  statusCode: "all" | MyWorkTaskStatus;
  priorityCode: "all" | MyWorkPriority;
  dateFrom: string;
  dateTo: string;
  selectedDate: string;
  visibleMonth: string;
};

export type TaskFormValue = {
  id?: string;
  spaceId: string;
  title: string;
  details: string;
  statusCode: MyWorkTaskStatus;
  priorityCode: MyWorkPriority;
  startAt: string;
  dueAt: string;
  isStarred: boolean;
};

export type EventFormValue = {
  id?: string;
  spaceId: string;
  title: string;
  details: string;
  startAt: string;
  endAt: string;
  linkedTaskId: string;
  allDay: boolean;
  isBusy: boolean;
  locationText: string;
};

export type SpaceFormValue = {
  id?: string;
  name: string;
  colorToken: MyWorkSpaceColor;
  sortOrder: number;
};

export type ReminderFormValue = {
  id?: string;
  targetType: MyWorkReminderTargetType;
  targetId: string;
  title: string;
  remindAt: string;
  noteText: string;
};

export const MY_WORK_SEGMENT_OPTIONS: Array<{ value: MyWorkSegment; label: string }> = [
  { value: "today", label: "Hoy" },
  { value: "list", label: "Lista" },
  { value: "calendar", label: "Calendario" },
  { value: "agenda", label: "Agenda" },
];

export const MY_WORK_STATUS_OPTIONS: Array<{ value: MyWorkTaskStatus; label: string }> = [
  { value: "todo", label: "Por hacer" },
  { value: "in_progress", label: "En progreso" },
  { value: "blocked", label: "Bloqueada" },
  { value: "done", label: "Hecha" },
];

export const MY_WORK_PRIORITY_OPTIONS: Array<{ value: MyWorkPriority; label: string }> = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Normal" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export const MY_WORK_SPACE_COLORS: Array<{ value: MyWorkSpaceColor; label: string }> = [
  { value: "slate", label: "Grafito" },
  { value: "sky", label: "Azul" },
  { value: "emerald", label: "Esmeralda" },
  { value: "amber", label: "Ambar" },
  { value: "rose", label: "Rosa" },
];
