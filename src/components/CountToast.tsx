"use client";

import { useEffect } from "react";

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
    <div className="fixed bottom-20 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
      {items.map((item) => (
        <div
          key={item.id}
          className="max-w-lg rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg"
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
