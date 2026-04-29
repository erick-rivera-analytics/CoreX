"use client";

import { useDeferredValue, useState } from "react";
import { Search, UserRound, X } from "lucide-react";
import useSWR from "swr";

import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import type { EmployeeFollowupPersonSearchResult } from "@/modules/talento-humano/seguimientos/server/types";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (personId: string) => void;
  asOfDate?: string;
  placeholder?: string;
};

const personFetcher = (url: string) =>
  fetchJson<{ results: EmployeeFollowupPersonSearchResult[] }>(url, "No se pudo buscar colaboradores.");

export function PersonSearchField({
  id,
  label,
  value,
  onChange,
  asOfDate,
  placeholder = "Buscar por nombre o codigo...",
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const shouldSearch = deferredQuery.length >= 2 && deferredQuery !== selectedLabel;
  const searchUrl = shouldSearch
    ? `/api/talento-humano/seguimientos/person-search?q=${encodeURIComponent(deferredQuery)}&asOfDate=${encodeURIComponent(asOfDate ?? "")}`
    : null;

  const { data, isValidating } = useSWR(searchUrl, personFetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });

  const results = data?.results ?? [];

  function handleInput(nextValue: string) {
    setQuery(nextValue);
    if (value) {
      setSelectedLabel("");
      onChange("");
    }
  }

  function selectPerson(person: EmployeeFollowupPersonSearchResult) {
    const labelValue = `${person.personName} · ${person.personId}`;
    setSelectedLabel(labelValue);
    setQuery(labelValue);
    onChange(person.personId);
  }

  function clearSelection() {
    setQuery("");
    setSelectedLabel("");
    onChange("");
  }

  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          value={query}
          onChange={(event) => handleInput(event.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-[16px] border border-input bg-background pl-10 pr-10 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        {query ? (
          <button
            type="button"
            onClick={clearSelection}
            aria-label="Limpiar persona seleccionada"
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {value ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          Se guardara el ID: <span className="font-medium">{value}</span>
        </p>
      ) : null}

      {shouldSearch ? (
        <div className="overflow-hidden rounded-[18px] border border-border/70 bg-card">
          {results.length > 0 ? (
            <div className="max-h-64 overflow-auto p-1">
              {results.map((person) => (
                <Button
                  key={person.personId}
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start rounded-[14px] px-3 py-2 text-left"
                  onClick={() => selectPerson(person)}
                >
                  <UserRound className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{person.personName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {person.personId}
                      {person.jobTitle ? ` · ${person.jobTitle}` : ""}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          ) : (
            <div className={cn("px-4 py-5 text-center text-sm text-muted-foreground", isValidating && "animate-pulse")}>
              {isValidating ? "Buscando colaboradores..." : "No hay coincidencias."}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
