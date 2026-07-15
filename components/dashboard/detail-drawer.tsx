"use client";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Hash, MessageSquareWarning } from "lucide-react";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { statusVariant, yesNoVariant } from "@/lib/filters";
import type { Cell, DynamicRecord, FormConfig } from "@/lib/types";

// No bridge alias — detail-drawer.tsx natively consumes DynamicRecord +
// FormConfig (fieldHints + drawerHeader) as of Step 12. lib/kobo.ts's
// normalizeSubmission emits DynamicRecord[]; lib/filters.ts's helpers
// consume DynamicRecord[]; we read both without aliasing.

/**
 * Reserve-set for fields the drawer auto-iteration must skip. We hide
 * the three DynamicRecord-reserved slots (id/uuid/submission_time)
 * separately via auto-discover rules below; the Set here captures
 * additional meta-shaped keys (the literal `meta` dict, defensive
 * even though lib/kobo.ts's isCell sweep already removes it).
 */
const HIDDEN_KEYS = new Set<string>(["_id", "_uuid", "meta"]);

/**
 * Title-fallback string. Used when drawerHeader.titleField is unset
 * OR when the resolved record value is null/empty/non-string. Always
 * rendered as plain text, never as a hyphen — semantically distinct
 * from "field has no value".
 */
const TITLE_FALLBACK = "Anonymous respondent";

interface DetailDrawerProps {
  record: DynamicRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Per-form spec driving field rendering decisions:
   *  - `fieldHints.longText` declares which keys render as full-width
   *    sections at the top of the drawer (one section per entry).
   *  - `fieldHints.status` / `fieldHints.yesNo` declare which keys
   *    get Badge treatment (status-style Resolved/New/Under and
   *    yesNo-style default/muted).
   *  - `drawerHeader.titleField` is the dynamic field read for the
   *    title; `drawerHeader.subtitleFields` are joined with " · " to
   *    compose the DrawerDescription line.
   *
   * The Step 12 spec landed these per-form declarations so adding a
   * third form needs zero edits to this file.
   */
  form: FormConfig;
}

/**
 * Per-cell renderer. Plain text by default; dispatches to status-style
 * or yesNo-style Badge wrappers when the column key is in
 * `form.fieldHints.status` / `form.fieldHints.yesNo` respectively.
 */
function renderCell(value: Cell, chip: "status" | "yesNo" | undefined) {
  const display = value == null || value === "" ? "—" : String(value);
  if (chip === "status") {
    return <Badge variant={statusVariant(value)}>{display}</Badge>;
  }
  if (chip === "yesNo") {
    return <Badge variant={yesNoVariant(value)}>{display}</Badge>;
  }
  return display;
}

/**
 * One entry in the grid. Reuses the same Field-cell layout as today
 * so visual density matches the pre-Step-12 hardcoded layout (label
 * over value, full-width opts in to span both grid columns on sm+).
 */
function Field({
  label,
  value,
  chip,
  full = false,
}: {
  label: string;
  value: Cell;
  chip?: "status" | "yesNo";
  full?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", full && "sm:col-span-2")}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-cordaid-muted">
        {label}
      </span>
      <span className="text-sm text-cordaid-dark break-words">
        {renderCell(value, chip)}
      </span>
    </div>
  );
}

/**
 * Per-field chip lookup. Returns the chip kind for a given key, or
 * undefined for plain-text rendering. Centralised so the auto-discover
 * grid + the per-section renderers share the SAME dispatch.
 */
function chipForKey(form: FormConfig, key: string): "status" | "yesNo" | undefined {
  if (form.fieldHints?.status?.includes(key)) return "status";
  if (form.fieldHints?.yesNo?.includes(key)) return "yesNo";
  return undefined;
}

/**
 * Title-case humanisation for record keys NOT surfaced in
 * `form.tableColumns`. Fallback for the few drawer-only fields the
 * Cordaid grid carries — `_submission_time`, `Subcounty`, `Village`,
 * `Feedback Channel used`, `Thematic Area`, `Date feedback was
 * resolved`, `Reported to Integrity Focal Person`, `Feedback
 * requires urgent response`, `Feedback Categorized as`. Title case
 * reads better than the raw snake_case / PascalCase key verbatim.
 *
 * "Days taken to resolved this feedback" → "Days Taken To Resolved
 * This Feedback" — readable, even if slightly verbose for the
 * handful of long-titled fields. Forms that want exact control can
 * future-proof with a `drawerLabels?: Record<string, string>` config.
 */
function humanize(key: string): string {
  return key
    .replace(/[_/]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Cell-label resolution. Looks up `form.tableColumns.label` by key
 * first (covers the 10 fields Cordaid's table renders with curated
 * labels like "Project", "Category", "Days"); falls back to
 * humanize(key) for any key NOT in tableColumns.
 */
function labelForKey(form: FormConfig, key: string): string {
  const col = form.tableColumns.find((c) => c.key === key);
  return col ? col.label : humanize(key);
}

/**
 * Read the drawer's title text. Pulls drawerHeader.titleField and
 * returns its string value (or empty string when null/non-string).
 * Falls back to TITLE_FALLBACK for missing/empty results so the
 * header always renders a non-empty title line.
 */
function readTitle(record: DynamicRecord, form: FormConfig): string {
  const f = form.drawerHeader?.titleField;
  if (!f) return TITLE_FALLBACK;
  const v = record[f];
  if (typeof v !== "string" || !v) return TITLE_FALLBACK;
  return v;
}

/**
 * Read the drawer's subtitle. Walks drawerHeader.subtitleFields,
 * joins each non-empty string with " · ". Returns null when no
 * subtitle field contributes a non-empty string so the Drawer
 * Description collapses cleanly (vs rendering a dangling " · ").
 */
function readSubtitle(record: DynamicRecord, form: FormConfig): string | null {
  const fields = form.drawerHeader?.subtitleFields ?? [];
  const parts: string[] = [];
  for (const f of fields) {
    const v = record[f];
    if (typeof v === "string" && v) parts.push(v);
  }
  return parts.length ? parts.join(" · ") : null;
}

export function DetailDrawer({
  record,
  open,
  onOpenChange,
  form,
}: DetailDrawerProps) {
  const [copied, setCopied] = useState(false);

  if (!record) return null;

  async function copyUuid() {
    if (!record) return;
    try {
      await navigator.clipboard.writeText(record._uuid);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Silently ignore — user can still see uuid below.
    }
  }

  // Per-form config-derived sets. We freeze the hidden-set + longText
  // set on every render — small (≤ 20 entries) so Set spread is cheap.
  const longTextKeys = new Set(
    (form.fieldHints?.longText ?? []).map((l) => l.field),
  );

  // Emergency-style header badge: take the FIRST yesNo key declared
  // and show its "Yes" value as a Badge with the warning icon. Cordaid
  // declares "Emergency Feedback" first; WeWork declares none. The
  // pattern generalises to any form whose first yesNo key semantically
  // indicates urgency.
  const emergencyKey = form.fieldHints?.yesNo?.[0];
  const emergencyValue = emergencyKey ? record[emergencyKey] : null;
  const showEmergency = emergencyValue === "Yes";

  // Status header badge: the FIRST status key declared, dispatched
  // through statusVariant for the colour-coded Resolved/New/Under
  // badge. Cordaid declares "Status of this feedback".
  const statusKey = form.fieldHints?.status?.[0];
  const statusValue = statusKey ? record[statusKey] : null;

  // Title + subtitle composition.
  const title = readTitle(record, form);
  const subtitle = readSubtitle(record, form);

  // Build the auto-discover field list. Order:
  //   1. form.tableColumns keys in declared order (Cordaid's curated
  //      sequence matches the original hardcoded grid closely).
  //   2. Any remaining record keys in Kobo-returned insertion order
  //      (so all `_submission_time`, `Subcounty`, `Village`,
  //      `Feedback Channel used`, etc. appear after the table columns
  //      and after the hidden + longText reservation filter).
  // Filters:
  //   - HIDDEN_KEYS: _id, _uuid, meta (defensive).
  //   - longTextKeys: reserved for dedicated sections above the grid.
  //   - Undefined record values are still rendered — the auto-discover
  //     preserves the field even when Kobo returned null, so the user
  //     can see "—" instead of a shrinking field list per record.
  const tableColumnOrder = form.tableColumns.map((c) => c.key);
  const tableColumnSet = new Set(tableColumnOrder);
  const seen = new Set<string>();
  const orderedEntries: Array<[string, Cell]> = [];

  // Pass 1: tableColumns keys in declared order.
  for (const k of tableColumnOrder) {
    if (HIDDEN_KEYS.has(k) || longTextKeys.has(k)) continue;
    if (!(k in record)) continue;
    orderedEntries.push([k, record[k]]);
    seen.add(k);
  }
  // Pass 2: remaining keys in Kobo-returned insertion order.
  for (const [k, v] of Object.entries(record)) {
    if (seen.has(k)) continue;
    if (HIDDEN_KEYS.has(k) || longTextKeys.has(k)) continue;
    if (!tableColumnSet.has(k) && (k === "_submission_time" || k === "meta")) continue;
    orderedEntries.push([k, v]);
    seen.add(k);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right">
        <DrawerHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="muted">
              <Hash className="h-3 w-3 mr-1" />
              {record._id}
            </Badge>
            {showEmergency && (
              <Badge variant="default">
                <MessageSquareWarning
                  className="h-3 w-3"
                  aria-hidden="true"
                />
                <span className="sr-only">Emergency feedback</span>
              </Badge>
            )}
            {statusKey && (
              <Badge variant={statusVariant(statusValue)}>
                {statusValue == null || statusValue === ""
                  ? "—"
                  : String(statusValue)}
              </Badge>
            )}
          </div>
          <DrawerTitle className="mt-2">{title}</DrawerTitle>
          {subtitle && <DrawerDescription>{subtitle}</DrawerDescription>}
        </DrawerHeader>

        <div className="flex-1 overflow-auto scroll-area px-5 py-4 space-y-5">
          {/* Long-text sections render above the grid in declared order.
              Each section keeps the labelled heading + thematic card
              styling so visual rhythm matches today's Cordaid drawer. */}
          {(form.fieldHints?.longText ?? []).map((lt) => {
            const v = record[lt.field];
            const text =
              typeof v === "string" ? v : v == null ? "" : String(v);
            const preview =
              text.length > 220
                ? text.slice(0, 220).trimEnd() + "…"
                : text;
            const title = lt.title ?? humanize(lt.field);
            return (
              <section key={lt.field}>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-cordaid-muted mb-2">
                  {title}
                </h4>
                <Card className="bg-cordaid-cream/60 p-4">
                  <p
                    className="text-sm leading-relaxed text-cordaid-dark"
                    title={text}
                  >
                    {preview || (
                      <span className="italic text-cordaid-muted">
                        No content yet
                      </span>
                    )}
                  </p>
                </Card>
              </section>
            );
          })}

          {/* Auto-discovered grid of remaining fields. */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {orderedEntries.map(([key, value]) => (
              <Field
                key={key}
                label={labelForKey(form, key)}
                value={value}
                chip={chipForKey(form, key)}
              />
            ))}
          </section>

          {/* Submission ID + copy-UUID section. */}
          <section className="pt-2 border-t border-cordaid-border">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-cordaid-muted">
                Submission ID
              </h4>
              <Button variant="ghost" size="sm" onClick={copyUuid} className="gap-1.5">
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copy UUID
                  </>
                )}
              </Button>
            </div>
            <code className="block break-all rounded-md bg-cordaid-cream px-3 py-2 text-xs text-cordaid-dark">
              {record._uuid}
            </code>
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
