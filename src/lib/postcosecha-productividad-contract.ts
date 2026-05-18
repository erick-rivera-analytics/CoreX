export type PostharvestProductivityFilters = {
  year: string;
  month: string;
  area: string;
  pathPost: string;
  finalDestination: string;
  variety: string;
  dateFrom: string;
  dateTo: string;
};

export type PostharvestProductivityFilterOptions = {
  years: string[];
  months: string[];
  areas: string[];
  paths: string[];
  finalDestinations: string[];
  varieties: string[];
};

export type PostharvestProductivityRow = {
  year: number | null;
  month: number | null;
  isoWeekId: string;
  postDate: string;
  pathPost: string;
  finalDestination: string;
  varietyCanon: string;
  weightKg: number;
  boxes10: number;
  hoursCls: number;
  hoursSb: number;
  hoursEmp: number;
  totalHours: number;
  hoursPerBoxTotal: number | null;
  hoursPerBoxCls: number | null;
  hoursPerBoxSb: number | null;
  hoursPerBoxEmp: number | null;
};

export type PostharvestProductivitySummary = {
  rowCount: number;
  postDateCount: number;
  totalWeightKg: number;
  totalBoxes10: number;
  totalHours: number;
  totalHoursCls: number;
  totalHoursSb: number;
  totalHoursEmp: number;
  weightedHoursPerBox: number | null;
};

export type PostharvestProductivityDashboardData = {
  generatedAt: string;
  filters: PostharvestProductivityFilters;
  options: PostharvestProductivityFilterOptions;
  rows: PostharvestProductivityRow[];
  summary: PostharvestProductivitySummary;
};

export type PostharvestProductivityActivityDetailFilters = PostharvestProductivityFilters & {
  yearScope: string;
  monthScope: string;
  isoWeekId: string;
  areaScope: string;
  pathPostScope: string;
  finalDestinationScope: string;
  varietyScope: string;
};

export type PostharvestProductivityActivityDetailRow = {
  costArea: string;
  subCostCenter: string;
  activityName: string;
  hoursCls: number;
  hoursSb: number;
  hoursEmp: number;
  totalHours: number;
  hoursPerBoxCls: number | null;
  hoursPerBoxSb: number | null;
  hoursPerBoxEmp: number | null;
  hoursPerBoxTotal: number | null;
};

export type PostharvestProductivityActivityDetailData = {
  filters: PostharvestProductivityActivityDetailFilters;
  rows: PostharvestProductivityActivityDetailRow[];
};

export const defaultPostharvestProductivityFilters: PostharvestProductivityFilters = {
  year: "all",
  month: "all",
  area: "all",
  pathPost: "all",
  finalDestination: "all",
  variety: "all",
  dateFrom: "",
  dateTo: "",
};
