"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

export type CountToastItem = {
  id: string;
  message: string;
};

interface CountToastProps {
  items: CountToastItem[];
  onDismiss: (id: string) => void;
}

export function CountToast({ items, onDismiss }: CountToastProps) {
  useEffect(() => {
    if (!items.length) return;
    const timers = items.map((item) =>
      setTimeout(() => onDismiss(item.id), 5000),
    );
    return () => timers.forEach(clearTimeout);
  }, [items, onDismiss]);

  if (!items.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-20 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "max-w-lg rounded-lg border bg-foreground px-4 py-3 text-sm text-background shadow-lg",
          )}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
