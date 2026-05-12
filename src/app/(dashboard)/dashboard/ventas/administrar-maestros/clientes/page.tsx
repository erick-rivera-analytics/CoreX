import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SalesCustomersPageRoute() {
  redirect("/dashboard/comercial/administrar-maestros/clientes");
}
