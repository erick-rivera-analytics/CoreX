import { ensurePersonalWorkspaceBootstrap } from "@/lib/personal-workspace-bootstrap";
import { getMyWorkSummary } from "@/lib/my-work-repository";
import type { MyAccountPageData } from "@/lib/personal-workspace-types";

type LoaderAccess = {
  userId: number | string;
  username: string;
};

export async function loadMyAccountPageData(access: LoaderAccess): Promise<MyAccountPageData> {
  const bootstrap = await ensurePersonalWorkspaceBootstrap(access);
  const summary = await getMyWorkSummary(bootstrap.authUserId, bootstrap.profile.timezoneName);

  return {
    profile: bootstrap.profile,
    summary,
  };
}
