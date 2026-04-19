import { ensurePersonalWorkspaceBootstrap } from "@/lib/personal-workspace-bootstrap";
import {
  getMyWorkSummary,
  listMyCalendarItems,
  listMyReminders,
  listMyTasks,
  listMyWorkSpaces,
} from "@/lib/my-work-repository";
import type { MyWorkPageData } from "@/lib/personal-workspace-types";

type LoaderAccess = {
  userId: number | string;
  username: string;
};

function toIso(date: Date) {
  return date.toISOString();
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export async function loadMyWorkPageData(access: LoaderAccess): Promise<MyWorkPageData> {
  const bootstrap = await ensurePersonalWorkspaceBootstrap(access);
  const now = new Date();

  const [spaces, summary, tasks, reminders, calendarItems, agendaItems] = await Promise.all([
    listMyWorkSpaces(bootstrap.authUserId),
    getMyWorkSummary(bootstrap.authUserId, bootstrap.profile.timezoneName),
    listMyTasks(bootstrap.authUserId, {}),
    listMyReminders(bootstrap.authUserId, { statusCode: "pending", limit: 12 }),
    listMyCalendarItems(bootstrap.authUserId, {
      dateFrom: toIso(startOfMonth(now)),
      dateTo: toIso(endOfMonth(now)),
    }),
    listMyCalendarItems(bootstrap.authUserId, {
      dateFrom: toIso(now),
      dateTo: toIso(addDays(now, 7)),
    }),
  ]);

  return {
    profile: bootstrap.profile,
    spaces,
    summary,
    tasks,
    agendaItems,
    reminders,
    calendarItems,
  };
}
