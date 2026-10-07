import type { Metadata } from "next";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const metadata: Metadata = {
  title: "Onboard a restaurant — Dine Connect",
};

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-paper">
      <OnboardingWizard />
    </div>
  );
}
