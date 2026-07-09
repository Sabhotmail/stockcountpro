"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { getProductImageCandidates } from "@/lib/product-image";
import { cn } from "@/lib/utils";

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
        className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-input bg-muted text-xs text-muted-foreground"
      >
        รูปภาพ
      </div>
    );
  }

  return (
    <div
      aria-label={alt}
      className="flex h-40 w-full items-center justify-center rounded-xl bg-muted text-muted-foreground"
    >
      No Image
    </div>
  );
}

function ProductImageInner({
  candidates,
  alt,
  compact,
}: {
  candidates: string[];
  alt: string;
  compact?: boolean;
}) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  const currentSrc = candidates[candidateIndex];

  if (!currentSrc || exhausted) {
    return <Placeholder alt={alt} compact={compact} />;
  }

  const frameClass = compact
    ? "relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-input bg-muted/40"
    : "relative h-40 w-full overflow-hidden rounded-xl bg-muted/40";

  const imageClass = cn("object-contain", compact ? "p-1" : "p-4");

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

  return (
    <ProductImageInner
      key={candidates.join("|") || "empty"}
      candidates={candidates}
      alt={alt}
      compact={compact}
    />
  );
}
