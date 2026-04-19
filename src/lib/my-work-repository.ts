import type { QueryResultRow } from "pg";

import { insertPersonalWorkspaceActivity } from "@/lib/personal-workspace-audit";
import { queryPersonalWorkspace, withPersonalWorkspaceTransaction } from "@/lib/personal-workspace-db";
import type {
  CalendarFiltersInput,
  CreateEventInput,
  CreateReminderInput,
  CreateSpaceInput,
  CreateTaskInput,
  EventFiltersInput,
  ReminderFiltersInput,
  TaskFiltersInput,
  UpdateEventInput,
  UpdateReminderInput,
  UpdateSpaceInput,
  UpdateTaskInput,
} from "@/lib/personal-workspace-schemas";
import {
  mapWorkspaceCalendarItemRow,
  mapWorkspaceEventRow,
  mapWorkspaceReminderRow,
  mapWorkspaceSpaceRow,
  mapWorkspaceTaskRow,
  type PersonalWorkSummary,
} from "@/lib/personal-workspace-types";

type QueryExecutor = {
  query<T extends QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
};

const directExecutor: QueryExecutor = { query: queryPersonalWorkspace };

function slugifySpaceName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "espacio";
}

async function findAvailableSpaceSlug(executor: QueryExecutor, authUserId: string, rawName: string) {
  const baseSlug = slugifySpaceName(rawName);
  const { rows } = await executor.query<{ space_slug: string }>(
    "select space_slug from public.wrk_dim_space_core_scd0 where auth_user_id = $1 and space_slug like $2",
    [authUserId, `${baseSlug}%`],
  );
  const existing = new Set(rows.map((row) => row.space_slug));
  if (!existing.has(baseSlug)) return baseSlug;

  let counter = 2;
  while (existing.has(`${baseSlug}-${counter}`)) counter += 1;
  return `${baseSlug}-${counter}`;
}

function buildUpdateSet(updates: Array<{ column: string; value: unknown; include: boolean }>, startIndex = 3) {
  const values: unknown[] = [];
  const sets: string[] = [];

  for (const update of updates) {
    if (!update.include) continue;
    values.push(update.value);
    sets.push(`${update.column} = $${startIndex + values.length - 1}`);
  }

  return { values, sets };
}

export function buildTaskListQuery(authUserId: string, filters: TaskFiltersInput) {
  const values: unknown[] = [authUserId];
  const where = ["task.auth_user_id = $1", "task.archived_at is null"];

  if (filters.spaceId) {
    values.push(filters.spaceId);
    where.push(`task.space_id = $${values.length}::uuid`);
  }
  if (filters.statusCode) {
    values.push(filters.statusCode);
    where.push(`task.status_code = $${values.length}`);
  }
  if (filters.priorityCode) {
    values.push(filters.priorityCode);
    where.push(`task.priority_code = $${values.length}`);
  }
  if (filters.dateFrom) {
    values.push(filters.dateFrom);
    where.push(`coalesce(task.start_at, task.due_at) >= $${values.length}::timestamptz`);
  }
  if (filters.dateTo) {
    values.push(filters.dateTo);
    where.push(`coalesce(task.start_at, task.due_at) <= $${values.length}::timestamptz`);
  }
  if (filters.search) {
    values.push(`%${filters.search}%`);
    where.push(`(task.title ilike $${values.length} or coalesce(task.description_text, '') ilike $${values.length})`);
  }

  return {
    text: `
      select task.*, space.space_name, space.color_token
      from public.wrk_fact_task_core_cur task
      join public.wrk_dim_space_core_scd0 space on space.space_id = task.space_id
      where ${where.join(" and ")}
      order by task.is_starred desc, coalesce(task.due_at, task.start_at, task.created_at) asc, task.created_at desc
    `,
    values,
  };
}

export function buildCalendarItemsQuery(authUserId: string, filters: CalendarFiltersInput) {
  const values: unknown[] = [authUserId];
  const where = ["auth_user_id = $1"];

  if (filters.spaceId) {
    values.push(filters.spaceId);
    where.push(`space_id = $${values.length}::uuid`);
  }
  if (filters.dateFrom) {
    values.push(filters.dateFrom);
    where.push(`starts_at >= $${values.length}::timestamptz`);
  }
  if (filters.dateTo) {
    values.push(filters.dateTo);
    where.push(`ends_at <= $${values.length}::timestamptz`);
  }

  return {
    text: `select * from public.wrk_v_calendar_item_cur where ${where.join(" and ")} order by starts_at asc, title asc`,
    values,
  };
}

async function ensureOwnedTask(executor: QueryExecutor, authUserId: string, taskId: string) {
  const { rows } = await executor.query<{ task_id: string }>(
    "select task_id from public.wrk_fact_task_core_cur where auth_user_id = $1 and task_id = $2 and archived_at is null",
    [authUserId, taskId],
  );
  if (!rows[0]) throw new Error("La tarea solicitada no pertenece al usuario autenticado.");
}

async function ensureOwnedEvent(executor: QueryExecutor, authUserId: string, eventId: string) {
  const { rows } = await executor.query<{ event_id: string }>(
    "select event_id from public.wrk_fact_event_core_cur where auth_user_id = $1 and event_id = $2 and archived_at is null",
    [authUserId, eventId],
  );
  if (!rows[0]) throw new Error("El evento solicitado no pertenece al usuario autenticado.");
}

export async function listMyWorkSpaces(authUserId: string, executor: QueryExecutor = directExecutor) {
  const { rows } = await executor.query<Record<string, unknown>>(
    `
      select *
      from public.wrk_dim_space_core_scd0
      where auth_user_id = $1 and is_archived = false
      order by is_default desc, sort_order asc, created_at asc
    `,
    [authUserId],
  );
  return rows.map(mapWorkspaceSpaceRow);
}

export async function createMyWorkSpace(authUserId: string, input: CreateSpaceInput, actorId: string) {
  return withPersonalWorkspaceTransaction(async (client) => {
    const slug = await findAvailableSpaceSlug(client, authUserId, input.spaceName);
    const { rows } = await client.query<Record<string, unknown>>(
      `
        insert into public.wrk_dim_space_core_scd0 (auth_user_id, space_name, space_slug, color_token, sort_order, is_default)
        values ($1, $2, $3, $4, $5, false)
        returning *
      `,
      [authUserId, input.spaceName, slug, input.colorToken, input.sortOrder],
    );
    const space = mapWorkspaceSpaceRow(rows[0]!);
    await insertPersonalWorkspaceActivity(client, { authUserId, entityType: "space", entityId: space.spaceId, actionCode: "space.created", payload: { actorId } });
    return space;
  });
}

export async function updateMyWorkSpace(authUserId: string, spaceId: string, input: UpdateSpaceInput, actorId: string) {
  return withPersonalWorkspaceTransaction(async (client) => {
    const { values, sets } = buildUpdateSet([
      { column: "space_name", value: input.spaceName, include: input.spaceName !== undefined },
      { column: "color_token", value: input.colorToken, include: input.colorToken !== undefined },
      { column: "sort_order", value: input.sortOrder, include: input.sortOrder !== undefined },
    ]);
    if (!sets.length) throw new Error("No hay cambios para guardar.");
    const { rows } = await client.query<Record<string, unknown>>(
      `update public.wrk_dim_space_core_scd0 set ${sets.join(", ")} where auth_user_id = $1 and space_id = $2 returning *`,
      [authUserId, spaceId, ...values],
    );
    if (!rows[0]) throw new Error("No se encontro el espacio solicitado.");
    const space = mapWorkspaceSpaceRow(rows[0]);
    await insertPersonalWorkspaceActivity(client, { authUserId, entityType: "space", entityId: spaceId, actionCode: "space.updated", payload: { actorId } });
    return space;
  });
}

export async function archiveMyWorkSpace(authUserId: string, spaceId: string, actorId: string) {
  return withPersonalWorkspaceTransaction(async (client) => {
    const current = await client.query<{ is_default: boolean }>(
      "select is_default from public.wrk_dim_space_core_scd0 where auth_user_id = $1 and space_id = $2 and is_archived = false",
      [authUserId, spaceId],
    );
    if (!current.rows[0]) throw new Error("No se encontro el espacio solicitado.");
    if (current.rows[0].is_default) throw new Error("El espacio personal por defecto no puede archivarse.");
    await client.query("update public.wrk_dim_space_core_scd0 set is_archived = true where auth_user_id = $1 and space_id = $2", [authUserId, spaceId]);
    await insertPersonalWorkspaceActivity(client, { authUserId, entityType: "space", entityId: spaceId, actionCode: "space.archived", payload: { actorId } });
  });
}

export async function listMyTasks(authUserId: string, filters: TaskFiltersInput = {}, executor: QueryExecutor = directExecutor) {
  const query = buildTaskListQuery(authUserId, filters);
  const { rows } = await executor.query<Record<string, unknown>>(query.text, query.values);
  return rows.map(mapWorkspaceTaskRow);
}

export async function getMyTask(authUserId: string, taskId: string, executor: QueryExecutor = directExecutor) {
  const { rows } = await executor.query<Record<string, unknown>>(
    `
      select task.*, space.space_name, space.color_token
      from public.wrk_fact_task_core_cur task
      join public.wrk_dim_space_core_scd0 space on space.space_id = task.space_id
      where task.auth_user_id = $1 and task.task_id = $2 and task.archived_at is null
    `,
    [authUserId, taskId],
  );
  return rows[0] ? mapWorkspaceTaskRow(rows[0]) : null;
}

export async function createMyTask(authUserId: string, input: CreateTaskInput, actorId: string) {
  return withPersonalWorkspaceTransaction(async (client) => {
    const completedAt = input.statusCode === "done" ? new Date().toISOString() : null;
    const { rows } = await client.query<Record<string, unknown>>(
      `
        insert into public.wrk_fact_task_core_cur (
          auth_user_id, space_id, title, description_text, status_code, priority_code, start_at, due_at, completed_at, is_starred
        )
        values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9::timestamptz, $10)
        returning *
      `,
      [authUserId, input.spaceId, input.titleText, input.descriptionText, input.statusCode, input.priorityCode, input.startAt, input.dueAt, completedAt, input.isStarred],
    );
    const task = mapWorkspaceTaskRow(rows[0]!);
    await insertPersonalWorkspaceActivity(client, { authUserId, entityType: "task", entityId: task.taskId, actionCode: "task.created", payload: { actorId } });
    return task;
  });
}

export async function updateMyTask(authUserId: string, taskId: string, input: UpdateTaskInput, actorId: string) {
  return withPersonalWorkspaceTransaction(async (client) => {
    const completedAt = input.statusCode === "done"
      ? (input.completedAt ?? new Date().toISOString())
      : input.statusCode
        ? null
        : input.completedAt;
    const { values, sets } = buildUpdateSet([
      { column: "space_id", value: input.spaceId, include: input.spaceId !== undefined },
      { column: "title", value: input.titleText, include: input.titleText !== undefined },
      { column: "description_text", value: input.descriptionText, include: input.descriptionText !== undefined },
      { column: "status_code", value: input.statusCode, include: input.statusCode !== undefined },
      { column: "priority_code", value: input.priorityCode, include: input.priorityCode !== undefined },
      { column: "start_at", value: input.startAt, include: input.startAt !== undefined },
      { column: "due_at", value: input.dueAt, include: input.dueAt !== undefined },
      { column: "completed_at", value: completedAt, include: completedAt !== undefined },
      { column: "is_starred", value: input.isStarred, include: input.isStarred !== undefined },
    ]);
    if (!sets.length) throw new Error("No hay cambios para guardar.");
    const { rows } = await client.query<Record<string, unknown>>(
      `update public.wrk_fact_task_core_cur set ${sets.join(", ")} where auth_user_id = $1 and task_id = $2 and archived_at is null returning *`,
      [authUserId, taskId, ...values],
    );
    if (!rows[0]) throw new Error("No se encontro la tarea solicitada.");
    const task = mapWorkspaceTaskRow(rows[0]);
    await insertPersonalWorkspaceActivity(client, { authUserId, entityType: "task", entityId: taskId, actionCode: "task.updated", payload: { actorId } });
    return task;
  });
}

export async function archiveMyTask(authUserId: string, taskId: string, actorId: string) {
  return withPersonalWorkspaceTransaction(async (client) => {
    const { rows } = await client.query<{ task_id: string }>(
      "update public.wrk_fact_task_core_cur set archived_at = now() where auth_user_id = $1 and task_id = $2 and archived_at is null returning task_id",
      [authUserId, taskId],
    );
    if (!rows[0]) throw new Error("No se encontro la tarea solicitada.");
    await insertPersonalWorkspaceActivity(client, { authUserId, entityType: "task", entityId: taskId, actionCode: "task.archived", payload: { actorId } });
  });
}

export async function listMyEvents(authUserId: string, filters: EventFiltersInput = {}, executor: QueryExecutor = directExecutor) {
  const values: unknown[] = [authUserId];
  const where = ["event.auth_user_id = $1", "event.archived_at is null"];
  if (filters.spaceId) { values.push(filters.spaceId); where.push(`event.space_id = $${values.length}::uuid`); }
  if (filters.dateFrom) { values.push(filters.dateFrom); where.push(`event.ends_at >= $${values.length}::timestamptz`); }
  if (filters.dateTo) { values.push(filters.dateTo); where.push(`event.starts_at <= $${values.length}::timestamptz`); }
  const { rows } = await executor.query<Record<string, unknown>>(
    `select event.*, space.space_name, space.color_token from public.wrk_fact_event_core_cur event join public.wrk_dim_space_core_scd0 space on space.space_id = event.space_id where ${where.join(" and ")} order by event.starts_at asc`,
    values,
  );
  return rows.map(mapWorkspaceEventRow);
}

export async function getMyEvent(authUserId: string, eventId: string, executor: QueryExecutor = directExecutor) {
  const { rows } = await executor.query<Record<string, unknown>>(
    `select event.*, space.space_name, space.color_token from public.wrk_fact_event_core_cur event join public.wrk_dim_space_core_scd0 space on space.space_id = event.space_id where event.auth_user_id = $1 and event.event_id = $2::uuid and event.archived_at is null`,
    [authUserId, eventId],
  );
  return rows[0] ? mapWorkspaceEventRow(rows[0]) : null;
}

export async function createMyEvent(authUserId: string, input: CreateEventInput, actorId: string) {
  return withPersonalWorkspaceTransaction(async (client) => {
    if (input.linkedTaskId) await ensureOwnedTask(client, authUserId, input.linkedTaskId);
    const { rows } = await client.query<Record<string, unknown>>(
      `
        insert into public.wrk_fact_event_core_cur (
          auth_user_id, space_id, linked_task_id, title, description_text, starts_at, ends_at, all_day, is_busy, location_text
        )
        values ($1, $2, $3::uuid, $4, $5, $6::timestamptz, $7::timestamptz, $8, $9, $10)
        returning *
      `,
      [authUserId, input.spaceId, input.linkedTaskId, input.titleText, input.descriptionText, input.startAt, input.endAt, input.allDay, input.isBusy, input.locationText],
    );
    const event = mapWorkspaceEventRow(rows[0]!);
    await insertPersonalWorkspaceActivity(client, { authUserId, entityType: "event", entityId: event.eventId, actionCode: "event.created", payload: { actorId } });
    return event;
  });
}

export async function updateMyEvent(authUserId: string, eventId: string, input: UpdateEventInput, actorId: string) {
  return withPersonalWorkspaceTransaction(async (client) => {
    if (input.linkedTaskId) await ensureOwnedTask(client, authUserId, input.linkedTaskId);
    const { values, sets } = buildUpdateSet([
      { column: "space_id", value: input.spaceId, include: input.spaceId !== undefined },
      { column: "linked_task_id", value: input.linkedTaskId, include: input.linkedTaskId !== undefined },
      { column: "title", value: input.titleText, include: input.titleText !== undefined },
      { column: "description_text", value: input.descriptionText, include: input.descriptionText !== undefined },
      { column: "starts_at", value: input.startAt, include: input.startAt !== undefined },
      { column: "ends_at", value: input.endAt, include: input.endAt !== undefined },
      { column: "all_day", value: input.allDay, include: input.allDay !== undefined },
      { column: "is_busy", value: input.isBusy, include: input.isBusy !== undefined },
      { column: "location_text", value: input.locationText, include: input.locationText !== undefined },
    ]);
    if (!sets.length) throw new Error("No hay cambios para guardar.");
    const { rows } = await client.query<Record<string, unknown>>(
      `update public.wrk_fact_event_core_cur set ${sets.join(", ")} where auth_user_id = $1 and event_id = $2 and archived_at is null returning *`,
      [authUserId, eventId, ...values],
    );
    if (!rows[0]) throw new Error("No se encontro el evento solicitado.");
    const event = mapWorkspaceEventRow(rows[0]);
    await insertPersonalWorkspaceActivity(client, { authUserId, entityType: "event", entityId: eventId, actionCode: "event.updated", payload: { actorId } });
    return event;
  });
}

export async function archiveMyEvent(authUserId: string, eventId: string, actorId: string) {
  return withPersonalWorkspaceTransaction(async (client) => {
    const { rows } = await client.query<{ event_id: string }>(
      "update public.wrk_fact_event_core_cur set archived_at = now() where auth_user_id = $1 and event_id = $2 and archived_at is null returning event_id",
      [authUserId, eventId],
    );
    if (!rows[0]) throw new Error("No se encontro el evento solicitado.");
    await insertPersonalWorkspaceActivity(client, { authUserId, entityType: "event", entityId: eventId, actionCode: "event.archived", payload: { actorId } });
  });
}

export async function listMyReminders(authUserId: string, filters: ReminderFiltersInput = {}, executor: QueryExecutor = directExecutor) {
  const values: unknown[] = [authUserId];
  const where = ["reminder.auth_user_id = $1"];
  if (filters.statusCode) { values.push(filters.statusCode); where.push(`reminder.status_code = $${values.length}`); }
  values.push(filters.limit ?? 20);
  const { rows } = await executor.query<Record<string, unknown>>(
    `
      select reminder.*, coalesce(task.title, event.title) as linked_title
      from public.wrk_fact_reminder_core_cur reminder
      left join public.wrk_fact_task_core_cur task on task.task_id = reminder.task_id
      left join public.wrk_fact_event_core_cur event on event.event_id = reminder.event_id
      where ${where.join(" and ")}
      order by reminder.remind_at asc
      limit $${values.length}
    `,
    values,
  );
  return rows.map(mapWorkspaceReminderRow);
}

export async function createMyReminder(authUserId: string, input: CreateReminderInput, actorId: string) {
  return withPersonalWorkspaceTransaction(async (client) => {
    if (input.linkedTaskId) await ensureOwnedTask(client, authUserId, input.linkedTaskId);
    if (input.linkedEventId) await ensureOwnedEvent(client, authUserId, input.linkedEventId);
    const { rows } = await client.query<Record<string, unknown>>(
      `
        insert into public.wrk_fact_reminder_core_cur (auth_user_id, task_id, event_id, remind_at, channel_code, status_code)
        values ($1, $2::uuid, $3::uuid, $4::timestamptz, $5, 'pending')
        returning *
      `,
      [authUserId, input.linkedTaskId ?? null, input.linkedEventId ?? null, input.remindAt, input.channelCode],
    );
    const reminder = mapWorkspaceReminderRow(rows[0]!);
    await insertPersonalWorkspaceActivity(client, { authUserId, entityType: "reminder", entityId: reminder.reminderId, actionCode: "reminder.created", payload: { actorId } });
    return reminder;
  });
}

export async function updateMyReminder(authUserId: string, reminderId: string, input: UpdateReminderInput, actorId: string) {
  return withPersonalWorkspaceTransaction(async (client) => {
    const { values, sets } = buildUpdateSet([
      { column: "remind_at", value: input.remindAt, include: input.remindAt !== undefined },
      { column: "channel_code", value: input.channelCode, include: input.channelCode !== undefined },
      { column: "status_code", value: input.statusCode, include: input.statusCode !== undefined },
      { column: "sent_at", value: input.statusCode === "sent" ? new Date().toISOString() : null, include: input.statusCode === "sent" },
      { column: "read_at", value: input.statusCode === "read" ? new Date().toISOString() : null, include: input.statusCode === "read" },
    ]);
    if (!sets.length) throw new Error("No hay cambios para guardar.");
    const { rows } = await client.query<Record<string, unknown>>(
      `update public.wrk_fact_reminder_core_cur set ${sets.join(", ")} where auth_user_id = $1 and reminder_id = $2 returning *`,
      [authUserId, reminderId, ...values],
    );
    if (!rows[0]) throw new Error("No se encontro el recordatorio solicitado.");
    const reminder = mapWorkspaceReminderRow(rows[0]);
    await insertPersonalWorkspaceActivity(client, { authUserId, entityType: "reminder", entityId: reminderId, actionCode: "reminder.updated", payload: { actorId } });
    return reminder;
  });
}

export async function listMyCalendarItems(authUserId: string, filters: CalendarFiltersInput = {}, executor: QueryExecutor = directExecutor) {
  const query = buildCalendarItemsQuery(authUserId, filters);
  const { rows } = await executor.query<Record<string, unknown>>(query.text, query.values);
  return rows.map(mapWorkspaceCalendarItemRow);
}

export async function getMyWorkSummary(authUserId: string, timezoneName = "America/Guayaquil", executor: QueryExecutor = directExecutor): Promise<PersonalWorkSummary> {
  const [taskSummary, nextEvent, reminderSummary] = await Promise.all([
    executor.query<{ pending_today: number; overdue: number; in_progress: number; next_seven_days: number }>(
      `
        with local_now as (select timezone($2, now()) as value)
        select
          count(*) filter (where task.archived_at is null and task.status_code <> 'done' and timezone($2, coalesce(task.due_at, task.start_at))::date = local_now.value::date) as pending_today,
          count(*) filter (where task.archived_at is null and task.status_code <> 'done' and task.due_at is not null and timezone($2, task.due_at) < local_now.value) as overdue,
          count(*) filter (where task.archived_at is null and task.status_code = 'in_progress') as in_progress,
          count(*) filter (
            where task.archived_at is null
              and task.status_code <> 'done'
              and coalesce(task.start_at, task.due_at) is not null
              and timezone($2, coalesce(task.start_at, task.due_at))::date between local_now.value::date and (local_now.value::date + 6)
          ) as next_seven_days
        from public.wrk_fact_task_core_cur task, local_now
        where task.auth_user_id = $1
      `,
      [authUserId, timezoneName],
    ),
    executor.query<{ title: string; starts_at: Date }>(
      `
        select title, starts_at
        from public.wrk_fact_event_core_cur
        where auth_user_id = $1 and archived_at is null and ends_at >= now()
        order by starts_at asc
        limit 1
      `,
      [authUserId],
    ),
    executor.query<{ upcoming_reminders: number }>(
      `
        select count(*)::int as upcoming_reminders
        from public.wrk_fact_reminder_core_cur
        where auth_user_id = $1 and status_code = 'pending' and remind_at >= now()
      `,
      [authUserId],
    ),
  ]);

  return {
    pendingToday: Number(taskSummary.rows[0]?.pending_today ?? 0),
    overdue: Number(taskSummary.rows[0]?.overdue ?? 0),
    inProgress: Number(taskSummary.rows[0]?.in_progress ?? 0),
    nextSevenDays: Number(taskSummary.rows[0]?.next_seven_days ?? 0),
    nextEventTitle: nextEvent.rows[0]?.title ?? null,
    nextEventAt: nextEvent.rows[0]?.starts_at ? new Date(nextEvent.rows[0].starts_at).toISOString() : null,
    upcomingReminders: Number(reminderSummary.rows[0]?.upcoming_reminders ?? 0),
  };
}
