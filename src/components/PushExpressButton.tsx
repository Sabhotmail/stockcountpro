"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PushExpressButton({
  documentId,
  className,
  fullWidth,
  variant = "outline",
  size = "sm",
  onPushed,
}: {
  documentId: string;
  className?: string;
  fullWidth?: boolean;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  onPushed?: (message: string) => void;
}) {
  const [pushing, setPushing] = useState(false);

  async function handlePush() {
    const ok = window.confirm(
      "ส่งผลการนับกลับ Express?\nจะส่งเฉพาะรายการที่นับแล้วของเอกสารนี้",
    );
    if (!ok) return;

    setPushing(true);
    try {
      const res = await fetch(
        `/api/count-documents/${documentId}/push-express`,
        {
          method: "POST",
          credentials: "same-origin",
        },
      );
      const data = (await res.json()) as {
        error?: string;
        lineCount?: number;
        locationCode?: string;
        userIdSent?: string;
      };

      if (!res.ok) {
        window.alert(data.error ?? "ส่งกลับ Express ไม่สำเร็จ");
        return;
      }

      const message = `ส่งกลับ Express สำเร็จ · ${data.lineCount ?? 0} รายการ · คลัง ${data.locationCode ?? "—"} · UserID ${data.userIdSent ?? "—"}`;
      onPushed?.(message);
      window.alert(message);
    } catch {
      window.alert("ส่งกลับ Express ไม่สำเร็จ");
    } finally {
      setPushing(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={pushing}
      className={cn(fullWidth && "w-full", className)}
      onClick={(event) => {
        event.stopPropagation();
        void handlePush();
      }}
    >
      {pushing ? "กำลังส่ง Express..." : "ส่งกลับ Express"}
    </Button>
  );
}
