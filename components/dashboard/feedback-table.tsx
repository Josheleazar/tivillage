"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { searchRecords } from "@/lib/filters";
import { cn } from "@/lib/utils";
import type { Cell, DynamicRecord, FormConfig } from "@/lib/types";

// No bridge alias — feedback-table.tsx natively consumes DynamicRecord +
// FormConfig (tableColumns + searchFields) as of Step 9. lib/filters.ts's
// searchRecords now emits DynamicRecord[]; we read it without aliasing.

const PAGE_SIZES = [10, 25, 50, 100] as const;

/**
 * Read a record cell for use as a sort key. Lazy to keep the comparator
 * in buildComparator as flat as possible — when sortKey advances past a
 * row we only touch rank-of-N cell reads rather than re-fetching the
 * search-records memo.
 */
function valueFor(r: DynamicRecord, key: string): Cell {
  return r[key];
}

function buildComparator(
  col: { key: string },
  dir: "asc" | "desc",
): (a: DynamicRecord, b: DynamicRecord) => number {
  return (a, b) => {
    const va = valueFor(a, col.key);
    const vb = valueFor(b, col.key);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") {
      return dir === "asc" ? va - vb : vb - va;
    }
    const sa = String(va);
    const sb = String(vb);
    return dir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
  };
}

/**
 * Status-derived Badge variant. Coerces Cell to string before the
 * includes() check so integer/null Cell variants don't trip TS — Kobo
 * select_one options normalise to display labels, so Cell is
 * overwhelmingly a string here, but older deployments can leave
 * numeric responses as numbers.
 */
function statusVariant(status: Cell): "success" | "warning" | "muted" {
  const v =
    typeof status === "string"
      ? status
      : status == null
        ? ""
        : String(status);
  if (!v) return "muted";
  if (v.includes("Resolved")) return "success";
  if (v.includes("New") || v.includes("Under")) return "warning";
  return "muted";
}

/**
 * Yes/No Badge variant. Today used for boolean-style feedback like
 * Cordaid's `Emergency Feedback` column; defaults to muted when the
 * value isn't the literal "Yes".
 */
function yesNoVariant(v: Cell): "default" | "muted" {
  return v === "Yes" ? "default" : "muted";
}

interface FeedbackTableProps {
  records: DynamicRecord[];
  /**
   * Form config drives the table-scoped quick filter (searchRecords walks
   * `form.searchFields`) and per-form column set (`form.tableColumns`).
   * Step 9 reformats the table to iterate `form.tableColumns` instead of
   * the legacy hardcoded COLUMNS array; adding a third form needs zero
   * edits to this file.
   */
  form: FormConfig;
  onSelect: (record: DynamicRecord) => void;
}

export function FeedbackTable({ records, form, onSelect }: FeedbackTableProps) {
  const columns = form.tableColumns;
  // Default sort to the first declared column. The `?` keeps the
  // initialiser safe when a form legitimately declares no columns
  // (today only cordaidDemo and Wework declare 9–10 columns each); the
  // empty string falls back to "no sort" if a form ever lists zero.
  const [sortKey, setSortKey] = useState<string>(() => columns[0]?.key ?? "");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);
  const [localSearch, setLocalSearch] = useState("");

  // Table-scoped quick filter: applies on TOP of the page-level filters that
  // produced `records`, and is intentionally independent of the global
  // FilterBar so it doesn't affect KPIs, charts, or the CSV export.
  const tableRows = useMemo(
    () => searchRecords(records, localSearch, form.searchFields),
    [records, localSearch, form.searchFields],
  );

  // Reset to first page whenever the table-scoped search changes.
  useEffect(() => {
    setPage(0);
  }, [localSearch]);

  // Reset sortKey + page if a form switch left sortKey pointing at a
  // column the new form doesn't have. Falls through to the first
  // declared column for the new form so the table keeps a sensible
  // default.
  useEffect(() => {
    if (!columns.some((c) => c.key === sortKey)) {
      setSortKey(columns[0]?.key ?? "");
      setPage(0);
    }
  }, [columns, sortKey]);

  const sortedRows = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return tableRows;
    return [...tableRows].sort(buildComparator(col, sortDir));
  }, [tableRows, columns, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sortedRows.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize,
  );
  const start = sortedRows.length === 0 ? 0 : safePage * pageSize + 1;
  const end = Math.min(sortedRows.length, safePage * pageSize + pageSize);

  function toggleSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  /**
   * Cell renderer that dispatches on `col.chip`:
   *  - `chip: "status"` renders a colour-coded Badge (Resolved → success,
   *    New/Under → warning, else muted).
   *  - `chip: "yesNo"` renders a yes/No Badge (Yes → default, else muted).
   *  - Undefined renders plain text. The numeric right-align flag still
   *    flows through the parent <TableCell>'s className.
   */
  function renderCell(
    col: { key: string; chip?: "yesNo" | "status" },
    r: DynamicRecord,
  ) {
    const v = valueFor(r, col.key);
    const display = v == null || v === "" ? "—" : String(v);
    if (col.chip === "status") {
      return <Badge variant={statusVariant(v)}>{display}</Badge>;
    }
    if (col.chip === "yesNo") {
      return <Badge variant={yesNoVariant(v)}>{display}</Badge>;
    }
    return display;
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle>Records</CardTitle>
            <p className="mt-1 text-xs text-cordaid-muted">
              {sortedRows.length === tableRows.length ? (
                <>
                  {sortedRows.length.toLocaleString()} of {records.length.toLocaleString()}{" "}
                  records · showing {start.toLocaleString()}–{end.toLocaleString()} · click any row for full details
                </>
              ) : (
                <>
                  {sortedRows.length.toLocaleString()} of {records.length.toLocaleString()}{" "}
                  records ({tableRows.length.toLocaleString()} match the table search) ·
                  showing {start.toLocaleString()}–{end.toLocaleString()}
                </>
              )}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cordaid-muted" />
            <Input
              type="search"
              placeholder="Quick filter rows…"
              aria-label="Quick filter rows in the table"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="h-9 pl-9 pr-9"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch("")}
                aria-label="Clear table search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-cordaid-muted transition-colors hover:bg-cordaid-cream hover:text-cordaid-dark focus:outline-none focus:ring-2 focus:ring-cordaid-red/40"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-t border-cordaid-border">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                {columns.map((col) => {
                  const Icon =
                    sortKey === col.key
                      ? sortDir === "asc"
                        ? ArrowUp
                        : ArrowDown
                      : ArrowUpDown;
                  return (
                    <TableHead
                      key={col.key}
                      className={cn(col.align === "right" && "text-right")}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={cn(
                          "inline-flex items-center gap-1.5 uppercase tracking-wide text-[11px] font-semibold",
                          "hover:text-cordaid-dark transition-colors",
                          col.align === "right" && "flex-row-reverse",
                        )}
                      >
                        {col.label}
                        <Icon className="h-3.5 w-3.5 opacity-70" />
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="px-6 py-10 text-center text-cordaid-muted"
                  >
                    {records.length === 0 ? (
                      <span>
                        No feedback matches the global filters. Adjust the filters above to widen the result set.
                      </span>
                    ) : localSearch ? (
                      <span className="inline-flex flex-col items-center gap-2">
                        <span>
                          No rows match{" "}
                          <span className="font-semibold text-cordaid-dark">
                            “{localSearch}”
                          </span>{" "}
                          in the table.
                        </span>
                        <button
                          type="button"
                          onClick={() => setLocalSearch("")}
                          className="inline-flex items-center gap-1 rounded-full border border-cordaid-border bg-white px-3 py-1 text-xs font-semibold text-cordaid-dark transition-colors hover:bg-cordaid-cream"
                        >
                          <X className="h-3.5 w-3.5" />
                          Clear table search
                        </button>
                      </span>
                    ) : (
                      <span>Sort or paginate to view more feedback rows.</span>
                    )}
                  </TableCell>
                </TableRow>
              )}
              {pageRows.map((r) => (
                <TableRow
                  key={r._uuid}
                  onClick={() => onSelect(r)}
                  className="cursor-pointer"
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        col.align === "right" && "text-right tabular-nums",
                        // Truncate long free-text columns so the table
                        // stays readable when an enterprise-list / long
                        // description value would otherwise stretch.
                        col.chip == null &&
                          typeof r[col.key] === "string" &&
                          "max-w-[220px] truncate",
                      )}
                    >
                      {renderCell(col, r)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cordaid-border px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-cordaid-muted">
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
              className="h-8 rounded-md border border-cordaid-border bg-white px-2 text-sm text-cordaid-dark focus:outline-none focus:ring-2 focus:ring-cordaid-red/40"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="px-3 text-xs text-cordaid-muted tabular-nums">
              Page {safePage + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              className="gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
