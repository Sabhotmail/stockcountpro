import { connection } from "next/server";
import { getEnvBannerText, getEnvBannerTone } from "@/lib/app-env";

const BANNER_TONE_CLASS = {
  amber: "bg-amber-500 text-amber-950",
  sky: "bg-sky-500 text-sky-950",
} as const;

export async function EnvBanner() {
  await connection();
  const text = getEnvBannerText();
  const tone = getEnvBannerTone();
  if (!text || !tone) return null;

  return (
    <div
      role="status"
      className={`fixed inset-x-0 top-0 z-50 flex h-[var(--env-banner-h,2.75rem)] items-center justify-center px-3 text-center text-sm font-semibold pt-[env(safe-area-inset-top,0px)] print:hidden ${BANNER_TONE_CLASS[tone]}`}
    >
      <span className="min-w-0 truncate">{text}</span>
    </div>
  );
}
