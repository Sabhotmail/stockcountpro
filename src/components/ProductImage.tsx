"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { getProductImageCandidates } from "@/lib/product-image";

function Placeholder({
  alt,
  compact,
}: {
  alt: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div
        aria-label={alt}
        className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-xs text-slate-500"
      >
        รูปภาพ
      </div>
    );
  }

  return (
    <div
      aria-label={alt}
      className="flex h-40 w-full items-center justify-center rounded-xl bg-slate-100 text-slate-500"
    >
      No Image
    </div>
  );
}

export function ProductImage({
  src,
  productCode,
  alt,
  compact,
}: {
  src?: string;
  productCode?: string;
  alt: string;
  compact?: boolean;
}) {
  const candidates = useMemo(() => {
    if (src?.trim()) return [src.trim()];
    if (productCode?.trim()) return getProductImageCandidates(productCode);
    return [];
  }, [src, productCode]);

  const [candidateIndex, setCandidateIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
    setExhausted(false);
  }, [candidates]);

  const currentSrc = candidates[candidateIndex];

  if (!currentSrc || exhausted) {
    return <Placeholder alt={alt} compact={compact} />;
  }

  const frameClass = compact
    ? "relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
    : "relative h-40 w-full overflow-hidden rounded-xl bg-slate-50";

  const imageClass = compact
    ? "object-contain p-1"
    : "object-contain p-4";

  return (
    <div className={frameClass}>
      <Image
        key={currentSrc}
        src={currentSrc}
        alt={alt}
        fill
        className={imageClass}
        unoptimized
        onError={() => {
          if (candidateIndex < candidates.length - 1) {
            setCandidateIndex((index) => index + 1);
            return;
          }

          setExhausted(true);
        }}
      />
    </div>
  );
}
