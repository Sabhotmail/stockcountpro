"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COUNT_QTY_NOT_COUNTED } from "@/lib/count-qty";
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

function formatQtyValue(value: number | null): string {
  return value === null ? "" : String(value);
}

function parseQtyInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) return null;
  if (parsed === COUNT_QTY_NOT_COUNTED || parsed >= 0) return parsed;
  return null;
}

function isDraftAllowed(raw: string): boolean {
  if (!/^-?\d*$/.test(raw)) return false;
  if (raw === "" || raw === "-") return true;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return false;
  return parsed === COUNT_QTY_NOT_COUNTED || parsed >= 0;
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
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => formatQtyValue(value));

  useEffect(() => {
    if (!focused) {
      setDraft(formatQtyValue(value));
    }
  }, [focused, value]);

  const commitDraft = () => {
    const committed = parseQtyInput(draft);
    const previous = value;

    setFocused(false);

    // Commit qty before blur/release so parent can renew the lock
    // before any deferred unlock runs.
    if (committed !== previous) {
      onChange(committed);
    } else {
      setDraft(formatQtyValue(value));
    }

    onBlur?.();
  };

  const handleFocus = () => {
    setFocused(true);
    setDraft(formatQtyValue(value));
    onFocus?.();
  };

  const handleChange = (raw: string) => {
    if (!isDraftAllowed(raw)) return;
    setDraft(raw);
  };

  const inputProps = {
    type: "number" as const,
    min: COUNT_QTY_NOT_COUNTED,
    step: 1,
    inputMode: "numeric" as const,
    disabled,
    value: focused ? draft : formatQtyValue(value),
    placeholder: "—",
    onFocus: handleFocus,
    onBlur: commitDraft,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      }
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      handleChange(e.target.value),
  };

  if (compact) {
    return (
      <Label className="flex items-center gap-2 font-normal">
        <Input
          {...inputProps}
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
        {...inputProps}
        className={cn("h-14 text-xl font-semibold")}
      />
    </div>
  );
}
