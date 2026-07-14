"use client";

import { CalendarIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { dateKeyToDmy, dmyToDateKey } from "@/lib/datetime";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  value: string;
  onChange: (yyyyMmDd: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  /** Allow clearing the field (empty string). Default true. */
  allowEmpty?: boolean;
};

/**
 * Date field shown as DD/MM/YYYY while storing YYYY-MM-DD.
 * Native type=date always follows browser locale (often MM/DD/YYYY).
 */
export function DateInputDMY({
  id,
  value,
  onChange,
  disabled,
  className,
  placeholder = "DD/MM/YYYY",
  allowEmpty = true,
}: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const pickerRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => dateKeyToDmy(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(dateKeyToDmy(value));
    setInvalid(false);
  }, [value]);

  function commitText(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (allowEmpty) {
        setInvalid(false);
        setText("");
        onChange("");
        return;
      }
      setText(dateKeyToDmy(value));
      setInvalid(false);
      return;
    }

    const key = dmyToDateKey(trimmed);
    if (!key) {
      setInvalid(true);
      setText(dateKeyToDmy(value));
      return;
    }

    setInvalid(false);
    setText(dateKeyToDmy(key));
    onChange(key);
  }

  function openPicker() {
    const el = pickerRef.current;
    if (!el || disabled) return;
    try {
      el.showPicker?.();
    } catch {
      el.click();
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        value={text}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          setText(event.target.value);
          setInvalid(false);
        }}
        onBlur={() => commitText(text)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitText(text);
            (event.target as HTMLInputElement).blur();
          }
        }}
        className="pr-9"
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label="เปิดปฏิทิน"
        onClick={openPicker}
        className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <CalendarIcon className="size-3.5" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        value={value || ""}
        onChange={(event) => {
          const next = event.target.value;
          setInvalid(false);
          setText(dateKeyToDmy(next));
          onChange(next);
        }}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
    </div>
  );
}
