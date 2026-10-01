"use client";

import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, ClipboardPaste, Copy, ListChecks, Lock, Plus, Settings2, SlidersHorizontal, Trash2 } from "lucide-react";
import type { FocusEvent } from "react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ModifierGroup } from "@/lib/api/client";
import { money } from "@/lib/order-status";

// The admin edits intent (what kind of group / option is this?) and the payload for the API
// (includedQuantity / defaultQuantity / isLocked / min / max) is derived in `draftToPayload`.
export type GroupKind = "ingredients" | "choice" | "extras";
export type OptionKind = "fixed" | "included" | "extra";

export type ModifierOptionDraft = {
  key: string; id?: string; name: string; description: string; priceDelta: number;
  kind: OptionKind; isDefault: boolean; extraPortions: boolean; maxQuantity: number; isActive: boolean;
};
export type ModifierGroupDraft = {
  key: string; id?: string; name: string; description: string; kind: GroupKind;
  required: boolean; limit: number | null; isActive: boolean; options: ModifierOptionDraft[];
};

export type ModifierGroupPayload = {
  id?: string; name: string; description?: string; selectionType: "single" | "multiple"; minSelections: number; maxSelections: number; isActive: boolean; sortOrder: number;
  options: Array<{ id?: string; name: string; description?: string; priceDelta: number; includedQuantity: number; defaultQuantity: number; maxQuantity: number; isLocked: boolean; isActive: boolean; sortOrder: number }>;
};

// Same limits as the API's Zod schema, so the admin never gets a server-side rejection for these.
const MAX_GROUPS = 30;
const MAX_OPTIONS = 100;
const NAME_MAX = 100;
const NOTE_MAX = 300;

const key = () => crypto.randomUUID();
const selectNumber = (event: FocusEvent<HTMLInputElement>) => event.currentTarget.select();

const groupKinds: Record<GroupKind, { label: string; hint: string; icon: typeof ListChecks; optionKind: OptionKind }> = {
  ingredients: { label: "Ingredientes del plato", hint: "Vienen incluidos; el cliente puede quitar los que no quiera.", icon: ListChecks, optionKind: "included" },
  choice: { label: "Elige una", hint: "El cliente escoge una sola opción (base, pan, tamaño…).", icon: SlidersHorizontal, optionKind: "extra" },
  extras: { label: "Extras", hint: "Adicionales con costo que el cliente suma si quiere.", icon: Plus, optionKind: "extra" },
};
const optionKinds: Record<OptionKind, string> = { fixed: "Fijo (no se quita)", included: "Incluido", extra: "Extra con costo" };

function NumberInput({ value, onValueChange, min = 0, max, decimal = false, nullable = false, ariaLabel, placeholder }: { value: number | null; onValueChange: (value: number | null) => void; min?: number; max?: number; decimal?: boolean; nullable?: boolean; ariaLabel?: string; placeholder?: string }) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const parse = (raw: string) => { const number = Number(raw.replace(",", ".")); return raw.trim() !== "" && Number.isFinite(number) ? number : null; };
  function commit() {
    const parsed = parse(draft);
    if (parsed === null) {
      // An empty field means "no value" when the field allows it; otherwise restore the last value.
      if (nullable) { setDraft(""); onValueChange(null); return; }
      setDraft(value === null ? "" : String(value));
      return;
    }
    const next = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, parsed));
    const normalized = decimal ? Math.round(next * 100) / 100 : Math.round(next);
    setDraft(String(normalized)); onValueChange(normalized);
  }
  return (
    <input
      aria-label={ariaLabel} placeholder={placeholder} type="text" inputMode={decimal ? "decimal" : "numeric"} value={draft} onFocus={selectNumber}
      onChange={(event) => {
        const raw = event.target.value;
        if (!(decimal ? /^\d*(?:[.,]\d{0,2})?$/ : /^\d*$/).test(raw)) return;
        setDraft(raw);
        const parsed = parse(raw);
        if (parsed !== null) onValueChange(parsed);
        else if (nullable) onValueChange(null);
      }}
      onBlur={commit}
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }}
    />
  );
}

// ---- API <-> draft -----------------------------------------------------------

/** Label only: every control exists for both multiple kinds, so nothing is lost if the label changes on reload. */
function inferGroupKind(group: ModifierGroup): GroupKind {
  if (group.selectionType === "single") return "choice";
  const active = group.options.filter((option) => option.isActive);
  return active.length > 0 && active.every((option) => option.includedQuantity > 0) ? "ingredients" : "extras";
}

export function modifierGroupsToDraft(groups: ModifierGroup[], { stripIds = false } = {}): ModifierGroupDraft[] {
  return groups.map((group) => {
    const kind = inferGroupKind(group);
    const active = group.options.filter((option) => option.isActive);
    return {
      key: stripIds ? key() : group.id, id: stripIds ? undefined : group.id, name: group.name, description: group.description ?? "", kind,
      required: group.minSelections > 0,
      limit: kind !== "choice" && group.maxSelections < active.length ? group.maxSelections : null,
      isActive: group.isActive,
      options: group.options.map((option) => ({
        key: stripIds ? key() : option.id, id: stripIds ? undefined : option.id, name: option.name, description: option.description ?? "", priceDelta: Number(option.priceDelta),
        kind: option.isLocked ? "fixed" : option.includedQuantity > 0 ? "included" : "extra",
        isDefault: option.defaultQuantity > 0, extraPortions: option.maxQuantity > 1, maxQuantity: Math.max(2, option.maxQuantity), isActive: option.isActive,
      })),
    };
  });
}

export function draftToPayload(groups: ModifierGroupDraft[]): ModifierGroupPayload[] {
  return groups.map((group, groupIndex) => {
    const activeCount = Math.max(1, group.options.filter((option) => option.isActive).length);
    const single = group.kind === "choice";
    const maxSelections = single ? 1 : Math.min(50, group.limit ?? activeCount, activeCount);
    return {
      id: group.id, name: group.name.trim(), description: group.description.trim() || undefined, selectionType: single ? "single" : "multiple",
      minSelections: single && group.required ? 1 : 0, maxSelections, isActive: group.isActive, sortOrder: groupIndex,
      options: group.options.map((option, optionIndex) => {
        const included = !single && option.kind !== "extra" ? 1 : 0;
        return {
          id: option.id, name: option.name.trim(), description: option.description.trim() || undefined, priceDelta: option.priceDelta,
          includedQuantity: included, defaultQuantity: single ? (option.isDefault ? 1 : 0) : included,
          maxQuantity: single ? 1 : option.extraPortions ? Math.max(2, option.maxQuantity) : 1,
          isLocked: !single && option.kind === "fixed", isActive: option.isActive, sortOrder: optionIndex,
        };
      }),
    };
  });
}

// ---- validation (mirrors modifierGroupSchema in the API) -------------------------

export function groupConfigurationIssues(group: ModifierGroupDraft) {
  const issues: string[] = [];
  const active = group.options.filter((option) => option.isActive);
  if (group.name.trim().length < 2) issues.push("Escribe un nombre de al menos 2 letras para el grupo.");
  if (group.isActive && active.length === 0) issues.push("Agrega al menos una opción disponible, u oculta el grupo.");
  if (group.kind === "choice" && group.isActive) {
    const defaults = active.filter((option) => option.isDefault).length;
    if (group.required && active.length > 0 && defaults === 0) issues.push("Marca cuál opción viene seleccionada por defecto.");
    if (defaults > 1) issues.push("Solo una opción puede venir seleccionada por defecto.");
  }
  if (group.kind !== "choice" && group.limit !== null) {
    const included = active.filter((option) => option.kind !== "extra").length;
    if (group.limit > active.length) issues.push(`El máximo es ${group.limit}, pero solo hay ${active.length} opciones disponibles.`);
    else if (group.isActive && included > group.limit) issues.push(`El máximo es ${group.limit}, pero ${included} opciones vienen incluidas. Sube el máximo o cambia algunas a "Extra con costo".`);
  }
  group.options.forEach((option, index) => { if (!option.name.trim()) issues.push(`Completa el nombre de la opción ${index + 1}.`); });
  return issues;
}

export function validateModifierGroups(groups: ModifierGroupDraft[]) {
  for (const [index, group] of groups.entries()) {
    const issue = groupConfigurationIssues(group)[0];
    if (issue) return `Personalización, grupo ${index + 1}${group.name.trim() ? ` (${group.name.trim()})` : ""}: ${issue}`;
  }
  return null;
}

// ---- helpers --------------------------------------------------------------------

function newOption(kind: OptionKind, name = ""): ModifierOptionDraft {
  return { key: key(), name: name.slice(0, NAME_MAX), description: "", priceDelta: 0, kind, isDefault: false, extraPortions: false, maxQuantity: 2, isActive: true };
}

function newGroup(kind: GroupKind): ModifierGroupDraft {
  const names: Record<GroupKind, string> = { ingredients: "Ingredientes", choice: "", extras: "Extras" };
  return { key: key(), name: names[kind], description: "", kind, required: kind === "choice", limit: null, isActive: true, options: [] };
}

/** One option per line; names may contain commas ("Jamón, queso y tomate"). */
function splitList(raw: string) {
  return raw.split(/\n+/).map((part) => part.trim()).filter(Boolean);
}

function optionSummary(group: ModifierGroupDraft, option: ModifierOptionDraft) {
  if (group.kind === "choice") return option.priceDelta > 0 ? `+${money.format(option.priceDelta)}` : "Sin recargo";
  if (option.kind === "extra") return option.priceDelta > 0 ? `+${money.format(option.priceDelta)}${option.extraPortions ? `, hasta ${option.maxQuantity}` : ""}` : "Sin recargo";
  if (option.extraPortions) return `1 incluida, ${option.priceDelta > 0 ? `+${money.format(option.priceDelta)} por porción extra` : "porción extra gratis"}, máximo ${option.maxQuantity}`;
  return option.kind === "fixed" ? "Incluido, no se puede quitar" : "Incluido";
}

function groupSummary(group: ModifierGroupDraft) {
  const active = group.options.filter((option) => option.isActive);
  const parts = [`${active.length} ${active.length === 1 ? "opción" : "opciones"}`];
  if (group.kind === "choice") parts.push(group.required ? "obligatorio" : "opcional");
  else {
    const fixed = active.filter((option) => option.kind === "fixed").length;
    const extras = active.filter((option) => option.kind === "extra").length;
    if (fixed) parts.push(`${fixed} ${fixed === 1 ? "fija" : "fijas"}`);
    if (extras) parts.push(`${extras} con costo`);
    if (group.limit !== null) parts.push(`máximo ${group.limit}`);
  }
  if (!group.isActive) parts.push("oculto");
  return parts.join(", ");
}

// ---- component -----------------------------------------------------------------

type CopySource = { products: Array<{ id: string; name: string }>; load: (productId: string) => Promise<ModifierGroup[]> };
type Pending = { kind: "delete-group"; index: number } | { kind: "replace"; groups: ModifierGroupDraft[] };
type Props = {
  groups: ModifierGroupDraft[];
  onChange: (groups: ModifierGroupDraft[]) => void;
  copySource?: CopySource;
  /** Show per-group problems. Off until the admin tries to save, so a new group does not start in red. */
  showIssues?: boolean;
};

export function ProductConfiguratorEditor({ groups, onChange, copySource, showIssues = false }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set());
  const [pasting, setPasting] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);

  const patchGroup = (index: number, patch: Partial<ModifierGroupDraft>) => onChange(groups.map((group, itemIndex) => itemIndex === index ? { ...group, ...patch } : group));
  const patchOption = (groupIndex: number, optionIndex: number, patch: Partial<ModifierOptionDraft>) => {
    const group = groups[groupIndex];
    if (!group) return;
    patchGroup(groupIndex, { options: group.options.map((option, itemIndex) => itemIndex === optionIndex ? { ...option, ...patch } : option) });
  };
  const toggle = (set: Set<string>, value: string) => { const next = new Set(set); if (next.has(value)) next.delete(value); else next.add(value); return next; };

  function move<T>(list: T[], index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= list.length) return list;
    const next = [...list];
    const [item] = next.splice(index, 1);
    if (item !== undefined) next.splice(target, 0, item);
    return next;
  }
  function addGroup(kind: GroupKind) {
    if (groups.length >= MAX_GROUPS) return;
    onChange([...groups, newGroup(kind)]);
  }
  function addOptions(groupIndex: number, names: string[]) {
    const group = groups[groupIndex];
    if (!group) return;
    const room = Math.max(0, MAX_OPTIONS - group.options.length);
    patchGroup(groupIndex, { options: [...group.options, ...names.slice(0, room).map((name) => newOption(groupKinds[group.kind].optionKind, name))] });
  }
  function addPasted(groupIndex: number) {
    addOptions(groupIndex, splitList(pasteText));
    setPasteText(""); setPasting(null);
  }
  /** Clicking the selected default again clears it, unless the group is required. */
  function toggleDefault(groupIndex: number, optionIndex: number) {
    const group = groups[groupIndex];
    if (!group) return;
    const already = group.options[optionIndex]?.isDefault ?? false;
    if (already && group.required) return;
    patchGroup(groupIndex, { options: group.options.map((option, itemIndex) => ({ ...option, isDefault: !already && itemIndex === optionIndex })) });
  }
  function changeGroupKind(groupIndex: number, kind: GroupKind) {
    const group = groups[groupIndex];
    if (!group) return;
    patchGroup(groupIndex, {
      kind,
      required: kind === "choice",
      limit: kind === "choice" ? null : group.limit,
      options: group.options.map((option) => ({ ...option, kind: kind === "ingredients" && option.kind === "extra" ? "included" : kind === "extras" && option.kind !== "extra" ? "extra" : option.kind })),
    });
  }
  function removeGroup(index: number) {
    const group = groups[index];
    if (group && group.options.length > 0) setPending({ kind: "delete-group", index });
    else onChange(groups.filter((_, itemIndex) => itemIndex !== index));
  }
  async function copyFrom(productId: string) {
    if (!copySource || !productId) return;
    setCopying(true); setCopyError("");
    try {
      const copied = modifierGroupsToDraft(await copySource.load(productId), { stripIds: true });
      if (copied.length === 0) setCopyError("Ese producto no tiene personalización para copiar.");
      else if (groups.length === 0) onChange(copied);
      else setPending({ kind: "replace", groups: copied });
    } catch { setCopyError("No pudimos copiar la personalización de ese producto."); }
    finally { setCopying(false); }
  }

  return (
    <div className="modifier-editor">
      <div className="modifier-editor-heading">
        <p>Ingredientes que vienen incluidos, elecciones y extras con costo. Los precios son finales, con IVA.</p>
        {copySource && copySource.products.length > 0 && (
          <label className="modifier-copy"><Copy size={14} aria-hidden="true" />
            <select value="" disabled={copying} aria-label="Copiar personalización de otro producto" onChange={(event) => void copyFrom(event.target.value)}>
              <option value="">{copying ? "Copiando…" : "Copiar de otro producto…"}</option>
              {copySource.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </label>
        )}
      </div>
      {copyError && <p className="form-error" role="alert">{copyError}</p>}

      {groups.length === 0 && <div className="modifier-empty">Este producto se vende tal cual, sin personalización. Agrega un grupo si el cliente puede elegir o quitar algo.</div>}

      {groups.map((group, groupIndex) => {
        const issues = groupConfigurationIssues(group);
        const kind = groupKinds[group.kind];
        const isCollapsed = collapsed.has(group.key);
        const flagged = showIssues && issues.length > 0;
        return (
          <article className={`modifier-group-card ${flagged ? "has-issues" : ""} ${group.isActive ? "" : "is-hidden"}`} key={group.key}>
            <header>
              <button className="modifier-group-toggle" type="button" aria-expanded={!isCollapsed} onClick={() => setCollapsed((current) => toggle(current, group.key))}>
                <kind.icon size={16} />
                <div><b>{group.name.trim() || `Grupo ${groupIndex + 1}`}</b><span>{kind.label}: {groupSummary(group)}</span></div>
                {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
              <div className="modifier-card-actions">
                <button type="button" aria-label={`Subir grupo ${group.name}`} disabled={groupIndex === 0} onClick={() => onChange(move(groups, groupIndex, -1))}><ArrowUp size={15} /></button>
                <button type="button" aria-label={`Bajar grupo ${group.name}`} disabled={groupIndex === groups.length - 1} onClick={() => onChange(move(groups, groupIndex, 1))}><ArrowDown size={15} /></button>
                <button type="button" aria-label={`Eliminar grupo ${group.name}`} onClick={() => removeGroup(groupIndex)}><Trash2 size={15} /></button>
              </div>
            </header>

            {!isCollapsed && (
              <>
                <div className="modifier-group-fields">
                  <label>Nombre del grupo<input value={group.name} maxLength={NAME_MAX} onChange={(event) => patchGroup(groupIndex, { name: event.target.value })} placeholder={group.kind === "choice" ? "Ej. Elige tu base" : group.kind === "extras" ? "Ej. Extras" : "Ej. Ingredientes"} /></label>
                  <label>Tipo<select value={group.kind} onChange={(event) => changeGroupKind(groupIndex, event.target.value as GroupKind)}>{(Object.keys(groupKinds) as GroupKind[]).map((value) => <option key={value} value={value}>{groupKinds[value].label}</option>)}</select></label>
                  {group.kind === "choice"
                    ? <label className="modifier-check"><input type="checkbox" checked={group.required} onChange={(event) => patchGroup(groupIndex, { required: event.target.checked })} /> El cliente debe elegir una</label>
                    : <label>Máximo que puede elegir <em>Opcional</em><NumberInput key={`limit-${group.key}`} nullable value={group.limit} min={1} max={50} placeholder="Sin límite" ariaLabel={`Máximo de opciones en ${group.name}`} onValueChange={(value) => patchGroup(groupIndex, { limit: value })} /></label>}
                  <label className="wide">Texto de ayuda <em>Opcional</em><input value={group.description} maxLength={NOTE_MAX} onChange={(event) => patchGroup(groupIndex, { description: event.target.value })} placeholder={group.kind === "ingredients" ? "Ej. Quita lo que no quieras" : group.kind === "choice" ? "Ej. Todas las bases vienen frescas" : "Ej. Se sirven aparte"} /></label>
                  <label className="modifier-check wide"><input type="checkbox" checked={!group.isActive} onChange={(event) => patchGroup(groupIndex, { isActive: !event.target.checked })} /> Ocultar este grupo a los clientes por ahora</label>
                </div>

                <div className="modifier-options">
                  {group.options.length > 0 && <div className="modifier-option-head" aria-hidden="true"><span>Opción</span><span>{group.kind === "choice" ? "Por defecto" : "Tipo"}</span><span>Precio</span><span /></div>}
                  {group.options.map((option, optionIndex) => {
                    const expanded = expandedOptions.has(option.key);
                    const label = option.name || `opción ${optionIndex + 1}`;
                    return (
                      <div className={`modifier-option-row ${option.isActive ? "" : "is-inactive"} ${expanded ? "is-expanded" : ""}`} key={option.key}>
                        <div className="modifier-option-main">
                          <input className="modifier-option-name" value={option.name} maxLength={NAME_MAX} onChange={(event) => patchOption(groupIndex, optionIndex, { name: event.target.value })} placeholder="Nombre de la opción" aria-label={`Nombre de la opción ${optionIndex + 1}`} />
                          {group.kind === "choice"
                            ? <label className="modifier-default"><input type="checkbox" checked={option.isDefault} aria-label={`${label} viene seleccionada por defecto`} onChange={() => toggleDefault(groupIndex, optionIndex)} /><span>{option.isDefault ? "Seleccionada" : "No"}</span></label>
                            : <select value={option.kind} aria-label={`Tipo de ${label}`} onChange={(event) => patchOption(groupIndex, optionIndex, { kind: event.target.value as OptionKind })}>{(Object.keys(optionKinds) as OptionKind[]).map((value) => <option key={value} value={value}>{optionKinds[value]}</option>)}</select>}
                          <div className="modifier-option-price">
                            {group.kind === "choice" || option.kind === "extra" || option.extraPortions
                              ? <div className="money-input"><span>$</span><NumberInput key={`price-${option.key}`} ariaLabel={`Precio de ${label}`} value={option.priceDelta} min={0} max={10000} decimal onValueChange={(value) => patchOption(groupIndex, optionIndex, { priceDelta: value ?? 0 })} /></div>
                              : <span className="modifier-option-summary">{option.kind === "fixed" && <Lock size={12} />}{optionSummary(group, option)}</span>}
                          </div>
                          <div className="modifier-option-actions">
                            <button type="button" aria-label={`Subir ${label}`} disabled={optionIndex === 0} onClick={() => patchGroup(groupIndex, { options: move(group.options, optionIndex, -1) })}><ArrowUp size={14} /></button>
                            <button type="button" aria-label={`Bajar ${label}`} disabled={optionIndex === group.options.length - 1} onClick={() => patchGroup(groupIndex, { options: move(group.options, optionIndex, 1) })}><ArrowDown size={14} /></button>
                            <button type="button" className={expanded ? "is-active" : ""} aria-label={`Más ajustes de ${label}`} aria-expanded={expanded} onClick={() => setExpandedOptions((current) => toggle(current, option.key))}><Settings2 size={15} /></button>
                            <button type="button" aria-label={`Eliminar ${label}`} onClick={() => patchGroup(groupIndex, { options: group.options.filter((_, index) => index !== optionIndex) })}><Trash2 size={15} /></button>
                          </div>
                        </div>
                        {(option.extraPortions || !option.isActive || option.description) && !expanded && <small className="modifier-option-meta">{[!option.isActive && "Agotado", option.extraPortions && group.kind !== "choice" && optionSummary(group, option), option.description].filter(Boolean).join(". ")}</small>}
                        {expanded && (
                          <div className="modifier-option-details">
                            <label className="wide">Nota para el cliente <em>Opcional</em><input value={option.description} maxLength={NOTE_MAX} onChange={(event) => patchOption(groupIndex, optionIndex, { description: event.target.value })} placeholder="Ej. Se entrega en un recipiente aparte" /></label>
                            <label className="modifier-check"><input type="checkbox" checked={!option.isActive} onChange={(event) => patchOption(groupIndex, optionIndex, { isActive: !event.target.checked })} /> Agotado (ocultar por ahora)</label>
                            {group.kind !== "choice" && <label className="modifier-check"><input type="checkbox" checked={option.extraPortions} onChange={(event) => patchOption(groupIndex, optionIndex, { extraPortions: event.target.checked })} /> Permitir más de una porción</label>}
                            {group.kind !== "choice" && option.extraPortions && <label>Hasta cuántas<NumberInput key={`max-${option.key}`} value={option.maxQuantity} min={2} max={20} onValueChange={(value) => patchOption(groupIndex, optionIndex, { maxQuantity: value ?? 2 })} /></label>}
                            {group.kind !== "choice" && option.kind !== "extra" && option.extraPortions && <p className="modifier-kind-hint wide">La primera porción va incluida; el precio se cobra por cada porción adicional.</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {pasting === group.key ? (
                    <div className="modifier-paste">
                      <textarea autoFocus rows={4} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder={"Una opción por línea:\nPollo a la parrilla\nTomate cherry\nZanahoria"} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setPasting(null); setPasteText(""); } }} />
                      <div>
                        <button type="button" className="is-primary" onClick={() => addPasted(groupIndex)}>Agregar {splitList(pasteText).length || ""}</button>
                        <button type="button" onClick={() => { setPasting(null); setPasteText(""); }}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="modifier-options-foot">
                      <button type="button" disabled={group.options.length >= MAX_OPTIONS} onClick={() => addOptions(groupIndex, [""])}><Plus size={14} /> Agregar opción</button>
                      <button type="button" disabled={group.options.length >= MAX_OPTIONS} onClick={() => { setPasting(group.key); setPasteText(""); }}><ClipboardPaste size={14} /> Pegar lista</button>
                    </div>
                  )}
                  {flagged && <div className="modifier-inline-errors">{issues.map((issue) => <span key={issue}>{issue}</span>)}</div>}
                </div>
              </>
            )}
          </article>
        );
      })}

      <div className="modifier-add-group">
        <span>Agregar grupo</span>
        {(Object.keys(groupKinds) as GroupKind[]).map((value) => {
          const Icon = groupKinds[value].icon;
          return <button type="button" key={value} title={groupKinds[value].hint} disabled={groups.length >= MAX_GROUPS} onClick={() => addGroup(value)}><Icon size={15} /> {groupKinds[value].label}</button>;
        })}
      </div>

      {pending?.kind === "delete-group" && (
        <ConfirmDialog
          title="¿Eliminar este grupo?"
          body={<p><strong>{groups[pending.index]?.name || "Grupo sin nombre"}.</strong> Se quitarán sus {groups[pending.index]?.options.length ?? 0} opciones. El cambio se aplica al guardar el producto.</p>}
          confirmLabel="Eliminar grupo"
          onConfirm={() => { onChange(groups.filter((_, index) => index !== pending.index)); setPending(null); }}
          onCancel={() => setPending(null)}
        />
      )}
      {pending?.kind === "replace" && (
        <ConfirmDialog
          title="¿Reemplazar la personalización?"
          body={<p>Los {groups.length} grupos actuales se sustituyen por los {pending.groups.length} copiados. El cambio se aplica al guardar el producto.</p>}
          confirmLabel="Reemplazar"
          onConfirm={() => { onChange(pending.groups); setPending(null); }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
