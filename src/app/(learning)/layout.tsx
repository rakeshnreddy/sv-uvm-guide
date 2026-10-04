import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import KeyboardShortcuts from "@/components/layout/KeyboardShortcuts";
import ClientProviders from "@/components/providers/ClientProviders";
import AIAssistantWidget from "@/components/widgets/AIAssistantWidget";

export default function LearningLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientProviders>
      {/* MainLayout renders the navbar, the course outline (Sidebar), main and the footer. */}
      <MainLayout>{children}</MainLayout>
      <AIAssistantWidget />
      <KeyboardShortcuts />
    </ClientProviders>
  );
}
