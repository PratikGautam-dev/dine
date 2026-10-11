"use client";

import { useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Image as ImageIcon, Mail, Send, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Input";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/formatDate";
import type { Patient } from "@/hooks/usePatients";
import type { Campaign } from "@/hooks/useCampaigns";
import type { CustomerSegment, SegmentMember } from "@/hooks/useCustomerSegments";

// Gmail's own web-compose recipient ceiling is ~500 -- staying comfortably under it rather than
// hitting an undocumented hard failure partway through a large restaurant's customer base.
const MAX_RECIPIENTS = 480;

type Audience = "all" | "segment" | "tag";

// Common restaurant campaign shapes -- a starting point to edit, not a rigid form. Filling in
// subject + body only (no image); staff adds a photo separately if they want one.
const TEMPLATES = [
  {
    id: "weekend-special",
    label: "Weekend Special",
    subject: "This weekend's special at {{restaurant}} 🍽️",
    body: "Hi there,\n\nWe've put together something special for this weekend. Swing by or order in and try it out!\n\nSee you soon,\n{{restaurant}}",
  },
  {
    id: "new-menu",
    label: "New Menu Launch",
    subject: "New on the menu at {{restaurant}} 🎉",
    body: "Hi there,\n\nWe've just added some new dishes to the menu and we think you'll love them. Come in and be one of the first to try them!\n\n{{restaurant}}",
  },
  {
    id: "festive-offer",
    label: "Festive Offer",
    subject: "A festive treat from {{restaurant}} 🎊",
    body: "Hi there,\n\nTo celebrate the season, we're running a special offer for our regulars. Come celebrate with us!\n\nWarm wishes,\n{{restaurant}}",
  },
  {
    id: "win-back",
    label: "We Miss You",
    subject: "We miss you at {{restaurant}}!",
    body: "Hi there,\n\nIt's been a while since your last visit and we wanted to check in. We'd love to have you back soon!\n\n{{restaurant}}",
  },
  {
    id: "loyalty-reminder",
    label: "Loyalty Points Reminder",
    subject: "Your loyalty points are waiting at {{restaurant}}",
    body: "Hi there,\n\nJust a reminder that you've got loyalty points sitting in your account. Come redeem them on your next visit!\n\n{{restaurant}}",
  },
  {
    id: "thank-you",
    label: "Thank You",
    subject: "Thank you for being a loyal customer",
    body: "Hi there,\n\nWe just wanted to say thank you for your continued support -- it genuinely means a lot to us.\n\nWith gratitude,\n{{restaurant}}",
  },
] as const;

function buildGmailComposeUrl(emails: string[], subject: string, body: string): string {
  const params = new URLSearchParams({
    view: "cm", fs: "1", bcc: emails.slice(0, MAX_RECIPIENTS).join(","), su: subject, body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

const HISTORY_COLUMNS: ColumnDef<Campaign>[] = [
  { id: "subject", header: "Subject", cell: ({ row }) => <span className="font-semibold text-ink-900">{row.original.subject}</span> },
  { id: "audience", header: "Audience", cell: ({ row }) => row.original.audience_label },
  {
    id: "recipients",
    header: "Recipients",
    cell: ({ row }) => <span className="tabular-nums">{row.original.recipient_count}</span>,
  },
  { id: "created_by", header: "Opened by", cell: ({ row }) => row.original.created_by || "—" },
  { id: "created_at", header: "Date", cell: ({ row }) => formatDateTime(row.original.created_at) },
];

/** Customers page's Campaigns tab -- there's no email-sending infrastructure in this app (no
 * SMTP/SendGrid anywhere), so a campaign is composed here and handed off to the staff member's
 * own Gmail via a pre-filled compose URL -- the same hand-off-to-the-real-channel pattern wa.me
 * links already use for WhatsApp elsewhere on this page. The app never claims an email was
 * delivered, or even sent; it only knows the compose window was opened, and logs that for the
 * history table below. */
export function CampaignsPanel({
  directory,
  segments,
  segmentMembers,
  segmentMembersLoading,
  onLoadSegmentMembers,
  campaigns,
  creating,
  onCreateCampaign,
  uploadingImage,
  onUploadImage,
  restaurantName,
}: {
  directory: Patient[] | null;
  segments: CustomerSegment[] | null;
  segmentMembers: SegmentMember[] | null;
  segmentMembersLoading: boolean;
  onLoadSegmentMembers: (id: number) => void;
  campaigns: Campaign[] | null;
  creating: boolean;
  onCreateCampaign: (subject: string, audienceLabel: string, recipientCount: number) => Promise<boolean>;
  uploadingImage: boolean;
  onUploadImage: (file: File) => Promise<string | null>;
  restaurantName: string;
}) {
  const [audience, setAudience] = useState<Audience>("all");
  const [segmentId, setSegmentId] = useState<number | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function applyTemplate(t: (typeof TEMPLATES)[number]) {
    const fill = (s: string) => s.replaceAll("{{restaurant}}", restaurantName || "us");
    setSubject(fill(t.subject));
    setBody(fill(t.body));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await onUploadImage(file);
    if (!url) return;
    setImageUrl(url);
    setBody((b) => `${b}${b.trim() ? "\n\n" : ""}📷 Image: ${url}`);
  }

  function removeImage() {
    if (imageUrl) setBody((b) => b.replace(`📷 Image: ${imageUrl}`, "").trimEnd());
    setImageUrl(null);
  }

  const tagEntries = useMemo(() => {
    const byTag = new Map<string, Patient[]>();
    for (const p of directory ?? []) {
      for (const t of p.tags ?? []) {
        if (!byTag.has(t)) byTag.set(t, []);
        byTag.get(t)!.push(p);
      }
    }
    return [...byTag.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [directory]);

  function selectSegment(id: number) {
    setSegmentId(id);
    onLoadSegmentMembers(id);
  }

  const { recipients, audienceLabel, loadingRecipients } = useMemo(() => {
    if (audience === "all") {
      const emails = (directory ?? []).map((p) => p.email).filter((e): e is string => !!e);
      return { recipients: emails, audienceLabel: "All customers", loadingRecipients: false };
    }
    if (audience === "segment") {
      const segment = segments?.find((s) => s.id === segmentId);
      if (!segment) return { recipients: [], audienceLabel: "", loadingRecipients: false };
      if (segmentMembersLoading) return { recipients: [], audienceLabel: segment.name, loadingRecipients: true };
      const emails = (segmentMembers ?? []).map((m) => m.email).filter((e): e is string => !!e);
      return { recipients: emails, audienceLabel: `Segment: ${segment.name}`, loadingRecipients: false };
    }
    if (audience === "tag") {
      if (!tag) return { recipients: [], audienceLabel: "", loadingRecipients: false };
      const members = tagEntries.find(([t]) => t === tag)?.[1] ?? [];
      const emails = members.map((p) => p.email).filter((e): e is string => !!e);
      return { recipients: emails, audienceLabel: `Tag: ${tag}`, loadingRecipients: false };
    }
    return { recipients: [], audienceLabel: "", loadingRecipients: false };
  }, [audience, directory, segments, segmentId, segmentMembers, segmentMembersLoading, tag, tagEntries]);

  const totalInAudience =
    audience === "all"
      ? (directory ?? []).length
      : audience === "segment"
        ? (segmentMembers ?? []).length
        : (tagEntries.find(([t]) => t === tag)?.[1].length ?? 0);

  const canSend = recipients.length > 0 && subject.trim().length > 0 && !loadingRecipients;

  async function handleOpenInGmail() {
    if (!canSend) return;
    window.open(buildGmailComposeUrl(recipients, subject.trim(), body), "_blank", "noopener,noreferrer");
    const ok = await onCreateCampaign(subject.trim(), audienceLabel, recipients.length);
    if (ok) {
      setSubject("");
      setBody("");
      setImageUrl(null);
    }
  }

  return (
    <div className="space-y-space-4">
      <PermissionGate page="patients" action="write">
        <Card className="p-space-4">
          <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">New campaign</h3>

          <p className="mb-space-2 text-[11px] font-semibold text-ink-600">AUDIENCE</p>
          <div className="mb-space-3 flex flex-wrap gap-space-2">
            {(["all", "segment", "tag"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAudience(a)}
                className={cn(
                  "rounded-md border px-space-3 py-space-1 text-[12.5px] font-semibold capitalize transition-colors",
                  audience === a
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-line bg-card text-ink-700 hover:border-brand-300 hover:bg-brand-50",
                )}
              >
                {a === "all" ? "All customers" : a}
              </button>
            ))}
          </div>

          {audience === "segment" && (
            <div className="mb-space-3 flex flex-wrap gap-space-2">
              {(segments ?? []).length === 0 ? (
                <p className="text-[12.5px] text-ink-400">No saved segments yet — create one on the Segments tab.</p>
              ) : (
                segments!.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectSegment(s.id)}
                    className={cn(
                      "rounded-full border px-space-3 py-1 text-[12px] font-semibold",
                      segmentId === s.id
                        ? "border-brand-600 bg-brand-50 text-brand-700"
                        : "border-line bg-card text-ink-600 hover:border-brand-300",
                    )}
                  >
                    {s.name} ({s.member_count})
                  </button>
                ))
              )}
            </div>
          )}

          {audience === "tag" && (
            <div className="mb-space-3 flex flex-wrap gap-space-2">
              {tagEntries.length === 0 ? (
                <p className="text-[12.5px] text-ink-400">No tags yet — add one on the Tags tab.</p>
              ) : (
                tagEntries.map(([t, members]) => (
                  <button key={t} type="button" onClick={() => setTag(t)}>
                    <Badge tone={tag === t ? "brand" : "neutral"}>
                      {t} ({members.length})
                    </Badge>
                  </button>
                ))
              )}
            </div>
          )}

          <p className="mb-space-2 text-[11px] font-semibold text-ink-600">TEMPLATES</p>
          <div className="mb-space-4 flex flex-wrap gap-space-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className="rounded-full border border-dashed border-line px-space-3 py-1 text-[12px] font-semibold text-ink-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                {t.label}
              </button>
            ))}
          </div>

          <Field label="Subject" htmlFor="campaign-subject" required>
            <Input
              id="campaign-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. This weekend's specials"
            />
          </Field>
          <Field label="Message" htmlFor="campaign-body" hint="Opens in Gmail for final review before sending.">
            <Textarea
              id="campaign-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Write your message…"
            />
          </Field>

          <div className="mb-space-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            {imageUrl ? (
              <div className="flex items-start gap-space-3 rounded-lg border border-line bg-paper p-space-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- a restaurant-uploaded
                    photo on an R2/local URL, not a Next-optimizable static asset */}
                <img
                  src={imageUrl}
                  alt="Campaign"
                  draggable
                  className="h-16 w-16 shrink-0 cursor-grab rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-ink-900">Image attached</p>
                  <p className="text-hint">
                    Dropped into the message as a link. For an inline photo, drag this image into the
                    Gmail window once it opens.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removeImage}
                  aria-label="Remove image"
                  className="shrink-0 rounded-md p-1 text-ink-400 hover:bg-black/[0.04] hover:text-destructive"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="flex w-full items-center justify-center gap-space-2 rounded-lg border border-dashed border-line py-space-3 text-[12.5px] font-semibold text-ink-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
              >
                <ImageIcon size={14} /> {uploadingImage ? "Uploading…" : "Insert an image"}
              </button>
            )}
          </div>

          <p className="mb-space-3 text-[12.5px] text-ink-600">
            {loadingRecipients
              ? "Loading recipients…"
              : audienceLabel
                ? `${recipients.length} of ${totalInAudience} ${totalInAudience === 1 ? "customer has" : "customers have"} an email on file.`
                : "Choose an audience above."}
            {recipients.length > MAX_RECIPIENTS && (
              <span className="block text-warning">
                Only the first {MAX_RECIPIENTS} will be included — Gmail limits BCC recipients per message.
              </span>
            )}
          </p>

          <Button onClick={handleOpenInGmail} disabled={!canSend || creating} className="w-full">
            <Send size={14} /> {creating ? "Opening…" : "Open in Gmail"}
          </Button>
        </Card>
      </PermissionGate>

      <Card className="p-space-4">
        <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Campaign history</h3>
        {!campaigns ? (
          <TableSkeleton rows={4} columns={1} />
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center gap-space-2 rounded-lg bg-paper py-space-6 text-center">
            <Mail size={22} className="text-ink-300" />
            <p className="text-[12.5px] text-ink-400">No campaigns sent yet.</p>
          </div>
        ) : (
          <DataTable columns={HISTORY_COLUMNS} data={campaigns} getRowId={(c) => String(c.id)} />
        )}
      </Card>
    </div>
  );
}
