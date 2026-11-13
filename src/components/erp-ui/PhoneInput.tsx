"use client";

import { forwardRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  COUNTRY_PREFIX,
  phoneError,
  phoneForInput,
  type PhoneKind,
} from "@/lib/erp/phone";

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
  /** Set by a form that validates itself (a schema): it shows the message. Left out, the field checks itself once it loses focus. */
  invalid?: boolean;
  /** "mobile" for people; "any" also takes a landline with its STD code. */
  kind?: PhoneKind;
};

/** A phone field: a fixed "+91" in front, the number typed after it ("98765 43210"). What was typed is passed on as it is; on blur a
 * valid number is tidied ("09876543210" -> "98765 43210"). Before sending, check with lib/phone (phoneError / phoneField) and send
 * toE164(value): the server stores E.164 and applies the same rule. */
export const PhoneInput = forwardRef<HTMLInputElement, Props>(
  function PhoneInput(
    { value, onChange, invalid, kind = "mobile", className, onBlur, ...props },
    ref,
  ) {
    const [blurred, setBlurred] = useState(false);
    const own =
      invalid === undefined && blurred
        ? phoneError(value, kind, { required: props.required })
        : undefined;
    const bad = invalid ?? Boolean(own);
    return (
      <div className={cn("w-full min-w-0", className)}>
        <div
          className={cn(
            "flex h-11 w-full min-w-0 items-stretch overflow-hidden rounded-md border border-line bg-card shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-150",
            "focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100",
            bad &&
              "border-error focus-within:border-error focus-within:ring-error-tint",
            props.disabled && "bg-paper",
          )}
        >
          <span
            aria-hidden
            className="flex shrink-0 items-center border-r border-line bg-paper px-space-3 text-[14px] font-medium text-ink-600"
          >
            {COUNTRY_PREFIX}
          </span>
          <input
            ref={ref}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder={
              kind === "any" ? "98765 43210 or 0612 2345678" : "98765 43210"
            }
            aria-invalid={bad || undefined}
            // a stored "+919876543210" is shown as "98765 43210" (the +91 is already in front)
            value={value.startsWith("+") ? phoneForInput(value) : value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => {
              setBlurred(true);
              const tidy = phoneForInput(value);
              if (tidy && tidy !== value) onChange(tidy);
              onBlur?.(e);
            }}
            className="min-w-0 flex-1 bg-transparent px-space-3 text-[14px] text-ink-900 outline-none placeholder:text-ink-400 disabled:cursor-not-allowed disabled:text-ink-400"
            {...props}
          />
        </div>
        {own && (
          <p className="mt-1 text-[12px] font-medium text-error" role="alert">
            {own}
          </p>
        )}
      </div>
    );
  },
);
