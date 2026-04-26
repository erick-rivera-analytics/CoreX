"use client";

export { MetricTile } from "@/shared/data-display/metric-tile";
export { DateField } from "@/shared/filters/date-field";
export { WeekField } from "@/shared/filters/week-field";
export { EmptyState } from "@/shared/data-display/empty-state";

export {
  TALENTO_WEEKS,
  TALENTO_WEEK_OPTIONS,
  BAR_COLORS,
  buildTalentoQueryString,
  groupTalentoRows,
  type TalentoGroup,
  type CompositionRow,
} from "@/modules/talento-humano/components/talento-view-utils";
export {
  buildCompositionRows,
  CompositionTable,
} from "@/modules/talento-humano/components/composition-table";
export {
  TalentoFilterToolbar,
} from "@/modules/talento-humano/components/talento-filter-toolbar";
export {
  DistributionChart,
  DistributionSummaryCard,
  DonutChart,
} from "@/modules/talento-humano/components/talento-charts";
export { PersonListModal } from "@/modules/talento-humano/components/person-list-modal";
