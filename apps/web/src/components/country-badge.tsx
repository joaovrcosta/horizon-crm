import { getCountryName } from "@horizon/shared";
import { CountryFlag } from "@/components/country-flag";

type CountryBadgeProps = {
  code: string | null | undefined;
  showName?: boolean;
};

export function CountryBadge({ code, showName = true }: CountryBadgeProps) {
  if (!code) return null;

  const name = getCountryName(code);

  return (
    <span className="country-badge">
      <CountryFlag code={code} className="country-badge-flag" />
      {showName ? <span>{name ?? code}</span> : null}
    </span>
  );
}
