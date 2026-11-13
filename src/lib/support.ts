export type SupportStatus = "open" | "in_progress" | "waiting_on_you" | "completed";
export type SupportPriority = "low" | "normal" | "high" | "urgent";

export const STATUSES: SupportStatus[] = ["open", "in_progress", "waiting_on_you", "completed"];
export const PRIORITIES: SupportPriority[] = ["low", "normal", "high", "urgent"];

export const STATUS_LABEL: Record<SupportStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_you: "Waiting on you",
  completed: "Completed",
};
export const STATUS_TONE = {
  open: "warning",
  in_progress: "brand",
  waiting_on_you: "violet",
  completed: "success",
} as const;

export const PRIORITY_LABEL: Record<SupportPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};
export const PRIORITY_TONE = {
  low: "neutral",
  normal: "clay",
  high: "warning",
  urgent: "error",
} as const;

/** Up to three images per ticket, two megabytes each; JPEG, PNG or WebP. The server checks the file's own bytes too. */
export const MAX_FILES = 3;
export const MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Why a chosen file can't be attached, or null if it can. */
export function fileProblem(f: File): string | null {
  if (!IMAGE_TYPES.includes(f.type)) return `"${f.name}" isn't a JPEG, PNG or WebP image.`;
  if (f.size > MAX_BYTES) return `"${f.name}" is larger than 2 MB.`;
  return null;
}

/** What the forms allow, all counted in characters: a subject of up to 50, a description of up to 500, a reply of up to 500. */
export const SUBJECT_MAX_CHARS = 50;
export const QUESTION_MAX_CHARS = 500;
export const REPLY_MAX_CHARS = 500;
