"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { ProspectTag, ProspectTagKind } from "@horizon/shared";
import { IconX } from "@/components/icons";
import { apiFetch } from "@/lib/api-client";

type TagInputProps = {
  kind: ProspectTagKind;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  max?: number;
  allowCreate?: boolean;
  disabled?: boolean;
};

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function TagInput({
  kind,
  value,
  onChange,
  placeholder = "Digite para buscar ou criar…",
  max,
  allowCreate = true,
  disabled = false,
}: TagInputProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ProspectTag[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);

  const selectedKeys = useMemo(
    () => new Set(value.map(normalizeKey)),
    [value],
  );
  const atLimit = max != null && value.length >= max;

  const visibleSuggestions = useMemo(
    () => suggestions.filter((tag) => !selectedKeys.has(normalizeKey(tag.name))),
    [suggestions, selectedKeys],
  );

  const exactMatch = visibleSuggestions.some(
    (tag) => normalizeKey(tag.name) === normalizeKey(query),
  );
  const canCreate =
    allowCreate &&
    !atLimit &&
    query.trim().length > 0 &&
    !exactMatch &&
    !selectedKeys.has(normalizeKey(query));

  const options = useMemo(() => {
    const items: Array<{ type: "tag" | "create"; label: string; name: string }> =
      visibleSuggestions.map((tag) => ({
        type: "tag" as const,
        label: tag.name,
        name: tag.name,
      }));
    if (canCreate) {
      items.push({
        type: "create",
        label: `Criar “${query.trim()}”`,
        name: query.trim(),
      });
    }
    return items;
  }, [visibleSuggestions, canCreate, query]);

  useEffect(() => {
    if (!open) return;

    const handle = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const params = new URLSearchParams({ kind });
          if (query.trim()) params.set("q", query.trim());
          const data = await apiFetch<ProspectTag[]>(
            `/prospects/tags?${params.toString()}`,
          );
          setSuggestions(data);
        } catch {
          setSuggestions([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 160);

    return () => window.clearTimeout(handle);
  }, [kind, query, open]);

  useEffect(() => {
    setHighlight(0);
  }, [query, options.length]);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function addTag(rawName: string, create: boolean) {
    const name = rawName.trim();
    if (!name || selectedKeys.has(normalizeKey(name))) {
      setQuery("");
      return;
    }
    if (atLimit && max === 1) {
      onChange([name]);
    } else if (atLimit) {
      return;
    } else {
      onChange([...value, name]);
    }
    setQuery("");
    if (create) {
      try {
        const tag = await apiFetch<ProspectTag>("/prospects/tags", {
          method: "POST",
          body: { kind, name },
        });
        onChange(
          max === 1
            ? [tag.name]
            : [
                ...value.filter(
                  (item) => normalizeKey(item) !== normalizeKey(tag.name),
                ),
                tag.name,
              ],
        );
      } catch {
        // a tag fica no cliente; o save do prospect persiste no catálogo
      }
    }
    if (max === 1) setOpen(false);
    inputRef.current?.focus();
  }

  function removeTag(name: string) {
    onChange(value.filter((item) => item !== name));
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !query && value.length > 0) {
      event.preventDefault();
      onChange(value.slice(0, -1));
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((prev) => Math.min(prev + 1, Math.max(options.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === "Enter" || event.key === ",") {
      if (!options[highlight] && !query.trim()) return;
      event.preventDefault();
      const option = options[highlight];
      if (option) {
        void addTag(option.name, option.type === "create");
      } else if (canCreate) {
        void addTag(query, true);
      }
    }
  }

  return (
    <div
      className={`tag-input${open ? " open" : ""}${disabled ? " disabled" : ""}`}
      ref={rootRef}
    >
      <div
        className="tag-input-box"
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {value.map((tag) => (
          <span key={tag} className={`tag-chip tag-chip-${kind.toLowerCase()}`}>
            {tag}
            {!disabled ? (
              <button
                type="button"
                className="tag-chip-remove"
                aria-label={`Remover ${tag}`}
                onClick={(event) => {
                  event.stopPropagation();
                  removeTag(tag);
                }}
              >
                <IconX size={12} />
              </button>
            ) : null}
          </span>
        ))}
        <input
          ref={inputRef}
          className="tag-input-field"
          value={query}
          disabled={disabled || (atLimit && max !== 1)}
          placeholder={value.length === 0 ? placeholder : ""}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
      </div>

      {open && !disabled ? (
        <div className="tag-input-menu" role="listbox">
          {loading && options.length === 0 ? (
            <p className="tag-input-empty">Buscando…</p>
          ) : options.length === 0 ? (
            <p className="tag-input-empty">
              {query.trim()
                ? allowCreate
                  ? "Nenhuma tag encontrada. Pressione Enter para criar."
                  : "Nenhuma tag encontrada."
                : "Digite para buscar tags já usadas."}
            </p>
          ) : (
            options.map((option, index) => (
              <button
                key={`${option.type}-${option.name}`}
                type="button"
                role="option"
                className={`tag-input-option${index === highlight ? " highlight" : ""}${
                  option.type === "create" ? " create" : ""
                }`}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => void addTag(option.name, option.type === "create")}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
