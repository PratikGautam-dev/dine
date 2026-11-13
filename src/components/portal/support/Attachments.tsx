import type { SupportAttachment } from "@/hooks/useSupport";
import { API_BASE_URL } from "@/lib/staffAuth";

/** Local-dev uploads come back as a path on the API; stored (R2) ones are full links. */
const src = (url: string) => (url.startsWith("/") ? `${API_BASE_URL}${url}` : url);

/** The images on a ticket: thumbnails that open the full image in a new tab. */
export function Attachments({ items }: { items: SupportAttachment[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-space-3 flex flex-wrap gap-space-2">
      {items.map((a) => (
        <li key={a.url}>
          <a
            href={src(a.url)}
            target="_blank"
            rel="noopener noreferrer"
            title={`${a.name} · ${(a.size / 1024).toFixed(0)} KB`}
            className="block overflow-hidden rounded-md border border-line hover:border-brand-400"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded files from the media bucket */}
            <img src={src(a.url)} alt={a.name} className="h-24 w-24 object-cover" />
          </a>
        </li>
      ))}
    </ul>
  );
}
