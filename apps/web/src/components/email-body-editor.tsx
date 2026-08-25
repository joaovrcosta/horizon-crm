"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { IconLink } from "@/components/icons";
import {
  DEFAULT_EMAIL_FONT,
  EMAIL_FONTS,
  normalizeLinkHref,
  plainTextToEditorHtml,
} from "@/lib/email-body";

export type EmailBodyEditorHandle = {
  insertLink: () => void;
};

type EditorProps = {
  value: string;
  onChange: (html: string) => void;
  fontFamily: string;
  placeholder?: string;
};

export const EmailBodyEditor = forwardRef<EmailBodyEditorHandle, EditorProps>(
  function EmailBodyEditor(
    {
      value,
      onChange,
      fontFamily,
      placeholder = "Escreva sua mensagem…",
    },
    ref,
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    const lastExternalRef = useRef(value);

    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;
      if (value !== lastExternalRef.current) {
        const next = plainTextToEditorHtml(value);
        if (el.innerHTML !== next) {
          el.innerHTML = next;
        }
        lastExternalRef.current = value;
      }
      const text = (el.textContent || "").replace(/\u00a0/g, " ").trim();
      el.dataset.empty = text ? "false" : "true";
    }, [value]);

    function emitChange() {
      const el = editorRef.current;
      if (!el) return;
      const html = el.innerHTML;
      lastExternalRef.current = html;
      onChange(html);
      const text = (el.textContent || "").replace(/\u00a0/g, " ").trim();
      el.dataset.empty = text ? "false" : "true";
    }

    function insertLink() {
      const el = editorRef.current;
      if (!el) return;
      el.focus();

      const selection = window.getSelection();
      const hasSelection =
        selection &&
        selection.rangeCount > 0 &&
        !selection.getRangeAt(0).collapsed &&
        el.contains(selection.anchorNode);

      const raw = window.prompt("URL do link", "https://");
      if (!raw?.trim()) return;
      const href = normalizeLinkHref(raw);
      if (!href) return;

      if (hasSelection) {
        document.execCommand("createLink", false, href);
      } else {
        const label =
          window.prompt("Texto do link", href.replace(/^https?:\/\//i, "")) ||
          href;
        document.execCommand(
          "insertHTML",
          false,
          `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`,
        );
      }

      el.querySelectorAll("a").forEach((a) => {
        const current = a.getAttribute("href") || "";
        const safe = normalizeLinkHref(current);
        if (safe) {
          a.setAttribute("href", safe);
          a.setAttribute("target", "_blank");
          a.setAttribute("rel", "noopener noreferrer");
        }
      });

      emitChange();
    }

    useImperativeHandle(ref, () => ({ insertLink }), []);

    return (
      <div className="compose-editor">
        <div
          ref={editorRef}
          className="compose-body compose-body-editor"
          contentEditable
          role="textbox"
          aria-multiline="true"
          data-placeholder={placeholder}
          data-empty="true"
          style={{ fontFamily: fontFamily || DEFAULT_EMAIL_FONT }}
          onInput={emitChange}
          onBlur={emitChange}
          suppressContentEditableWarning
        />
      </div>
    );
  },
);

type ToolbarProps = {
  fontFamily: string;
  onFontFamilyChange: (font: string) => void;
  onInsertLink: () => void;
};

export function EmailBodyToolbar({
  fontFamily,
  onFontFamilyChange,
  onInsertLink,
}: ToolbarProps) {
  return (
    <div className="compose-editor-toolbar" role="toolbar" aria-label="Formatação">
      <label className="compose-font-select">
        <span className="sr-only">Fonte</span>
        <select
          value={fontFamily}
          onChange={(e) => onFontFamilyChange(e.target.value)}
          title="Fonte"
        >
          {EMAIL_FONTS.map((font) => (
            <option key={font.label} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="compose-editor-tool"
        title="Inserir link"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onInsertLink}
      >
        <IconLink size={15} />
        <span>Link</span>
      </button>
    </div>
  );
}
