"use client";

import { Suspense } from "react";
import ProspectsPage from "./prospects-client";
import { ProspectsSkeleton } from "@/components/skeleton";

export default function Page() {
  return (
    <Suspense fallback={<ProspectsSkeleton />}>
      <ProspectsPage />
    </Suspense>
  );
}
