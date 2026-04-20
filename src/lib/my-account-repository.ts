import type { QueryResultRow } from "pg";

import { insertPersonalWorkspaceActivity } from "@/lib/personal-workspace-audit";
import { queryPersonalWorkspace, withPersonalWorkspaceTransaction } from "@/lib/personal-workspace-db";
import type { ProfilePatchInput } from "@/lib/personal-workspace-schemas";
import {
  mapWorkspaceProfileRow,
  notificationPrefsToJson,
  type PersonalWorkspaceProfile,
} from "@/lib/personal-workspace-types";

type QueryExecutor = {
  query<T extends QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
};

type ProfileRow = {
  auth_user_id: string;
  display_name: string;
  avatar_url: string | null;
  bio_text: string | null;
  locale_code: string;
  timezone_name: string;
  theme_code: string;
  default_route: string;
  default_calendar_view_code: string;
  default_task_view_code: string;
  week_start_iso: number;
  contact_email: string | null;
  notification_prefs_jsonb: unknown;
  created_at: Date;
  updated_at: Date;
};

const PROFILE_ENTITY_ID = "00000000-0000-0000-0000-000000000000";

async function loadProfile(executor: QueryExecutor, authUserId: string) {
  const { rows } = await executor.query<ProfileRow>(
    "select * from public.usr_dim_profile_pref_scd0 where auth_user_id = $1",
    [authUserId],
  );

  return rows[0] ? mapWorkspaceProfileRow(rows[0]) : null;
}

export async function getMyAccountProfile(authUserId: string, executor: QueryExecutor = { query: queryPersonalWorkspace }) {
  return loadProfile(executor, authUserId);
}

export async function updateMyAccountProfile(
  authUserId: string,
  input: ProfilePatchInput,
  actorId: string,
): Promise<PersonalWorkspaceProfile> {
  return withPersonalWorkspaceTransaction(async (client) => {
    const { rows } = await client.query<ProfileRow>(
      `
        update public.usr_dim_profile_pref_scd0
        set
          display_name = $2,
          avatar_url = $3,
          bio_text = $4,
          locale_code = $5,
          timezone_name = $6,
          theme_code = $7,
          default_route = $8,
          default_calendar_view_code = $9,
          default_task_view_code = $10,
          week_start_iso = $11,
          contact_email = $13,
          notification_prefs_jsonb = $12::jsonb
        where auth_user_id = $1
        returning *
      `,
      [
        authUserId,
        input.displayName,
        input.avatarUrl,
        input.bioText,
        input.localeCode,
        input.timezoneName,
        input.themeCode,
        input.defaultRoute,
        input.defaultCalendarViewCode,
        input.defaultTaskViewCode,
        input.weekStartIso,
        JSON.stringify(notificationPrefsToJson(input.notificationPrefs)),
        input.contactEmail ?? null,
      ],
    );

    const profile = rows[0] ? mapWorkspaceProfileRow(rows[0]) : null;
    if (!profile) {
      throw new Error("No se encontro el perfil personal solicitado.");
    }

    await insertPersonalWorkspaceActivity(client, {
      authUserId,
      entityType: "profile",
      entityId: PROFILE_ENTITY_ID,
      actionCode: "profile.updated",
      payload: {
        actorId,
        defaultRoute: input.defaultRoute,
        themeCode: input.themeCode,
      },
    });

    return profile;
  });
}
