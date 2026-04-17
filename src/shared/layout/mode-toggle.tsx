"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { useTheme } from "@/hooks/use-theme";

const emptySubscribe = () => () => {};

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => setSystemTheme(mediaQuery.matches ? "dark" : "light");

    syncTheme();
    mediaQuery.addEventListener("change", syncTheme);

    return () => mediaQuery.removeEventListener("change", syncTheme);
  }, []);

  const resolvedTheme = useMemo(() => {
    if (theme === "system") {
      return systemTheme;
    }

    return theme;
  }, [systemTheme, theme]);

  const displayTheme = mounted ? resolvedTheme : "light";

  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-full"
      onClick={() => setTheme(displayTheme === "dark" ? "light" : "dark")}
      disabled={!mounted}
    >
      {displayTheme === "dark" ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
      <span className="sr-only">Cambiar tema</span>
    </Button>
  );
}
