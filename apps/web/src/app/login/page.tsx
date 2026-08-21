"use client";

import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="boot-screen">
          <p>Carregando…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
