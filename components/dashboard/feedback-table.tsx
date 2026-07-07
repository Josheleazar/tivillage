"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FeedbackRecord } from "@/lib/types";

type SortKey =
  | "Date"
  | "Project"
  | "District"
  | "Category"
  | "Status"
  | "Gender"
  | "Age"
  | "Referral"
  | "Days";

interface ColumnDef {
  key: SortKey;
  label: string;
  align?: "left" | "right";
  accessor: (r: FeedbackRecord) => string | number | null;
}

const COLUMNS: ColumnDef[] = [
  { key: "Date", label: "Date", accessor: (r) => r.Date ?? "" },
  {
    key: "Project",
    label: "Project",
    accessor: (r) => r["Project related to feedback"] ?? "",
  },
  { key: "District", label: "District", accessor: (r) => r.District ?? "" },
  { key: "Category", label: "Category", accessor: (r) => r["Feedback Category"] ?? "" },
  { key: "Status", label: "Status", accessor: (r) => r["Status of this feedback"] ?? "" },
  { key: "Gender", label: "Gender", accessor: (r) => r.Gender ?? "" },
  { key: "Age", label: "Age", accessor: (r) => r.Age, align: "right" },
  {
    key: "Referral",
    label: "Referral",
    accessor: (r) => r["Referral Status"] ?? "",
  },
  {
    key: "Days",
    label: "Days",
    accessor: (r) => r["Days taken to resolved this feedback"],
    align: "right",
  },
];

const PAGE_SIZES = [10, 25, 50, 100] as const;

function statusVariant(status: string | null): "success" | "warning" | "muted" {
  if (!status) return "muted";
  if (status.includes("Resolved")) return "success";
  if (status.includes("New") || status.includes("Under")) return "warning";
  return "muted";
}

function emergencyVariant(v: string | null): "default" | "muted" {
  return v === "Yes" ? "default" : "muted";
}

interface FeedbackTableProps {
  records: FeedbackRecord[];
  onSelect: (record: FeedbackRecord) => void;
}

export function FeedbackTable({ records, onSelect }: FeedbackTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("Date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);

  const sortedRows = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey);
    if (!col) return records;
    const comparator = (a: FeedbackRecord, b: FeedbackRecord) => {
      const va = col.accessor(a);
      const vb = col.accessor(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const sa = String(va);
      const sb = String(vb);
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    };
    return [...records].sort(comparator);
  }, [records, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sortedRows.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const start = sortedRows.length === 0 ? 0 : safePage * pageSize + 1;
  const end = Math.min(sortedRows.length, safePage * pageSize + pageSize);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle>Feedback records</CardTitle>
          <p className="text-xs text-cordaid-muted">
            {sortedRows.length.toLocaleString()} records · showing {start.toLocaleString()}–
            {end.toLocaleString()} · click any row for full details
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-t border-cordaid-border">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                {COLUMNS.map((col) => {
                  const Icon =
                    sortKey === col.key
                      ? sortDir === "asc"
                        ? ArrowUp
                        : ArrowDown
                      : ArrowUpDown;
                  return (
                    <TableHead key={col.key} className={cn(col.align === "right" && "text-right")}>
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={cn(
                          "inline-flex items-center gap-1.5 uppercase tracking-wide text-[11px] font-semibold",
                          "hover:text-cordaid-dark transition-colors",
                          col.align === "right" && "flex-row-reverse"
                        )}
                      >
                        {col.label}
                        <Icon className="h-3.5 w-3.5 opacity-70" />
                      </button>
                    </TableHead>
                  );
                })}
                <TableHead className="w-[120px] text-right uppercase tracking-wide text-[11px] font-semibold">
                  Emergency
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length + 1} className="text-center text-cordaid-muted py-10">
                    No feedback matches the current filters.
                  </TableCell>
                </TableRow>
              )}
              {pageRows.map((r) => (
                <TableRow
                  key={r._uuid}
                  onClick={() => onSelect(r)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium tabular-nums whitespace-nowrap">
                    {r.Date ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">{r["Project related to feedback"] ?? "—"}</TableCell>
                  <TableCell>{r.District ?? "—"}</TableCell>
                  <TableCell>{r["Feedback Category"] ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r["Status of this feedback"])}>
                      {r["Status of this feedback"] ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.Gender ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.Age ?? "—"}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{r["Referral Status"] ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r["Days taken to resolved this feedback"] ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={emergencyVariant(r["Emergency Feedback"])}>
                      {r["Emergency Feedback"] ?? "—"}
                    </Badge>
                  </TableCell>
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
