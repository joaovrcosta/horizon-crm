import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
} from "@react-email/components";
import {
  HalkEmailSignature,
  type HalkSignatureProps,
} from "./halk-signature";

export type ProspectOutreachEmailProps = {
  messageHtml: string;
  previewText?: string;
  fontFamily?: string;
  signature?: HalkSignatureProps | null;
  includeSignature?: boolean;
};

const DEFAULT_FONT = "Georgia, 'Times New Roman', Times, serif";

const styles = {
  body: {
    backgroundColor: "#ffffff",
    margin: "0",
    padding: "24px",
  } as const,
  container: {
    margin: "0",
    padding: "0",
    maxWidth: "560px",
  } as const,
};

export function ProspectOutreachEmail({
  messageHtml,
  previewText = "Mensagem",
  fontFamily = DEFAULT_FONT,
  signature,
  includeSignature = true,
}: ProspectOutreachEmailProps) {
  const messageStyle = {
    fontFamily,
    fontSize: "15px",
    color: "#111111",
    lineHeight: "1.55",
    margin: "0 0 28px 0",
  } as const;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {messageHtml.trim() ? (
            <Section>
              <div
                style={messageStyle}
                dangerouslySetInnerHTML={{ __html: messageHtml }}
              />
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
