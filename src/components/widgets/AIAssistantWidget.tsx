"use client";

import dynamic from "next/dynamic";
import { MessageSquarePlus } from "lucide-react";
import React, { useState } from "react";

import { Button } from "@/components/ui/Button";

const AIAssistantDialog = dynamic(() => import("./AIAssistantDialog"), {
  ssr: false,
  loading: () => null,
});

export default function AIAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);

  if (isOpen) {
    return <AIAssistantDialog onClose={() => setIsOpen(false)} />;
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9998]">
      <Button
        onClick={() => setIsOpen(true)}
        size="lg"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-primary p-0 shadow-2xl hover:bg-primary/90"
        aria-label="Open AI assistant"
      >
        <MessageSquarePlus aria-hidden="true" size={28} />
      </Button>
    </div>
  );
}
