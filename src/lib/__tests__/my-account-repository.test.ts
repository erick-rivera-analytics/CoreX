import { afterEach, describe, expect, it, vi } from "vitest";

import { getMyAccountProfile, updateMyAccountProfile } from "@/lib/my-account-repository";
import { queryPersonalWorkspace, withPersonalWorkspaceTransaction } from "@/lib/personal-workspace-db";

vi.mock("@/lib/personal-workspace-db", () => ({
  queryPersonalWorkspace: vi.fn(),
  withPersonalWorkspaceTransaction: vi.fn(),
}));

const baseProfileRow = {
  auth_user_id: "7",
  display_name: "Erick",
  avatar_url: null,
  bio_text: null,
  locale_code: "es-EC",
  timezone_name: "America/Guayaquil",
  theme_code: "system",
  default_route: "/dashboard/mi-trabajo",
  default_calendar_view_code: "month",
  default_task_view_code: "today",
  week_start_iso: 1,
  notification_prefs_jsonb: {
    in_app_task_assigned: true,
    in_app_task_due: true,
    in_app_reminder: true,
    email_task_assigned: false,
    email_task_due: false,
    email_reminder: false,
  },
  created_at: new Date("2026-04-19T00:00:00.000Z"),
  updated_at: new Date("2026-04-19T00:00:00.000Z"),
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("my-account repository", () => {
  it("loads a profile scoped by auth_user_id", async () => {
    vi.mocked(queryPersonalWorkspace).mockResolvedValueOnce({ rows: [baseProfileRow] } as never);

    const profile = await getMyAccountProfile("7");

    expect(profile?.authUserId).toBe("7");
    expect(profile?.displayName).toBe("Erick");
    expect(queryPersonalWorkspace).toHaveBeenCalledWith(
      expect.stringContaining("where auth_user_id = $1"),
      ["7"],
    );
  });

  it("updates profile fields with typed notification preferences", async () => {
    const updatedRow = {
      ...baseProfileRow,
      display_name: "Erick Rivera",
      avatar_url: "https://cdn/avatar.png",
      bio_text: "Analitica aplicada",
      theme_code: "dark",
      notification_prefs_jsonb: {
        in_app_task_assigned: true,
        in_app_task_due: false,
        in_app_reminder: true,
        email_task_assigned: false,
        email_task_due: false,
        email_reminder: true,
      },
      updated_at: new Date("2026-04-20T00:00:00.000Z"),
    };
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [updatedRow] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    vi.mocked(withPersonalWorkspaceTransaction).mockImplementation(async (run) => run(client as never));

    const profile = await updateMyAccountProfile("7", {
      displayName: "Erick Rivera",
      avatarUrl: "https://cdn/avatar.png",
      bioText: "Analitica aplicada",
      localeCode: "es-EC",
      timezoneName: "America/Guayaquil",
      themeCode: "dark",
      defaultRoute: "/dashboard/mi-trabajo",
      defaultCalendarViewCode: "month",
      defaultTaskViewCode: "today",
      weekStartIso: 1,
      notificationPrefs: {
        inAppTaskAssigned: true,
        inAppTaskDue: false,
        inAppReminder: true,
        emailTaskAssigned: false,
        emailTaskDue: false,
        emailReminder: true,
      },
    }, "erick.rivera");

    expect(profile.displayName).toBe("Erick Rivera");
    expect(profile.themeCode).toBe("dark");
    expect(profile.notificationPrefs.inAppTaskDue).toBe(false);
    expect(profile.notificationPrefs.emailReminder).toBe(true);
    expect(client.query).toHaveBeenCalledTimes(2);
  });
});
