"use client";

import { ChevronDown, ChevronUp, CircleDollarSign, Info, Plus, Trash2 } from "lucide-react";
import type { FocusEvent } from "react";
import { useState } from "react";
import type { ModifierGroup } from "@/lib/api/client";

export type ModifierOptionDraft = { key: string; id?: string; name: string; description: string; priceDelta: number; includedQuantity: number; defaultQuantity: number; maxQuantity: number; isLocked: boolean; isActive: boolean };
export type ModifierGroupDraft = { key: string; id?: string; name: string; description: string; selectionType: "single" | "multiple"; minSelections: number; maxSelections: number; isActive: boolean; options: ModifierOptionDraft[] };

const key = () => crypto.randomUUID();
const money = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const selectNumber = (event: FocusEvent<HTMLInputElement>) => event.currentTarget.select();

function NumberInput({ value, onValueChange, min = 0, max, decimal = false, ariaLabel }: { value: number; onValueChange: (value: number) => void; min?: number; max?: number; decimal?: boolean; ariaLabel?: string }) {
  const [draft, setDraft] = useState(String(value));
  function parse(raw: string) {
    const number = Number(raw.replace(",", "."));
    return Number.isFinite(number) ? number : null;
  }
  function commit() {
    const parsed = parse(draft);
    const next = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, parsed ?? value));
    const normalized = decimal ? Math.round(next * 100) / 100 : Math.round(next);
    setDraft(String(normalized)); onValueChange(normalized);
  }
  return <input aria-label={ariaLabel} type="text" inputMode={decimal ? "decimal" : "numeric"} value={draft} onFocus={selectNumber} onChange={(event) => { const raw = event.target.value; if (!/^\d*(?:[.,]\d{0,2})?$/.test(raw)) return; setDraft(raw); const parsed = parse(raw); if (parsed !== null) onValueChange(parsed); }} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />;
}

export function modifierGroupsToDraft(groups: ModifierGroup[]): ModifierGroupDraft[] {
  return groups.map((group) => ({ key: group.id, id: group.id, name: group.name, description: group.description ?? "", selectionType: group.selectionType, minSelections: group.minSelections, maxSelections: group.maxSelections, isActive: group.isActive, options: group.options.map((option) => ({ key: option.id, id: option.id, name: option.name, description: option.description ?? "", priceDelta: Number(option.priceDelta), includedQuantity: option.includedQuantity, defaultQuantity: option.defaultQuantity, maxQuantity: option.maxQuantity, isLocked: option.isLocked, isActive: option.isActive })) }));
}

export function groupConfigurationIssues(group: ModifierGroupDraft) {
  const issues: string[] = [];
  const active = group.options.filter((option) => option.isActive);
  const defaults = active.filter((option) => option.defaultQuantity > 0).length;
  if (!group.name.trim()) issues.push("Escribe un nombre para el grupo.");
  if (group.isActive && active.length === 0) issues.push("Agrega al menos una opción activa.");
  if (group.minSelections > group.maxSelections) issues.push("El mínimo requerido no puede superar el máximo.");
  if (group.isActive && group.maxSelections > active.length) issues.push(`El máximo es ${group.maxSelections}, pero solo hay ${active.length} ${active.length === 1 ? "opción activa" : "opciones activas"}.`);
  if (group.isActive && (defaults < group.minSelections || defaults > group.maxSelections)) issues.push(`Hay ${defaults} opciones preseleccionadas; deben quedar entre ${group.minSelections} y ${group.maxSelections}.`);
  if (group.selectionType === "single" && (group.maxSelections !== 1 || group.minSelections > 1 || active.some((option) => option.maxQuantity !== 1))) issues.push("La selección única debe permitir exactamente una opción y una unidad.");
  group.options.forEach((option, index) => {
    const label = option.name.trim() || `Opción ${index + 1}`;
    if (!option.name.trim()) issues.push(`Completa el nombre de la opción ${index + 1}.`);
    if (option.priceDelta < 0) issues.push(`${label}: el precio adicional no puede ser negativo.`);
    if (option.maxQuantity < 1) issues.push(`${label}: la cantidad máxima debe ser al menos 1.`);
    if (option.includedQuantity > option.maxQuantity || option.defaultQuantity > option.maxQuantity) issues.push(`${label}: la cantidad incluida o inicial supera el máximo.`);
    if (option.isLocked && (option.defaultQuantity < 1 || option.includedQuantity < option.defaultQuantity)) issues.push(`${label}: una opción fija debe estar incluida y preseleccionada.`);
  });
  return issues;
}

export function validateModifierGroups(groups: ModifierGroupDraft[]) {
  for (const [index, group] of groups.entries()) {
    const issue = groupConfigurationIssues(group)[0];
    if (issue) return `Grupo ${index + 1}${group.name.trim() ? ` · ${group.name.trim()}` : ""}: ${issue}`;
  }
  return null;
}

export function ProductConfiguratorEditor({ groups, onChange }: { groups: ModifierGroupDraft[]; onChange: (groups: ModifierGroupDraft[]) => void }) {
  const patchGroup = (index: number, patch: Partial<ModifierGroupDraft>) => onChange(groups.map((group, itemIndex) => itemIndex === index ? { ...group, ...patch } : group));
  const patchOption = (groupIndex: number, optionIndex: number, patch: Partial<ModifierOptionDraft>) => patchGroup(groupIndex, { options: groups[groupIndex].options.map((option, itemIndex) => itemIndex === optionIndex ? { ...option, ...patch } : option) });

  function moveGroup(index: number, direction: -1 | 1) {
    const next = [...groups]; const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]]; onChange(next);
  }
  function addGroup() { onChange([...groups, { key: key(), name: "", description: "", selectionType: "multiple", minSelections: 0, maxSelections: 1, isActive: true, options: [] }]); }
  function addOption(groupIndex: number) { patchGroup(groupIndex, { options: [...groups[groupIndex].options, { key: key(), name: "", description: "", priceDelta: 0, includedQuantity: 0, defaultQuantity: 0, maxQuantity: 1, isLocked: false, isActive: true }] }); }
  function setSelectionType(groupIndex: number, selectionType: "single" | "multiple") {
    const group = groups[groupIndex];
    if (selectionType === "multiple") { patchGroup(groupIndex, { selectionType }); return; }
    let keptDefault = false;
    patchGroup(groupIndex, { selectionType, minSelections: Math.min(1, group.minSelections), maxSelections: 1, options: group.options.map((option) => { const keepDefault = option.defaultQuantity > 0 && !keptDefault; if (keepDefault) keptDefault = true; return { ...option, defaultQuantity: keepDefault ? 1 : 0, includedQuantity: Math.min(1, option.includedQuantity), maxQuantity: 1 }; }) });
  }

  return <section className="wide modifier-editor">
    <div className="modifier-editor-heading"><div><strong>Personalización del producto</strong><span>Crea grupos claros de ingredientes, elecciones y extras.</span></div><button type="button" onClick={addGroup}><Plus size={15} /> Nuevo grupo</button></div>
    <div className="modifier-guide"><Info size={17} /><div><strong>Ejemplo: guacamole incluido + papas por $1,50</strong><span>Usa “Puede combinar varias” y máximo 2. Marca guacamole como incluido y preseleccionado; deja papas sin incluir, sin preseleccionar y con precio adicional de 1,50.</span></div></div>
    {groups.length === 0 ? <div className="modifier-empty">Este producto todavía no requiere personalización.</div> : groups.map((group, groupIndex) => {
      const issues = groupConfigurationIssues(group); const activeCount = group.options.filter((option) => option.isActive).length;
      return <article className={`modifier-group-card ${issues.length ? "has-issues" : ""}`} key={group.key}>
        <header><div><b>{group.name.trim() || `Grupo ${groupIndex + 1}`}</b><span>{group.selectionType === "single" ? "El cliente elige una opción" : "El cliente puede combinar opciones"}</span></div><div className="modifier-card-actions"><button type="button" aria-label="Subir grupo" disabled={groupIndex === 0} onClick={() => moveGroup(groupIndex, -1)}><ChevronUp size={15} /></button><button type="button" aria-label="Bajar grupo" disabled={groupIndex === groups.length - 1} onClick={() => moveGroup(groupIndex, 1)}><ChevronDown size={15} /></button><button type="button" aria-label="Eliminar grupo" onClick={() => onChange(groups.filter((_, index) => index !== groupIndex))}><Trash2 size={15} /></button></div></header>
        <div className="modifier-group-fields">
          <label>Nombre del grupo<input required value={group.name} onChange={(event) => patchGroup(groupIndex, { name: event.target.value })} placeholder="Ej. Acompañamientos" /></label>
          <label>Cómo elige el cliente<select value={group.selectionType} onChange={(event) => setSelectionType(groupIndex, event.target.value as "single" | "multiple")}><option value="multiple">Puede combinar varias</option><option value="single">Elige solo una</option></select></label>
          <label className="wide">Texto de ayuda <span className="label-optional">Opcional</span><input value={group.description} onChange={(event) => patchGroup(groupIndex, { description: event.target.value })} placeholder="Ej. Elige tus acompañamientos" /></label>
          <label>Mínimo requerido<NumberInput key={`min-${group.selectionType}`} value={group.minSelections} min={0} max={group.selectionType === "single" ? 1 : 50} onValueChange={(value) => patchGroup(groupIndex, { minSelections: value })} /></label>
          <label>Máximo que puede elegir<NumberInput key={`max-${group.selectionType}`} value={group.maxSelections} min={1} max={group.selectionType === "single" ? 1 : 50} onValueChange={(value) => patchGroup(groupIndex, { maxSelections: value })} /></label>
          <label className="check-field"><input type="checkbox" checked={group.isActive} onChange={(event) => patchGroup(groupIndex, { isActive: event.target.checked })} /> Grupo visible y activo</label>
        </div>
        {group.selectionType === "single" && group.options.some((option) => option.defaultQuantity > 0) && <div className="modifier-context-note"><Info size={15} /> Al elegir otra opción, la preseleccionada será reemplazada. Si deben conservarse ambas, cambia a “Puede combinar varias”.</div>}
        <div className="modifier-options">
          <div className="modifier-options-head"><div><strong>Opciones</strong><span>{activeCount} activas · el cliente puede elegir hasta {group.maxSelections}</span></div><button type="button" onClick={() => addOption(groupIndex)}><Plus size={14} /> Agregar opción</button></div>
          {group.options.length === 0 ? <p>Agrega al menos una opción para publicar este grupo.</p> : group.options.map((option, optionIndex) => {
            const included = option.includedQuantity > 0; const selected = option.defaultQuantity > 0;
            return <div className="modifier-option-card" key={option.key}>
              <div className="modifier-option-primary">
                <label className="option-name">Nombre<input required value={option.name} onChange={(event) => patchOption(groupIndex, optionIndex, { name: event.target.value })} placeholder="Ej. Porción de papas fritas" /></label>
                <label className="option-price">Precio adicional<div className="money-input"><CircleDollarSign size={16} /><NumberInput ariaLabel={`Precio adicional de ${option.name || `opción ${optionIndex + 1}`}`} value={option.priceDelta} min={0} max={10000} decimal onValueChange={(value) => patchOption(groupIndex, optionIndex, { priceDelta: value })} /></div></label>
                <label className="option-active"><input type="checkbox" checked={option.isActive} onChange={(event) => patchOption(groupIndex, optionIndex, { isActive: event.target.checked })} /> Activa</label>
                <button className="modifier-delete-option" type="button" aria-label="Eliminar opción" onClick={() => patchGroup(groupIndex, { options: group.options.filter((_, index) => index !== optionIndex) })}><Trash2 size={15} /></button>
              </div>
              <label className="option-description">Descripción para el cliente <span className="label-optional">Opcional</span><input value={option.description} onChange={(event) => patchOption(groupIndex, optionIndex, { description: event.target.value })} placeholder="Ej. Se entrega en un recipiente aparte" /></label>
              <div className="modifier-option-behavior">
                <label className="behavior-toggle"><input type="checkbox" checked={included} disabled={option.isLocked} onChange={(event) => patchOption(groupIndex, optionIndex, { includedQuantity: event.target.checked ? 1 : 0, defaultQuantity: event.target.checked ? Math.max(1, option.defaultQuantity) : option.defaultQuantity })} /><span><b>Incluida en el precio</b><small>La primera unidad no suma costo</small></span></label>
                <label className="behavior-toggle"><input type="checkbox" checked={selected} disabled={option.isLocked} onChange={(event) => patchOption(groupIndex, optionIndex, { defaultQuantity: event.target.checked ? 1 : 0 })} /><span><b>Preseleccionada</b><small>Aparece marcada al abrir</small></span></label>
                <label className="behavior-toggle locked-toggle"><input type="checkbox" checked={option.isLocked} onChange={(event) => patchOption(groupIndex, optionIndex, { isLocked: event.target.checked, includedQuantity: event.target.checked ? Math.max(1, option.includedQuantity) : option.includedQuantity, defaultQuantity: event.target.checked ? Math.max(1, option.defaultQuantity) : option.defaultQuantity })} /><span><b>No permitir quitar</b><small>Ingrediente fijo del producto</small></span></label>
                <label className="option-maximum">Cantidad máxima<NumberInput key={`quantity-${group.selectionType}`} value={option.maxQuantity} min={1} max={20} onValueChange={(value) => patchOption(groupIndex, optionIndex, { maxQuantity: value })} /></label>
                <div className="option-result"><span>Así se cobrará</span><strong>{included ? "Incluida" : option.priceDelta > 0 ? `+${money.format(option.priceDelta)}` : "Sin recargo"}</strong></div>
              </div>
            </div>;
          })}
          {issues.length > 0 && <div className="modifier-inline-errors" role="alert"><strong>Revisa este grupo</strong>{issues.map((issue) => <span key={issue}>{issue}</span>)}</div>}
        </div>
      </article>;
    })}
  </section>;
}
