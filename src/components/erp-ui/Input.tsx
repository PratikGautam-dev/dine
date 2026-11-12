"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";
import { cn } from "@/lib/cn";

const fieldStyle =
  "h-11 min-w-0 w-full rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900 shadow-[var(--shadow-sm)] " +
  "transition-[border-color,box-shadow] duration-150 ease-(--ease-standard) placeholder:text-ink-400 " +
  "focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 " +
  "disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-400";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

/** A text input. `type="password"` gets an eye button that shows or hides what was typed, so every password, PIN and secret field in the
 * app can be checked before submitting. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, type, ...props },
  ref,
) {
  const [shown, setShown] = useState(false);
  const secret = type === "password";
  const input = (
    <input
      ref={ref}
      type={secret && shown ? "text" : type}
      className={cn(
        fieldStyle,
        invalid && "border-error focus:border-error focus:ring-error-tint",
        secret && "pr-11",
        className,
      )}
      {...props}
    />
  );
  if (!secret) return input;
  return (
    <div className="relative">
      {input}
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        disabled={props.disabled}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="touch-target absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-400 transition-colors hover:text-ink-900 focus-visible:text-ink-900 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
      >
        {shown ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, invalid, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          fieldStyle,
          "h-auto resize-y py-space-2 leading-relaxed",
          invalid && "border-error focus:border-error focus:ring-error-tint",
          className,
        )}
        {...props}
      />
    );
  },
);
