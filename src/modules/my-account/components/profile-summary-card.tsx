import { UserCircle2 } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatDateTime } from "@/shared/lib/format";
import type { MyAccountProfile, MyAccountWorkSummary } from "@/modules/my-account/index";

function getInitials(value: string) {
  return value
    .split(" ")
    .map((part) => part.trim()[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ProfileSummaryCard({
  profile,
  workSummary,
}: {
  profile: MyAccountProfile;
  workSummary: MyAccountWorkSummary;
}) {
  const initials = getInitials(profile.displayName || profile.username);

  return (
    <Card className="bg-card/90">
      <CardHeader className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex size-16 items-center justify-center rounded-full border border-border/70 bg-muted text-lg font-semibold">
            {profile.avatarUrl ? (
              <div
                aria-label={profile.displayName}
                className="size-full rounded-full bg-cover bg-center"
                style={{ backgroundImage: `url(${profile.avatarUrl})` }}
              />
            ) : initials ? (
              initials
            ) : (
              <UserCircle2 className="size-8 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <div>
              <CardTitle className="text-lg">{profile.displayName || profile.username}</CardTitle>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {profile.timezoneName}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {profile.themeCode}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Inicio: {profile.defaultRoute}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {profile.bioText || "Tu perfil personal aparecera aqui con la informacion operativa basica y tus preferencias de trabajo."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[18px] border border-border/70 bg-background/70 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Espacios activos</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{workSummary.activeSpaces}</p>
          </div>
          <div className="rounded-[18px] border border-border/70 bg-background/70 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Ultima actualizacion</p>
            <p className="mt-2 text-sm font-medium">{formatDateTime(profile.lastUpdatedAt)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
