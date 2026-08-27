"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getHomePathForRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types/user";
import { AppVersion } from "@/components/AppVersion";

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

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          res.status === 404
            ? "ไม่พบบริการเข้าสู่ระบบ — ลองรีสตาร์ทเซิร์ฟเวอร์ (npm run dev)"
            : "เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ — ลองรีเฟรชหรือรีสตาร์ทเซิร์ฟเวอร์",
        );
      }

      const data = (await res.json()) as {
        error?: string;
        user?: { role: UserRole };
      };
      if (!res.ok) {
        throw new Error(data.error ?? "เข้าสู่ระบบไม่สำเร็จ");
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

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_28rem]">
      <aside className="hidden flex-col justify-between border-r px-12 py-12 lg:flex">
        <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground">
          ระบบตรวจนับสต็อก
        </p>
        <div>
          <p className="text-5xl font-semibold tracking-tight">StockCount</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            นับบนแท็บเล็ตในคลัง ตรวจและอนุมัติบนคอมพิวเตอร์
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          ใช้บัญชีที่ได้รับจากองค์กร · <AppVersion />
        </p>
      </aside>

      <div className="flex flex-col justify-center px-4 py-10 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8">
        <div className="mx-auto w-full max-w-sm">
          <header className="mb-8 lg:hidden">
            <p className="flex items-baseline gap-2 text-[11px] font-medium tracking-[0.12em] text-muted-foreground">
              <span>StockCount Pro</span>
              <AppVersion className="font-normal tracking-normal" />
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              เข้าสู่ระบบ
            </h1>
          </header>
          <h1 className="mb-8 hidden text-2xl font-semibold tracking-tight lg:block">
            เข้าสู่ระบบ
          </h1>

          {error && (
            <Alert variant="destructive" className="mb-5">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid gap-2">
              <Label htmlFor="username">ชื่อผู้ใช้</Label>
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
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                disabled={loading}
                className="min-h-11 text-base"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={loading}
                  className="min-h-11 pr-11 text-base"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  disabled={loading}
                  onClick={() => setShowPassword((v) => !v)}
                  className={cn(
                    "absolute top-1/2 right-1.5 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50",
                  )}
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
              className="mt-1 min-h-11 w-full text-base"
              disabled={loading || !username.trim() || !password}
              size="lg"
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
