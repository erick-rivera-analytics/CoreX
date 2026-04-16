"use client";

import { useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCcw,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import {
  ACCESS_RESOURCES_BY_SECTION,
  ROLE_OPTIONS,
  getBaseAllowedResources,
  type PermissionOverride,
  type RoleCode,
} from "@/lib/access-control";
import { fetchJson } from "@/lib/fetch-json";
import type { User } from "@/lib/users";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { EmptyState } from "@/shared/data-display/empty-state";
import { FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { DialogShell } from "@/shared/overlays/dialog-shell";
import { formatDate, formatInteger } from "@/shared/lib/format";
import { ToggleSwitch } from "@/shared/forms/toggle-switch";
import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";
import { StandardTable, StandardTd, StandardTh } from "@/shared/tables/standard-table";
import { cn } from "@/lib/utils";

const usersFetcher = (url: string) =>
  fetchJson<{ users: User[] }>(url, "No se pudo cargar la lista de usuarios.");

const roleLabelByCode = ROLE_OPTIONS.reduce<Record<RoleCode, string>>(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {
    superadmin: "Superadmin",
    viewer: "Viewer",
    custom: "Custom",
  },
);

function getEffectiveAllowedResources(roleCode: RoleCode, overrides: PermissionOverride[]) {
  const baseAllowed = getBaseAllowedResources(roleCode);
  const overrideMap = new Map(overrides.map((override) => [override.resourceKey, override.canView]));

  return Object.values(ACCESS_RESOURCES_BY_SECTION)
    .flat()
    .map((resource) => resource.resourceKey)
    .filter((resourceKey) => {
      if (roleCode === "superadmin") return true;
      if (overrideMap.has(resourceKey)) return overrideMap.get(resourceKey) === true;
      return baseAllowed.includes(resourceKey);
    });
}

function upsertPermissionOverride(
  overrides: PermissionOverride[],
  roleCode: RoleCode,
  resourceKey: string,
  nextCanView: boolean,
) {
  const baseAllowed = getBaseAllowedResources(roleCode).includes(resourceKey);
  const nextOverrides = overrides.filter((override) => override.resourceKey !== resourceKey);

  if (nextCanView === baseAllowed) {
    return nextOverrides;
  }

  nextOverrides.push({ resourceKey, canView: nextCanView });
  return nextOverrides;
}

export function UsersPage() {
  const { data, error, isLoading, mutate } = useSWR("/api/admin/users", usersFetcher, {
    revalidateOnFocus: false,
  });

  const [showModal, setShowModal] = useState<"create" | "edit" | "delete" | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pendingToggleUserId, setPendingToggleUserId] = useState<number | null>(null);

  function openCreate() {
    setSelectedUser(null);
    setShowModal("create");
  }

  function openEdit(user: User) {
    setSelectedUser(user);
    setShowModal("edit");
  }

  function openDelete(user: User) {
    setSelectedUser(user);
    setShowModal("delete");
  }

  function closeModal() {
    setShowModal(null);
    setSelectedUser(null);
  }

  async function handleToggleActive(user: User) {
    setPendingToggleUserId(user.id);
    try {
      await fetchJson(`/api/admin/users/${user.id}`, "Error al cambiar estado.", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      toast.success(`Usuario ${!user.isActive ? "activado" : "desactivado"} correctamente.`);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar estado.");
    } finally {
      setPendingToggleUserId(null);
    }
  }

  const users = data?.users ?? [];
  const activeUsers = users.filter((user) => user.isActive).length;
  const inactiveUsers = users.length - activeUsers;
  const customRoles = users.filter((user) => user.roleCode === "custom").length;

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Administracion / Seguridad"
        title="Usuarios"
        subtitle="Gestiona acceso, estado y permisos por pantalla con el mismo patron visual del resto del dashboard."
        icon={<ShieldCheck className="size-6" aria-hidden="true" />}
        actions={(
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => mutate()} disabled={isLoading}>
              <RefreshCcw className={cn("size-3.5", isLoading && "animate-spin")} />
              Actualizar
            </Button>
            <Button size="sm" className="gap-2" onClick={openCreate}>
              <Plus className="size-3.5" />
              Nuevo usuario
            </Button>
          </div>
        )}
      >
        <FilterPanel>
          <div className="text-xs text-muted-foreground">
            {users.length} {users.length === 1 ? "usuario" : "usuarios"} registrados
          </div>
          <KpiGrid>
            <MetricTile label="Usuarios totales" value={formatInteger(users.length)} />
            <MetricTile label="Activos" value={formatInteger(activeUsers)} />
            <MetricTile label="Inactivos" value={formatInteger(inactiveUsers)} />
            <MetricTile label="Roles custom" value={formatInteger(customRoles)} />
          </KpiGrid>
        </FilterPanel>
      </SectionPageShell>

      <Card className="overflow-hidden border-border/70 bg-card/90">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Usuarios del sistema</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Cargando usuarios...
            </div>
          ) : error ? (
            <div className="px-6 py-16 text-center text-sm text-destructive">{error.message}</div>
          ) : users.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState label="No hay usuarios registrados." />
            </div>
          ) : (
            <ScrollFadeTable>
              <StandardTable>
                <thead>
                  <tr className="border-b border-border/60">
                    <StandardTh>ID</StandardTh>
                    <StandardTh>Usuario</StandardTh>
                    <StandardTh>Rol</StandardTh>
                    <StandardTh>Accesos</StandardTh>
                    <StandardTh>Estado</StandardTh>
                    <StandardTh>Activo</StandardTh>
                    <StandardTh>Creado</StandardTh>
                    <StandardTh>Actualizado</StandardTh>
                    <StandardTh align="right">Acciones</StandardTh>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const effectiveAllowedResources = getEffectiveAllowedResources(user.roleCode, user.permissionOverrides);
                    const togglePending = pendingToggleUserId === user.id;

                    return (
                      <tr key={user.id} className="border-b border-border/50 last:border-0 hover:bg-muted/25">
                        <StandardTd className="text-muted-foreground">{user.id}</StandardTd>
                        <StandardTd>
                          <div className="flex items-center gap-2">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
                              {user.username.charAt(0)}
                            </div>
                            <span className="font-medium">{user.username}</span>
                          </div>
                        </StandardTd>
                        <StandardTd>
                          <Badge variant="outline">{roleLabelByCode[user.roleCode]}</Badge>
                        </StandardTd>
                        <StandardTd className="text-muted-foreground">
                          {user.roleCode === "superadmin" ? "Todas" : formatInteger(effectiveAllowedResources.length)}
                        </StandardTd>
                        <StandardTd>
                          {user.isActive ? (
                            <Badge variant="success" className="gap-1">
                              <ShieldCheck className="size-3" /> Activo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-muted-foreground">
                              <ShieldOff className="size-3" /> Inactivo
                            </Badge>
                          )}
                        </StandardTd>
                        <StandardTd>
                          <div className="flex items-center gap-2">
                            <ToggleSwitch checked={user.isActive} disabled={togglePending} onCheckedChange={() => handleToggleActive(user)} />
                            {togglePending ? <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" /> : null}
                          </div>
                        </StandardTd>
                        <StandardTd className="text-muted-foreground">{formatDate(user.createdAt)}</StandardTd>
                        <StandardTd className="text-muted-foreground">{formatDate(user.updatedAt)}</StandardTd>
                        <StandardTd align="right">
                          <div className="flex items-center justify-end gap-1">
                            <ActionButton title="Editar" onClick={() => openEdit(user)}>
                              <Pencil className="size-3.5" />
                            </ActionButton>
                            <ActionButton title="Eliminar" onClick={() => openDelete(user)} danger>
                              <Trash2 className="size-3.5" />
                            </ActionButton>
                          </div>
                        </StandardTd>
                      </tr>
                    );
                  })}
                </tbody>
              </StandardTable>
            </ScrollFadeTable>
          )}
        </CardContent>
      </Card>

      {(showModal === "create" || showModal === "edit") && (
        <UserFormModal
          user={selectedUser}
          onClose={closeModal}
          onSaved={() => {
            mutate();
            closeModal();
          }}
        />
      )}
      {showModal === "delete" && selectedUser ? (
        <DeleteModal
          user={selectedUser}
          onClose={closeModal}
          onDeleted={() => {
            mutate();
            closeModal();
          }}
        />
      ) : null}
    </div>
  );
}

function ActionButton({
  children,
  title,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-[10px] border border-transparent transition-colors",
        danger
          ? "hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function UserFormModal({
  user,
  onClose,
  onSaved,
}: {
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = user !== null;
  const [username, setUsername] = useState(user?.username ?? "");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [roleCode, setRoleCode] = useState<RoleCode>(user?.roleCode ?? "custom");
  const [permissionOverrides, setPermissionOverrides] = useState<PermissionOverride[]>(user?.permissionOverrides ?? []);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveAllowedResources = useMemo(() => getEffectiveAllowedResources(roleCode, permissionOverrides), [permissionOverrides, roleCode]);
  const effectiveAllowedSet = useMemo(() => new Set(effectiveAllowedResources), [effectiveAllowedResources]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        isActive,
        roleCode,
        permissionOverrides,
      };

      if (!isEdit || username !== user?.username) {
        body.username = username;
      }

      if (!isEdit) {
        body.username = username;
        body.password = password;
      } else if (password) {
        body.password = password;
      }

      const url = isEdit ? `/api/admin/users/${user.id}` : "/api/admin/users";
      const method = isEdit ? "PATCH" : "POST";

      await fetchJson(url, isEdit ? "Error al actualizar usuario." : "Error al crear usuario.", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      toast.success(isEdit ? "Usuario actualizado." : "Usuario creado.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  function handleToggleAccess(resourceKey: string, nextCanView: boolean) {
    setPermissionOverrides((current) => upsertPermissionOverride(current, roleCode, resourceKey, nextCanView));
  }

  return (
    <DialogShell
      title={isEdit ? "Editar usuario" : "Nuevo usuario"}
      onClose={onClose}
      maxWidth="max-w-5xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Nombre de usuario">
            <Input value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} placeholder="ej. juan.garcia" />
          </FormField>

          <FormField label={isEdit ? "Nueva contraseña (opcional)" : "Contraseña"}>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required={!isEdit}
                minLength={isEdit && !password ? undefined : 6}
                placeholder={isEdit ? "••••••••" : "Mínimo 6 caracteres"}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((value) => !value)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </FormField>

          <FormField label="Rol">
            <select
              value={roleCode}
              onChange={(event) => setRoleCode(event.target.value as RoleCode)}
              className="h-11 w-full rounded-[16px] border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="pt-1 text-xs text-muted-foreground">
              {ROLE_OPTIONS.find((option) => option.value === roleCode)?.description}
            </p>
          </FormField>

          <FormField label="Estado">
            <div className="flex items-center gap-3 pt-2">
              <ToggleSwitch checked={isActive} onCheckedChange={setIsActive} />
              <span className="text-sm">{isActive ? "Activo" : "Inactivo"}</span>
            </div>
          </FormField>
        </div>

        <Card className="bg-background/40">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-semibold">Accesos por pantalla</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {roleCode === "superadmin"
                    ? "Superadmin siempre ve todo. Esta configuración queda bloqueada."
                    : `${formatInteger(effectiveAllowedResources.length)} pantallas habilitadas.`}
                </p>
              </div>
              <Badge variant="outline">{roleLabelByCode[roleCode]}</Badge>
            </div>
          </CardHeader>
          <CardContent className="max-h-[360px] overflow-y-auto p-4">
            {roleCode === "superadmin" ? (
              <div className="rounded-[14px] border border-border/70 bg-card/70 px-4 py-3 text-sm text-muted-foreground">
                Este rol conserva acceso total fijo y no requiere overrides.
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(ACCESS_RESOURCES_BY_SECTION).map(([section, resources]) => (
                  <div key={section} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{section}</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {resources.map((resource) => {
                        const enabled = effectiveAllowedSet.has(resource.resourceKey);
                        return (
                          <div key={resource.resourceKey} className="flex items-center justify-between gap-3 rounded-[14px] border border-border/70 bg-card/80 px-4 py-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{resource.label}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{resource.resourceKey}</p>
                            </div>
                            <ToggleSwitch checked={enabled} onCheckedChange={(nextValue) => handleToggleAccess(resource.resourceKey, nextValue)} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {error ? <p className="rounded-[12px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={loading} className="gap-2">
            {loading ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
            {isEdit ? "Guardar cambios" : "Crear usuario"}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

function DeleteModal({
  user,
  onClose,
  onDeleted,
}: {
  user: User;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      await fetchJson(`/api/admin/users/${user.id}`, "Error al eliminar usuario.", {
        method: "DELETE",
      });
      toast.success("Usuario eliminado.");
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar.");
      setLoading(false);
    }
  }

  return (
    <DialogShell title="Eliminar usuario" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          ¿Estás seguro de que deseas eliminar al usuario <span className="font-semibold text-foreground">{user.username}</span>? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" size="sm" variant="destructive" disabled={loading} onClick={handleDelete} className="gap-2">
            {loading ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Eliminar
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
