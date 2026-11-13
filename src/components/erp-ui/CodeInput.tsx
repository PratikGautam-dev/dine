"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/** A one-time code typed into one box per digit. The value is a plain digit string with no gaps (what a single box would hold),
 * so the form's logic doesn't change: typing moves to the next box, Backspace on an empty box goes back, a pasted or phone-filled
 * code fills every box, and a click past the last digit lands on the next empty box. */
export function CodeInput({
  value,
  onChange,
  length = 6,
  autoFocus,
  label = `${length}-digit code`,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  label?: string;
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  // The code as of the last keystroke. Moving to the next box fires its focus check before React re-renders with the new value, so
  // the handlers read this instead of `value` (which would still be the old code there and send the cursor back to the start).
  const current = useRef(value);
  useEffect(() => {
    current.current = value;
  }, [value]);
  const change = (next: string) => {
    current.current = next;
    onChange(next);
  };
  const focus = (i: number) =>
    boxes.current[Math.max(0, Math.min(i, length - 1))]?.focus();

  // Writes `typed` (digits only) starting at box i, then moves to the box after it.
  function put(i: number, typed: string) {
    const digits = typed.replace(/\D/g, "");
    if (!digits) return;
    if (digits.length >= length) {
      change(digits.slice(0, length)); // a whole code: pasted, or filled in by the phone
      return focus(length - 1);
    }
    const code = current.current;
    change(
      (code.slice(0, i) + digits + code.slice(i + digits.length)).slice(
        0,
        length,
      ),
    );
    focus(i + digits.length);
  }

  // Removes the digit in box i; the ones after it move up, so the value never has a gap.
  function remove(i: number) {
    const code = current.current;
    change(code.slice(0, i) + code.slice(i + 1));
  }

  return (
    <div
      role="group"
      aria-label={label}
      className="flex justify-between gap-space-2"
    >
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          aria-label={`Digit ${i + 1} of ${length}`}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && i === 0}
          value={value[i] ?? ""}
          onFocus={(e) => {
            const filled = current.current.length;
            if (i > filled) return focus(filled); // no gaps: start at the first empty box
            e.target.select(); // so typing replaces the digit that's there
          }}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "") remove(i);
            else put(i, next);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !current.current[i] && i > 0) {
              e.preventDefault();
              remove(i - 1);
              focus(i - 1);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              focus(i - 1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              focus(i + 1);
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            put(i, e.clipboardData.getData("text"));
          }}
          className={cn(
            "h-12 w-full min-w-0 rounded-md border border-line bg-card text-center text-[20px] font-semibold text-ink-900 shadow-[var(--shadow-sm)]",
            "transition-[border-color,box-shadow] duration-150 ease-(--ease-standard)",
            "focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none",
            value[i] && "border-brand-300",
          )}
        />
      ))}
    </div>
  );
}
