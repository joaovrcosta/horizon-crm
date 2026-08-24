"use client";

import { useEffect, useState } from "react";
import type { EmailSignature } from "@horizon/shared";
import { HalkEmailSignature } from "@/emails/halk-signature";
import { toSignatureProps } from "@/lib/email-signature";

type Props = {
  signature: EmailSignature;
  fallbackName?: string | null;
  intro?: string | null;
  compact?: boolean;
};

/** Prévia ao vivo do template React Email (mesmos componentes do HTML final). */
export function EmailSignaturePreview({
  signature,
  fallbackName,
  intro,
  compact,
}: Props) {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  if (!signature.enabled) {
    return <p className="field-hint">Nenhuma assinatura definida.</p>;
  }

  const props = toSignatureProps(signature, {
    fallbackName,
    origin: origin || undefined,
  });

  return (
    <div
      className={`signature-preview${compact ? " signature-preview-sm" : ""}`}
    >
      {intro?.trim() ? (
        <pre className="signature-intro">{intro.trim()}</pre>
      ) : null}
      <div className="signature-react-email">
        <HalkEmailSignature {...props} />
      </div>
    </div>
  );
}
