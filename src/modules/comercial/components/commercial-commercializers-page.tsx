import { SimpleMasterPage } from "@/modules/domain-masters/components/simple-master-page";
import type { QualitySimpleMasterRecord } from "@/lib/quality-master-types";

export function CommercialCommercializersPage({
  initialData,
  initialError,
}: {
  initialData: QualitySimpleMasterRecord[];
  initialError?: string | null;
}) {
  return (
    <SimpleMasterPage
      initialData={initialData}
      initialError={initialError}
      config={{
        apiEndpoint: "/api/comercial/administrar-maestros/comercializadoras",
        resourceNameSingular: "Comercializadora",
        resourceNamePlural: "Comercializadoras",
        eyebrow: "Administracion / Maestros por dominio / Comercial / Comercializadoras",
        title: "Comercializadoras",
        subtitle: "Administra el maestro de comercializadoras usado por notas de credito y alertas de reclamo. Cada guardado conserva trazabilidad SCD2 en db_commercial.public.",
        searchPlaceholder: "Buscar por codigo, nombre o referencia externa...",
        newButtonLabel: "Nueva comercializadora",
        saveButtonLabel: "Guardar comercializadora",
        listTitle: "Catalogo de comercializadoras",
        listDescription: "Selecciona una comercializadora para editarla o registra una nueva desde el formulario.",
        editorDescription: "Se mantiene separado de clientes porque ambos campos existen en el flujo operativo.",
        codeLabel: "Codigo comercializadora",
        nameLabel: "Nombre comercializadora",
        externalRefLabel: "Referencia externa",
        externalRefPlaceholder: "Opcional. Ej. codigo heredado o ERP.",
        showContactEmail: false,
        storageScopeLabel: "db_commercial.public",
      }}
    />
  );
}
