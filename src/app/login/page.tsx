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
    <div className="flex min-h-[100dvh] flex-col bg-muted/40">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <header className="mb-8 space-y-2 text-center">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            StockCount Pro
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            เข้าสู่ระบบ
          </h1>
          <p className="text-sm text-muted-foreground">
            ใช้ username และ password ที่ได้รับจากองค์กร
          </p>
        </header>

        <section className="rounded-xl border bg-background p-6 shadow-sm sm:p-8">
          {error && (
            <Alert variant="destructive" className="mb-5">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid gap-2">
              <Label htmlFor="username" className="text-sm font-medium">
                Username
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
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                disabled={loading}
                className="min-h-11 text-base"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
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
                    "absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50",
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
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          ระบบตรวจนับสต็อก · ใช้งานบน Tablet ในคลัง
        </p>
      </div>
    </div>
  );
}
