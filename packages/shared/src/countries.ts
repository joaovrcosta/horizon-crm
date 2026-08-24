import countries from "i18n-iso-countries";
import pt from "i18n-iso-countries/langs/pt.json";

countries.registerLocale(pt);

export type CountryOption = {
  code: string;
  name: string;
};

export function normalizeCountryCode(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;

  const trimmed = value.trim();
  if (/^[a-zA-Z]{2}$/.test(trimmed)) {
    const upper = trimmed.toUpperCase();
    return countries.isValid(upper) ? upper : null;
  }

  return (
    countries.getAlpha2Code(trimmed, "pt") ??
    countries.getAlpha2Code(trimmed, "en") ??
    null
  );
}

export function getCountryName(
  code: string | null | undefined,
  locale = "pt",
): string | null {
  if (!code) return null;
  const normalized = normalizeCountryCode(code);
  if (!normalized) return null;
  return countries.getName(normalized, locale) ?? normalized;
}

export function getCountryOptions(locale = "pt"): CountryOption[] {
  return Object.entries(countries.getNames(locale, { select: "official" }))
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** Valores possíveis no banco para um código ISO (inclui legado). */
export function getCountryFilterValues(
  code: string | null | undefined,
): string[] {
  const normalized = normalizeCountryCode(code);
  if (!normalized) return [];

  const values = new Set<string>([normalized, normalized.toLowerCase()]);

  for (const locale of ["pt", "en"] as const) {
    const name = countries.getName(normalized, locale);
    if (name) {
      values.add(name);
      values.add(name.toLowerCase());
    }
  }

  const aliases: Record<string, string[]> = {
    BR: ["Brasil", "Brazil"],
    US: ["Estados Unidos", "United States", "USA", "EUA"],
    PT: ["Portugal"],
    AR: ["Argentina"],
  };

  for (const alias of aliases[normalized] ?? []) {
    values.add(alias);
    values.add(alias.toLowerCase());
  }

  return [...values];
}
