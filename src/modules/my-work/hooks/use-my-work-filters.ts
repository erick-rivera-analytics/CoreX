"use client";

import { useState } from "react";

import type {
  EventFormValue,
  MyWorkAgendaItem,
  MyWorkCalendarItem,
  MyWorkEvent,
  MyWorkFilters,
  MyWorkReminder,
  MyWorkSegment,
  MyWorkSummary,
  MyWorkTask,
  TaskFormValue,
} from "@/modules/my-work/server/types";
import { toDateTimeInput } from "@/modules/my-work/server/mappers";

function getVisibleMonth(value: string) {
  const [year = "2000", month = "01"] = value.split("-");
  return `${year}-${month}-01`;
}

export function useMyWorkFilters(initialDate: string) {
  const [filters, setFilters] = useState<MyWorkFilters>({
    segment: "today",
    search: "",
    spaceId: "all",
    statusCode: "all",
    priorityCode: "all",
    dateFrom: "",
    dateTo: "",
    selectedDate: initialDate,
    visibleMonth: getVisibleMonth(initialDate),
  });

  function updateFilter<Key extends keyof MyWorkFilters>(key: Key, value: MyWorkFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function setSegment(segment: MyWorkSegment) {
    setFilters((current) => ({ ...current, segment }));
  }

  function setSelectedDate(selectedDate: string) {
    setFilters((current) => ({
      ...current,
      selectedDate,
      visibleMonth: getVisibleMonth(selectedDate),
    }));
  }

  function setVisibleMonth(visibleMonth: string) {
    setFilters((current) => ({ ...current, visibleMonth }));
  }

  function resetFilters() {
    setFilters((current) => ({
      ...current,
      search: "",
      spaceId: "all",
      statusCode: "all",
      priorityCode: "all",
      dateFrom: "",
      dateTo: "",
    }));
  }

  return {
    filters,
    updateFilter,
    setSegment,
    setSelectedDate,
    setVisibleMonth,
    resetFilters,
  };
}

function toDateKey(value: string | null | undefined) {
  return value ? (value.split("T")[0] ?? value) : "";
}

export function applyRangeFilter(value: string, dateFrom: string, dateTo: string) {
  const key = toDateKey(value);
  if (!key) return false;
  if (dateFrom && key < dateFrom) return false;
  if (dateTo && key > dateTo) return false;
  return true;
}

export function taskMatches(task: MyWorkTask, filters: Pick<MyWorkFilters, "search" | "spaceId" | "statusCode" | "priorityCode" | "dateFrom" | "dateTo">) {
  if (task.isArchived) return false;
  if (filters.spaceId !== "all" && task.spaceId !== filters.spaceId) return false;
  if (filters.statusCode !== "all" && task.statusCode !== filters.statusCode) return false;
  if (filters.priorityCode !== "all" && task.priorityCode !== filters.priorityCode) return false;
  const searchText = `${task.title} ${task.details}`.toLowerCase();
  if (filters.search && !searchText.includes(filters.search.toLowerCase())) return false;
  if (filters.dateFrom || filters.dateTo) {
    const pivot = task.dueAt ?? task.startAt;
    if (!pivot || !applyRangeFilter(pivot, filters.dateFrom, filters.dateTo)) return false;
  }
  return true;
}

export function buildCalendarItems(tasks: MyWorkTask[], events: MyWorkEvent[], colorBySpace: Record<string, string>) {
  const taskItems: MyWorkCalendarItem[] = tasks
    .filter((task) => !task.isArchived && !!(task.startAt || task.dueAt))
    .map((task) => ({
      id: `task-${task.id}`,
      kind: "task",
      sourceId: task.id,
      spaceId: task.spaceId,
      title: task.title,
      subtitle: task.statusCode,
      startAt: task.startAt ?? task.dueAt!,
      endAt: null,
      allDay: false,
      priorityCode: task.priorityCode,
      statusCode: task.statusCode,
      colorToken: (colorBySpace[task.spaceId] as MyWorkCalendarItem["colorToken"] | undefined) ?? "slate",
    }));
  const eventItems: MyWorkCalendarItem[] = events
    .filter((event) => !event.isArchived)
    .map((event) => ({
      id: `event-${event.id}`,
      kind: "event",
      sourceId: event.id,
      spaceId: event.spaceId,
      title: event.title,
      subtitle: event.locationText || "Evento personal",
      startAt: event.startAt,
      endAt: event.endAt,
      allDay: event.allDay,
      priorityCode: null,
      statusCode: null,
      colorToken: (colorBySpace[event.spaceId] as MyWorkCalendarItem["colorToken"] | undefined) ?? "sky",
    }));

  return [...taskItems, ...eventItems];
}

export function buildAgendaItems(
  tasks: MyWorkTask[],
  events: MyWorkEvent[],
  reminders: MyWorkReminder[],
  spaceNameById: Record<string, string>,
  filters: Pick<MyWorkFilters, "search" | "spaceId" | "dateFrom" | "dateTo">,
) {
  const taskItems: MyWorkAgendaItem[] = tasks
    .filter((task) => taskMatches(task, { ...filters, statusCode: "all", priorityCode: "all" }))
    .filter((task) => !!(task.startAt || task.dueAt))
    .map((task) => ({
      id: `task-${task.id}`,
      kind: "task",
      sourceId: task.id,
      title: task.title,
      subtitle: task.details || "Tarea operativa personal",
      startsAt: task.startAt ?? task.dueAt!,
      endsAt: null,
      tone: task.statusCode === "done" ? "success" : task.statusCode === "blocked" ? "warning" : task.dueAt && new Date(task.dueAt).getTime() < Date.now() ? "danger" : "default",
      spaceLabel: spaceNameById[task.spaceId] ?? "Sin espacio",
    }));
  const eventItems: MyWorkAgendaItem[] = events
    .filter((event) => !event.isArchived)
    .filter((event) => filters.spaceId === "all" || event.spaceId === filters.spaceId)
    .filter((event) => !filters.search || `${event.title} ${event.details} ${event.locationText}`.toLowerCase().includes(filters.search.toLowerCase()))
    .map((event) => ({
      id: `event-${event.id}`,
      kind: "event",
      sourceId: event.id,
      title: event.title,
      subtitle: event.locationText || "Evento personal",
      startsAt: event.startAt,
      endsAt: event.endAt,
      tone: "default",
      spaceLabel: spaceNameById[event.spaceId] ?? "Sin espacio",
    }));
  const reminderItems: MyWorkAgendaItem[] = reminders
    .filter((reminder) => reminder.statusCode === "pending")
    .filter((reminder) => !filters.search || `${reminder.title} ${reminder.noteText}`.toLowerCase().includes(filters.search.toLowerCase()))
    .map((reminder) => ({
      id: `reminder-${reminder.id}`,
      kind: "reminder",
      sourceId: reminder.id,
      title: reminder.title,
      subtitle: reminder.noteText || "Recordatorio pendiente",
      startsAt: reminder.remindAt,
      endsAt: null,
      tone: "warning",
      spaceLabel: "Recordatorio",
    }));

  return [...taskItems, ...eventItems, ...reminderItems]
    .filter((item) => (!filters.dateFrom && !filters.dateTo) || applyRangeFilter(item.startsAt, filters.dateFrom, filters.dateTo))
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
}

export function buildSummary(tasks: MyWorkTask[], events: MyWorkEvent[], reminders: MyWorkReminder[], today: string): MyWorkSummary {
  const activeTasks = tasks.filter((task) => !task.isArchived);
  const pendingToday = activeTasks.filter((task) => task.statusCode !== "done" && toDateKey(task.dueAt ?? task.startAt) === today).length;
  const overdue = activeTasks.filter((task) => task.statusCode !== "done" && !!task.dueAt && toDateKey(task.dueAt) < today).length;
  const inProgress = activeTasks.filter((task) => task.statusCode === "in_progress").length;
  const nextSevenDays = activeTasks.filter((task) => task.statusCode !== "done" && !!task.dueAt && toDateKey(task.dueAt) >= today).length;
  const nextEvent = events.filter((event) => !event.isArchived).sort((left, right) => left.startAt.localeCompare(right.startAt))[0];
  const upcomingReminders = reminders.filter((reminder) => reminder.statusCode === "pending").length;

  return {
    pendingToday,
    overdue,
    inProgress,
    nextSevenDays,
    nextEventLabel: nextEvent ? nextEvent.title : "Sin eventos",
    upcomingReminders,
  };
}

export function toTaskFormValue(task: MyWorkTask | undefined): TaskFormValue | null {
  if (!task) return null;
  return {
    id: task.id,
    spaceId: task.spaceId,
    title: task.title,
    details: task.details,
    statusCode: task.statusCode,
    priorityCode: task.priorityCode,
    startAt: toDateTimeInput(task.startAt),
    dueAt: toDateTimeInput(task.dueAt),
    isStarred: task.isStarred,
  };
}

export function toEventFormValue(event: MyWorkEvent | undefined): EventFormValue | null {
  if (!event) return null;
  return {
    id: event.id,
    spaceId: event.spaceId,
    title: event.title,
    details: event.details,
    startAt: toDateTimeInput(event.startAt),
    endAt: toDateTimeInput(event.endAt),
    linkedTaskId: event.linkedTaskId ?? "",
    allDay: event.allDay,
    isBusy: event.isBusy,
    locationText: event.locationText,
  };
}
