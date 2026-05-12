import { SimpleMasterPage } from "@/modules/domain-masters/components/simple-master-page";
import type { GeneralSimpleMasterRecord } from "@/lib/general-master-types";

export function GeneralVarietiesPage({
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
        apiEndpoint: "/api/general/administrar-maestros/variedades",
        resourceNameSingular: "Variedad",
        resourceNamePlural: "Variedades",
        eyebrow: "Administracion / Maestros por dominio / General / Variedades",
        title: "Variedades",
        subtitle: "Administra el catalogo general inicial de variedades para reclamos y otros procesos transversales. Cada guardado conserva trazabilidad SCD2 en db_general.public.",
        searchPlaceholder: "Buscar por codigo, nombre o referencia externa...",
        newButtonLabel: "Nueva variedad",
        saveButtonLabel: "Guardar variedad",
        listTitle: "Catalogo de variedades",
        listDescription: "Selecciona una variedad para editarla o registra una nueva desde el formulario.",
        editorDescription: "Se ubica en General para que luego pueda alimentar tambien otros dominios fuera de Ventas.",
        codeLabel: "Codigo variedad",
        nameLabel: "Nombre variedad",
        externalRefLabel: "Referencia externa",
        externalRefPlaceholder: "Opcional. Ej. codigo de otra fuente.",
        showContactEmail: false,
        storageScopeLabel: "db_general.public",
      }}
    />
  );
}
