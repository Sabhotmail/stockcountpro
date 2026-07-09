interface QtyInputProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  compact?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function QtyInput({
  label,
  value,
  onChange,
  disabled,
  compact,
  onFocus,
  onBlur,
}: QtyInputProps) {
  if (compact) {
    return (
      <label className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          disabled={disabled}
          value={value ?? ""}
          placeholder="—"
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange(null);
              return;
            }
            const parsed = Number.parseInt(raw, 10);
            if (!Number.isNaN(parsed)) {
              onChange(parsed);
            }
          }}
          className="h-10 w-20 rounded-lg border border-slate-200 bg-white px-2 text-center text-base font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
        />
        <span className="min-w-10 shrink-0 text-sm font-medium text-slate-600">
          {label}
        </span>
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        disabled={disabled}
        value={value ?? ""}
        placeholder="—"
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(null);
            return;
          }
          const parsed = Number.parseInt(raw, 10);
          if (!Number.isNaN(parsed)) {
            onChange(parsed);
          }
        }}
        className="h-14 rounded-xl border border-slate-200 bg-white px-4 text-xl font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
      />
    </label>
  );
}
