import { useCallback, useEffect, useState } from "react";
import { staffFetch } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";

export type TenantLLMConfiguration = {
  configured: boolean;
  model_name: string;
  provider: string;
  base_url: string;
  api_key_configured: boolean;
  api_key_mask: string;
};

export function useTenantLLMConfiguration(ready: boolean) {
  const [configuration, setConfiguration] = useState<TenantLLMConfiguration | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    const result = await staffFetch("/api/portal/settings/llm");
    if (result.ok) setConfiguration(result.data as TenantLLMConfiguration);
  }, []);

  useEffect(() => {
    if (ready) void reload();
  }, [ready, reload]);

  async function save(payload: { model_name: string; api_key: string; base_url: string }) {
    setLoading(true);
    const result = await staffFetch("/api/portal/settings/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!result.ok) return result.unauthorized ? "Session expired — please sign in again." : result.error;
    setConfiguration(result.data as TenantLLMConfiguration);
    toast.success("AI model connected");
    return null;
  }

  async function clear() {
    setLoading(true);
    const result = await staffFetch("/api/portal/settings/llm", { method: "DELETE" });
    setLoading(false);
    if (!result.ok) return result.unauthorized ? "Session expired — please sign in again." : result.error;
    setConfiguration(result.data as TenantLLMConfiguration);
    toast.success("AI model configuration removed");
    return null;
  }

  return { configuration, loading, save, clear };
}
