"use client";

import { Clock3 } from "lucide-react";
import { useId } from "react";

type Props = {
  /** "HH:mm" or "". */
  value: string;
  onChange: (value: string) => void;
  label: string;
  stepMinutes?: number;
  /** Inclusive bounds, "HH:mm". */
  min?: string;
  max?: string;
  error?: string | null;
  disabled?: boolean;
};

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function fromMinutes(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Hour dropdown on a fixed grid (30 min by default). A stored value off the grid is kept as an extra option. */
export function TimeSelect({ value, onChange, label, stepMinutes = 30, min, max, error, disabled }: Props) {
  const id = useId();
  const low = min ? toMinutes(min) : 0;
  const high = max ? toMinutes(max) : 24 * 60 - 1;
  const options: string[] = [];
  for (let at = 0; at < 24 * 60; at += stepMinutes) {
    if (at >= low && at <= high) options.push(fromMinutes(at));
  }
  if (value && !options.includes(value)) {
    options.push(value);
    options.sort();
  }
  return (
    <div className={`ui-field time-select ${error ? "has-error" : ""}`}>
      <label className="ui-field-label" htmlFor={id}>{label}</label>
      <div className="ui-control time-select-control">
        <Clock3 size={17} aria-hidden="true" />
        <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
          <option value="" disabled>Hora</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
      {error && <small className="ui-field-error" role="alert">{error}</small>}
    </div>
  );
}
