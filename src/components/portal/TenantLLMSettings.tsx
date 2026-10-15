"use client";

import { useEffect, useState } from "react";
import { Bot, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import type { TenantLLMConfiguration } from "@/hooks/useTenantLLMConfiguration";

type Props = {
  configuration: TenantLLMConfiguration | null;
  loading: boolean;
  onSave: (values: { model_name: string; api_key: string; base_url: string }) => Promise<string | null>;
  onClear: () => Promise<string | null>;
};

export function TenantLLMSettings({ configuration, loading, onSave, onClear }: Props) {
  const [modelName, setModelName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!configuration) return;
    setModelName(configuration.model_name);
    setBaseUrl(configuration.base_url);
    setApiKey("");
  }, [configuration]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const problem = await onSave({ model_name: modelName, api_key: apiKey, base_url: baseUrl });
    if (problem) setError(problem);
    else {
      setApiKey("");
      setNotice("Credentials verified and saved securely.");
    }
  }

  async function remove() {
    setError(null);
    const problem = await onClear();
    if (problem) setError(problem);
    else {
      setModelName("");
      setBaseUrl("");
      setApiKey("");
      setNotice("AI model configuration removed.");
    }
  }

  return (
    <Card className="max-w-3xl p-space-5">
      <div className="mb-space-4 flex items-start gap-space-3">
        <Bot className="mt-0.5 text-brand-600" size={20} />
        <div>
          <h2 className="text-[15px] font-bold text-ink-900">Auto LLM Configuration</h2>
          <p className="mt-1 text-[12.5px] text-ink-600">
            Connect a chat model for AI assisted menu matching. Common model names are detected automatically;
            other LangChain providers use provider:model (for example, groq:llama-3.3-70b-versatile or ollama:codellama).
            The API key is encrypted on the backend and never sent back to this page.
          </p>
        </div>
      </div>

      {configuration?.configured && (
        <div className="mb-space-4 flex items-center gap-space-2 rounded-md bg-success-tint p-space-3 text-[13px] text-success">
          <CheckCircle2 size={16} /> Connected to {configuration.provider} · {configuration.model_name}
        </div>
      )}

      <form onSubmit={submit} className="space-y-space-3">
        <Field label="Model name" htmlFor="llm-model" hint="Examples: gpt-4o-mini, claude-sonnet-4-5, gemini-2.5-flash">
          <Input id="llm-model" value={modelName} onChange={(event) => setModelName(event.target.value)} required autoComplete="off" />
        </Field>
        <Field label="API key" htmlFor="llm-api-key" hint={configuration?.configured ? "Leave blank to keep the saved key, or enter a replacement. Local Ollama models do not need a key." : "Required by hosted providers. Local Ollama models do not need a key."}>
          <Input id="llm-api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="new-password" placeholder={configuration?.api_key_mask || "Enter provider API key"} />
        </Field>
        <Field label="Base URL (optional)" htmlFor="llm-base-url" hint="For an OpenAI-compatible provider or custom endpoint. Leave blank for the provider default.">
          <Input id="llm-base-url" type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" autoComplete="url" />
        </Field>
        {error && <p role="alert" className="text-[12.5px] font-medium text-error">{error}</p>}
        {notice && <p role="status" className="text-[12.5px] font-medium text-success">{notice}</p>}
        <div className="flex flex-wrap gap-space-2 pt-space-2">
          <Button type="submit" disabled={loading}>{loading ? "Checking model…" : "Verify and save"}</Button>
          {configuration?.configured && (
            <Button type="button" variant="secondary" disabled={loading} onClick={remove}>
              <Trash2 size={14} /> Remove configuration
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
