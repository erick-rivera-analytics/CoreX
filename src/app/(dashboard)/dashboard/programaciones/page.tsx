import { getProgramaciones } from "@/lib/programaciones";
import { ProgramacionesPage } from "@/modules/programaciones/components/programaciones-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

function getCurrentMonthRange() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const paddedMonth = String(month + 1).padStart(2, "0");
  const lastDay = new Date(year, month + 1, 0).getDate();

  return {
    dateFrom: `${year}-${paddedMonth}-01`,
    dateTo: `${year}-${paddedMonth}-${String(lastDay).padStart(2, "0")}`,
  };
}

export default async function ProgramacionesPageRoute() {
  const { dateFrom, dateTo } = getCurrentMonthRange();
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/programaciones",
    loader: () => getProgramaciones(dateFrom, dateTo),
    fallbackMessage: "No se pudieron cargar las programaciones iniciales.",
    fallbackData: [],
  });

  return (
    <ProgramacionesPage
      initialData={data ?? []}
      initialDateFrom={dateFrom}
      initialDateTo={dateTo}
      initialError={error}
    />
  );
}
