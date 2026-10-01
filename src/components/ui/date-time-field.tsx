"use client";

import { DatePicker } from "@/components/ui/date-picker";
import { TimeSelect } from "@/components/ui/time-select";

type Props = {
  legend: string;
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  error?: string | null;
  disabled?: boolean;
};

/** A date and an hour side by side, for a single instant such as "opens at". */
export function DateTimeField({ legend, date, time, onDateChange, onTimeChange, minDate, maxDate, error, disabled }: Props) {
  return (
    <fieldset className={`date-time-field ${error ? "has-error" : ""}`}>
      <legend>{legend}</legend>
      <div className="date-time-row">
        <DatePicker label="Fecha" value={date} onChange={onDateChange} min={minDate} max={maxDate} disabled={disabled} />
        <TimeSelect label="Hora" value={time} onChange={onTimeChange} disabled={disabled} />
      </div>
      {error && <small className="ui-field-error" role="alert">{error}</small>}
    </fieldset>
  );
}
