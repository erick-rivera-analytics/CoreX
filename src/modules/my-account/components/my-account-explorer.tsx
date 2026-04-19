"use client";

import { useState } from "react";
import { RefreshCcw, UserCircle2 } from "lucide-react";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import type { PersonalWorkspaceProfile } from "@/lib/personal-workspace-types";
import { ProfileSummaryCard } from "@/modules/my-account/components/profile-summary-card";
import { ProfilePreferencesForm } from "@/modules/my-account/components/profile-preferences-form";
import { NotificationPreferencesForm } from "@/modules/my-account/components/notification-preferences-form";
import type { MyAccountInitialData, MyAccountNotificationPreferences, MyAccountProfile } from "@/modules/my-account/index";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { ChartSurface } from "@/shared/data-display/chart-surface";
import { DetailSection, FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { Button } from "@/shared/ui/button";
import { formatInteger } from "@/shared/lib/format";

function mapApiProfile(profile: PersonalWorkspaceProfile, username: string): MyAccountProfile {
  return {
    authUserId: profile.authUserId,
    username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl ?? "",
    bioText: profile.bioText ?? "",
    localeCode: profile.localeCode,
    timezoneName: profile.timezoneName,
    themeCode: profile.themeCode,
    defaultRoute: profile.defaultRoute,
    defaultCalendarViewCode: profile.defaultCalendarViewCode,
    defaultTaskViewCode: profile.defaultTaskViewCode,
    weekStartIso: profile.weekStartIso === 7 ? 7 : 1,
    notificationPreferences: profile.notificationPrefs,
    lastUpdatedAt: profile.updatedAt ?? profile.createdAt ?? new Date().toISOString(),
  };
}

function toProfilePayload(profile: MyAccountProfile, notificationPreferences: MyAccountNotificationPreferences) {
  return {
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl || null,
    bioText: profile.bioText || null,
    localeCode: profile.localeCode,
    timezoneName: profile.timezoneName,
    themeCode: profile.themeCode,
    defaultRoute: profile.defaultRoute,
    defaultCalendarViewCode: profile.defaultCalendarViewCode,
    defaultTaskViewCode: profile.defaultTaskViewCode,
    weekStartIso: profile.weekStartIso,
    notificationPrefs: notificationPreferences,
  };
}

export function MyAccountExplorer({ initialData }: { initialData: MyAccountInitialData }) {
  const [profile, setProfile] = useState(initialData.profile);
  const [notificationPreferences, setNotificationPreferences] = useState(initialData.profile.notificationPreferences);
  const [formVersion, setFormVersion] = useState(0);

  async function persistProfile(nextProfile: MyAccountProfile, nextNotifications: MyAccountNotificationPreferences) {
    const response = await fetchJson<{ profile: PersonalWorkspaceProfile }>("/api/me/profile", "No se pudo guardar el perfil.", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toProfilePayload(nextProfile, nextNotifications)),
    });
    const savedProfile = mapApiProfile(response.profile, initialData.profile.username);
    setProfile(savedProfile);
    setNotificationPreferences(savedProfile.notificationPreferences);
    setFormVersion((current) => current + 1);
    return savedProfile;
  }

  async function handleProfileSave(nextProfile: MyAccountProfile) {
    try {
      await persistProfile({ ...nextProfile, notificationPreferences }, notificationPreferences);
      toast.success("Preferencias guardadas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el perfil.");
    }
  }

  async function handleNotificationsSave(nextValue: MyAccountNotificationPreferences) {
    try {
      await persistProfile({ ...profile, notificationPreferences: nextValue }, nextValue);
      toast.success("Notificaciones guardadas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron guardar las notificaciones.");
    }
  }

  function resetLocalChanges() {
    setProfile(initialData.profile);
    setNotificationPreferences(initialData.profile.notificationPreferences);
    setFormVersion((current) => current + 1);
    toast.message("Se restauro la informacion inicial de la pantalla.");
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Gestion / Personal"
        title="Mi cuenta"
        subtitle="Perfil, preferencias y notificaciones personales conectadas al usuario autenticado de CoreX."
        icon={<UserCircle2 className="size-6" aria-hidden="true" />}
        actions={(
          <Button variant="outline" onClick={resetLocalChanges}>
            <RefreshCcw className="size-4" aria-hidden="true" />
            Restablecer
          </Button>
        )}
      >
        <FilterPanel>
          <KpiGrid columns={4}>
            <MetricTile label="Perfil" value={profile.displayName || profile.username} hint={`Usuario: ${profile.username}`} />
            <MetricTile label="Ruta inicial" value={profile.defaultRoute} hint="Se guarda como preferencia personal" />
            <MetricTile label="Pendientes hoy" value={formatInteger(initialData.workSummary.pendingToday)} hint="Resumen de mi trabajo" />
            <MetricTile label="Vencidas" value={formatInteger(initialData.workSummary.overdue)} accent={initialData.workSummary.overdue ? "danger" : "default"} />
          </KpiGrid>
        </FilterPanel>
      </SectionPageShell>

      <DetailSection>
        <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <ProfileSummaryCard profile={profile} workSummary={initialData.workSummary} />
          <ProfilePreferencesForm key={`profile-${profile.authUserId}-${formVersion}`} value={profile} onSave={handleProfileSave} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <NotificationPreferencesForm
            key={`notifications-${profile.authUserId}-${formVersion}`}
            value={notificationPreferences}
            onSave={handleNotificationsSave}
          />
          <ChartSurface title="Resumen de mi trabajo" subtitle="Lectura rapida para entrar al dia con contexto suficiente.">
            <KpiGrid columns={3}>
              <MetricTile label="Espacios activos" value={formatInteger(initialData.workSummary.activeSpaces)} />
              <MetricTile label="En progreso" value={formatInteger(initialData.workSummary.inProgress)} />
              <MetricTile label="Siguiente evento" value={initialData.workSummary.nextEventLabel} hint={initialData.workSummary.nextReminderLabel} />
            </KpiGrid>
          </ChartSurface>
        </div>
      </DetailSection>
    </div>
  );
}
