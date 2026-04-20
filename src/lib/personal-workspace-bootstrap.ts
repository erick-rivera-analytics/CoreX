import type { QueryResultRow } from "pg";

import { withPersonalWorkspaceTransaction } from "@/lib/personal-workspace-db";
import {
  DEFAULT_NOTIFICATION_PREFS,
  mapWorkspaceProfileRow,
  mapWorkspaceSpaceRow,
  PERSONAL_WORKSPACE_DEFAULT_ROUTE,
} from "@/lib/personal-workspace-types";

type BootstrapAccess = {
  userId: number | string;
  username: string;
};

type BootstrapExecutor = {
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

type SpaceRow = {
  space_id: string;
  auth_user_id: string;
  space_name: string;
  space_slug: string;
  color_token: string;
  sort_order: number;
  is_default: boolean;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
};

export function resolveWorkspaceAuthUserId(access: { userId: number | string; username?: string }) {
  return String(access.userId);
}

async function findAvailableSpaceSlug(executor: BootstrapExecutor, authUserId: string, baseSlug: string) {
  const { rows } = await executor.query<{ space_slug: string }>(
    "select space_slug from public.wrk_dim_space_core_scd0 where auth_user_id = $1 and space_slug like $2",
    [authUserId, `${baseSlug}%`],
  );

  const existing = new Set(rows.map((row) => row.space_slug));
  if (!existing.has(baseSlug)) {
    return baseSlug;
  }

  let counter = 2;
  while (existing.has(`${baseSlug}-${counter}`)) {
    counter += 1;
  }

  return `${baseSlug}-${counter}`;
}

async function runBootstrap(executor: BootstrapExecutor, access: BootstrapAccess) {
  const authUserId = resolveWorkspaceAuthUserId(access);

  const profileResult = await executor.query<ProfileRow>(
    "select * from public.usr_dim_profile_pref_scd0 where auth_user_id = $1",
    [authUserId],
  );

  const profileRow = profileResult.rows[0]
    ?? (await executor.query<ProfileRow>(
      `
        insert into public.usr_dim_profile_pref_scd0 (
          auth_user_id,
          display_name,
          locale_code,
          timezone_name,
          theme_code,
          default_route,
          default_calendar_view_code,
          default_task_view_code,
          week_start_iso,
          notification_prefs_jsonb
        )
        values ($1, $2, 'es-EC', 'America/Guayaquil', 'system', $3, 'month', 'today', 1, $4::jsonb)
        returning *
      `,
      [authUserId, access.username, PERSONAL_WORKSPACE_DEFAULT_ROUTE, JSON.stringify({
        in_app_task_assigned: DEFAULT_NOTIFICATION_PREFS.inAppTaskAssigned,
        in_app_task_due: DEFAULT_NOTIFICATION_PREFS.inAppTaskDue,
        in_app_reminder: DEFAULT_NOTIFICATION_PREFS.inAppReminder,
        email_task_assigned: DEFAULT_NOTIFICATION_PREFS.emailTaskAssigned,
        email_task_due: DEFAULT_NOTIFICATION_PREFS.emailTaskDue,
        email_reminder: DEFAULT_NOTIFICATION_PREFS.emailReminder,
      })],
    )).rows[0];

  const defaultSpaceResult = await executor.query<SpaceRow>(
    `
      select
        space_id,
        auth_user_id,
        space_name,
        space_slug,
        color_token,
        sort_order,
        is_default,
        is_archived,
        created_at,
        updated_at
      from public.wrk_dim_space_core_scd0
      where auth_user_id = $1
        and is_default = true
        and is_archived = false
      order by created_at asc
      limit 1
    `,
    [authUserId],
  );

  const defaultSpaceRow = defaultSpaceResult.rows[0]
    ?? (await executor.query<SpaceRow>(
      `
        insert into public.wrk_dim_space_core_scd0 (
          auth_user_id,
          space_name,
          space_slug,
          color_token,
          sort_order,
          is_default
        )
        values ($1, 'Personal', $2, 'slate', 0, true)
        returning
          space_id,
          auth_user_id,
          space_name,
          space_slug,
          color_token,
          sort_order,
          is_default,
          is_archived,
          created_at,
          updated_at
      `,
      [authUserId, await findAvailableSpaceSlug(executor, authUserId, "personal")],
    )).rows[0];

  return {
    authUserId,
    profile: mapWorkspaceProfileRow(profileRow),
    defaultSpace: mapWorkspaceSpaceRow(defaultSpaceRow),
  };
}

export async function ensurePersonalWorkspaceBootstrap(access: BootstrapAccess, executor?: BootstrapExecutor) {
  if (executor) {
    return runBootstrap(executor, access);
  }

  return withPersonalWorkspaceTransaction((client) => runBootstrap(client, access));
}
