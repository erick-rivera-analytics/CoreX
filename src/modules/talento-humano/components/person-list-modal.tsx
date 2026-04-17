"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { PersonInfoOverlay } from "@/modules/talento-humano/components/person-info-overlay";
import { DialogShell } from "@/shared/overlays/dialog-shell";
import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";
import { StandardTable, StandardTd, StandardTh } from "@/shared/tables/standard-table";
import { Input } from "@/shared/ui/input";
import { EmptyState } from "@/shared/data-display/empty-state";
import type { TalentoPersonRecord } from "@/lib/talento-humano";

export function PersonListModal<T extends TalentoPersonRecord>({
  title,
  people,
  onClose,
}: {
  title: string;
  people: T[];
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<T | null>(null);

  const filteredPeople = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return people;
    return people.filter((person) => person.personId.toLowerCase().includes(term) || person.personName.toLowerCase().includes(term));
  }, [people, search]);

  return (
    <>
      <DialogShell
        title={title}
        description={`${people.length} personas`}
        onClose={onClose}
        maxWidth="max-w-5xl"
        headerActions={(
          <button type="button" onClick={onClose} className="rounded-[10px] p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Cerrar listado">
            <X className="size-4" />
          </button>
        )}
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o ID..." className="pl-8" />
          </div>
          {filteredPeople.length ? (
            <ScrollFadeTable>
              <StandardTable>
                <thead className="border-b border-border/70">
                  <tr>
                    <StandardTh>ID</StandardTh>
                    <StandardTh>Nombre</StandardTh>
                    <StandardTh>Area</StandardTh>
                    <StandardTh>Genero</StandardTh>
                  </tr>
                </thead>
                <tbody>
                  {filteredPeople.map((person, index) => (
                    <tr key={`${person.personId}-${person.areaId}-${index}`} className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-muted/30" onClick={() => setSelectedPerson(person)}>
                      <StandardTd className="text-xs text-muted-foreground">{person.personId}</StandardTd>
                      <StandardTd className="text-xs font-medium">{person.personName}</StandardTd>
                      <StandardTd className="max-w-[180px] truncate text-xs text-muted-foreground">{person.areaName}</StandardTd>
                      <StandardTd className="text-xs text-muted-foreground">{person.gender ?? "-"}</StandardTd>
                    </tr>
                  ))}
                </tbody>
              </StandardTable>
            </ScrollFadeTable>
          ) : (
            <EmptyState label="Sin resultados." />
          )}
        </div>
      </DialogShell>
      {selectedPerson ? <PersonInfoOverlay personId={selectedPerson.personId} personName={selectedPerson.personName} onClose={() => setSelectedPerson(null)} /> : null}
    </>
  );
}
