import { afterEach, describe, expect, it, vi } from "vitest";

import {
  archiveMyTask,
  buildCalendarItemsQuery,
  buildTaskListQuery,
  createMyReminder,
  createMyTask,
  listMyCalendarItems,
  updateMyReminder,
  updateMyTask,
} from "@/lib/my-work-repository";
import { withPersonalWorkspaceTransaction } from "@/lib/personal-workspace-db";

vi.mock("@/lib/personal-workspace-db", () => ({
  queryPersonalWorkspace: vi.fn(),
  withPersonalWorkspaceTransaction: vi.fn(),
}));

const taskRow = {
  task_id: "task-1",
  auth_user_id: "user-7",
  space_id: "space-1",
  space_name: "Personal",
  color_token: "slate",
  title_text: "Preparar agenda",
  description_text: null,
  status_code: "todo",
  priority_code: "medium",
  start_at: null,
  due_at: null,
  completed_at: null,
  is_starred: false,
  archived_at: null,
  created_at: new Date("2026-04-20T00:00:00.000Z"),
  updated_at: new Date("2026-04-20T00:00:00.000Z"),
};

const reminderRow = {
  reminder_id: "rem-1",
  auth_user_id: "user-7",
  linked_task_id: "task-1",
  linked_event_id: null,
  remind_at: new Date("2026-04-21T08:00:00.000Z"),
  channel_code: "in_app",
  status_code: "pending",
  note_text: null,
  title_text: "Preparar agenda",
  sent_at: null,
  read_at: null,
  canceled_at: null,
  created_at: new Date("2026-04-20T00:00:00.000Z"),
  updated_at: new Date("2026-04-20T00:00:00.000Z"),
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("my-work repository", () => {
  it("keeps auth_user_id filtering in task listings", () => {
    const query = buildTaskListQuery("user-7", { statusCode: "todo", search: "riego" });

    expect(query.text).toContain("task.auth_user_id = $1");
    expect(query.values).toEqual(["user-7", "todo", "%riego%"]);
  });

  it("builds calendar queries from the unified calendar view", async () => {
    const query = buildCalendarItemsQuery("user-7", {
      dateFrom: "2026-04-21T00:00:00.000Z",
      dateTo: "2026-04-22T00:00:00.000Z",
    });

    expect(query.text).toContain("public.wrk_v_calendar_item_cur");
    expect(query.values).toEqual(["user-7", "2026-04-21T00:00:00.000Z", "2026-04-22T00:00:00.000Z"]);

    const executor = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [
          {
            item_kind: "task",
            item_id: "task-1",
            auth_user_id: "user-7",
            space_id: "space-1",
            space_name: "Personal",
            color_token: "slate",
            title_text: "Tarea",
            description_text: null,
            status_code: "todo",
            priority_code: "medium",
            start_at: new Date("2026-04-21T09:00:00.000Z"),
            end_at: null,
            all_day: false,
            is_busy: false,
            location_text: null,
            linked_task_id: null,
            source_at: new Date("2026-04-21T09:00:00.000Z"),
          },
        ],
      }),
    };

    const items = await listMyCalendarItems("user-7", {}, executor);
    expect(items).toHaveLength(1);
    expect(items[0]?.itemKind).toBe("task");
  });

  it("creates, updates and archives a task transactionally", async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [taskRow] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...taskRow, status_code: "done", completed_at: new Date("2026-04-20T02:00:00.000Z") }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ task_id: "task-1" }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    vi.mocked(withPersonalWorkspaceTransaction).mockImplementation(async (run) => run(client as never));

    const created = await createMyTask("user-7", {
      spaceId: "space-1",
      titleText: "Preparar agenda",
      descriptionText: null,
      statusCode: "todo",
      priorityCode: "medium",
      startAt: null,
      dueAt: null,
      isStarred: false,
    }, "erick.rivera");
    const updated = await updateMyTask("user-7", "task-1", {
      statusCode: "done",
      completedAt: "2026-04-20T02:00:00.000Z",
    }, "erick.rivera");
    await archiveMyTask("user-7", "task-1", "erick.rivera");

    expect(created.taskId).toBe("task-1");
    expect(updated.statusCode).toBe("done");
    expect(client.query).toHaveBeenCalledTimes(6);
  });

  it("creates and updates reminders with ownership checks", async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ task_id: "task-1" }] })
        .mockResolvedValueOnce({ rows: [reminderRow] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...reminderRow, status_code: "read", read_at: new Date("2026-04-20T01:00:00.000Z") }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    vi.mocked(withPersonalWorkspaceTransaction).mockImplementation(async (run) => run(client as never));

    const created = await createMyReminder("user-7", {
      linkedTaskId: "task-1",
      linkedEventId: null,
      remindAt: "2026-04-21T08:00:00.000Z",
      channelCode: "in_app",
      noteText: null,
    }, "erick.rivera");
    const updated = await updateMyReminder("user-7", "rem-1", { statusCode: "read" }, "erick.rivera");

    expect(created.reminderId).toBe("rem-1");
    expect(updated.statusCode).toBe("read");
    expect(client.query).toHaveBeenCalledTimes(5);
  });
});
