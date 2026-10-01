"use client";

type Option<T extends string | number> = { value: T; label: string };

type Props<T extends string | number> = {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
};

/** A small set of mutually exclusive choices shown as one control. */
export function Segmented<T extends string | number>({ label, value, options, onChange, disabled }: Props<T>) {
  return (
    <div className="ui-field">
      <span className="ui-field-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button key={String(option.value)} type="button" role="radio" aria-checked={value === option.value} className={value === option.value ? "active" : undefined} disabled={disabled} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
