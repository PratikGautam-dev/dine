import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

export type Automation = {
  id: number;
  name: string;
  trigger_event: string;
  message_text: string;
  delay_minutes: number;
  is_active: boolean;
  created_at: string;
  run_count: number;
};

export type NewAutomationFields = { name: string; trigger_event: string; message_text: string; delay_minutes: number };

/** Loads /api/portal/automations -- the one real section of the Messages & Automations page
 * (migration 0047). Only trigger_event "feedback_received" is actually wired to send anything
 * on WhatsApp today; see docs/Spec.md for the rest of the phased plan. */
export function useAutomations(ready: boolean) {
  const router = useRouter();
  const [automations, setAutomations] = useState<Automation[] | null>(null);
  const [triggerEvents, setTriggerEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const result = await portalFetch("/api/portal/automations");
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else setError(result.error);
      return;
    }
    const data = result.data as { automations: Automation[]; trigger_events: string[] };
    setAutomations(data.automations);
    setTriggerEvents(data.trigger_events);
  }, [router]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function createAutomation(fields: NewAutomationFields): Promise<boolean> {
    setCreating(true);
    const result = await portalFetch("/api/portal/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    setCreating(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't create automation", result.error);
      return false;
    }
    toast.success("Automation created");
    load();
    return true;
  }

  async function toggleAutomation(automation: Automation) {
    const result = await portalFetch(`/api/portal/automations/${automation.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !automation.is_active }),
    });
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't update automation", result.error);
      return;
    }
    toast.success(automation.is_active ? "Automation paused" : "Automation activated");
    load();
  }

  return { automations, triggerEvents, error, creating, createAutomation, toggleAutomation };
}
