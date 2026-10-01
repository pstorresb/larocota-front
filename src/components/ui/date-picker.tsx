"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { es } from "react-day-picker/locale";

type Props = {
  /** "YYYY-MM-DD" or "" when empty. The value is a calendar date, not an instant: no time zone involved. */
  value: string;
  onChange: (value: string) => void;
  label: string;
  min?: string;
  max?: string;
  error?: string | null;
  disabled?: boolean;
  placeholder?: string;
};

const display = new Intl.DateTimeFormat("es-EC", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

function parse(value: string | undefined) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function serialize(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Date field with a calendar popover. Replaces the browser's native date input so it looks the same everywhere. */
export function DatePicker({ value, onChange, label, min, max, error, disabled, placeholder = "Elegir fecha" }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = parse(value);
  const minDate = parse(min);
  const maxDate = parse(max);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div className={`ui-field date-picker ${error ? "has-error" : ""}`} ref={root}>
      <label className="ui-field-label" htmlFor={id}>{label}</label>
      <button id={id} type="button" className="ui-control date-picker-trigger" aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={() => setOpen((current) => !current)}>
        <CalendarDays size={17} aria-hidden="true" />
        <span className={selected ? undefined : "is-placeholder"}>{selected ? display.format(selected) : placeholder}</span>
      </button>
      {open && (
        <div className="date-picker-popover" role="dialog" aria-label={`Calendario: ${label}`}>
          <DayPicker
            mode="single"
            locale={es}
            weekStartsOn={1}
            showOutsideDays
            autoFocus
            selected={selected}
            defaultMonth={selected ?? minDate ?? new Date()}
            disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
            onSelect={(day) => { if (day) { onChange(serialize(day)); setOpen(false); } }}
          />
        </div>
      )}
      {error && <small className="ui-field-error" role="alert">{error}</small>}
    </div>
  );
}
