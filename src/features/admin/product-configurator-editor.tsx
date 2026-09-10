"use client";

import { ChevronDown, ChevronUp, ClipboardPaste, Copy, ListChecks, Lock, Plus, Settings2, SlidersHorizontal, Trash2 } from "lucide-react";
import type { FocusEvent } from "react";
import { useState } from "react";
import type { ModifierGroup } from "@/lib/api/client";

// The admin edits intent (what kind of group / option is this?) and the payload
// for the API — includedQuantity / defaultQuantity / isLocked / min / max — is
// derived in `draftToPayload`. The database model does not change.
export type GroupKind = "ingredients" | "choice" | "extras";
export type OptionKind = "fixed" | "included" | "extra";

export type ModifierOptionDraft = {
  key: string; id?: string; name: string; description: string; priceDelta: number;
  kind: OptionKind; isDefault: boolean; extraPortions: boolean; maxQuantity: number; isActive: boolean;
};
export type ModifierGroupDraft = {
  key: string; id?: string; name: string; description: string; kind: GroupKind;
  required: boolean; limit: number | null; minSelections: number; isActive: boolean; options: ModifierOptionDraft[];
};

export type ModifierGroupPayload = {
  id?: string; name: string; description?: string; selectionType: "single" | "multiple"; minSelections: number; maxSelections: number; isActive: boolean; sortOrder: number;
  options: Array<{ id?: string; name: string; description?: string; priceDelta: number; includedQuantity: number; defaultQuantity: number; maxQuantity: number; isLocked: boolean; isActive: boolean; sortOrder: number }>;
};

const key = () => crypto.randomUUID();
const money = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const selectNumber = (event: FocusEvent<HTMLInputElement>) => event.currentTarget.select();

const groupKinds: Record<GroupKind, { label: string; hint: string; icon: typeof ListChecks; optionKind: OptionKind }> = {
  ingredients: { label: "Ingredientes del plato", hint: "Vienen incluidos; el cliente puede quitar los que no quiera.", icon: ListChecks, optionKind: "included" },
  choice: { label: "Elige una", hint: "El cliente escoge una sola opción (base, pan, tamaño…).", icon: SlidersHorizontal, optionKind: "extra" },
  extras: { label: "Extras", hint: "Adicionales con costo que el cliente suma si quiere.", icon: Plus, optionKind: "extra" },
};
const optionKinds: Record<OptionKind, string> = { fixed: "Fijo", included: "Incluido", extra: "Extra" };

function NumberInput({ value, onValueChange, min = 0, max, decimal = false, ariaLabel, placeholder }: { value: number | null; onValueChange: (value: number | null) => void; min?: number; max?: number; decimal?: boolean; ariaLabel?: string; placeholder?: string }) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const parse = (raw: string) => { const number = Number(raw.replace(",", ".")); return raw.trim() !== "" && Number.isFinite(number) ? number : null; };
  function commit() {
    const parsed = parse(draft);
    if (parsed === null) { setDraft(value === null ? "" : String(value)); onValueChange(value); return; }
    const next = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, parsed));
    const normalized = decimal ? Math.round(next * 100) / 100 : Math.round(next);
    setDraft(String(normalized)); onValueChange(normalized);
  }
  return <input aria-label={ariaLabel} placeholder={placeholder} type="text" inputMode={decimal ? "decimal" : "numeric"} value={draft} onFocus={selectNumber}
    onChange={(event) => { const raw = event.target.value; if (!/^\d*(?:[.,]\d{0,2})?$/.test(raw)) return; setDraft(raw); const parsed = parse(raw); if (parsed !== null) onValueChange(parsed); }}
    onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} />;
}

// ---- API <-> draft -----------------------------------------------------------

function inferGroupKind(group: ModifierGroup): GroupKind {
  if (group.selectionType === "single") return "choice";
  const active = group.options.filter((option) => option.isActive);
  const allIncluded = active.length > 0 && active.every((option) => option.includedQuantity > 0);
  return allIncluded && group.maxSelections >= active.length ? "ingredients" : "extras";
}

export function modifierGroupsToDraft(groups: ModifierGroup[], { stripIds = false } = {}): ModifierGroupDraft[] {
  return groups.map((group) => {
    const kind = inferGroupKind(group);
    const active = group.options.filter((option) => option.isActive);
    return {
      key: group.id, id: stripIds ? undefined : group.id, name: group.name, description: group.description ?? "", kind,
      required: group.minSelections > 0, limit: kind === "extras" && group.maxSelections < active.length ? group.maxSelections : null,
      minSelections: kind === "choice" ? 0 : group.minSelections, isActive: group.isActive,
      options: group.options.map((option) => ({
        key: option.id, id: stripIds ? undefined : option.id, name: option.name, description: option.description ?? "", priceDelta: Number(option.priceDelta),
        kind: option.isLocked ? "fixed" : option.includedQuantity > 0 ? "included" : "extra",
        isDefault: option.defaultQuantity > 0, extraPortions: option.maxQuantity > 1, maxQuantity: Math.max(1, option.maxQuantity), isActive: option.isActive,
      })),
    };
  });
}

export function draftToPayload(groups: ModifierGroupDraft[]): ModifierGroupPayload[] {
  return groups.map((group, groupIndex) => {
    const activeCount = Math.max(1, group.options.filter((option) => option.isActive).length);
    const single = group.kind === "choice";
    const maxSelections = single ? 1 : Math.min(50, group.limit ?? activeCount, activeCount);
    const minSelections = single ? (group.required ? 1 : 0) : Math.min(group.minSelections, maxSelections);
    return {
      id: group.id, name: group.name.trim(), description: group.description.trim() || undefined, selectionType: single ? "single" : "multiple",
      minSelections, maxSelections, isActive: group.isActive, sortOrder: groupIndex,
      options: group.options.map((option, optionIndex) => {
        const included = !single && option.kind !== "extra" ? 1 : 0;
        const defaultQuantity = single ? (option.isDefault ? 1 : 0) : included;
        return {
          id: option.id, name: option.name.trim(), description: option.description.trim() || undefined, priceDelta: option.priceDelta,
          includedQuantity: included, defaultQuantity, maxQuantity: single ? 1 : option.extraPortions ? Math.max(2, option.maxQuantity) : 1,
          isLocked: !single && option.kind === "fixed", isActive: option.isActive, sortOrder: optionIndex,
        };
      }),
    };
  });
}

// ---- validation -----------------------------------------------------------------

export function groupConfigurationIssues(group: ModifierGroupDraft) {
  const issues: string[] = [];
  const active = group.options.filter((option) => option.isActive);
  if (!group.name.trim()) issues.push("Escribe un nombre para el grupo.");
  if (group.isActive && active.length === 0) issues.push("Agrega al menos una opción disponible.");
  if (group.kind === "choice" && group.required && group.isActive && active.length > 0 && !active.some((option) => option.isDefault)) issues.push("Marca cuál opción viene seleccionada por defecto.");
  if (group.kind === "choice" && active.filter((option) => option.isDefault).length > 1) issues.push("Solo una opción puede venir seleccionada por defecto.");
  if (group.kind !== "choice" && group.limit !== null && group.limit > active.length) issues.push(`El límite es ${group.limit}, pero solo hay ${active.length} opciones disponibles.`);
  group.options.forEach((option, index) => { if (!option.name.trim()) issues.push(`Completa el nombre de la opción ${index + 1}.`); });
  return issues;
}

export function validateModifierGroups(groups: ModifierGroupDraft[]) {
  for (const [index, group] of groups.entries()) {
    const issue = groupConfigurationIssues(group)[0];
    if (issue) return `Grupo ${index + 1}${group.name.trim() ? ` · ${group.name.trim()}` : ""}: ${issue}`;
  }
  return null;
}

// ---- helpers --------------------------------------------------------------------

function newOption(kind: OptionKind, name = ""): ModifierOptionDraft {
  return { key: key(), name, description: "", priceDelta: 0, kind, isDefault: false, extraPortions: false, maxQuantity: 2, isActive: true };
}

function newGroup(kind: GroupKind): ModifierGroupDraft {
  const names: Record<GroupKind, string> = { ingredients: "Ingredientes", choice: "", extras: "Extras" };
  return { key: key(), name: names[kind], description: "", kind, required: kind === "choice", limit: null, minSelections: 0, isActive: true, options: [] };
}

function splitList(raw: string) {
  return raw.split(/[\n,;]+/).map((part) => part.trim()).filter(Boolean);
}

function optionSummary(group: ModifierGroupDraft, option: ModifierOptionDraft) {
  if (group.kind === "choice") return option.priceDelta > 0 ? `+${money.format(option.priceDelta)}` : "Sin recargo";
  if (option.kind === "extra") return option.priceDelta > 0 ? `+${money.format(option.priceDelta)}${option.extraPortions ? ` · hasta ${option.maxQuantity}` : ""}` : "Sin recargo";
  if (option.extraPortions) return `1 incluida · ${option.priceDelta > 0 ? `+${money.format(option.priceDelta)} por porción extra` : "porción extra gratis"} · máx ${option.maxQuantity}`;
  return option.kind === "fixed" ? "Incluido · no se puede quitar" : "Incluido";
}

function groupSummary(group: ModifierGroupDraft) {
  const active = group.options.filter((option) => option.isActive);
  if (group.kind === "choice") return `${active.length} ${active.length === 1 ? "opción" : "opciones"} · ${group.required ? "obligatorio" : "opcional"}`;
  const fixed = active.filter((option) => option.kind === "fixed").length;
  const extras = active.filter((option) => option.kind === "extra").length;
  const parts = [`${active.length} ${active.length === 1 ? "opción" : "opciones"}`];
  if (fixed) parts.push(`${fixed} ${fixed === 1 ? "fija" : "fijas"}`);
  if (extras) parts.push(`${extras} con costo`);
  if (group.limit !== null) parts.push(`máx ${group.limit}`);
  return parts.join(" · ");
}

// ---- component -----------------------------------------------------------------

type CopySource = { products: Array<{ id: string; name: string }>; load: (productId: string) => Promise<ModifierGroup[]> };

export function ProductConfiguratorEditor({ groups, onChange, copySource }: { groups: ModifierGroupDraft[]; onChange: (groups: ModifierGroupDraft[]) => void; copySource?: CopySource }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set());
  const [pasting, setPasting] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState("");

  const patchGroup = (index: number, patch: Partial<ModifierGroupDraft>) => onChange(groups.map((group, itemIndex) => itemIndex === index ? { ...group, ...patch } : group));
  const patchOption = (groupIndex: number, optionIndex: number, patch: Partial<ModifierOptionDraft>) => patchGroup(groupIndex, { options: groups[groupIndex].options.map((option, itemIndex) => itemIndex === optionIndex ? { ...option, ...patch } : option) });
  const toggle = (set: Set<string>, value: string) => { const next = new Set(set); if (next.has(value)) next.delete(value); else next.add(value); return next; };

  function moveGroup(index: number, direction: -1 | 1) {
    const next = [...groups]; const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]]; onChange(next);
  }
  function addGroup(kind: GroupKind) { const group = newGroup(kind); onChange([...groups, group]); setCollapsed((current) => { const next = new Set(current); next.delete(group.key); return next; }); }
  function addOption(groupIndex: number, name = "") { const group = groups[groupIndex]; patchGroup(groupIndex, { options: [...group.options, newOption(groupKinds[group.kind].optionKind, name)] }); }
  function addPasted(groupIndex: number) {
    const names = splitList(pasteText);
    if (names.length) { const group = groups[groupIndex]; patchGroup(groupIndex, { options: [...group.options, ...names.map((name) => newOption(groupKinds[group.kind].optionKind, name))] }); }
    setPasteText(""); setPasting(null);
  }
  function setDefault(groupIndex: number, optionIndex: number) {
    patchGroup(groupIndex, { options: groups[groupIndex].options.map((option, itemIndex) => ({ ...option, isDefault: itemIndex === optionIndex })) });
  }
  function changeGroupKind(groupIndex: number, kind: GroupKind) {
    const group = groups[groupIndex];
    const optionKind = groupKinds[kind].optionKind;
    patchGroup(groupIndex, { kind, required: kind === "choice" ? true : group.required, limit: kind === "extras" ? group.limit : null, options: group.options.map((option) => ({ ...option, kind: kind === "ingredients" && option.kind === "extra" ? "included" : kind === "extras" && option.kind !== "extra" ? optionKind : option.kind })) });
  }
  async function copyFrom(productId: string) {
    if (!copySource || !productId) return;
    setCopying(true); setCopyError("");
    try {
      const copied = modifierGroupsToDraft(await copySource.load(productId), { stripIds: true }).map((group) => ({ ...group, key: key(), options: group.options.map((option) => ({ ...option, key: key() })) }));
      onChange(groups.length === 0 || window.confirm("¿Reemplazar la personalización actual por la copiada?") ? copied : groups);
    } catch { setCopyError("No pudimos copiar la personalización de ese producto."); }
    finally { setCopying(false); }
  }

  return <section className="wide modifier-editor">
    <div className="modifier-editor-heading">
      <div><strong>Personalización del producto</strong><span>Ingredientes que vienen incluidos, elecciones y extras con costo.</span></div>
      {copySource && copySource.products.length > 0 && <label className="modifier-copy"><Copy size={14} /><select value="" disabled={copying} onChange={(event) => void copyFrom(event.target.value)}><option value="">{copying ? "Copiando…" : "Copiar de otro producto…"}</option>{copySource.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>}
    </div>
    {copyError && <p className="form-error" role="alert">{copyError}</p>}

    {groups.length === 0 && <div className="modifier-empty">Este producto todavía no tiene personalización. Agrega un grupo para empezar.</div>}

    {groups.map((group, groupIndex) => {
      const issues = groupConfigurationIssues(group); const kind = groupKinds[group.kind]; const isCollapsed = collapsed.has(group.key);
      return <article className={`modifier-group-card ${issues.length ? "has-issues" : ""}`} key={group.key}>
        <header>
          <button className="modifier-group-toggle" type="button" aria-expanded={!isCollapsed} onClick={() => setCollapsed((current) => toggle(current, group.key))}>
            <kind.icon size={16} />
            <div><b>{group.name.trim() || `Grupo ${groupIndex + 1}`}</b><span>{kind.label} · {groupSummary(group)}</span></div>
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <div className="modifier-card-actions"><button type="button" aria-label="Subir grupo" disabled={groupIndex === 0} onClick={() => moveGroup(groupIndex, -1)}><ChevronUp size={15} /></button><button type="button" aria-label="Bajar grupo" disabled={groupIndex === groups.length - 1} onClick={() => moveGroup(groupIndex, 1)}><ChevronDown size={15} /></button><button type="button" aria-label="Eliminar grupo" onClick={() => onChange(groups.filter((_, index) => index !== groupIndex))}><Trash2 size={15} /></button></div>
        </header>

        {!isCollapsed && <>
          <div className="modifier-group-fields">
            <label>Nombre del grupo<input required value={group.name} onChange={(event) => patchGroup(groupIndex, { name: event.target.value })} placeholder={group.kind === "choice" ? "Ej. Elige tu base" : group.kind === "extras" ? "Ej. Extras" : "Ej. Ingredientes"} /></label>
            <label>Tipo<select value={group.kind} onChange={(event) => changeGroupKind(groupIndex, event.target.value as GroupKind)}>{(Object.keys(groupKinds) as GroupKind[]).map((value) => <option key={value} value={value}>{groupKinds[value].label}</option>)}</select></label>
            {group.kind === "choice" && <label className="check-field modifier-check"><input type="checkbox" checked={group.required} onChange={(event) => patchGroup(groupIndex, { required: event.target.checked })} /> Obligatorio</label>}
            {group.kind === "extras" && <label>Máximo que puede elegir<NumberInput key={`limit-${group.key}`} value={group.limit} min={1} max={50} placeholder="Sin límite" onValueChange={(value) => patchGroup(groupIndex, { limit: value })} /></label>}
            {group.kind === "ingredients" && <p className="modifier-kind-hint">{kind.hint}</p>}
            <label className="wide">Texto de ayuda <span className="label-optional">Opcional</span><input value={group.description} onChange={(event) => patchGroup(groupIndex, { description: event.target.value })} placeholder={group.kind === "ingredients" ? "Ej. Quita lo que no quieras" : group.kind === "choice" ? "Ej. Todas las bases vienen frescas" : "Ej. Se sirven aparte"} /></label>
          </div>

          <div className="modifier-options">
            {group.options.length > 0 && <div className="modifier-option-head"><span>Opción</span>{group.kind !== "choice" && <span>Tipo</span>}{group.kind === "choice" && <span>Por defecto</span>}<span>Precio</span><span /></div>}
            {group.options.map((option, optionIndex) => {
              const expanded = expandedOptions.has(option.key);
              return <div className={`modifier-option-row ${option.isActive ? "" : "is-inactive"} ${expanded ? "is-expanded" : ""}`} key={option.key}>
                <div className="modifier-option-main">
                  <input className="modifier-option-name" required value={option.name} onChange={(event) => patchOption(groupIndex, optionIndex, { name: event.target.value })} placeholder="Nombre de la opción" aria-label={`Nombre de la opción ${optionIndex + 1}`} />
                  {group.kind !== "choice" && <select value={option.kind} aria-label={`Tipo de ${option.name || `opción ${optionIndex + 1}`}`} onChange={(event) => patchOption(groupIndex, optionIndex, { kind: event.target.value as OptionKind })}>{(Object.keys(optionKinds) as OptionKind[]).map((value) => <option key={value} value={value}>{optionKinds[value]}</option>)}</select>}
                  {group.kind === "choice" && <label className="modifier-default"><input type="radio" name={`default-${group.key}`} checked={option.isDefault} onChange={() => setDefault(groupIndex, optionIndex)} /><span>{option.isDefault ? "Sí" : "—"}</span></label>}
                  <div className="modifier-option-price">
                    {group.kind === "choice" || option.kind === "extra" || option.extraPortions
                      ? <div className="money-input"><span>$</span><NumberInput key={`price-${option.key}`} ariaLabel={`Precio de ${option.name || `opción ${optionIndex + 1}`}`} value={option.priceDelta} min={0} max={10000} decimal onValueChange={(value) => patchOption(groupIndex, optionIndex, { priceDelta: value ?? 0 })} /></div>
                      : <span className="modifier-option-summary">{option.kind === "fixed" && <Lock size={12} />}{optionSummary(group, option)}</span>}
                  </div>
                  <div className="modifier-option-actions">
                    <button type="button" className={expanded ? "is-active" : ""} aria-label="Más opciones" aria-expanded={expanded} onClick={() => setExpandedOptions((current) => toggle(current, option.key))}><Settings2 size={15} /></button>
                    <button type="button" aria-label="Eliminar opción" onClick={() => patchGroup(groupIndex, { options: group.options.filter((_, index) => index !== optionIndex) })}><Trash2 size={15} /></button>
                  </div>
                </div>
                {(option.extraPortions || !option.isActive || option.description) && !expanded && <small className="modifier-option-meta">{[!option.isActive && "Agotado", option.extraPortions && group.kind !== "choice" && optionSummary(group, option), option.description].filter(Boolean).join(" · ")}</small>}
                {expanded && <div className="modifier-option-details">
                  <label className="wide">Nota para el cliente <span className="label-optional">Opcional</span><input value={option.description} onChange={(event) => patchOption(groupIndex, optionIndex, { description: event.target.value })} placeholder="Ej. Se entrega en un recipiente aparte" /></label>
                  <label className="check-field modifier-check"><input type="checkbox" checked={!option.isActive} onChange={(event) => patchOption(groupIndex, optionIndex, { isActive: !event.target.checked })} /> Agotado (ocultar temporalmente)</label>
                  {group.kind !== "choice" && <label className="check-field modifier-check"><input type="checkbox" checked={option.extraPortions} onChange={(event) => patchOption(groupIndex, optionIndex, { extraPortions: event.target.checked })} /> Permitir porción extra</label>}
                  {group.kind !== "choice" && option.extraPortions && <label>Hasta cuántas<NumberInput key={`max-${option.key}`} value={option.maxQuantity} min={2} max={20} onValueChange={(value) => patchOption(groupIndex, optionIndex, { maxQuantity: value ?? 2 })} /></label>}
                  {group.kind !== "choice" && option.kind !== "extra" && option.extraPortions && <p className="modifier-kind-hint">La primera porción va incluida; el precio de arriba se cobra por cada porción adicional.</p>}
                </div>}
              </div>;
            })}
            {pasting === group.key
              ? <div className="modifier-paste"><textarea autoFocus rows={3} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder={"Una por línea o separadas por coma:\nPollo a la parrilla, Tomate cherry, Zanahoria"} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); addPasted(groupIndex); } if (event.key === "Escape") { setPasting(null); setPasteText(""); } }} /><div><button type="button" onClick={() => addPasted(groupIndex)}>Agregar {splitList(pasteText).length || ""}</button><button type="button" className="secondary" onClick={() => { setPasting(null); setPasteText(""); }}>Cancelar</button></div></div>
              : <div className="modifier-options-foot"><button type="button" onClick={() => addOption(groupIndex)}><Plus size={14} /> Agregar opción</button><button type="button" onClick={() => { setPasting(group.key); setPasteText(""); }}><ClipboardPaste size={14} /> Pegar lista</button></div>}
            {issues.length > 0 && <div className="modifier-inline-errors" role="alert">{issues.map((issue) => <span key={issue}>{issue}</span>)}</div>}
          </div>
        </>}
      </article>;
    })}

    <div className="modifier-add-group">
      <span>Agregar grupo</span>
      {(Object.keys(groupKinds) as GroupKind[]).map((value) => { const Icon = groupKinds[value].icon; return <button type="button" key={value} title={groupKinds[value].hint} onClick={() => addGroup(value)}><Icon size={15} /> {groupKinds[value].label}</button>; })}
    </div>
  </section>;
}
