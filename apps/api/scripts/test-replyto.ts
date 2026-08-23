/**
 * Teste de Reply-To via fluxo real da lib Resend do CRM.
 * Uso: npx tsx scripts/test-replyto.ts
 */
import "dotenv/config";
import {
  renderProspectEmailHtml,
  resolveReplyToEmail,
  sendProspectEmail,
} from "../src/lib/resend";
import { DEFAULT_EMAIL_REPLY_TO } from "@horizon/shared";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const to =
    process.env.TEST_EMAIL_TO?.trim() ||
    "joaovr.costa@gmail.com";

  const signatureRow = await prisma.emailSignature.findFirst();
  const signature = signatureRow
    ? {
        id: signatureRow.id,
        userId: signatureRow.userId,
        enabled: signatureRow.enabled,
        replyToEmail: signatureRow.replyToEmail,
        displayName: signatureRow.displayName,
        title: signatureRow.title,
        phone: signatureRow.phone,
        logoUrl: signatureRow.logoUrl,
        company: signatureRow.company,
        tagline: signatureRow.tagline,
        addressLine1: signatureRow.addressLine1,
        addressLine2: signatureRow.addressLine2,
        website: signatureRow.website,
        defaultIntro: signatureRow.defaultIntro,
        updatedAt: signatureRow.updatedAt.toISOString(),
      }
    : null;

  const resolved = resolveReplyToEmail(signature);
  console.log("DB replyToEmail:", signatureRow?.replyToEmail);
  console.log("resolveReplyToEmail:", resolved);
  console.log("DEFAULT_EMAIL_REPLY_TO:", DEFAULT_EMAIL_REPLY_TO);
  console.log("EMAIL_REPLY_TO env:", process.env.EMAIL_REPLY_TO);
  console.log("EMAIL_FROM env:", process.env.EMAIL_FROM);

  if (resolved.includes(".local")) {
    throw new Error(`FAIL: resolveReplyToEmail retornou domínio .local: ${resolved}`);
  }

  const subject = `Reply-To CRM test ${Date.now()}`;
  const { html, text } = await renderProspectEmailHtml({
    message: "Teste automatizado de Reply-To. Pode ignorar.",
    subject,
    signature,
    includeSignature: false,
    fallbackName: "Test",
  });

  const sent = await sendProspectEmail({
    to,
    subject,
    html,
    text,
    replyTo: resolved,
  });

  console.log("Sent id:", sent.id);
  console.log("Sent replyTo (app):", sent.replyTo);

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const got = await resend.emails.get(sent.id!);
  const replyTo = got.data?.reply_to;
  console.log("Resend reply_to:", replyTo);

  const ok = Array.isArray(replyTo)
    ? replyTo.includes("hello@halk.solutions") &&
      !replyTo.some((e) => String(e).includes(".local"))
    : replyTo === "hello@halk.solutions";

  if (!ok) {
    throw new Error(
      `FAIL: Resend gravou reply_to inesperado: ${JSON.stringify(replyTo)}`,
    );
  }

  console.log("PASS: Reply-To correto no Resend.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
