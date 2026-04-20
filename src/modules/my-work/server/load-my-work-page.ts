import { ensurePersonalWorkspaceBootstrap } from "@/lib/personal-workspace-bootstrap";
import {
  getMyWorkSummary,
  listMyCalendarItems,
  listMyReminders,
  listMyTasks,
  listMyWorkSpaces,
} from "@/lib/my-work-repository";
import type { MyWorkPageData } from "@/lib/personal-workspace-types";
import { addDays, endOfMonth, startOfMonth, toIso } from "@/shared/lib/date-utils";

type LoaderAccess = {
  userId: number | string;
  username: string;
};

export async function loadMyWorkPageData(access: LoaderAccess): Promise<MyWorkPageData> {
  const bootstrap = await ensurePersonalWorkspaceBootstrap(access);
  const now = new Date();

  // Dos rangos distintos: el calendario mensual (para la vista mensual)
  // y la agenda próxima de 7 días (para widgets de "hoy / próximo").
  // Son consultas independientes y no pueden fusionarse sin cambiar la UI.
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
