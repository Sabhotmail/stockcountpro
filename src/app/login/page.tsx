"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppVersion } from "@/components/AppVersion";
import { getHomePathForRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types/user";

function loginErrorMessage(status: number, serverError?: string): string {
  if (status === 429) return "ลองเข้าสู่ระบบใหม่ในอีกสักครู่";
  if (status === 401) return "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
  if (status === 400) return serverError || "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน";
  if (status === 404) return "ไม่พบบริการเข้าสู่ระบบ — ลองรีเฟรชหน้านี้";
  return serverError || "เข้าสู่ระบบไม่สำเร็จ";
}

const fieldClass =
  "min-h-12 border-background/25 bg-background/8 text-base text-background placeholder:text-background/35 md:text-base focus-visible:border-background focus-visible:ring-background/25";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const trimmedUsername = username.trim();

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: trimmedUsername, password }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(loginErrorMessage(res.status));
      }

      const data = (await res.json()) as {
        error?: string;
        user?: { role: UserRole };
      };
      if (!res.ok) {
        throw new Error(loginErrorMessage(res.status, data.error));
      }
      if (!data.user?.role) {
        throw new Error("เข้าสู่ระบบไม่สำเร็จ");
      }

      router.replace(getHomePathForRole(data.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = username.trim().length > 0 && password.length > 0;

  return (
    <div className="relative flex min-h-[calc(100dvh-var(--env-banner-h,0px))] flex-col overflow-hidden bg-foreground text-background">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-[-8%] flex items-center select-none text-[min(48vw,20rem)] font-semibold leading-none text-background/[0.04]"
      >
        SC
      </span>

      <AppVersion className="absolute top-[max(1.25rem,env(safe-area-inset-top))] right-6 z-10 text-background/45 sm:right-8" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-sm">
          <header className="mb-8 text-center">
            <p className="text-[11px] font-medium tracking-[0.18em] text-background/50">
              ระบบตรวจนับสต็อก
            </p>
            <h1 className="mt-4 text-[clamp(2.5rem,8vw,3.75rem)] font-semibold leading-[0.95] tracking-tight">
              StockCount
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-background/60">
              นับบนแท็บเล็ตในคลัง
              <span className="hidden sm:inline"> · ตรวจและอนุมัติบนคอมพิวเตอร์</span>
            </p>
          </header>

          {error && (
            <p className="mb-4 text-center text-sm text-red-300" role="alert">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username" className="text-background/70">
                ชื่อผู้ใช้
              </Label>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                enterKeyHint="next"
                autoFocus
                placeholder="เช่น chm.staff"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                disabled={loading}
                aria-invalid={error ? true : undefined}
                className={fieldClass}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password" className="text-background/70">
                รหัสผ่าน
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  placeholder="รหัสผ่าน"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={loading}
                  aria-invalid={error ? true : undefined}
                  className={cn(fieldClass, "pr-12")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  disabled={loading}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-1.5 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-background/50 transition-colors hover:text-background disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="mt-2 min-h-12 w-full bg-background text-base text-foreground hover:bg-background/90"
              disabled={loading || !canSubmit}
              size="lg"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-foreground/25 border-t-foreground" />
                  กำลังเข้าสู่ระบบ...
                </span>
              ) : (
                "เข้าสู่ระบบ"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
