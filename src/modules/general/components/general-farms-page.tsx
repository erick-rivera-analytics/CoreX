import { SimpleMasterPage } from "@/modules/domain-masters/components/simple-master-page";
import type { GeneralSimpleMasterRecord } from "@/lib/general-master-types";

export function GeneralFarmsPage({
  initialData,
  initialError,
}: {
  initialData: GeneralSimpleMasterRecord[];
  initialError?: string | null;
}) {
  return (
    <SimpleMasterPage
      initialData={initialData}
      initialError={initialError}
      config={{
        apiEndpoint: "/api/general/administrar-maestros/fincas",
        resourceNameSingular: "Finca",
        resourceNamePlural: "Fincas",
        eyebrow: "Administracion / Maestros por dominio / General / Fincas",
        title: "Fincas",
        subtitle: "Administra el maestro general inicial de fincas para reclamos y otros procesos transversales. Cada guardado conserva trazabilidad SCD2 en db_general.public.",
        searchPlaceholder: "Buscar por codigo, nombre o referencia externa...",
        newButtonLabel: "Nueva finca",
        saveButtonLabel: "Guardar finca",
        listTitle: "Catalogo de fincas",
        listDescription: "Selecciona una finca para editarla o registra una nueva desde el formulario.",
        editorDescription: "Este maestro se ubica en General porque puede reutilizarse por Calidad, Ventas y otros dominios operativos.",
        codeLabel: "Codigo finca",
        nameLabel: "Nombre finca",
        externalRefLabel: "Referencia externa",
        externalRefPlaceholder: "Opcional. Ej. codigo de Campo o legacy.",
        showContactEmail: false,
        storageScopeLabel: "db_general.public",
      }}
    />
  );
}
