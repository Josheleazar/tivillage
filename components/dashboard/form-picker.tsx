"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Layers } from "lucide-react";
import type { FormConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FormPickerProps {
  /**
   * All forms avail. for selection. The registry's iteration order is
   * preserved so dropdown rows line up with `lib/dashboards/index.ts`.
   */
  forms: FormConfig[];
  /** Currently active form — drives trigger label + active row checkmark. */
  current: FormConfig;
  /**
   * Invoked with the picked form's id. Parent (DashboardClient) runs
   * its `switchForm` callback which strips all filter params and
   * navigates to `?form=<id>`.
   */
  onSelect: (formId: string) => void;
}

/**
 * FormPicker — Layers-icon dropdown in the dashboard header.
 *
 * Step 6 of DASHPLUS_PLAN.md (dashPlus branch). Lightweight accessible
 * popover built without a new dep: button trigger + an absolutely-
 * positioned listbox panel that closes on outside click OR Escape key.
 * The lists close on selection so hitting the same form is a no-op
 * (avoids a wasted router.replace).
 *
 * Why not @radix-ui/react-dropdown-menu? — The shape is small enough
 * (~70 lines) that pulling a new dep + a shadcn primitive would cost
 * more than it saves for a single use site. Once a second popover
 * shape shows up, refactor this to a generic primitive.
 */
export function FormPicker({ forms, current, onSelect }: FormPickerProps) {
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState<number>(() => {
    const idx = forms.findIndex((f) => f.id === current.id);
    return idx >= 0 ? idx : 0;
  });
  /**
   * Why the panel closed. Drives the focus-restore decision in the
   * effect below: if the user picked an option or hit Escape we
   * escort focus back to the trigger; if they clicked outside, they
   * meant to drop focus wherever they clicked — we don't pull it back.
   */
  const [closeReason, setCloseReason] = useState<
    "select" | "escape" | "outside" | null
  >(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Mirror of focusedIdx so the key handler below never needs to
  // re-attach on every Arrow press (keeping it out of the effect's
  // dep array). The state still drives the visual treatment.
  const focusedIdxRef = useRef(0);

  function closeWith(reason: "select" | "escape" | "outside") {
    setCloseReason(reason);
    setOpen(false);
  }

  // Keep the ref mirroring the state so the keydown handler (registered
  // once while open=true) always reads the latest cursor without
  // needing focusedIdx in the effect's deps.
  useEffect(() => {
    focusedIdxRef.current = focusedIdx;
  }, [focusedIdx]);

  // Outside-click + Escape + Arrow/Home/End listeners only run while the
  // panel is open. Cleanup removes both when the panel closes (or the
  // component unmounts), so the capture set stays tight. Focus is
  // restored to the trigger ONLY when the user dismissed via selection
  // or Escape — outside-click is honored as a "I want focus where I
  // clicked" gesture; pulling focus back would fight the click.
  useEffect(() => {
    if (!open) {
      if (closeReason === "select" || closeReason === "escape") {
        triggerRef.current?.focus();
      }
      if (closeReason) setCloseReason(null);
      return;
    }
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closeWith("outside");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeWith("escape");
        return;
      }
      if (!forms.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIdx((i) => (i + 1) % forms.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIdx((i) => (i - 1 + forms.length) % forms.length);
      } else if (e.key === "Home") {
        e.preventDefault();
        setFocusedIdx(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setFocusedIdx(forms.length - 1);
      } else if (e.key === "Enter" || e.key === " ") {
        const pick = forms[focusedIdxRef.current];
        if (pick && pick.id !== current.id) {
          e.preventDefault();
          closeWith("select");
          onSelect(pick.id);
        }
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, forms, current.id, onSelect, closeReason]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => {
          if (open) {
            // Toggling closed via the trigger button itself: skip
            // focus restore (focus is already on the button) and
            // classify as "outside"-equivalent so the effect doesn't
            // yank focus on next open either.
            setCloseReason("outside");
            setOpen(false);
          } else {
            setOpen(true);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Form picker. Active: ${current.label}`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-sm font-semibold text-white",
          "transition hover:bg-white/25 backdrop-blur-sm",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        )}
      >
        <Layers className="h-4 w-4" />
        <span className="hidden sm:inline truncate max-w-[120px]">
          {current.label}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Available forms"
          className={cn(
            "absolute right-0 top-full mt-2 z-50 min-w-[240px]",
            "rounded-2xl border border-cordaid-border bg-white shadow-xl overflow-hidden",
            "animate-fade-in"
          )}
        >
          <div
            className={cn(
              "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide",
              "text-cordaid-muted border-b border-cordaid-border bg-cordaid-cream/60"
            )}
          >
            Available forms
          </div>
          {forms.length === 0 ? (
            <div className="px-4 py-3 text-xs text-cordaid-muted">
              No forms configured.
            </div>
          ) : (
            <ul className="py-1">
              {forms.map((f, i) => {
                const active = f.id === current.id;
                const focused = i === focusedIdx;
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setFocusedIdx(i)}
                      onClick={() => {
                        if (f.id !== current.id) {
                          closeWith("select");
                          onSelect(f.id);
                        } else {
                          // Same-form selection is a no-op to avoid a wasted
                          // router.replace (which would clear unrelated params);
                          // still close the panel.
                          closeWith("select");
                        }
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm transition-colors border-l-2",
                        active
                          ? "bg-cordaid-cream text-cordaid-dark border-cordaid-red"
                          : focused
                            ? "bg-cordaid-red/5 text-cordaid-dark border-transparent"
                            : "hover:bg-cordaid-cream/60 text-cordaid-dark border-transparent"
                      )}
                    >
                      <Layers
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active || focused
                            ? "text-cordaid-red"
                            : "text-cordaid-muted"
                        )}
                      />
                      <span className="flex-1 font-semibold truncate">
                        {f.label}
                      </span>
                      {active && (
                        <Check
                          className="h-4 w-4 shrink-0 text-cordaid-red"
                          aria-hidden
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
