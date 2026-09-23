/** The real WhatsApp glyph (not a generic message-bubble icon) -- used only where the underlying
 * data genuinely is a WhatsApp-sourced order/booking/conversation, never as a stand-in for a
 * channel this app doesn't actually have (see: Swiggy/Zomato, deliberately not rendered anywhere
 * in this codebase since no such integration exists). */
export function WhatsAppIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <path
        d="M23.47 8.52A9.8 9.8 0 0 0 16.06 5.5c-5.42 0-9.83 4.4-9.83 9.83 0 1.73.45 3.42 1.31 4.91L6.15 26.5l6.42-1.68a9.8 9.8 0 0 0 3.49.85h.01c5.42 0 9.83-4.4 9.83-9.83a9.8 9.8 0 0 0-2.43-6.82Z"
        fill="#fff"
      />
      <path
        d="M16.07 6.97c-4.62 0-8.37 3.75-8.37 8.37 0 1.63.47 3.16 1.28 4.45l.2.32-.85 3.11 3.19-.84.31.18a8.35 8.35 0 0 0 4.23 1.15h.01c4.62 0 8.37-3.75 8.37-8.37s-3.75-8.37-8.37-8.37Z"
        fill="#25D366"
      />
      <path
        d="M12.6 10.9c-.18-.4-.37-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.65 2.65 4.08 3.6 2.02.79 2.43.63 2.87.6.44-.04 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.44-1.34-1.68-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.5-1.28-.7-1.74Z"
        fill="#fff"
      />
    </svg>
  );
}
