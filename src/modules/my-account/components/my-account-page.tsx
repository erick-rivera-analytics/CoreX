"use client";

import { MyAccountExplorer } from "@/modules/my-account/components/my-account-explorer";
import type { MyAccountInitialData } from "@/modules/my-account/index";

export function MyAccountPage({ initialData }: { initialData: MyAccountInitialData }) {
  return <MyAccountExplorer initialData={initialData} />;
}
