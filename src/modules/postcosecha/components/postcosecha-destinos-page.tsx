import { SimpleMasterPage } from "@/modules/domain-masters/components/simple-master-page";
import type { PostharvestDestinationRecord } from "@/lib/postcosecha-destination-types";

export function PostcosechaDestinosPage({
  initialData,
  initialError,
}: {
  initialData: PostharvestDestinationRecord[];
  initialError?: string | null;
}) {
  return (
    <SimpleMasterPage
      initialData={initialData}
      initialError={initialError}
      config={{
        apiEndpoint: "/api/postcosecha/administrar-maestros/destinos",
        resourceNameSingular: "Destino",
        resourceNamePlural: "Destinos",
        eyebrow: "Administracion / Maestros por dominio / Postcosecha / Destinos",
        title: "Destinos",
        subtitle: "Administra el maestro de destinos de postcosecha que en reclamos se mostrara visualmente como Proceso. Debe contemplar la opcion NA / No aplica. Cada guardado conserva trazabilidad SCD2 en db_postharvest.public.",
        searchPlaceholder: "Buscar por codigo, nombre o referencia externa...",
        newButtonLabel: "Nuevo destino",
        saveButtonLabel: "Guardar destino",
        listTitle: "Catalogo de destinos",
        listDescription: "Selecciona un destino para editarlo o registra uno nuevo desde el formulario.",
        editorDescription: "En Comercial / Reclamos este maestro alimentara el campo visual Proceso.",
        codeLabel: "Codigo destino",
        nameLabel: "Nombre destino",
        externalRefLabel: "Referencia externa",
        externalRefPlaceholder: "Opcional. Ej. destino operativo o clave heredada.",
        showContactEmail: false,
        storageScopeLabel: "db_postharvest.public",
      }}
    />
  );
}
