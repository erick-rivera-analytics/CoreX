import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacySalesVarietiesRedirectPage() {
  redirect("/dashboard/general/administrar-maestros/variedades");
}
