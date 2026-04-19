"use client";

import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import type {
  PersonalWorkspaceEvent,
  PersonalWorkspaceReminder,
  PersonalWorkspaceSpace,
  PersonalWorkspaceTask,
} from "@/lib/personal-workspace-types";
import {
  inputToIso,
  mapPersonalEvent,
  mapPersonalReminder,
  mapPersonalSpace,
  mapPersonalTask,
} from "@/modules/my-work/server/mappers";
import type {
  EventFormValue,
  MyWorkEvent,
  MyWorkReminder,
  MyWorkSpace,
  MyWorkTask,
  ReminderFormValue,
  SpaceFormValue,
  TaskFormValue,
} from "@/modules/my-work/server/types";

const jsonHeaders = { "Content-Type": "application/json" };

type ActionState = {
  setSpaces: Dispatch<SetStateAction<MyWorkSpace[]>>;
  setTasks: Dispatch<SetStateAction<MyWorkTask[]>>;
  setEvents: Dispatch<SetStateAction<MyWorkEvent[]>>;
  setReminders: Dispatch<SetStateAction<MyWorkReminder[]>>;
  closeTaskDialog: () => void;
  closeEventDialog: () => void;
  closeSpaceDialog: () => void;
  closeReminderDialog: () => void;
};

function upsertById<T extends { id: string }>(items: T[], nextItem: T) {
  return items.some((item) => item.id === nextItem.id)
    ? items.map((item) => (item.id === nextItem.id ? nextItem : item))
    : [...items, nextItem];
}

function taskPayload(value: TaskFormValue) {
  return {
    spaceId: value.spaceId,
    titleText: value.title,
    descriptionText: value.details || null,
    statusCode: value.statusCode,
    priorityCode: value.priorityCode,
    startAt: inputToIso(value.startAt),
    dueAt: inputToIso(value.dueAt),
    completedAt: value.statusCode === "done" ? new Date().toISOString() : value.statusCode ? null : undefined,
    isStarred: value.isStarred,
  };
}

function eventPayload(value: EventFormValue) {
  return {
    spaceId: value.spaceId,
    linkedTaskId: value.linkedTaskId || null,
    titleText: value.title,
    descriptionText: value.details || null,
    startAt: inputToIso(value.startAt) ?? new Date().toISOString(),
    endAt: inputToIso(value.endAt) ?? inputToIso(value.startAt) ?? new Date().toISOString(),
    allDay: value.allDay,
    isBusy: value.isBusy,
    locationText: value.locationText || null,
  };
}

function reminderPayload(value: ReminderFormValue) {
  return {
    linkedTaskId: value.targetType === "task" ? value.targetId : null,
    linkedEventId: value.targetType === "event" ? value.targetId : null,
    remindAt: inputToIso(value.remindAt) ?? new Date().toISOString(),
    channelCode: "in_app",
    noteText: value.noteText || null,
  };
}

export function useMyWorkActions(state: ActionState) {
  async function saveTask(value: TaskFormValue) {
    try {
      const response = value.id
        ? await fetchJson<{ task: PersonalWorkspaceTask }>(`/api/me/work/tasks/${value.id}`, "No se pudo guardar la tarea.", {
          method: "PATCH",
          headers: jsonHeaders,
          body: JSON.stringify(taskPayload(value)),
        })
        : await fetchJson<{ task: PersonalWorkspaceTask }>("/api/me/work/tasks", "No se pudo crear la tarea.", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify(taskPayload(value)),
        });

      const task = mapPersonalTask(response.task);
      state.setTasks((current) => upsertById(current, task));
      state.closeTaskDialog();
      toast.success("Tarea guardada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la tarea.");
    }
  }

  async function saveEvent(value: EventFormValue) {
    try {
      const response = value.id
        ? await fetchJson<{ event: PersonalWorkspaceEvent }>(`/api/me/work/events/${value.id}`, "No se pudo guardar el evento.", {
          method: "PATCH",
          headers: jsonHeaders,
          body: JSON.stringify(eventPayload(value)),
        })
        : await fetchJson<{ event: PersonalWorkspaceEvent }>("/api/me/work/events", "No se pudo crear el evento.", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify(eventPayload(value)),
        });

      const event = mapPersonalEvent(response.event);
      state.setEvents((current) => upsertById(current, event));
      state.closeEventDialog();
      toast.success("Evento guardado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el evento.");
    }
  }

  async function saveSpace(value: SpaceFormValue) {
    try {
      const payload = { spaceName: value.name, colorToken: value.colorToken, sortOrder: value.sortOrder };
      const response = value.id
        ? await fetchJson<{ space: PersonalWorkspaceSpace }>(`/api/me/work/spaces/${value.id}`, "No se pudo guardar el espacio.", {
          method: "PATCH",
          headers: jsonHeaders,
          body: JSON.stringify(payload),
        })
        : await fetchJson<{ space: PersonalWorkspaceSpace }>("/api/me/work/spaces", "No se pudo crear el espacio.", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify(payload),
        });

      const space = mapPersonalSpace(response.space);
      state.setSpaces((current) => upsertById(current, space));
      state.closeSpaceDialog();
      toast.success("Espacio guardado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el espacio.");
    }
  }

  async function saveReminder(value: ReminderFormValue) {
    try {
      const response = value.id
        ? await fetchJson<{ reminder: PersonalWorkspaceReminder }>(`/api/me/work/reminders/${value.id}`, "No se pudo guardar el recordatorio.", {
          method: "PATCH",
          headers: jsonHeaders,
          body: JSON.stringify({
            remindAt: inputToIso(value.remindAt) ?? new Date().toISOString(),
            noteText: value.noteText || null,
            statusCode: "pending",
          }),
        })
        : await fetchJson<{ reminder: PersonalWorkspaceReminder }>("/api/me/work/reminders", "No se pudo crear el recordatorio.", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify(reminderPayload(value)),
        });

      const reminder = mapPersonalReminder(response.reminder, value.title);
      state.setReminders((current) => upsertById(current, reminder));
      state.closeReminderDialog();
      toast.success("Recordatorio guardado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el recordatorio.");
    }
  }

  async function archiveTask(task: MyWorkTask) {
    try {
      await fetchJson<{ ok: true }>(`/api/me/work/tasks/${task.id}`, "No se pudo archivar la tarea.", { method: "DELETE" });
      state.setTasks((current) => current.map((candidate) => (candidate.id === task.id ? { ...candidate, isArchived: true } : candidate)));
      toast.success("Tarea archivada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo archivar la tarea.");
    }
  }

  async function archiveEvent(event: MyWorkEvent) {
    try {
      await fetchJson<{ ok: true }>(`/api/me/work/events/${event.id}`, "No se pudo archivar el evento.", { method: "DELETE" });
      state.setEvents((current) => current.map((candidate) => (candidate.id === event.id ? { ...candidate, isArchived: true } : candidate)));
      state.closeEventDialog();
      toast.success("Evento archivado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo archivar el evento.");
    }
  }

  async function archiveSpace(space: MyWorkSpace) {
    try {
      await fetchJson<{ ok: true }>(`/api/me/work/spaces/${space.id}`, "No se pudo archivar el espacio.", { method: "DELETE" });
      state.setSpaces((current) => current.map((candidate) => (candidate.id === space.id ? { ...candidate, isArchived: true } : candidate)));
      state.closeSpaceDialog();
      toast.success("Espacio archivado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo archivar el espacio.");
    }
  }

  async function toggleTaskDone(task: MyWorkTask) {
    const done = task.statusCode !== "done";
    try {
      const response = await fetchJson<{ task: PersonalWorkspaceTask }>(`/api/me/work/tasks/${task.id}`, "No se pudo actualizar la tarea.", {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({
          statusCode: done ? "done" : "todo",
          completedAt: done ? new Date().toISOString() : null,
        }),
      });
      const nextTask = mapPersonalTask(response.task);
      state.setTasks((current) => upsertById(current, nextTask));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la tarea.");
    }
  }

  async function updateReminderStatus(reminder: MyWorkReminder, statusCode: MyWorkReminder["statusCode"]) {
    try {
      const response = await fetchJson<{ reminder: PersonalWorkspaceReminder }>(`/api/me/work/reminders/${reminder.id}`, "No se pudo actualizar el recordatorio.", {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ statusCode }),
      });
      const nextReminder = mapPersonalReminder(response.reminder, reminder.title);
      state.setReminders((current) => upsertById(current, nextReminder));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el recordatorio.");
    }
  }

  return {
    saveTask,
    saveEvent,
    saveSpace,
    saveReminder,
    archiveTask,
    archiveEvent,
    archiveSpace,
    toggleTaskDone,
    updateReminderStatus,
  };
}
