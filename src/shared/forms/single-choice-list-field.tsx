"use client";

type SingleChoiceListFieldProps = {
  id: string;
  label: string;
  value: string;
  options: string[];
  displayValue: (value: string) => string;
  onChange: (value: string) => void;
  className?: string;
};

export function SingleChoiceListField({
  id,
  label,
  value,
  options,
  displayValue,
  onChange,
  className,
}: SingleChoiceListFieldProps) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor={id}>
          {label}
        </label>
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
          >
            Limpiar
          </button>
        ) : null}
      </div>
      <div
        id={id}
        role="radiogroup"
        aria-label={label}
        className="max-h-[360px] overflow-y-auto rounded-[22px] border border-slate-200 bg-white/80 p-2 shadow-sm"
      >
        <div className="grid gap-2 md:grid-cols-2">
          {options.map((option, index) => {
            const checked = value === option;

            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => onChange(option)}
                className={[
                  "flex min-h-11 items-center gap-3 rounded-2xl border px-3 py-2 text-left text-sm transition",
                  checked
                    ? "border-emerald-400 bg-emerald-50 text-emerald-950 shadow-sm"
                    : "border-transparent bg-slate-50 text-slate-700 hover:border-slate-200 hover:bg-white",
                ].join(" ")}
              >
                <span
                  className={[
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold",
                    checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-slate-400",
                  ].join(" ")}
                >
                  {checked ? "" : index + 1}
                </span>
                <span className="leading-snug">{displayValue(option)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
