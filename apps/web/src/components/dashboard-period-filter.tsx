"use client";

import { useEffect, useRef, useState } from "react";
import { IconCalendar, IconChevronDown } from "@/components/icons";

export type DashboardPeriodPreset = 7 | 14 | 30 | "custom";

type DashboardPeriodFilterProps = {
  preset: DashboardPeriodPreset;
  customFrom: string;
  customTo: string;
  onPresetChange: (preset: DashboardPeriodPreset) => void;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  onApplyCustom: () => void;
};

const PRESETS: Array<{ value: DashboardPeriodPreset; label: string }> = [
  { value: 7, label: "7 dias" },
  { value: 14, label: "14 dias" },
  { value: 30, label: "30 dias" },
  { value: "custom", label: "Personalizado" },
];

function formatCustomLabel(from: string, to: string) {
  if (!from || !to) return "Personalizado";
  const fmt = (value: string) => {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year.slice(2)}`;
  };
  return `${fmt(from)} – ${fmt(to)}`;
}

export function DashboardPeriodFilter({
  preset,
  customFrom,
  customTo,
  onPresetChange,
  onCustomFromChange,
  onCustomToChange,
  onApplyCustom,
}: DashboardPeriodFilterProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!customOpen) return;
    function handleClick(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setCustomOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [customOpen]);

  function selectPreset(value: DashboardPeriodPreset) {
    if (value === "custom") {
      setCustomOpen(true);
      onPresetChange("custom");
      return;
    }
    setCustomOpen(false);
    onPresetChange(value);
  }

  function handleApply() {
    onApplyCustom();
    setCustomOpen(false);
  }

  return (
    <div className="period-filter" ref={panelRef}>
      <div className="period-filter-tabs" role="tablist" aria-label="Período">
        {PRESETS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={preset === item.value}
            className={`period-filter-tab${preset === item.value ? " active" : ""}`}
            onClick={() => selectPreset(item.value)}
          >
            {item.value === "custom" && preset === "custom"
              ? formatCustomLabel(customFrom, customTo)
              : item.label}
            {item.value === "custom" ? (
              <IconChevronDown
                size={14}
                className={customOpen ? "chevron-open" : undefined}
              />
            ) : null}
          </button>
        ))}
      </div>

      {customOpen ? (
        <div className="period-filter-panel" role="dialog" aria-label="Período personalizado">
          <div className="period-filter-panel-head">
            <IconCalendar size={16} />
            <span>Selecione o intervalo</span>
          </div>
          <div className="period-filter-fields">
            <label>
              De
              <input
                type="date"
                value={customFrom}
                onChange={(event) => onCustomFromChange(event.target.value)}
              />
            </label>
            <label>
              Até
              <input
                type="date"
                value={customTo}
                onChange={(event) => onCustomToChange(event.target.value)}
              />
            </label>
          </div>
          <div className="period-filter-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCustomOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!customFrom || !customTo || customFrom > customTo}
              onClick={handleApply}
            >
              Aplicar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
