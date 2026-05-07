"use client";

import { useState } from "react";
import { CalendarDays, CalendarPlus2, Plus, RefreshCcw, Shapes } from "lucide-react";

import { EventFormDialog } from "@/modules/my-work/components/event-form-dialog";
import { MyWorkAgenda } from "@/modules/my-work/components/my-work-agenda";
import { MyWorkCalendar } from "@/modules/my-work/components/my-work-calendar";
import { MyWorkSegmentedControl } from "@/modules/my-work/components/my-work-segmented-control";
import { MyWorkSummaryCards } from "@/modules/my-work/components/my-work-summary-cards";
import { MyWorkTaskTable } from "@/modules/my-work/components/my-work-task-table";
import { ReminderFormDialog } from "@/modules/my-work/components/reminder-form-dialog";
import { SpaceFormDialog } from "@/modules/my-work/components/space-form-dialog";
import { SpacesPanel } from "@/modules/my-work/components/spaces-panel";
import { TaskFormDialog } from "@/modules/my-work/components/task-form-dialog";
import { useMyWorkActions } from "@/modules/my-work/hooks/use-my-work-actions";
import {
  buildAgendaItems,
  buildCalendarItems,
  buildSummary,
  taskMatches,
  toEventFormValue,
  toTaskFormValue,
  useMyWorkFilters,
} from "@/modules/my-work/hooks/use-my-work-filters";
import { toDateTimeInput } from "@/modules/my-work/server/mappers";
import type {
  EventFormValue,
  MyWorkAgendaItem,
  MyWorkCalendarItem,
  MyWorkEvent,
  MyWorkInitialData,
  MyWorkTask,
  ReminderFormValue,
  SpaceFormValue,
  TaskFormValue,
} from "@/modules/my-work/server/types";
import { ChartSurface } from "@/shared/data-display/chart-surface";
import { DateField } from "@/shared/filters/date-field";
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { DetailSection, FilterPanel } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { DialogShell } from "@/shared/overlays/dialog-shell";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function toMonthDate(value: string) {
  const [year = "2000", month = "01"] = value.split("-");
  return new Date(Number(year), Number(month) - 1, 1);
}

export function MyWorkExplorer({ initialData }: { initialData: MyWorkInitialData }) {
  const initialDate = todayKey();
  const [spaces, setSpaces] = useState(initialData.spaces);
  const [tasks, setTasks] = useState(initialData.tasks);
  const [events, setEvents] = useState(initialData.events);
  const [reminders, setReminders] = useState(initialData.reminders);
  const [taskDialog, setTaskDialog] = useState<TaskFormValue | null | undefined>(undefined);
  const [eventDialog, setEventDialog] = useState<EventFormValue | null | undefined>(undefined);
  const [spaceDialog, setSpaceDialog] = useState<SpaceFormValue | null | undefined>(undefined);
  const [reminderDialog, setReminderDialog] = useState<ReminderFormValue | null | undefined>(undefined);
  const [spacesManagerOpen, setSpacesManagerOpen] = useState(false);
  const { filters, updateFilter, setSegment, setSelectedDate, setVisibleMonth, resetFilters } = useMyWorkFilters(initialDate);
  const actions = useMyWorkActions({
    setSpaces,
    setTasks,
    setEvents,
    setReminders,
    closeTaskDialog: () => setTaskDialog(undefined),
    closeEventDialog: () => setEventDialog(undefined),
    closeSpaceDialog: () => setSpaceDialog(undefined),
    closeReminderDialog: () => setReminderDialog(undefined),
  });

  const colorBySpace = Object.fromEntries(spaces.map((space) => [space.id, space.colorToken]));
  const spaceNameById = Object.fromEntries(spaces.map((space) => [space.id, space.name]));
  const filteredTasks = tasks.filter((task) => taskMatches(task, filters));
  const todayTasks = filteredTasks.filter((task) => {
    const pivot = task.dueAt ?? task.startAt;
    return pivot?.slice(0, 10) === initialDate && task.statusCode !== "done";
  });
  const calendarItems = buildCalendarItems(tasks, events, colorBySpace, filters);
  const agendaItems = buildAgendaItems(tasks, events, reminders, spaceNameById, filters);
  const summary = buildSummary(tasks, events, reminders, initialDate);
  const selectedDayItems = calendarItems.filter((item) => item.startAt.slice(0, 10) === filters.selectedDate);
  const selectedEvent = eventDialog?.id ? events.find((event) => event.id === eventDialog.id) : null;
  const selectedSpace = spaceDialog?.id ? spaces.find((space) => space.id === spaceDialog.id) : null;

  function openTask(task: MyWorkTask) {
    setTaskDialog(toTaskFormValue(task));
  }

  function openEvent(event: MyWorkEvent) {
    setEventDialog(toEventFormValue(event));
  }

  function openCalendarItem(item: MyWorkCalendarItem) {
    if (item.kind === "task") {
      const task = tasks.find((candidate) => candidate.id === item.sourceId);
      if (task) openTask(task);
      return;
    }

    const event = events.find((candidate) => candidate.id === item.sourceId);
    if (event) openEvent(event);
  }

  function openAgendaItem(item: MyWorkAgendaItem) {
    if (item.kind === "task") {
      const task = tasks.find((candidate) => candidate.id === item.sourceId);
      if (task) openTask(task);
    }
    if (item.kind === "event") {
      const event = events.find((candidate) => candidate.id === item.sourceId);
      if (event) openEvent(event);
    }
    if (item.kind === "reminder") {
      const reminder = reminders.find((candidate) => candidate.id === item.sourceId);
      if (reminder) setReminderDialog(reminder);
    }
  }

  async function reorderSpace(spaceId: string, newSortOrder: number) {
    const space = spaces.find((s) => s.id === spaceId);
    if (!space) return;
    await actions.saveSpace({ id: space.id, name: space.name, colorToken: space.colorToken, sortOrder: newSortOrder });
  }

  function createReminderFor(item: MyWorkAgendaItem | MyWorkCalendarItem | MyWorkTask | MyWorkEvent) {
    if ("kind" in item) {
      setReminderDialog({
        targetType: item.kind === "event" ? "event" : "task",
        targetId: item.sourceId,
        title: `Recordar: ${item.title}`,
        remindAt: toDateTimeInput("startsAt" in item ? item.startsAt : item.startAt),
        noteText: "",
      });
      return;
    }

    if ("dueAt" in item) {
      setReminderDialog({ targetType: "task", targetId: item.id, title: `Recordar: ${item.title}`, remindAt: toDateTimeInput(item.dueAt ?? item.startAt), noteText: "" });
      return;
    }

    setReminderDialog({ targetType: "event", targetId: item.id, title: `Recordar: ${item.title}`, remindAt: toDateTimeInput(item.startAt), noteText: "" });
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Gestión / Personal"
        title="Mi trabajo"
        subtitle={`Espacio operativo personal de ${initialData.profile.displayName || initialData.profile.username}: tareas, calendario, agenda y recordatorios.`}
        icon={<CalendarDays className="size-6" aria-hidden="true" />}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={resetFilters}>
              <RefreshCcw className="size-4" aria-hidden="true" />
              Restablecer filtros
            </Button>
            <Button variant="outline" onClick={() => setSpacesManagerOpen(true)}>
              <Shapes className="size-4" aria-hidden="true" />
              Espacios
            </Button>
            <Button onClick={() => setTaskDialog(null)}>
              <Plus className="size-4" aria-hidden="true" />
              Nueva tarea
            </Button>
            <Button variant="outline" onClick={() => setEventDialog(null)}>
              <CalendarPlus2 className="size-4" aria-hidden="true" />
              Nuevo evento
            </Button>
          </div>
        )}
      >
        <FilterPanel>
          <MyWorkSegmentedControl value={filters.segment} onChange={setSegment} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="my-work-search">Buscar</Label>
              <Input id="my-work-search" placeholder="Tarea, evento o recordatorio" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} />
            </div>
            <SingleSelectField
              id="my-work-space"
              label="Espacio"
              value={filters.spaceId}
              options={spaces.flatMap((space) => (space.isArchived ? [] : [space.id]))}
              onChange={(value) => updateFilter("spaceId", value)}
              emptyLabel="Todos los espacios"
              displayValue={(id) => spaces.find((space) => space.id === id)?.name ?? id}
            />
            <SingleSelectField
              id="my-work-status"
              label="Estado"
              value={filters.statusCode}
              options={["todo", "in_progress", "blocked", "done"]}
              onChange={(value) => updateFilter("statusCode", value as typeof filters.statusCode)}
              emptyLabel="Todos los estados"
              displayValue={(code) => ({ todo: "Por hacer", in_progress: "En progreso", blocked: "Bloqueada", done: "Hecha" }[code] ?? code)}
            />
            <SingleSelectField
              id="my-work-priority"
              label="Prioridad"
              value={filters.priorityCode}
              options={["low", "medium", "high", "urgent"]}
              onChange={(value) => updateFilter("priorityCode", value as typeof filters.priorityCode)}
              emptyLabel="Todas las prioridades"
              displayValue={(code) => ({ low: "Baja", medium: "Normal", high: "Alta", urgent: "Urgente" }[code] ?? code)}
            />
            <DateField id="my-work-from" label="Desde" value={filters.dateFrom} onChange={(value) => updateFilter("dateFrom", value)} />
            <DateField id="my-work-to" label="Hasta" value={filters.dateTo} onChange={(value) => updateFilter("dateTo", value)} />
          </div>
          <MyWorkSummaryCards summary={summary} />
        </FilterPanel>
      </SectionPageShell>

      <DetailSection>
        {filters.segment === "today" ? (
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <ChartSurface title="Pendientes de hoy" subtitle="Tareas activas con fecha o vencimiento hoy.">
              <MyWorkTaskTable tasks={todayTasks} onEdit={openTask} onArchive={actions.archiveTask} onToggleDone={actions.toggleTaskDone} onCreateReminder={createReminderFor} />
            </ChartSurface>
            <ChartSurface title="Agenda inmediata" subtitle="Eventos, tareas fechadas y recordatorios cercanos.">
              <MyWorkAgenda items={agendaItems.slice(0, 8)} reminders={reminders} onOpenItem={openAgendaItem} onCreateReminder={createReminderFor} onUpdateReminder={actions.updateReminderStatus} />
            </ChartSurface>
          </div>
        ) : null}

        {filters.segment === "list" ? (
          <ChartSurface title="Lista de tareas" subtitle="Vista editable con filtros basicos por espacio, estado, prioridad y rango.">
            <MyWorkTaskTable tasks={filteredTasks} onEdit={openTask} onArchive={actions.archiveTask} onToggleDone={actions.toggleTaskDone} onCreateReminder={createReminderFor} />
          </ChartSurface>
        ) : null}

        {filters.segment === "calendar" ? (
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <ChartSurface title="Calendario" subtitle="Mes operativo con tareas y eventos sobre la misma fuente.">
              <MyWorkCalendar
                viewDate={toMonthDate(filters.visibleMonth)}
                selectedDate={filters.selectedDate}
                items={calendarItems}
                onChangeMonth={(direction) => {
                  const current = toMonthDate(filters.visibleMonth);
                  setVisibleMonth(new Date(current.getFullYear(), current.getMonth() + direction, 1).toISOString().slice(0, 10));
                }}
                onSelectDate={setSelectedDate}
                onOpenItem={openCalendarItem}
              />
            </ChartSurface>
            <ChartSurface title="Detalle del dia" subtitle={filters.selectedDate}>
              <MyWorkAgenda
                items={selectedDayItems.map((item) => ({
                  id: item.id,
                  kind: item.kind,
                  sourceId: item.sourceId,
                  title: item.title,
                  subtitle: item.subtitle,
                  startsAt: item.startAt,
                  endsAt: item.endAt,
                  tone: item.statusCode === "done" ? "success" : item.priorityCode === "urgent" ? "danger" : "default",
                  spaceLabel: spaceNameById[item.spaceId] ?? "Sin espacio",
                }))}
                reminders={[]}
                onOpenItem={openAgendaItem}
                onCreateReminder={createReminderFor}
                onUpdateReminder={actions.updateReminderStatus}
              />
            </ChartSurface>
          </div>
        ) : null}

        {filters.segment === "agenda" ? (
          <ChartSurface title="Agenda" subtitle="Secuencia cronologica de trabajo con recordatorios inmediatos.">
            <MyWorkAgenda items={agendaItems} reminders={reminders} onOpenItem={openAgendaItem} onCreateReminder={createReminderFor} onUpdateReminder={actions.updateReminderStatus} />
          </ChartSurface>
        ) : null}
      </DetailSection>

      {spacesManagerOpen ? (
        <DialogShell
          open={spacesManagerOpen}
          onClose={() => setSpacesManagerOpen(false)}
          title="Espacios"
          description="Gestiona, reordena y crea espacios personales."
          maxWidth="max-w-2xl"
        >
          <SpacesPanel
            spaces={spaces}
            onEdit={(value) => setSpaceDialog(value)}
            onNew={() => setSpaceDialog(null)}
            onReorder={reorderSpace}
            onDelete={actions.deleteSpace}
          />
        </DialogShell>
      ) : null}

      <TaskFormDialog key={`task-${taskDialog?.id ?? "new"}-${taskDialog === undefined ? "closed" : "open"}`} open={taskDialog !== undefined} spaces={spaces} initialValue={taskDialog ?? null} onClose={() => setTaskDialog(undefined)} onSubmit={actions.saveTask} />
      <EventFormDialog key={`event-${eventDialog?.id ?? "new"}-${eventDialog === undefined ? "closed" : "open"}`} open={eventDialog !== undefined} spaces={spaces} tasks={tasks} initialValue={eventDialog ?? null} onClose={() => setEventDialog(undefined)} onSubmit={actions.saveEvent} onArchive={selectedEvent ? () => actions.archiveEvent(selectedEvent) : undefined} />
      <SpaceFormDialog key={`space-${spaceDialog?.id ?? "new"}-${spaceDialog === undefined ? "closed" : "open"}`} open={spaceDialog !== undefined} initialValue={spaceDialog ?? null} onClose={() => setSpaceDialog(undefined)} onSubmit={actions.saveSpace} onArchive={selectedSpace && !selectedSpace.isDefault ? () => actions.archiveSpace(selectedSpace) : undefined} />
      <ReminderFormDialog key={`reminder-${reminderDialog?.id ?? "new"}-${reminderDialog === undefined ? "closed" : "open"}`} open={reminderDialog !== undefined} tasks={tasks} events={events} initialValue={reminderDialog ?? null} onClose={() => setReminderDialog(undefined)} onSubmit={actions.saveReminder} />
    </div>
  );
}
