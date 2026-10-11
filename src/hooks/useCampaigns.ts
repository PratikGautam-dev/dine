import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

export type Campaign = {
  id: number;
  subject: string;
  audience_label: string;
  recipient_count: number;
  created_by: string | null;
  created_at: string;
};

/** Customers page's Campaigns tab -- history of past Gmail-compose sends. There's no email-
 * sending infrastructure in this app, so a campaign is composed in the portal and handed off to
 * the staff member's own Gmail (a pre-filled compose URL, built client-side); createCampaign()
 * is called right after that hand-off to log it, never before -- this hook never sends anything
 * itself, only records that a send happened. */
export function useCampaigns(ready: boolean) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const load = useCallback(async () => {
    const result = await portalFetch("/api/portal/campaigns");
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else setError(result.error);
      return;
    }
    setCampaigns((result.data as { campaigns: Campaign[] }).campaigns);
  }, [router]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const createCampaign = async (
    subject: string,
    audienceLabel: string,
    recipientCount: number,
  ): Promise<boolean> => {
    setCreating(true);
    const result = await portalFetch("/api/portal/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, audience_label: audienceLabel, recipient_count: recipientCount }),
    });
    setCreating(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't log campaign", result.error);
      return false;
    }
    load();
    return true;
  };

  /** Uploads to the same public image bucket menu item photos use. Gmail's compose-by-URL scheme
   * only takes a plain-text body (no inline-image param), so the caller both drops this URL into
   * the message as a visible link AND shows the image so staff can drag it into the Gmail window
   * that opens -- Gmail's own compose UI does embed a dragged-in image inline. */
  async function uploadImage(file: File): Promise<string | null> {
    setUploadingImage(true);
    const body = new FormData();
    body.append("file", file);
    const result = await portalFetch("/api/portal/campaigns/upload-image", { method: "POST", body });
    setUploadingImage(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't upload image", result.error);
      return null;
    }
    return (result.data as { image_url: string }).image_url;
  }

  return { campaigns, error, creating, createCampaign, uploadingImage, uploadImage };
}
