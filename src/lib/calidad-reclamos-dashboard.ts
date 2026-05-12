export type QualityClaimDashboardPlanData = {
  visuals: Array<{
    key: string;
    title: string;
    summary: string;
  }>;
  notes: string[];
};

export async function getQualityClaimDashboardPlanData(): Promise<QualityClaimDashboardPlanData> {
  return {
    visuals: [
      {
        key: "alerts",
        title: "Alertas y reclamos sin nota",
        summary: "Volumen y distribución de reclamos donde no aplica nota de crédito, con foco en incidencias operativas y alertas de calidad.",
      },
      {
        key: "credit-notes",
        title: "Notas de crédito",
        summary: "Seguimiento de reclamos con nota de crédito por origen del reclamo, cliente, ejecutivo, comercializadora y estado del proceso.",
      },
      {
        key: "reasons",
        title: "Motivos y problemas",
        summary: "Cortes por tipo de problema, problema específico, reclamo por Calidad o Comercial, y evolución por periodo.",
      },
    ],
    notes: [
      "Este frente vive en Calidad como visualizador estadístico, no como módulo transaccional.",
      "Su fuente futura será el modelo relacional de Comercial / Reclamos una vez exista el registro operativo.",
      "Debe complementarse con Punto de apertura, pero no reemplazarlo.",
    ],
  };
}
