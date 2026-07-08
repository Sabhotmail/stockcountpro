import Image from "next/image";

export function ProductImage({
  src,
  alt,
  compact,
}: {
  src?: string;
  alt: string;
  compact?: boolean;
}) {
  if (compact) {
    if (!src) {
      return (
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-xs text-slate-500">
          รูปภาพ
        </div>
      );
    }

    return (
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain p-1"
          unoptimized
        />
      </div>
    );
  }

  if (!src) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        No Image
      </div>
    );
  }

  return (
    <div className="relative h-40 w-full overflow-hidden rounded-xl bg-slate-50">
      <Image
        src={src}
        alt={alt}
        fill
        className="object-contain p-4"
        unoptimized
      />
    </div>
  );
}
