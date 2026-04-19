type QueryExecutor = {
  query: (text: string, values?: unknown[]) => Promise<unknown>;
};

export async function insertPersonalWorkspaceActivity(
  executor: QueryExecutor,
  input: {
    authUserId: string;
    entityType: string;
    entityId: string;
    actionCode: string;
    payload?: unknown;
  },
) {
  await executor.query(
    `
      insert into public.wrk_fact_activity_log_cur (
        auth_user_id,
        entity_type,
        entity_id,
        action_code,
        payload_jsonb
      )
      values ($1, $2, $3, $4, $5::jsonb)
    `,
    [
      input.authUserId,
      input.entityType,
      input.entityId,
      input.actionCode,
      JSON.stringify(input.payload ?? {}),
    ],
  );
}
