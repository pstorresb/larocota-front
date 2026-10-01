/**
 * Conversions between ISO instants and the values of `<input type="date|time|datetime-local">`
 * expressed in Ecuador time. Ecuador is fixed at UTC-5 with no daylight saving, so the offset is a constant.
 */
const TZ = "America/Guayaquil";
const OFFSET = "-05:00";

const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

function localParts(iso: string | Date) {
  const map = Object.fromEntries(parts.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  const hour = map.hour === "24" ? "00" : map.hour;
  return { date: `${map.year}-${map.month}-${map.day}`, time: `${hour}:${map.minute}` };
}

/** "2026-10-09T11:30" for a datetime-local input. */
export function toDateTimeLocal(iso?: string | Date | null) {
  if (!iso) return "";
  const { date, time } = localParts(iso);
  return `${date}T${time}`;
}

/** "2026-10-09" for a date input. */
export function toDateOnly(iso?: string | Date | null) {
  return iso ? localParts(iso).date : "";
}

/** "11:30" for a time input. */
export function toTimeOnly(iso?: string | Date | null) {
  return iso ? localParts(iso).time : "";
}

/** Reads a datetime-local value ("YYYY-MM-DDTHH:mm") as Ecuador time and returns the ISO instant. */
export function fromDateTimeLocal(value: string) {
  if (!value) return null;
  const date = new Date(`${value}:00${OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Combines a date value and a time value (both in Ecuador time) into an ISO instant. */
export function fromDateAndTime(date: string, time: string) {
  return date && time ? fromDateTimeLocal(`${date}T${time}`) : null;
}
