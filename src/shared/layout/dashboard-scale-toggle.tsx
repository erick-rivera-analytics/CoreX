"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Frame, Minus, Plus } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "dashboard-ui-scale";
const SCALE_EVENT = "dashboard-scale-change";
const MIN_SCALE = 0.80;
const MAX_SCALE = 1.20;
const STEP = 0.04;

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function applyScale(scale: number) {
  if (typeof document === "undefined") {
    return;
  }

  const nextScale = clampValue(scale, MIN_SCALE, MAX_SCALE);
  document.documentElement.style.fontSize = `${(16 * nextScale).toFixed(2)}px`;
  document.documentElement.style.setProperty("--dashboard-ui-scale", nextScale.toFixed(2));
}

function readStoredScaleSnapshot() {
  if (typeof window === "undefined") {
    return "1.00";
  }

  const storedValue = Number(window.localStorage.getItem(STORAGE_KEY) ?? "1");
  const scale = Number.isFinite(storedValue) ? clampValue(storedValue, MIN_SCALE, MAX_SCALE) : 1;
  return scale.toFixed(2);
}

function subscribeToScaleChange(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = () => onStoreChange();
  window.addEventListener("storage", handleChange);
  window.addEventListener(SCALE_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(SCALE_EVENT, handleChange);
  };
}

function persistScale(scale: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, clampValue(scale, MIN_SCALE, MAX_SCALE).toFixed(2));
  window.dispatchEvent(new Event(SCALE_EVENT));
}

export function DashboardScaleToggle() {
  const snapshot = useSyncExternalStore(subscribeToScaleChange, readStoredScaleSnapshot, () => "1.00");
  const scale = Number(snapshot ?? "1");

  useEffect(() => {
    applyScale(scale);
  }, [scale]);

  function updateScale(nextScale: number) {
    persistScale(nextScale);
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-card p-2 backdrop-blur-sm shadow-lg shadow-black/20">
      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all active:scale-95"
        onClick={() => persistScale(1)}
        title="Restablecer a 100%"
      >
        <Frame className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Restablecer tamaño</span>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
        onClick={() => updateScale(scale - STEP)}
        disabled={scale <= MIN_SCALE}
        title="Reducir (−)"
      >
        <Minus className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Reducir tamaño</span>
      </Button>

      <div className="bg-muted/40 rounded-full px-2.5 py-0.5 border border-border/50">
        <span
          className={cn(
            "cursor-default select-none text-center text-xs tabular-nums transition-colors",
            Math.abs(scale - 1) < 0.01 ? "font-bold text-foreground" : "font-medium text-muted-foreground",
          )}
          title="Escala actual del dashboard"
        >
          {`${Math.round(scale * 100)}%`}
        </span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
        onClick={() => updateScale(scale + STEP)}
        disabled={scale >= MAX_SCALE}
        title="Aumentar (+)"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Aumentar tamaño</span>
      </Button>
    </div>
  );
}
