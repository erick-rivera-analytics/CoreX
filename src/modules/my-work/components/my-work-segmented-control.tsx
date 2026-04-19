"use client";

import { cn } from "@/lib/utils";
import { MY_WORK_SEGMENT_OPTIONS, type MyWorkSegment } from "@/modules/my-work/server/types";

export function MyWorkSegmentedControl({
  value,
  onChange,
}: {
  value: MyWorkSegment;
  onChange: (value: MyWorkSegment) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {MY_WORK_SEGMENT_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
            value === option.value
              ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "border-border bg-background text-muted-foreground hover:bg-muted/70 hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
