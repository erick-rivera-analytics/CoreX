"use client";

import { MyWorkExplorer } from "@/modules/my-work/components/my-work-explorer";
import type { MyWorkInitialData } from "@/modules/my-work/server/types";

export function MyWorkPage({ initialData }: { initialData: MyWorkInitialData }) {
  return <MyWorkExplorer initialData={initialData} />;
}
