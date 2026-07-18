import MainLayout from "@/components/layout/MainLayout";
import KeyboardShortcuts from "@/components/layout/KeyboardShortcuts";
import Sidebar from "@/components/layout/Sidebar";
import ClientProviders from "@/components/providers/ClientProviders";
import AIAssistantWidget from "@/components/widgets/AIAssistantWidget";

export default function LearningLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientProviders>
      <Sidebar />
      <MainLayout>{children}</MainLayout>
      <AIAssistantWidget />
      <KeyboardShortcuts />
    </ClientProviders>
  );
}
