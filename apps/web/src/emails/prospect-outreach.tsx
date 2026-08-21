import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import {
  HalkEmailSignature,
  type HalkSignatureProps,
} from "@/emails/halk-signature";

export type ProspectOutreachEmailProps = {
  message: string;
  previewText?: string;
  signature?: HalkSignatureProps | null;
  includeSignature?: boolean;
};

const styles = {
  body: {
    backgroundColor: "#ffffff",
    margin: "0",
    padding: "0",
  } as const,
  container: {
    margin: "0",
    padding: "0",
    maxWidth: "560px",
  } as const,
  message: {
    fontFamily:
      "Georgia, 'Times New Roman', Times, serif",
    fontSize: "15px",
    color: "#111111",
    lineHeight: "1.55",
    margin: "0 0 28px 0",
    whiteSpace: "pre-wrap" as const,
  },
};

/** Template completo: mensagem + assinatura (React Email). */
export function ProspectOutreachEmail({
  message,
  previewText = "Mensagem",
  signature,
  includeSignature = true,
}: ProspectOutreachEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {message.trim() ? (
            <Section>
              <Text style={styles.message}>{message.trim()}</Text>
            </Section>
          ) : null}
          {includeSignature && signature ? (
            <HalkEmailSignature {...signature} />
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}

export default ProspectOutreachEmail;
