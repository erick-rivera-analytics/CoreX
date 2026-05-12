import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyQualityFarmsRedirectPage() {
  redirect("/dashboard/general/administrar-maestros/fincas");
}
