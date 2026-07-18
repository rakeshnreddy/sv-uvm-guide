"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bot, Loader2, Send, X } from "lucide-react";
import React, {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

interface AIAssistantDialogProps {
  onClose: () => void;
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const publicErrorMessages: Record<string, string> = {
  UNAUTHORIZED: "Sign in to use the AI tutor.",
  AI_RATE_LIMITED: "You’ve reached the tutor’s short-term request limit. Try again shortly.",
  AI_TIMEOUT: "The tutor took too long to respond. Please try again.",
  AI_NOT_CONFIGURED: "The AI tutor is not configured for this environment.",
};

export default function AIAssistantDialog({ onClose }: AIAssistantDialogProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "assistant-greeting",
      text: "Hello! I’m your SystemVerilog and UVM tutor. What would you like to work through?",
      sender: "assistant",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  const closeDialog = useCallback(() => {
    requestControllerRef.current?.abort();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      requestControllerRef.current?.abort();
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [closeDialog]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const question = inputValue.trim();
    if (!question) return;

    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), text: question, sender: "user", timestamp: new Date() },
    ]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          userQuestion: question,
          pageContext: {
            title: document.title.slice(0, 200),
            route: window.location.pathname.slice(0, 500),
            selectedText: window.getSelection()?.toString().slice(0, 2_000) ?? "",
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok || typeof payload.reply !== "string") {
        throw new Error(payload.error ?? "AI_UNAVAILABLE");
      }
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), text: payload.reply, sender: "assistant", timestamp: new Date() },
      ]);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      const code = error instanceof Error ? error.message : "AI_UNAVAILABLE";
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          text: publicErrorMessages[code] ?? "The AI tutor is unavailable right now. Please try again.",
          sender: "assistant",
          timestamp: new Date(),
        },
      ]);
    } finally {
      if (requestControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  };

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 32, scale: 0.96 }}
        className="fixed bottom-0 right-0 z-[9999] flex h-full w-full flex-col overflow-hidden border border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl sm:bottom-6 sm:right-6 sm:h-[min(600px,calc(100%-6rem))] sm:w-[380px] sm:rounded-xl"
        aria-modal="true"
        role="dialog"
        aria-labelledby="ai-assistant-title"
      >
        <header className="flex items-center justify-between border-b border-border/50 bg-background/50 p-3">
          <div className="flex items-center">
            <Bot aria-hidden="true" className="mr-2 text-primary" size={20} />
            <h2 id="ai-assistant-title" className="font-semibold">AI Assistant</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={closeDialog} aria-label="Close AI assistant">
            <X aria-hidden="true" size={20} />
          </Button>
        </header>

        <div className="flex-grow space-y-4 overflow-y-auto p-4" aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className={message.sender === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={message.sender === "user" ? "max-w-[80%] rounded-lg rounded-br-none bg-primary p-3 text-primary-foreground" : "max-w-[80%] rounded-lg rounded-bl-none bg-muted p-3"}>
                <p className="whitespace-pre-wrap text-sm">{message.text}</p>
                <p className="mt-1 text-right text-xs opacity-70">
                  {message.sender === "user" ? user?.displayName || "You" : "Assistant"} · {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          {isLoading ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 aria-hidden="true" className="mr-2 h-5 w-5 animate-spin text-primary" />
              Assistant is thinking…
            </div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} className="border-t border-border/50 bg-background/50 p-3">
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Ask about SystemVerilog or UVM…"
              className="max-h-28 flex-grow resize-none"
              minRows={1}
              aria-label="Message to AI tutor"
            />
            <Button type="submit" size="icon" disabled={!inputValue.trim() || isLoading} aria-label="Send message">
              {isLoading ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : <Send aria-hidden="true" size={20} />}
            </Button>
          </div>
        </form>
      </motion.div>
    </AnimatePresence>
  );
}
