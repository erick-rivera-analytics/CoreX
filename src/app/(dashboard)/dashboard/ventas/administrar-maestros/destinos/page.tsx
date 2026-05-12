import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacySalesDestinationsRedirectPage() {
  redirect("/dashboard/postcosecha/administrar-maestros/destinos");
}
