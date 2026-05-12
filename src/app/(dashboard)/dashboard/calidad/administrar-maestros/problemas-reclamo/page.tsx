import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function QualityClaimProblemsLegacyRoute() {
  redirect("/dashboard/comercial/administrar-maestros/problemas-reclamo");
}
