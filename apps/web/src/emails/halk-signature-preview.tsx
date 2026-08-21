import { HalkEmailSignature } from "./halk-signature";

/** Preview no `npm run email:dev -w @horizon/web` */
export default function HalkSignaturePreview() {
  return (
    <HalkEmailSignature
      displayName="Admin Horizon"
      title="Founder & Creative Developer"
      phone="(+55 11) 98888-7777"
      logoUrl="https://raw.githubusercontent.com/joaovrcosta/code-icons/main/halk-logo-blue-gradient.png"
      company="halk."
      tagline="Agência de experiências digitais"
      addressLine1="São Paulo, SP"
      addressLine2="Brasil"
      website="halk.studio"
    />
  );
}
