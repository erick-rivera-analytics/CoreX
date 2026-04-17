"use client";

import { fetchJson } from "@/lib/fetch-json";

export type SwrFetcherRequest = readonly [string, string];

export async function swrFetcher<T>([url, fallbackMessage]: SwrFetcherRequest) {
  return fetchJson<T>(url, fallbackMessage);
}
