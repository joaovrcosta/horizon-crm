"use client";

import type { MouseEvent } from "react";
import { IconStar } from "@/components/icons";

export function FavoriteButton({
  favorited,
  onToggle,
  size = 16,
  className = "",
}: {
  favorited: boolean;
  onToggle: () => void;
  size?: number;
  className?: string;
}) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onToggle();
  }

  return (
    <button
      type="button"
      className={`favorite-btn${favorited ? " is-on" : ""}${className ? ` ${className}` : ""}`}
      aria-pressed={favorited}
      aria-label={favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      title={favorited ? "Remover dos favoritos" : "Favoritar"}
      onClick={handleClick}
    >
      <IconStar size={size} filled={favorited} />
    </button>
  );
}
