import { describe, expect, it } from "vitest";

import {
  formatDateSlash,
  formatDateTime,
  formatDecimal,
  formatFlexibleNumber,
  formatInteger,
  formatPercent,
} from "@/shared/lib/format";

describe("shared formatters", () => {
  it("uses the canonical empty fallback", () => {
    expect(formatInteger(null)).toBe("-");
    expect(formatDecimal(undefined)).toBe("-");
    expect(formatFlexibleNumber("")).toBe("-");
    expect(formatPercent(null)).toBe("-");
  });

  it("formats slash dates for domain tables", () => {
    expect(formatDateSlash("2026-04-16")).toBe("16/04/2026");
    expect(formatDateSlash("2026-04-16T12:30:00.000Z")).toBe("16/04/2026");
    expect(formatDateSlash("9999-12-31")).toBe("-");
  });

  it("formats timezone-aware date times without non-breaking spaces", () => {
    const formatted = formatDateTime("2026-04-16T15:30:00.000Z", "America/Guayaquil");

    expect(formatted).toContain("2026");
    expect(formatted).not.toMatch(/[\u00A0\u202F]/);
  });
});
