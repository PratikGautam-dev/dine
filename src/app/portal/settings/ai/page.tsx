"use client";

import { Bot } from "lucide-react";
import { TenantLLMSettings } from "@/components/portal/TenantLLMSettings";
import { useTenantLLMConfiguration } from "@/hooks/useTenantLLMConfiguration";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";

export default function AiSettingsPage() {
  const { restaurant, ready } = usePortalGuard();
  const tenantLLM = useTenantLLMConfiguration(ready);

  return (
    <SettingsPageFrame
      restaurant={restaurant}
      title="AI model"
      icon={<Bot size={20} />}
      description="Which language model answers your guests."
    >
      <div className="max-w-2xl">
      <TenantLLMSettings
        configuration={tenantLLM.configuration}
        loading={tenantLLM.loading}
        onSave={tenantLLM.save}
        onClear={tenantLLM.clear}
      />
      </div>
    </SettingsPageFrame>
  );
}
