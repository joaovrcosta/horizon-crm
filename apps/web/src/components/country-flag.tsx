"use client";

import type { ComponentType } from "react";
import * as flags from "country-flag-icons/react/3x2";

type CountryFlagProps = {
  code: string | null | undefined;
  className?: string;
};

export function CountryFlag({ code, className }: CountryFlagProps) {
  if (!code) return null;

  const Flag = (
    flags as Record<string, ComponentType<{ className?: string }>>
  )[code.toUpperCase()];
  if (!Flag) return null;

  return <Flag className={className} aria-hidden />;
}
