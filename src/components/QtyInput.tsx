import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
  const handleChange = (raw: string) => {
    if (raw === "") {
      onChange(null);
      return;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed)) {
      onChange(parsed);
    }
  };

  if (compact) {
    return (
      <Label className="flex items-center gap-2 font-normal">
        <Input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          disabled={disabled}
          value={value ?? ""}
          placeholder="—"
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(e) => handleChange(e.target.value)}
          className="h-10 w-20 text-center text-base font-semibold"
        />
        <span className="min-w-10 shrink-0 text-sm font-medium text-muted-foreground">
          {label}
        </span>
      </Label>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        disabled={disabled}
        value={value ?? ""}
        placeholder="—"
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(e) => handleChange(e.target.value)}
        className={cn("h-14 text-xl font-semibold")}
      />
    </div>
  );
}
