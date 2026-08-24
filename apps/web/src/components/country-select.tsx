"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { getCountryName, getCountryOptions } from "@horizon/shared";
import { CountryFlag } from "@/components/country-flag";
import { IconChevronDown } from "@/components/icons";

const COUNTRY_OPTIONS = getCountryOptions("pt");

type CountrySelectProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function CountrySelect({
  value,
  onChange,
  id,
  placeholder = "Selecione um país",
}: CountrySelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const selectedName = value ? getCountryName(value) : null;

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter((option) => {
      const name = normalizeSearch(option.name);
      const code = option.code.toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(0);
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);

    function handleClick(event: MouseEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  function selectCountry(code: string) {
    onChange(code);
    setOpen(false);
  }

  function clearCountry() {
    onChange("");
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!open) return;

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((prev) =>
        Math.min(prev + 1, Math.max(filtered.length - 1, 0)),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[highlight];
      if (option) selectCountry(option.code);
    }
  }

  return (
    <div className="country-select" ref={rootRef}>
      <button
        id={id}
        type="button"
        className={`country-select-trigger${open ? " open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {value ? (
          <CountryFlag code={value} className="country-select-flag" />
        ) : null}
        <span className={selectedName ? undefined : "is-placeholder"}>
          {selectedName ?? placeholder}
        </span>
        <IconChevronDown
          size={14}
          className={open ? "chevron-open" : undefined}
        />
      </button>

      {open ? (
        <div className="country-select-panel" role="listbox">
          <input
            ref={searchRef}
            type="search"
            className="country-select-search"
            value={query}
            placeholder="Pesquisar país..."
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />

          <div className="country-select-list">
            {value ? (
              <button
                type="button"
                className="country-select-option muted"
                onClick={clearCountry}
              >
                Limpar seleção
              </button>
            ) : null}

            {filtered.length === 0 ? (
              <p className="country-select-empty">Nenhum país encontrado.</p>
            ) : (
              filtered.map((option, index) => (
                <button
                  key={option.code}
                  type="button"
                  role="option"
                  aria-selected={option.code === value}
                  className={`country-select-option${
                    option.code === value ? " selected" : ""
                  }${index === highlight ? " highlight" : ""}`}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => selectCountry(option.code)}
                >
                  <CountryFlag
                    code={option.code}
                    className="country-select-flag"
                  />
                  <span>{option.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
