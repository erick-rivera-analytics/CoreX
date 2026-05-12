import { SimpleMasterPage } from "@/modules/domain-masters/components/simple-master-page";
import type { QualitySimpleMasterRecord } from "@/lib/quality-master-types";

export function SalesCustomersPage({
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
        apiEndpoint: "/api/ventas/administrar-maestros/clientes",
        resourceNameSingular: "Cliente",
        resourceNamePlural: "Clientes",
        eyebrow: "Administracion / Maestros por dominio / Ventas / Clientes",
        title: "Clientes",
        subtitle: "Administra el maestro comercial de clientes para reclamos y creditos. Cada guardado conserva trazabilidad SCD2 en db_commercial.public.",
        searchPlaceholder: "Buscar por codigo, nombre o referencia externa...",
        newButtonLabel: "Nuevo cliente",
        saveButtonLabel: "Guardar cliente",
        listTitle: "Catalogo de clientes",
        listDescription: "Selecciona un cliente para editarlo o registra uno nuevo desde el formulario.",
        editorDescription: "Este catalogo alimenta las notas y alertas del flujo de reclamos.",
        codeLabel: "Codigo cliente",
        nameLabel: "Nombre cliente",
        externalRefLabel: "Referencia externa",
        externalRefPlaceholder: "Opcional. Ej. codigo heredado o ERP.",
        showContactEmail: false,
      }}
    />
  );
}
