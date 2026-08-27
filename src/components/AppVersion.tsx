import { APP_VERSION } from "@/lib/app-version";
import { cn } from "@/lib/utils";

export function AppVersion({ className }: { className?: string }) {
  return (
    <span
      className={cn("tabular-nums text-[11px] text-muted-foreground", className)}
      title={`เวอร์ชันแอป ${APP_VERSION}`}
    >
      v{APP_VERSION}
    </span>
  );
}
