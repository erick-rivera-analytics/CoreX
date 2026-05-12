import { SimpleMasterPage } from "@/modules/domain-masters/components/simple-master-page";
import type { QualitySimpleMasterRecord } from "@/lib/quality-master-types";

export function SalesAccountExecutivesPage({
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
        apiEndpoint: "/api/ventas/administrar-maestros/ejecutivos-cuenta",
        resourceNameSingular: "Ejecutivo de cuenta",
        resourceNamePlural: "Ejecutivos",
        eyebrow: "Administracion / Maestros por dominio / Ventas / Ejecutivos de cuenta",
        title: "Ejecutivos de cuenta",
        subtitle: "Administra el maestro de ejecutivos de cuenta. Por ahora se maneja con identificador propio y deja abierta la futura vinculacion con codigo de personal. Cada guardado conserva trazabilidad SCD2 en db_commercial.public.",
        searchPlaceholder: "Buscar por codigo, nombre o correo...",
        newButtonLabel: "Nuevo ejecutivo",
        saveButtonLabel: "Guardar ejecutivo",
        listTitle: "Catalogo de ejecutivos",
        listDescription: "Selecciona un ejecutivo para editarlo o registra uno nuevo desde el formulario.",
        editorDescription: "Este maestro evita que las notas se creen con ejecutivos libres sin trazabilidad.",
        codeLabel: "Codigo ejecutivo",
        nameLabel: "Nombre ejecutivo",
        externalRefLabel: "Codigo personal futuro",
        externalRefPlaceholder: "Opcional. Se puede enlazar despues con personal.",
        showContactEmail: true,
        contactEmailLabel: "Correo ejecutivo",
        contactEmailPlaceholder: "Opcional. Ej. nombre@empresa.com",
      }}
    />
  );
}
