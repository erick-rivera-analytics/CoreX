"use client";

import useSWR from "swr";

import { fetchJson } from "@/lib/fetch-json";
import type { MyAccountPageData, PersonalWorkspaceProfile } from "@/lib/personal-workspace-types";

const profileFetcher = (url: string) => fetchJson<{ profile: PersonalWorkspaceProfile }>(url, "No se pudo cargar el perfil personal.");

export function useMyProfile(initialData: MyAccountPageData) {
  const swr = useSWR("/api/me/profile", profileFetcher, {
    fallbackData: { profile: initialData.profile },
    revalidateOnFocus: false,
  });

  return {
    ...swr,
    profile: swr.data?.profile ?? initialData.profile,
  };
}
