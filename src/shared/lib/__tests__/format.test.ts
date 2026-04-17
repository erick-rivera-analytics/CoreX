import { describe, expect, it } from "vitest";

import {
  formatDateSlash,
  formatDate,
  formatDateLocal,
  formatDateTime,
  formatDecimal,
  formatFlexibleNumber,
  formatInteger,
  parseDateOnly,
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

  it("parses and formats date-only strings without timezone drift", () => {
    const parsed = parseDateOnly("2026-04-17");

    expect(parsed).not.toBeNull();
    expect(formatDateLocal("2026-04-17")).toBe("2026-04-17");
    expect(formatDate("2026-04-17")).toContain("2026");
    expect(formatDateLocal(parsed)).toBe("2026-04-17");
  });

  it("preserves time information for ISO datetimes", () => {
    const source = "2026-04-16T15:30:00.000Z";
    const parsed = parseDateOnly(source);

    expect(parsed).not.toBeNull();
    expect(parsed?.getTime()).toBe(new Date(source).getTime());
  });

  it("formats timezone-aware date times without non-breaking spaces", () => {
    const formatted = formatDateTime("2026-04-16T15:30:00.000Z", "America/Guayaquil");

    expect(formatted).toContain("2026");
    expect(formatted).not.toMatch(/[\u00A0\u202F]/);
  });
});
