"use client";

import type { CycleLaborPersonDetailPayload } from "@/lib/fenograma";

type Profile = CycleLaborPersonDetailPayload["profile"];

function InfoField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/18 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/65">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function PersonHoursInfoSection({ profile }: { profile: Profile | null }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/60 bg-muted/14 px-5 py-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/65">
          Datos personales
        </p>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <InfoField label="Nombre completo" value={profile?.fullName ?? "Sin dato"} />
          <InfoField label="Cedula / ID" value={profile?.nationalId ?? "Sin dato"} />
          <InfoField label="Genero" value={profile?.gender ?? "Sin dato"} />
          <InfoField label="Estado civil" value={profile?.maritalStatus ?? "Sin dato"} />
          <InfoField label="Fecha de nacimiento" value={profile?.birthDate ?? "Sin dato"} />
          <InfoField label="Lugar de nacimiento" value={profile?.birthPlace ?? "Sin dato"} />
          <InfoField label="Nacionalidad" value={profile?.nationality ?? "Sin dato"} />
          <InfoField label="Nivel educativo" value={profile?.educationTitle ?? "Sin dato"} />
          <InfoField label="Hijos" value={profile?.childrenCount == null ? "Sin dato" : String(profile.childrenCount)} />
          <InfoField label="Dependientes" value={profile?.dependentsCount == null ? "Sin dato" : String(profile.dependentsCount)} />
          <InfoField label="Discapacidad" value={profile?.disabledFlag == null ? "Sin dato" : profile.disabledFlag ? "Si" : "No"} />
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-muted/14 px-5 py-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/65">
          Datos laborales
        </p>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <InfoField label="Cargo" value={profile?.jobTitle ?? "Sin dato"} />
          <InfoField label="Tipo de empleado" value={profile?.employeeType ?? "Sin dato"} />
          <InfoField label="Tipo de contrato" value={profile?.contractType ?? "Sin dato"} />
          <InfoField label="Clasificacion de cargo" value={profile?.jobClassificationCode ?? "Sin dato"} />
          <InfoField label="Empleador" value={profile?.employerName ?? "Sin dato"} />
          <InfoField label="Codigo de finca" value={profile?.farmCode ?? "Sin dato"} />
          <InfoField label="Trabajador asociado" value={profile?.associatedWorkerName ?? "Sin dato"} />
          <InfoField label="Pago por rendimiento" value={profile?.performancePayApplicable == null ? "Sin dato" : profile.performancePayApplicable ? "Si" : "No"} />
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-muted/14 px-5 py-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/65">
          Contacto
        </p>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <InfoField label="Email" value={profile?.email ?? "Sin dato"} />
          <InfoField label="Telefono" value={profile?.phoneNumber ?? "Sin dato"} />
          <InfoField label="Direccion" value={profile?.address ?? "Sin dato"} />
          <InfoField label="Ciudad" value={profile?.city ?? "Sin dato"} />
          <InfoField label="Parroquia" value={profile?.parish ?? "Sin dato"} />
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-muted/14 px-5 py-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/65">
          Acceso a la empresa
        </p>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <InfoField label="Ultima entrada" value={profile?.lastEntryDate ?? "Sin dato"} />
          <InfoField label="Ultima salida" value={profile?.lastExitDate ?? "Sin dato"} />
        </div>
      </div>
    </div>
  );
}
