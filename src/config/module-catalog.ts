import type { LucideIcon } from "lucide-react";
import {
  Activity,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Clock,
  DatabaseZap,
  GitCompareArrows,
  Map as MapIcon,
  PieChart,
  Scale,
  TrendingDown,
  UserCircle2,
  UserCog,
  BriefcaseBusiness,
} from "lucide-react";

export type ModuleStatus = "active" | "hidden" | "internal";
export type ModuleNavigationGroup = "Dashboard" | "Gestion" | "Administracion" | "Personal";
export type ModuleAccessSection = "Dashboard / Indicadores" | "Gestion" | "Administracion" | "Personal";

export type CatalogModule = {
  key: string;
  label: string;
  title: string;
  eyebrow: string;
  summary: string;
  href: string;
  icon: LucideIcon;
  navigationGroup: ModuleNavigationGroup;
  trail: string[];
  accessSection: ModuleAccessSection;
  status: ModuleStatus;
  mobileVisible?: boolean;
};

export const STARTER_NAME = "CoreX";
export const STARTER_SUBTITLE = "Centro de Inteligencia Empresarial";

export const MODULE_CATALOG: CatalogModule[] = [
  {
    key: "campo-mapa",
    label: "Mapa",
    title: "Mapa",
    eyebrow: "Dashboard / Indicadores / Campo",
    summary: "Historial espacial de bloques con apertura por bloque padre.",
    href: "/dashboard/campo",
    icon: MapIcon,
    navigationGroup: "Dashboard",
    trail: ["Indicadores", "Campo"],
    accessSection: "Dashboard / Indicadores",
    status: "active",
  },
  {
    key: "campo-fenograma",
    label: "Fenograma",
    title: "Fenograma",
    eyebrow: "Dashboard / Indicadores / Campo",
    summary: "Pivot semanal de corte y desvio por ciclo.",
    href: "/dashboard/fenograma",
    icon: CalendarRange,
    navigationGroup: "Dashboard",
    trail: ["Indicadores", "Campo"],
    accessSection: "Dashboard / Indicadores",
    status: "active",
  },
  {
    key: "campo-mortality",
    label: "Mortandades",
    title: "Mortandades",
    eyebrow: "Dashboard / Indicadores / Campo",
    summary: "Mortandad por ciclo con curva ponderada y apertura al historial del bloque.",
    href: "/dashboard/mortality",
    icon: Activity,
    navigationGroup: "Dashboard",
    trail: ["Indicadores", "Campo"],
    accessSection: "Dashboard / Indicadores",
    status: "active",
  },
  {
    key: "campo-comparacion",
    label: "Comparacion",
    title: "Comparacion",
    eyebrow: "Dashboard / Indicadores / Campo",
    summary: "Cruce uno a uno entre ciclos activos.",
    href: "/dashboard/comparacion",
    icon: GitCompareArrows,
    navigationGroup: "Dashboard",
    trail: ["Indicadores", "Campo"],
    accessSection: "Dashboard / Indicadores",
    status: "active",
  },
  {
    key: "campo-productividad",
    label: "Productividad",
    title: "Productividad",
    eyebrow: "Dashboard / Indicadores / Campo",
    summary: "Productividad de mano de obra: horas por caja por ciclo y etapa operativa.",
    href: "/dashboard/productividad",
    icon: Clock,
    navigationGroup: "Dashboard",
    trail: ["Indicadores", "Campo"],
    accessSection: "Dashboard / Indicadores",
    status: "active",
  },
  {
    key: "postcosecha-balanzas",
    label: "Balanzas",
    title: "Indicadores Balanzas",
    eyebrow: "Dashboard / Indicadores / Postcosecha",
    summary: "Apertura B1 vs B1C sobre el flujo de postcosecha para peso y tallos.",
    href: "/dashboard/postcosecha/balanzas",
    icon: Scale,
    navigationGroup: "Dashboard",
    trail: ["Indicadores", "Postcosecha"],
    accessSection: "Dashboard / Indicadores",
    status: "active",
  },
  {
    key: "talento-composicion",
    label: "Composicion laboral",
    title: "Composicion laboral",
    eyebrow: "Dashboard / Indicadores / Talento Humano",
    summary: "Distribucion del personal activo por area, cargo, empresa y clasificacion.",
    href: "/dashboard/talento-humano/composicion-laboral",
    icon: PieChart,
    navigationGroup: "Dashboard",
    trail: ["Indicadores", "Talento Humano"],
    accessSection: "Dashboard / Indicadores",
    status: "active",
    mobileVisible: false,
  },
  {
    key: "talento-demografia",
    label: "Demografia personal",
    title: "Demografia personal",
    eyebrow: "Dashboard / Indicadores / Talento Humano",
    summary: "Distribucion demografica del personal activo por genero, estado civil, ciudad y contrato.",
    href: "/dashboard/talento-humano/demografia-personal",
    icon: UserCircle2,
    navigationGroup: "Dashboard",
    trail: ["Indicadores", "Talento Humano"],
    accessSection: "Dashboard / Indicadores",
    status: "active",
    mobileVisible: false,
  },
  {
    key: "talento-rotacion",
    label: "Rotacion laboral",
    title: "Rotacion laboral",
    eyebrow: "Dashboard / Indicadores / Talento Humano",
    summary: "Ingresos, salidas y tasa de rotacion por semana.",
    href: "/dashboard/talento-humano/rotacion-laboral",
    icon: TrendingDown,
    navigationGroup: "Dashboard",
    trail: ["Indicadores", "Talento Humano"],
    accessSection: "Dashboard / Indicadores",
    status: "active",
    mobileVisible: false,
  },
  {
    key: "gestion-programaciones",
    label: "Programaciones",
    title: "Programaciones",
    eyebrow: "Gestion / Campo / Planificacion",
    summary: "Calendario de programaciones de campo: plantas muertas, iluminacion y riego.",
    href: "/dashboard/programaciones",
    icon: CalendarClock,
    navigationGroup: "Gestion",
    trail: ["Campo", "Planificacion"],
    accessSection: "Gestion",
    status: "active",
  },
  {
    key: "campo-dead-plants-reseed",
    label: "Plantas muertas y resiembras",
    title: "Plantas muertas y resiembras",
    eyebrow: "Gestion / Campo / Registros",
    summary: "Registro operativo de plantas muertas y resiembras por bloque, fecha y cama.",
    href: "/dashboard/dead-plants-reseed",
    icon: ClipboardList,
    navigationGroup: "Gestion",
    trail: ["Campo", "Registros"],
    accessSection: "Gestion",
    status: "active",
  },
  {
    key: "personal-mi-cuenta",
    label: "Mi cuenta",
    title: "Mi cuenta",
    eyebrow: "Personal",
    summary: "Perfil local, preferencias visuales, ruta por defecto y notificaciones personales.",
    href: "/dashboard/mi-cuenta",
    icon: UserCircle2,
    navigationGroup: "Personal",
    trail: [],
    accessSection: "Personal",
    status: "active",
  },
  {
    key: "personal-mi-trabajo",
    label: "Workspace",
    title: "Workspace",
    eyebrow: "Personal",
    summary: "Tareas, eventos, calendario, agenda y recordatorios del usuario autenticado.",
    href: "/dashboard/mi-trabajo",
    icon: BriefcaseBusiness,
    navigationGroup: "Personal",
    trail: [],
    accessSection: "Personal",
    status: "active",
  },
  {
    key: "postcosecha-registros",
    label: "Registros",
    title: "Registros",
    eyebrow: "Gestion / Postcosecha / Registros",
    summary: "Ruta reservada para registros operativos de postcosecha.",
    href: "/dashboard/postcosecha/registros",
    icon: ClipboardList,
    navigationGroup: "Gestion",
    trail: ["Postcosecha"],
    accessSection: "Gestion",
    status: "hidden",
    mobileVisible: false,
  },
  {
    key: "postcosecha-skus",
    label: "Administrar SKU's",
    title: "Administrar SKU's",
    eyebrow: "Gestion / Postcosecha / Administrar Maestros",
    summary: "Maestro transaccional de SKU para alimentar el solver de clasificacion en blanco.",
    href: "/dashboard/postcosecha/administrar-maestros/skus",
    icon: DatabaseZap,
    navigationGroup: "Gestion",
    trail: ["Postcosecha", "Administrar Maestros"],
    accessSection: "Gestion",
    status: "active",
    mobileVisible: false,
  },
  {
    key: "postcosecha-programaciones",
    label: "Programaciones",
    title: "Programaciones",
    eyebrow: "Gestion / Postcosecha / Planificacion",
    summary: "Ruta reservada para la programacion operativa de postcosecha.",
    href: "/dashboard/postcosecha/planificacion/programaciones",
    icon: CalendarClock,
    navigationGroup: "Gestion",
    trail: ["Postcosecha", "Planificacion"],
    accessSection: "Gestion",
    status: "hidden",
    mobileVisible: false,
  },
  {
    key: "postcosecha-plan-trabajo",
    label: "Plan de trabajo",
    title: "Plan de trabajo",
    eyebrow: "Gestion / Postcosecha / Planificacion",
    summary: "Ruta reservada para consolidar el plan de trabajo de postcosecha.",
    href: "/dashboard/postcosecha/planificacion/plan-de-trabajo",
    icon: CalendarDays,
    navigationGroup: "Gestion",
    trail: ["Postcosecha", "Planificacion"],
    accessSection: "Gestion",
    status: "hidden",
    mobileVisible: false,
  },
  {
    key: "postcosecha-clasificacion",
    label: "Clasificacion en blanco",
    title: "Clasificacion en blanco",
    eyebrow: "Gestion / Postcosecha / Planificacion / Solver",
    summary: "Solver operativo para clasificacion en blanco con datos del maestro SKU.",
    href: "/dashboard/postcosecha/planificacion/solver/clasificacion-en-blanco",
    icon: Scale,
    navigationGroup: "Gestion",
    trail: ["Postcosecha", "Planificacion", "Solver"],
    accessSection: "Gestion",
    status: "active",
    mobileVisible: false,
  },
  {
    key: "admin-usuarios",
    label: "Usuarios",
    title: "Usuarios",
    eyebrow: "Administracion / Seguridad",
    summary: "Gestion de usuarios, roles y permisos por recurso.",
    href: "/dashboard/admin/seguridad/usuarios",
    icon: UserCog,
    navigationGroup: "Administracion",
    trail: ["Seguridad"],
    accessSection: "Administracion",
    status: "active",
    mobileVisible: false,
  },
];

export const ALL_MANAGED_MODULES = MODULE_CATALOG.filter((catalogEntry) => catalogEntry.status !== "internal");
export const ACTIVE_MODULES = MODULE_CATALOG.filter((catalogEntry) => catalogEntry.status === "active");
export const ACTIVE_MODULE_MAP = new globalThis.Map(ACTIVE_MODULES.map((catalogEntry) => [catalogEntry.href, catalogEntry]));
export const MANAGED_MODULE_MAP = new globalThis.Map(ALL_MANAGED_MODULES.map((catalogEntry) => [catalogEntry.href, catalogEntry]));
export const ACTIVE_RESOURCE_KEYS = new Set(ACTIVE_MODULES.map((catalogEntry) => catalogEntry.href));
export const ALL_MANAGED_RESOURCE_KEYS = new Set(ALL_MANAGED_MODULES.map((catalogEntry) => catalogEntry.href));

export function filterModulesByAccess<T extends { href: string }>(
  modules: T[],
  allowedResources: string[],
  isSuperadmin: boolean,
) {
  return modules.filter((catalogEntry) => isSuperadmin || allowedResources.includes(catalogEntry.href));
}

export function findModuleByPath(pathname: string) {
  return MODULE_CATALOG.find(
    (catalogEntry) => pathname === catalogEntry.href || pathname.startsWith(`${catalogEntry.href}/`),
  ) ?? null;
}
