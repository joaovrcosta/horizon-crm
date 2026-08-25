"use client";

import type { SiteQuality } from "@horizon/shared";
import { SITE_QUALITY_LABELS } from "@horizon/shared";
import { IconSiteQuality } from "@/components/icons";

const LEVEL: Record<Exclude<SiteQuality, "NO_SITE">, 1 | 2 | 3> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

export function SiteQualityMeter({
  value,
  size = 16,
}: {
  value: SiteQuality;
  size?: number;
}) {
  const label = SITE_QUALITY_LABELS[value];

  if (value === "NO_SITE") {
    return (
      <span className="tag-chip tag-chip-no-site" title="Sem site">
        Sem site
      </span>
    );
  }

  return (
    <span
      className="site-quality"
      title={`Qualidade do site: ${label}`}
      aria-label={`Qualidade do site: ${label}`}
    >
      <IconSiteQuality level={LEVEL[value]} size={size} />
    </span>
  );
}
