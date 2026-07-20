// =============================================================================
//  lib/dashboards/index.ts — hard-coded registry exposing one entry per
//  registered form. Steps 5+ read this directly; the form picker
//  iterates `Object.values(registry)` to build the dropdown.
//
//  Adding a future form is two edits:
//    1. drop `lib/dashboards/<formId>.ts` exporting a `FormConfig`
//    2. add it to `registry` below
//  No filesystem scanning, no magic.
// =============================================================================

import type { FormConfig } from "@/lib/types";
import { Agrip } from "./Agrip";
import { cordaidDemo } from "./cordaidDemo";
import { Wework } from "./Wework";

/**
 * The single source of truth for available forms. Order in this object
 * is the order the form picker lists them; first entry is not
 * authoritative — `DEFAULT_FORM` is.
 */
export const registry: Record<string, FormConfig> = {
  cordaidDemo,
  Agrip,
  Wework,
};

/**
 * Picker default and URL fallback for unknown id values. Cordaid is the
 * pre-dashPlus dashboard's only form, so it gets the default slot.
 */
export const DEFAULT_FORM = "cordaidDemo";

/**
 * Resolves a `?form=…` value (or any string the picker passes) to a
 * FormConfig. Unknown ids fall back to DEFAULT_FORM so the URL
 * `?form=garbage` lands on a valid dashboard view rather than mounting
 * nothing. The form picker (Step 6) disables menu items whose form is
 * not usable, so this fallback shouldn't normally fire — but it
 * guarantees component code never has to defend against undefined.
 */
export function getForm(id: string | null | undefined): FormConfig {
  if (id && registry[id]) return registry[id];
  return registry[DEFAULT_FORM];
}

/**
 * Iterates the registry in insertion order. The form picker renders
 * one menu item per entry returned by this list helper.
 */
export function listForms(): FormConfig[] {
  return Object.values(registry);
}
