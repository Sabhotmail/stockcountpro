"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Old review-tied URL — redirect to standalone documents report. */
export default function LegacyExpressVarianceRedirect() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(
      `/supervisor/documents/${params.documentId}/express-variance`,
    );
  }, [params.documentId, router]);

  return null;
}
