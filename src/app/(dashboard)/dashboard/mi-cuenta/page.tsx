import { requirePageAccess } from "@/lib/api-auth";
import type { MyAccountPageData } from "@/lib/personal-workspace-types";
import { DashboardRouteError } from "@/modules/core/server-page";
import { loadMyAccountPageData, MyAccountPage, type MyAccountInitialData } from "@/modules/my-account";

export const dynamic = "force-dynamic";

export default async function MiCuentaPageRoute() {
  const access = await requirePageAccess("/dashboard/mi-cuenta");
  let initialData: MyAccountInitialData | null = null;
  let errorMessage: string | null = null;

  try {
    const data = await loadMyAccountPageData(access);
    initialData = mapAccountPageData(data, access.username);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "No se pudo cargar la cuenta personal.";
  }

  if (!initialData) {
    return <DashboardRouteError title="Mi cuenta" error={errorMessage} />;
  }

  return <MyAccountPage initialData={initialData} />;
}

function mapAccountPageData(data: MyAccountPageData, username: string): MyAccountInitialData {
  return {
    profile: {
      authUserId: data.profile.authUserId,
      username,
      displayName: data.profile.displayName,
      avatarUrl: data.profile.avatarUrl ?? "",
      bioText: data.profile.bioText ?? "",
      localeCode: data.profile.localeCode,
      timezoneName: data.profile.timezoneName,
      themeCode: data.profile.themeCode,
      defaultRoute: data.profile.defaultRoute,
      defaultCalendarViewCode: data.profile.defaultCalendarViewCode,
      defaultTaskViewCode: data.profile.defaultTaskViewCode,
      weekStartIso: data.profile.weekStartIso === 7 ? 7 : 1,
      notificationPreferences: data.profile.notificationPrefs,
      lastUpdatedAt: data.profile.updatedAt ?? data.profile.createdAt ?? new Date().toISOString(),
    },
    workSummary: {
      activeSpaces: 1,
      pendingToday: data.summary.pendingToday,
      overdue: data.summary.overdue,
      inProgress: data.summary.inProgress,
      nextEventLabel: data.summary.nextEventTitle ?? "Sin eventos programados",
      nextReminderLabel: data.summary.upcomingReminders
        ? `${data.summary.upcomingReminders} recordatorios pendientes`
        : "Sin recordatorios pendientes",
    },
  };
}
