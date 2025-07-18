"use client";

import React, { useState, useRef, useEffect, FormEvent } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion"; // Added Variants
import { Bot, X, Send, MessageSquarePlus, Loader2 } from "lucide-react"; // Removed CornerDownLeft, User
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useAuth } from "@/contexts/AuthContext"; // To potentially get user info

interface Message {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

const AIAssistantWidget: React.FC = () => {
  const { user } = useAuth(); // Example: could use user.displayName if available
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false); // For assistant "thinking"
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    // Initial greeting from assistant when chat opens for the first time or is empty
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: `asst-${Date.now()}`,
          text: "Hello! I'm your SystemVerilog & UVM expert assistant. How can I help you today?",
          sender: "assistant",
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, messages.length]); // Added messages.length to dependency array


  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
  };

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault();
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: trimmedInput,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInputValue("");
    setIsLoading(true);

    // TODO: Implement actual page context extraction
    const pageContext = "Placeholder: Current page content will be extracted here.";
    const systemPrompt = "You are an expert-level verification engineer with 20 years of experience in SystemVerilog and UVM. You are a helpful tutor. Explain complex concepts clearly and concisely. Always refer to the provided context before answering.";

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemPrompt,
          pageContext,
          userQuestion: trimmedInput,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const assistantResponse: Message = {
        id: `asst-${Date.now() + 1}`,
        text: data.reply,
        sender: "assistant",
        timestamp: new Date(),
      };
      setMessages((prevMessages) => [...prevMessages, assistantResponse]);

    } catch (error) {
      console.error("Failed to get AI response:", error);
      const errorMessage: Message = {
        id: `err-${Date.now()}`,
        text: `Sorry, I encountered an error. ${error instanceof Error ? error.message : 'Please try again.'}`,
        sender: "assistant", // Error shown as an assistant message
        timestamp: new Date(),
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const fabVariants: Variants = { // Explicitly type with Variants from framer-motion
    hidden: { scale: 0, opacity: 0, y: 50 },
    visible: {
      scale: 1,
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 260, damping: 20 } // Use "as const" for the type property
    },
  };

  const chatWindowVariants: Variants = { // Explicitly type
    closed: { opacity: 0, y: 50, scale: 0.9, transition: { duration: 0.2, ease: "easeIn" } },
    open: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: "easeOut" } },
  };


  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            variants={fabVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed bottom-6 right-6 z-[9998]" // High z-index
          >
            <Button
              onClick={toggleOpen}
              size="lg" // Make FAB a bit larger
              className="rounded-full w-16 h-16 shadow-2xl p-0 flex items-center justify-center bg-primary hover:bg-primary/90"
              aria-label="Open AI Assistant"
            >
              <MessageSquarePlus size={28} className="text-primary-foreground" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={chatWindowVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 w-full h-full sm:w-[380px] sm:h-[calc(100%-6rem)] sm:max-h-[600px] z-[9999] flex flex-col
                       bg-card/80 dark:bg-card/70 backdrop-blur-xl border border-border/30 dark:border-border/50
                       shadow-2xl rounded-none sm:rounded-xl overflow-hidden"
            aria-modal="true"
            role="dialog"
            aria-labelledby="ai-assistant-header"
          >
            {/* Header */}
            <header
              id="ai-assistant-header"
              className="flex items-center justify-between p-3 border-b border-border/50 bg-background/50 dark:bg-background/30"
            >
              <div className="flex items-center">
                <Bot size={20} className="text-primary mr-2" />
                <h2 className="text-md font-semibold text-foreground">AI Assistant</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={toggleOpen} className="text-foreground/70 hover:text-foreground" aria-label="Close chat">
                <X size={20} />
              </Button>
            </header>

            {/* Message List */}
            <div className="flex-grow p-4 space-y-4 overflow-y-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg shadow ${
                      msg.sender === "user"
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-muted dark:bg-muted/50 text-foreground rounded-bl-none"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    <p className="text-xs opacity-70 mt-1 text-right">
                      {msg.sender === "user" ? (user?.displayName || "You") : "Assistant"} @ {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] p-3 rounded-lg shadow bg-muted dark:bg-muted/50 text-foreground rounded-bl-none flex items-center">
                    <Loader2 className="w-5 h-5 animate-spin mr-2 text-primary" />
                    <p className="text-sm">Assistant is thinking...</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-border/50 bg-background/50 dark:bg-background/30">
              <div className="flex items-end space-x-2">
                <Textarea
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Ask about SystemVerilog, UVM..."
                  className="flex-grow resize-none bg-background focus:bg-background/80 max-h-28"
                  minRows={1} // For auto-resizing if Textarea supports it
                  aria-label="Chat message input"
                />
                <Button type="submit" size="icon" disabled={!inputValue.trim() || isLoading} aria-label="Send message">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send size={20} />}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIAssistantWidget;
