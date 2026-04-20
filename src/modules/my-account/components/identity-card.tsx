import { UserCircle2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import type { MyAccountProfile } from "@/modules/my-account/index";

function getInitials(value: string) {
  return value
    .split(" ")
    .map((part) => part.trim()[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function IdentityCard({ profile }: { profile: MyAccountProfile }) {
  const displayName = profile.displayName || profile.username;
  const initials = getInitials(displayName);

  return (
    <Card className="bg-card/90">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">Identidad</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full border border-border/70 bg-muted text-lg font-semibold">
            {initials || <UserCircle2 className="size-7 text-muted-foreground" aria-hidden="true" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{displayName}</p>
            <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
            {profile.contactEmail ? (
              <p className="truncate text-xs text-muted-foreground mt-0.5">{profile.contactEmail}</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
