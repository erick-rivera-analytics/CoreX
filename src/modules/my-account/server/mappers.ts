import type { MyAccountPageData } from "@/lib/personal-workspace-types";
import type { MyAccountInitialData } from "@/modules/my-account";

/**
 * Transforma el payload del loader a la forma consumida por el explorer.
 * Convive con los campos deprecados (avatar_url, bio_text, etc.) para
 * mantener compatibilidad con el PATCH de `/api/me/profile`.
 */
export function mapAccountPageData(data: MyAccountPageData, username: string): MyAccountInitialData {
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
      contactEmail: data.profile.contactEmail ?? "",
      notificationPreferences: data.profile.notificationPrefs,
      lastUpdatedAt: data.profile.updatedAt ?? data.profile.createdAt ?? new Date().toISOString(),
    },
    workSummary: {
      activeSpaces: 1,
      pendingToday: data.summary.pendingToday,
      overdue: data.summary.overdue,
      inProgress: data.summary.inProgress,
      upcomingReminders: data.summary.upcomingReminders,
      nextEventLabel: data.summary.nextEventTitle ?? "Sin eventos programados",
      nextReminderLabel: data.summary.upcomingReminders
        ? `${data.summary.upcomingReminders} recordatorios pendientes`
        : "Sin recordatorios pendientes",
    },
    recentAccess: [],
  };
}
