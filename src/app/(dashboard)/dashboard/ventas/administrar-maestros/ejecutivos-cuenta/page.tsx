import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SalesAccountExecutivesPageRoute() {
  redirect("/dashboard/comercial/administrar-maestros/ejecutivos-cuenta");
}
