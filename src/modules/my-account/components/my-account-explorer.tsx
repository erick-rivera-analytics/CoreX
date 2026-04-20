"use client";

import { useState } from "react";
import { UserCircle2 } from "lucide-react";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import type { PersonalWorkspaceProfile } from "@/lib/personal-workspace-types";
import { IdentityCard } from "@/modules/my-account/components/identity-card";
import { NotificationPreferencesForm } from "@/modules/my-account/components/notification-preferences-form";
import { NotificationStatusCard } from "@/modules/my-account/components/notification-status-card";
import { OperationalSummaryCard } from "@/modules/my-account/components/operational-summary-card";
import { ProfilePreferencesForm } from "@/modules/my-account/components/profile-preferences-form";
import { RecentAccessCard } from "@/modules/my-account/components/recent-access-card";
import type { MyAccountInitialData, MyAccountNotificationPreferences, MyAccountProfile } from "@/modules/my-account/index";
import { SectionPageShell } from "@/shared/layout/section-page-shell";

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
    contactEmail: profile.contactEmail ?? "",
    notificationPreferences: profile.notificationPrefs,
    lastUpdatedAt: profile.updatedAt ?? profile.createdAt ?? new Date().toISOString(),
  };
}

/**
 * Payload completo al PATCH: conserva los campos deprecados desde el estado
 * (llegaron via GET) para no romper el shape del schema del servidor; la UI
 * solo expone `displayName`, `contactEmail` y los toggles in_app.
 */
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
    contactEmail: profile.contactEmail || null,
    notificationPrefs: notificationPreferences,
  };
}

export function MyAccountExplorer({ initialData }: { initialData: MyAccountInitialData }) {
  const [profile, setProfile] = useState(initialData.profile);
  const [notificationPreferences, setNotificationPreferences] = useState(initialData.profile.notificationPreferences);
  const [formVersion, setFormVersion] = useState(0);

  async function persistProfile(nextProfile: MyAccountProfile, nextNotifications: MyAccountNotificationPreferences) {
    const response = await fetchJson<{ profile: PersonalWorkspaceProfile }>(
      "/api/me/profile",
      "No se pudo guardar el perfil.",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toProfilePayload(nextProfile, nextNotifications)),
      },
    );
    const savedProfile = mapApiProfile(response.profile, initialData.profile.username);
    setProfile(savedProfile);
    setNotificationPreferences(savedProfile.notificationPreferences);
    setFormVersion((current) => current + 1);
    return savedProfile;
  }

  async function handleProfileSave(nextProfile: MyAccountProfile) {
    try {
      await persistProfile({ ...nextProfile, notificationPreferences }, notificationPreferences);
      toast.success("Cambios guardados.");
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

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Personal"
        title="Mi cuenta"
        subtitle="Panel compacto de identidad y estado personal."
        icon={<UserCircle2 className="size-6" aria-hidden="true" />}
      >
        <></>
      </SectionPageShell>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        {/* IZQUIERDA - solo lectura */}
        <div className="space-y-4">
          <IdentityCard profile={profile} />
          <OperationalSummaryCard summary={initialData.workSummary} />
          <RecentAccessCard items={initialData.recentAccess} />
          <NotificationStatusCard value={notificationPreferences} />
        </div>

        {/* DERECHA - edicion minima */}
        <div className="space-y-4">
          <ProfilePreferencesForm
            key={`profile-${profile.authUserId}-${formVersion}`}
            value={profile}
            onSave={handleProfileSave}
          />
          <NotificationPreferencesForm
            key={`notifications-${profile.authUserId}-${formVersion}`}
            value={notificationPreferences}
            onSave={handleNotificationsSave}
            emailDisabled
          />
        </div>
      </div>
    </div>
  );
}
