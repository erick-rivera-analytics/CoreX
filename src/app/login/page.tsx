"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

import { starterName, starterSubtitle } from "@/config/dashboard";
import { Logo } from "@/shared/layout/logo";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al iniciar sesion");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Error de conexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900/12 via-background to-accent/12 px-6 py-10 overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-gradient-to-br from-slate-900/20 to-transparent blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-gradient-to-tr from-accent/20 to-transparent blur-3xl" />

      <Card className="relative w-full max-w-md border border-slate-400/20 bg-card/95 shadow-2xl shadow-slate-900/20 backdrop-blur-xl transition-all duration-300 hover:shadow-2xl hover:shadow-slate-900/30 hover:border-slate-400/40 dark:border-slate-600/20 dark:hover:border-slate-600/40">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-lg shadow-slate-900/40">
              <Logo size={20} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">{starterName}</p>
              <p className="truncate text-[10px] text-muted-foreground/80">{starterSubtitle}</p>
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs border-slate-400/40 bg-slate-900/20 text-slate-700 dark:border-slate-600/40 dark:bg-slate-900/30 dark:text-white">
              Acceso
            </Badge>
            <CardTitle className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/75 bg-clip-text text-transparent">Entrar</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="font-semibold text-sm">Usuario</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Tu usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="h-11 border-border/60 bg-background/60 transition-all duration-200 hover:bg-background/80 focus:bg-background focus:border-slate-400/50 focus:ring-slate-900/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="font-semibold text-sm">Clave</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Tu clave"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 border-border/60 bg-background/60 transition-all duration-200 hover:bg-background/80 focus:bg-background focus:border-slate-400/50 focus:ring-slate-900/20"
                />
              </div>
            </div>

            {error ? (
              <p className="text-sm text-destructive font-medium">{error}</p>
            ) : null}

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-xl font-semibold text-base transition-all duration-200 bg-gradient-to-r from-slate-900 to-slate-800 text-white hover:shadow-lg hover:shadow-slate-900/40 hover:from-slate-900 hover:to-slate-800/90 dark:from-slate-800 dark:to-slate-700"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="size-4 ml-1" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
