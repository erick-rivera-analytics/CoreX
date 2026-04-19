import { describe, expect, it, vi } from "vitest";

import {
  ensurePersonalWorkspaceBootstrap,
  resolveWorkspaceAuthUserId,
} from "@/lib/personal-workspace-bootstrap";

const profileRow = {
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
  notification_prefs_jsonb: {},
  created_at: new Date("2026-04-19T00:00:00.000Z"),
  updated_at: new Date("2026-04-19T00:00:00.000Z"),
};

const spaceRow = {
  space_id: "space-1",
  auth_user_id: "7",
  space_name: "Personal",
  space_slug: "personal",
  color_token: "slate",
  sort_order: 0,
  is_default: true,
  archived_at: null,
  created_at: new Date("2026-04-19T00:00:00.000Z"),
  updated_at: new Date("2026-04-19T00:00:00.000Z"),
};

describe("personal workspace bootstrap", () => {
  it("resolves auth_user_id from current CoreX access", () => {
    expect(resolveWorkspaceAuthUserId({ userId: 42, username: "erick" })).toBe("42");
  });

  it("creates profile and default space when both are missing", async () => {
    const executor = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [profileRow] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [spaceRow] }),
    };

    const result = await ensurePersonalWorkspaceBootstrap(
      { userId: 7, username: "Erick" },
      executor,
    );

    expect(result.authUserId).toBe("7");
    expect(result.profile.displayName).toBe("Erick");
    expect(result.defaultSpace.spaceName).toBe("Personal");
    expect(executor.query).toHaveBeenCalledTimes(5);
  });

  it("does not duplicate existing profile or default space", async () => {
    const executor = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [profileRow] })
        .mockResolvedValueOnce({ rows: [spaceRow] }),
    };

    const result = await ensurePersonalWorkspaceBootstrap(
      { userId: 7, username: "Erick" },
      executor,
    );

    expect(result.profile.authUserId).toBe("7");
    expect(result.defaultSpace.spaceId).toBe("space-1");
    expect(executor.query).toHaveBeenCalledTimes(2);
  });
});
