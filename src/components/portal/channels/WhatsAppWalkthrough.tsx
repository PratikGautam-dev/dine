"use client";

import Image from "next/image";
import { useState } from "react";
import { CopyRow } from "@/components/portal/channels/CopyRow";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { cn } from "@/lib/erp/cn";

type Step = {
  title: string;
  image?: { src: string; alt: string; w: number; h: number };
  body: React.ReactNode;
};

/** Where each value comes from in Meta, one screen at a time with an annotated screenshot. The last two steps are ours: connect, then the webhook. */
export function WhatsAppWalkthrough({
  canConnect,
  onConnect,
  webhook,
  startAt = 0,
}: {
  canConnect: boolean;
  onConnect: () => void;
  webhook: { url: string; token: string } | null;
  startAt?: number;
}) {
  const [i, setI] = useState(startAt);
  const steps: Step[] = [
    {
      title: "Create your Meta Business account",
      image: {
        src: "/help/whatsapp/1-business-account.png",
        alt: "Meta Business Suite: click Create Account, enter your business details, verify your email, then come back here.",
        w: 1536,
        h: 1024,
      },
      body: (
        <>
          Go to <strong>business.facebook.com</strong> and choose <strong>Create account</strong>.
          Enter your business name, your name and your work email, then click the link Meta emails
          you. Already have an account? Skip to the next step.
        </>
      ),
    },
    {
      title: "Create an app and add WhatsApp",
      image: {
        src: "/help/whatsapp/2-create-app.png",
        alt: "Four screens: log in with the same account; Meta for Developers, My Apps, Create App with type Business; Add Products, WhatsApp, Set up; the WhatsApp API Setup page.",
        w: 1536,
        h: 1024,
      },
      body: (
        <>
          Log in at <strong>developers.facebook.com</strong> with the same account. Choose{" "}
          <strong>My Apps → Create App</strong>, pick the type <strong>Business</strong>, give it a
          name and email. Then under <strong>Add Products to Your App</strong> find{" "}
          <strong>WhatsApp</strong> and click <strong>Set up</strong>. The{" "}
          <strong>WhatsApp → API Setup</strong> page it opens is where you will come back for your
          IDs.
        </>
      ),
    },
    {
      title: "Verify your business and register your number",
      image: {
        src: "/help/whatsapp/3-register-number.png",
        alt: "WhatsApp production setup: start business verification, wait for Meta's review, register your WhatsApp phone number with a code, add a payment method.",
        w: 1584,
        h: 993,
      },
      body: (
        <>
          In the app go to <strong>WhatsApp → Production setup</strong>. Start{" "}
          <strong>business verification</strong> (Meta reviews it, which can take hours to days),{" "}
          <strong>register your WhatsApp phone number</strong> with the code Meta sends, and add a{" "}
          <strong>payment method</strong> so you can send business-initiated messages. You can carry
          on with the next steps while Meta reviews.
        </>
      ),
    },
    {
      title: "Generate a permanent access token",
      image: {
        src: "/help/whatsapp/4-access-token.png",
        alt: "Business settings, System users, Generate token: select your app, tick whatsapp_business_messaging and whatsapp_business_management, set expiration to Never, then copy the token.",
        w: 1774,
        h: 887,
      },
      body: (
        <>
          In Business settings go to <strong>Users → System users → Add</strong>, with the{" "}
          <strong>Admin</strong> role. Choose <strong>Assign assets → Apps</strong> and give it{" "}
          <strong>Full control</strong> of your app. Then <strong>Generate token</strong>: select
          the app, tick <strong>whatsapp_business_messaging</strong> and{" "}
          <strong>whatsapp_business_management</strong>, set expiry to <strong>Never</strong>.{" "}
          <strong>Copy the token at once</strong>; Meta shows it only once.
        </>
      ),
    },
    {
      title: "Copy your IDs and app secret",
      image: {
        src: "/help/whatsapp/5-credentials.png",
        alt: "WhatsApp, API Setup: copy the Phone number ID. Settings, Basic: click Show next to App secret and copy it.",
        w: 1536,
        h: 1024,
      },
      body: (
        <>
          In your app open <strong>WhatsApp → API Setup</strong> and copy the{" "}
          <strong>Phone number ID</strong> and the <strong>WhatsApp Business Account ID</strong>.
          Then open <strong>Settings → Basic</strong> and click <strong>Show</strong> next to{" "}
          <strong>App secret</strong> and copy it. You now have everything: the two IDs, the token
          and the secret.
        </>
      ),
    },
    {
      title: "Connect it here",
      body: (
        <>
          <p>
            Paste the four values into the connect form. We check them with Meta before saving, and
            your token and secret are stored encrypted.
          </p>
          {webhook ? (
            <p className="mt-space-2 font-semibold text-success">
              Connected. Use Edit details above if you need to change anything.
            </p>
          ) : canConnect ? (
            <Button className="mobile-page-action mt-space-3" onClick={onConnect}>
              Connect WhatsApp
            </Button>
          ) : (
            <p className="mt-space-2 text-ink-400">Ask an administrator to connect WhatsApp.</p>
          )}
        </>
      ),
    },
    {
      title: "Add the webhook in Meta",
      body: (
        <>
          <p>This is how Meta tells us a customer has sent a message. In your Meta app:</p>
          <ol className="my-space-2 list-decimal space-y-1 pl-space-5">
            <li>
              Open <strong>WhatsApp → Configuration</strong>, and in the <strong>Webhook</strong>{" "}
              section choose <strong>Edit</strong>.
            </li>
            <li>
              Paste the <strong>Callback URL</strong> and the <strong>Verify token</strong> below,
              then choose <strong>Verify and save</strong>.
            </li>
            <li>
              Under <strong>Webhook fields</strong>, <strong>Subscribe</strong> to{" "}
              <strong>messages</strong>.
            </li>
          </ol>
          {webhook ? (
            <div className="mt-space-3">
              <CopyRow label="Callback URL" value={webhook.url} />
              <CopyRow label="Verify token" value={webhook.token} />
            </div>
          ) : (
            <p className="mt-space-2 rounded-md bg-paper px-space-3 py-space-2 text-[13px] text-ink-600">
              Your Callback URL and Verify token appear here as soon as you connect in the previous
              step.
            </p>
          )}
        </>
      ),
    },
  ];
  const s = steps[i];
  return (
    <Card className="mt-space-5 overflow-hidden">
      <div className="border-b border-line p-space-4">
        <div className="flex flex-wrap items-start justify-between gap-space-3">
          <div>
            <h2 className="text-[15px] font-bold text-ink-900">
              Connect your WhatsApp Business number
            </h2>
            <p className="text-[13px] text-ink-600">
              Your business uses its own Meta account and number. Follow the steps in order; each
              shows where to click in Meta.
            </p>
          </div>
          {!webhook && canConnect && (
            <Button className="mobile-page-action" onClick={onConnect}>
              Connect WhatsApp
            </Button>
          )}
        </div>
        <ol className="mt-space-3 flex flex-wrap gap-space-2" aria-label="Steps">
          {steps.map((st, n) => (
            <li key={st.title}>
              <button
                type="button"
                onClick={() => setI(n)}
                aria-current={n === i ? "step" : undefined}
                aria-label={`Step ${n + 1}: ${st.title}`}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border text-[13px] font-bold",
                  n === i
                    ? "border-brand-600 bg-brand-600 text-white"
                    : n < i
                      ? "border-brand-200 bg-brand-50 text-brand-700"
                      : "border-line text-ink-600 hover:bg-paper",
                )}
              >
                {n + 1}
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="p-space-4">
        <p className="text-[12px] font-semibold text-ink-400">
          Step {i + 1} of {steps.length}
        </p>
        <h3 className="mb-space-2 text-[16px] font-bold text-ink-900">{s.title}</h3>
        <div className="max-w-3xl text-[14px] leading-relaxed text-ink-600">{s.body}</div>
        {s.image && (
          <Image
            src={s.image.src}
            alt={s.image.alt}
            width={s.image.w}
            height={s.image.h}
            sizes="(min-width: 1024px) 960px, 100vw"
            className="mt-space-4 h-auto w-full rounded-lg border border-line bg-paper"
          />
        )}
        <div className="mt-space-4 flex justify-between">
          <Button variant="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>
            Back
          </Button>
          <Button variant="secondary" disabled={i === steps.length - 1} onClick={() => setI(i + 1)}>
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}
