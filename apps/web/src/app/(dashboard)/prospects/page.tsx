"use client";

import { Suspense } from "react";
import ProspectsPage from "./prospects-client";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="detail-empty" style={{ minHeight: "100vh" }}>
          Carregando prospects…
        </div>
      }
    >
      <ProspectsPage />
    </Suspense>
  );
}
