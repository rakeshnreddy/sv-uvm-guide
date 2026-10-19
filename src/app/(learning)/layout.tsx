import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import KeyboardShortcuts from "@/components/layout/KeyboardShortcuts";
import ClientProviders from "@/components/providers/ClientProviders";
import AIAssistantWidget from "@/components/widgets/AIAssistantWidget";
import { SITE_FEATURES } from "@/lib/site-features";

export default function LearningLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientProviders>
      {/* MainLayout renders the navbar, the course outline (Sidebar), main and the footer. */}
      <MainLayout>{children}</MainLayout>
      {/*
        The AI tutor needs accounts and a server secret. With SITE_FEATURES.aiTutor off, no assistant island is
        rendered. AIAssistantWidget is only a small gate in this layout's client bundle: the button and the dialog
        load as a lazy chunk (AIAssistantLauncher) once useServerFeature('aiTutor') is true.
      */}
      {SITE_FEATURES.aiTutor ? <AIAssistantWidget /> : null}
      <KeyboardShortcuts />
    </ClientProviders>
  );
}
