import {
  Img,
  Link,
  Section,
  Text,
} from "@react-email/components";

export type HalkSignatureProps = {
  displayName?: string | null;
  title?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  company?: string | null;
  tagline?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  website?: string | null;
};

const font =
  "Georgia, 'Times New Roman', Times, serif";

const styles = {
  root: {
    fontFamily: font,
    color: "#111111",
    lineHeight: "1.4",
    margin: "0",
    padding: "0",
  } as const,
  name: {
    fontFamily: font,
    fontSize: "17px",
    fontWeight: 700,
    color: "#111111",
    margin: "0 0 2px 0",
    padding: "0",
    lineHeight: "1.3",
  } as const,
  meta: {
    fontFamily: font,
    fontSize: "14px",
    fontWeight: 400,
    color: "#111111",
    margin: "0 0 2px 0",
    padding: "0",
    lineHeight: "1.35",
  } as const,
  spacer: {
    margin: "0 0 14px 0",
    padding: "0",
    fontSize: "1px",
    lineHeight: "14px",
  } as const,
  logo: {
    display: "block",
    border: "0",
    outline: "none",
    textDecoration: "none",
    margin: "0 0 14px 0",
  } as const,
  company: {
    fontFamily: font,
    fontSize: "14px",
    color: "#111111",
    margin: "0 0 6px 0",
    padding: "0",
    lineHeight: "1.4",
  } as const,
  link: {
    fontFamily: font,
    fontSize: "13px",
    color: "#1a73e8",
    textDecoration: "underline",
    margin: "0 0 2px 0",
    padding: "0",
    lineHeight: "1.35",
    display: "block",
  } as const,
};

function websiteHref(website: string) {
  const t = website.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/**
 * Assinatura de e-mail no estilo agency (nome → cargo → telefone → logo → empresa → links).
 * Gerada com React Email (HTML table-friendly + estilos inline).
 */
export function HalkEmailSignature({
  displayName,
  title,
  phone,
  logoUrl,
  company,
  tagline,
  addressLine1,
  addressLine2,
  website,
}: HalkSignatureProps) {
  const name = displayName?.trim() || "";
  const role = title?.trim() || "";
  const tel = phone?.trim() || "";
  const logo = logoUrl?.trim() || "";
  const brand = company?.trim() || "";
  const tag = tagline?.trim() || "";
  const addr1 = addressLine1?.trim() || "";
  const addr2 = addressLine2?.trim() || "";
  const web = website?.trim() || "";

  const hasPerson = Boolean(name || role || tel);
  const companyLine = brand
    ? tag
      ? `${brand} — ${tag}`
      : brand
    : tag;

  return (
    <Section style={styles.root}>
      {name ? <Text style={styles.name}>{name}</Text> : null}
      {role ? <Text style={styles.meta}>{role}</Text> : null}
      {tel ? <Text style={styles.meta}>{tel}</Text> : null}
      {hasPerson ? <Text style={styles.spacer}>&nbsp;</Text> : null}

      {logo ? (
        <Img
          src={logo}
          alt={brand || "logo"}
          width={90}
          style={styles.logo}
        />
      ) : null}

      {companyLine ? (
        <Text style={styles.company}>
          {brand ? (
            <>
              <strong>{brand}</strong>
              {tag ? ` — ${tag}` : null}
            </>
          ) : (
            tag
          )}
        </Text>
      ) : null}

      {addr1 ? (
        <Link href={`https://maps.google.com/?q=${encodeURIComponent(addr1)}`} style={styles.link}>
          {addr1}
        </Link>
      ) : null}
      {addr2 ? (
        <Link href={`https://maps.google.com/?q=${encodeURIComponent(addr2)}`} style={styles.link}>
          {addr2}
        </Link>
      ) : null}
      {web ? (
        <Link href={websiteHref(web)} style={styles.link}>
          {web.replace(/^https?:\/\//i, "")}
        </Link>
      ) : null}
    </Section>
  );
}

export default HalkEmailSignature;
