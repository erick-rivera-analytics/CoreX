"use client";

import { useEffect, useReducer, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/lib/utils";
import {
  decodeMultiSelectValue,
  encodeMultiSelectValue,
} from "@/lib/multi-select";

export type MultiSelectFieldProps = {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  emptyLabel?: string;
  placeholder?: string;
  displayValue?: (option: string) => string;
};

type MultiSelectPanelStyle = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

type MultiSelectFieldState = {
  open: boolean;
  search: string;
  draftValues: string[];
  panelStyle: MultiSelectPanelStyle | null;
};

type MultiSelectFieldAction =
  | { type: "open"; draftValues: string[] }
  | { type: "close" }
  | { type: "set-search"; search: string }
  | { type: "set-draft-values"; draftValues: string[] }
  | { type: "toggle-option"; option: string }
  | { type: "set-panel-style"; panelStyle: MultiSelectPanelStyle | null };

function multiSelectFieldReducer(
  state: MultiSelectFieldState,
  action: MultiSelectFieldAction,
): MultiSelectFieldState {
  switch (action.type) {
    case "open":
      return {
        ...state,
        open: true,
        search: "",
        draftValues: action.draftValues,
      };
    case "close":
      return {
        ...state,
        open: false,
      };
    case "set-search":
      return {
        ...state,
        search: action.search,
      };
    case "set-draft-values":
      return {
        ...state,
        draftValues: action.draftValues,
      };
    case "toggle-option":
      return {
        ...state,
        draftValues: state.draftValues.includes(action.option)
          ? state.draftValues.filter((entry) => entry !== action.option)
          : [...state.draftValues, action.option],
      };
    case "set-panel-style":
      return {
        ...state,
        panelStyle: action.panelStyle,
      };
    default:
      return state;
  }
}

export function MultiSelectField({
  id,
  label,
  value,
  options,
  onChange,
  emptyLabel = "Todos",
  placeholder = "Buscar opcion...",
  displayValue,
}: MultiSelectFieldProps) {
  const [{ open, search, draftValues, panelStyle }, dispatch] = useReducer(
    multiSelectFieldReducer,
    {
      open: false,
      search: "",
      draftValues: decodeMultiSelectValue(value),
      panelStyle: null,
    },
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const selectedValues = decodeMultiSelectValue(value);
  const getDisplayValue = (option: string) => displayValue?.(option) ?? option;

  const selectedSummary = !selectedValues.length
    ? emptyLabel
    : selectedValues.length === 1
      ? getDisplayValue(selectedValues[0] ?? emptyLabel)
      : `${getDisplayValue(selectedValues[0] ?? emptyLabel)} +${selectedValues.length - 1}`;

  const filteredOptions = (() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return options;
    }

    return options.filter((option) => getDisplayValue(option).toLowerCase().includes(term));
  })();

  useEffect(() => {
    if (!open) return;

    const updatePanelPosition = () => {
      if (!buttonRef.current) return;

      const rect = buttonRef.current.getBoundingClientRect();
      const viewportPadding = 12;
      const maxWidth = Math.min(Math.max(rect.width, 320), window.innerWidth - viewportPadding * 2);
      const left = Math.min(rect.left, window.innerWidth - maxWidth - viewportPadding);
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - viewportPadding);
      const spaceAbove = Math.max(0, rect.top - viewportPadding);
      const openAbove = spaceBelow < 320 && spaceAbove > spaceBelow;
      const availableHeight = Math.max(220, openAbove ? spaceAbove - 8 : spaceBelow - 8);
      const maxHeight = Math.min(availableHeight, 420);

      dispatch({
        type: "set-panel-style",
        panelStyle: {
          top: openAbove ? Math.max(viewportPadding, rect.top - maxHeight - 8) : rect.bottom + 8,
          left: Math.max(viewportPadding, left),
          width: maxWidth,
          maxHeight,
        },
      });
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        dispatch({ type: "close" });
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dispatch({ type: "close" });
      }
    };

    updatePanelPosition();
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open]);

  function toggleOption(option: string) {
    dispatch({ type: "toggle-option", option });
  }

  function applyChanges(nextValues = draftValues) {
    onChange(nextValues.length ? encodeMultiSelectValue(nextValues) : "all");
    dispatch({ type: "close" });
  }

  function resetDraft() {
    dispatch({ type: "set-draft-values", draftValues: selectedValues });
  }

  function openPanel() {
    dispatch({ type: "open", draftValues: selectedValues });
  }

  function togglePanel() {
    if (open) {
      dispatch({ type: "close" });
      return;
    }

    openPanel();
  }

  return (
    <div ref={containerRef} className="relative min-w-0 space-y-2 overflow-visible">
      <Label htmlFor={id}>{label}</Label>
      <button
        id={id}
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={togglePanel}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[16px] border border-input bg-background px-4 py-2.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <span className="min-w-0 flex-1 truncate">{selectedSummary}</span>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline">{selectedValues.length || "Todo"}</Badge>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {selectedValues.length ? (
        <div className="flex flex-wrap gap-1">
          {selectedValues.slice(0, 2).map((entry) => (
            <Badge key={entry} variant="secondary" className="gap-1">
              <span className="max-w-[120px] truncate">{getDisplayValue(entry)}</span>
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => onChange(encodeMultiSelectValue(selectedValues.filter((currentValue) => currentValue !== entry)) || "all")}
                aria-label={`Quitar ${getDisplayValue(entry)}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {selectedValues.length > 2 ? <Badge variant="outline">+{selectedValues.length - 2}</Badge> : null}
        </div>
      ) : null}

      {open && panelStyle
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[250] overflow-hidden rounded-[24px] border border-border/80 bg-card shadow-[0_24px_80px_-32px_rgba(15,23,42,0.28)]"
              style={{ top: panelStyle.top, left: panelStyle.left, width: panelStyle.width }}
            >
              <div className="border-b border-border/70 p-3">
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => dispatch({ type: "set-search", search: event.target.value })}
                      placeholder={placeholder}
                      className="pl-8"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => dispatch({ type: "set-draft-values", draftValues: options })}
                  >
                    Todo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => dispatch({ type: "set-draft-values", draftValues: [] })}
                  >
                    Limpiar
                  </Button>
                </div>
              </div>
              <div className="overflow-auto p-2" style={{ maxHeight: panelStyle.maxHeight }}>
                {filteredOptions.length ? (
                  <div className="space-y-1">
                    {filteredOptions.map((option) => {
                      const active = draftValues.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-[12px] border px-3 py-2 text-left text-sm transition-colors",
                            active
                              ? "border-primary/25 bg-muted/70 text-foreground"
                              : "border-transparent hover:border-border hover:bg-muted/55",
                          )}
                          onClick={() => toggleOption(option)}
                        >
                          <span className="min-w-0 truncate">{getDisplayValue(option)}</span>
                          <span
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-full border",
                              active ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent",
                            )}
                          >
                            <Check className="size-3.5" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-[12px] border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
                    No hay coincidencias.
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border/70 px-3 py-3">
                <div className="text-xs text-muted-foreground">
                  {draftValues.length ? `${draftValues.length} seleccionadas` : "Sin seleccion"}
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={resetDraft}>
                    Restablecer
                  </Button>
                  <Button type="button" size="sm" onClick={() => applyChanges()}>
                    Aplicar
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
