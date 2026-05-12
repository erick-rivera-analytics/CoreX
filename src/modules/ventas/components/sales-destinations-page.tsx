import { SimpleMasterPage } from "@/modules/domain-masters/components/simple-master-page";
import type { QualitySimpleMasterRecord } from "@/lib/quality-master-types";

export function SalesDestinationsPage({
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
        apiEndpoint: "/api/ventas/administrar-maestros/destinos",
        resourceNameSingular: "Destino",
        resourceNamePlural: "Destinos",
        eyebrow: "Administracion / Maestros por dominio / Ventas / Destinos",
        title: "Destinos",
        subtitle: "Administra el catalogo manual inicial de destinos o procesos de ventas para reclamos. Cada guardado conserva trazabilidad SCD2 en db_commercial.public.",
        searchPlaceholder: "Buscar por codigo, nombre o referencia externa...",
        newButtonLabel: "Nuevo destino",
        saveButtonLabel: "Guardar destino",
        listTitle: "Catalogo de destinos",
        listDescription: "Selecciona un destino para editarlo o registra uno nuevo desde el formulario.",
        editorDescription: "Se deja manual para no mezclar todavia la definicion comercial con la fuente operativa de postcosecha.",
        codeLabel: "Codigo destino",
        nameLabel: "Nombre destino",
        externalRefLabel: "Referencia externa",
        externalRefPlaceholder: "Opcional. Ej. clave heredada o destino operativo.",
        showContactEmail: false,
      }}
    />
  );
}
