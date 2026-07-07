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
import {
  Calendar,
  ClipboardList,
  Hash,
  MapPin,
  MessageSquareWarning,
  Tag,
  User,
} from "lucide-react";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { FeedbackRecord } from "@/lib/types";

interface DetailDrawerProps {
  record: FeedbackRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({
  label,
  value,
  full = false,
}: {
  label: string;
  value: string | number | null | undefined;
  full?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", full && "sm:col-span-2")}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-cordaid-muted">
        {label}
      </span>
      <span className="text-sm text-cordaid-dark break-words">
        {value == null || value === "" ? "—" : String(value)}
      </span>
    </div>
  );
}

function StatusBadge({ value }: { value: string | null | undefined }) {
  if (!value) {
    return <Badge variant="muted">—</Badge>;
  }
  if (value.includes("Resolved")) return <Badge variant="success">{value}</Badge>;
  if (value.includes("New") || value.includes("Under"))
    return <Badge variant="warning">{value}</Badge>;
  return <Badge variant="default">{value}</Badge>;
}

export function DetailDrawer({ record, open, onOpenChange }: DetailDrawerProps) {
  const [copied, setCopied] = useState(false);

  if (!record) return null;

  const description =
    record["Description of feedback, suggestion or complaint"] ?? "";
  const descriptionShort =
    description.length > 220
      ? description.slice(0, 220).trimEnd() + "…"
      : description;

  async function copyUuid() {
    if (!record) return;
    try {
      await navigator.clipboard.writeText(record._uuid);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Silently ignore — user can still see uuid below
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right">
        <DrawerHeader>
          <div className="flex items-center gap-2">
            <Badge variant="muted">
              <Hash className="h-3 w-3 mr-1" />
              {record._id}
            </Badge>
            {record["Emergency Feedback"] === "Yes" && (
              <Badge variant="default">
                <MessageSquareWarning className="h-3 w-3 mr-1" />
                Emergency
              </Badge>
            )}
            <StatusBadge value={record["Status of this feedback"]} />
          </div>
          <DrawerTitle className="mt-2">
            {record["Who is giving feedback?"] || "Anonymous respondent"}
          </DrawerTitle>
          <DrawerDescription>
            {record.Activity ? `${record.Activity} · ` : ""}
            {record["Project related to feedback"] ?? "Unspecified project"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-auto scroll-area px-5 py-4 space-y-5">
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-cordaid-muted mb-2">
              The feedback
            </h4>
            <p className="text-sm leading-relaxed text-cordaid-dark" title={description}>
              {descriptionShort || (
                <span className="text-cordaid-muted italic">No description provided</span>
              )}
            </p>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-cordaid-muted mb-2">
              Actions taken
            </h4>
            <Card className="bg-cordaid-cream/60 p-4">
              <p className="text-sm leading-relaxed text-cordaid-dark">
                {record["Description of actions taken"] || (
                  <span className="italic text-cordaid-muted">
                    No actions recorded yet
                  </span>
                )}
              </p>
            </Card>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Date" value={record.Date} />
            <Field label="Submission time" value={record._submission_time} />
            <Field label="District" value={record.District} />
            <Field label="Subcounty" value={record.Subcounty} />
            <Field label="Village" value={record.Village} />
            <Field label="Channel" value={record["Feedback Channel used"]} />
            <Field label="Category" value={record["Feedback Category"]} />
            <Field label="Thematic area" value={record["Thematic Area"]} />
            <Field label="Gender" value={record.Gender} />
            <Field label="Age" value={record.Age} />
            <Field label="Referral status" value={record["Referral Status"]} />
            <Field label="Days to resolve" value={record["Days taken to resolved this feedback"]} />
            <Field label="Date resolved" value={record["Date feedback was resolved"]} />
            <Field label="Reported to integrity focal person" value={record["Reported to Integrity Focal Person"]} />
            <Field label="Requires urgent response" value={record["Feedback requires urgent response"]} />
            <Field label="Categorized as" value={record["Feedback Categorized as"]} />
          </section>

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

        <div className="border-t border-cordaid-border px-5 py-4 text-xs text-cordaid-muted flex flex-wrap gap-4">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {record.Date ?? "—"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {record.District ?? "—"}
            {record.Subcounty ? ` · ${record.Subcounty}` : ""}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            {record["Who is giving feedback?"] ?? "Anonymous"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            <Tag className="h-3.5 w-3.5" />
            {record.Activity ?? "—"}
          </span>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
