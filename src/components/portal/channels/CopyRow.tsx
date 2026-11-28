"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/erp-ui/Button";
import { toast } from "@/lib/toast";

export function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Couldn't copy", "Select it and copy by hand."),
  );
}

/** A value the tenant has to paste somewhere else, with a Copy button. */
export function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-space-2">
      <p className="text-[12px] text-ink-400">{label}</p>
      <div className="flex items-center gap-space-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-paper px-space-2 py-1.5 text-[13px] text-ink-900">
          {value}
        </code>
        <Button variant="secondary" aria-label={`Copy ${label}`} onClick={() => copy(value)}>
          <Copy size={14} /> Copy
        </Button>
      </div>
    </div>
  );
}
