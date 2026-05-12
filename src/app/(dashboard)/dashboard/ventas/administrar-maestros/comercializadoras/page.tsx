import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SalesCommercializersPageRoute() {
  redirect("/dashboard/comercial/administrar-maestros/comercializadoras");
}
