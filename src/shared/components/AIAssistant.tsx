"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I am your Dragon Router AI Assistant. How can I help you configure, scale, or optimize your gateway today?",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const presetQuestions = [
    "How do I configure provider limits?",
    "What is Dragon Scale auto-fallback?",
    "How to reset management password?",
    "CLI commands reference",
  ];

  const getAssistantResponse = (query: string): string => {
    const q = query.toLowerCase();
    if (q.includes("limit")) {
      return "To configure provider limits:\n1. Navigate to **Settings > Limits** in the dashboard.\n2. Set global rate limits (requests per minute/day) or define specific limits per API key.\n3. You can also specify token buffers to prevent overages with upstream providers.";
    }
    if (q.includes("fallback") || q.includes("dragon scale")) {
      return "Dragon Scale auto-fallback dynamically routes around failures:\n- If an upstream model is rate-limited (429) or down (5xx), Dragon Router instantly tries the next model in your defined 'Combo'.\n- It monitors ELO score and latency to optimize provider choices dynamically.";
    }
    if (q.includes("password") || q.includes("reset")) {
      return "To reset your management password:\n1. Stop the router server.\n2. Run the reset command in your terminal:\n   ```bash\n   npm run dragon-router-reset-password\n   ```\n3. Enter your new password and restart the server.";
    }
    if (q.includes("cli") || q.includes("command")) {
      return "Dragon Router CLI commands:\n- `dragon-router serve`: Start the gateway server locally.\n- `dragon-router tunnel`: Expose the gateway via secure reverse tunnel.\n- `dragon-router status`: View uptime, DB status, and running connections.\n- `dragon-router reset-password`: Interactively reset admin password.";
    }
    return "I'm here to help with Dragon Router configurations, including settings, limits, fallback combos, and CLI commands. Let me know if you want me to explain any specific features in detail!";
  };

  const handleSend = (text: string) => {
    if (!text.trim() || isTyping) return;

    const newMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(newMessages);
    setInputValue("");
    setIsTyping(true);

    const response = getAssistantResponse(text);

    // Simulate typing stream effect
    setTimeout(() => {
      setIsTyping(false);
      setMessages([...newMessages, { role: "assistant" as const, content: response }]);
    }, 1200);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-accent text-white shadow-lg shadow-primary/25 transition-transform duration-300 hover:scale-110 active:scale-95 focus:outline-none"
        aria-label="AI Help Assistant"
      >
        <span className="material-symbols-outlined text-[28px] animate-pulse">
          {isOpen ? "close" : "smart_toy"}
        </span>
      </button>

      {/* Glassmorphic Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[500px] w-96 flex-col rounded-2xl border border-border bg-surface/95 dark:bg-surface/85 p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="mb-3 flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-ping" />
              <h3 className="text-sm font-bold text-text-main">Dragon AI Assistant</h3>
            </div>
            <span className="text-xs text-text-muted">Online</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar text-xs">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gradient-to-tr from-primary to-accent text-white shadow-sm"
                      : "bg-bg/85 dark:bg-white/5 text-text-main border border-border"
                  }`}
                  style={{ whiteSpace: "pre-line" }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-xl px-3 py-2 bg-bg/85 dark:bg-white/5 text-text-muted border border-border flex gap-1 items-center">
                  <div className="h-1.5 w-1.5 bg-text-muted/50 rounded-full animate-bounce" />
                  <div className="h-1.5 w-1.5 bg-text-muted/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="h-1.5 w-1.5 bg-text-muted/50 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick presets (if no custom input yet) */}
          {messages.length === 1 && (
            <div className="my-3 space-y-1.5">
              <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
                Suggested Topics
              </p>
              <div className="flex flex-wrap gap-1.5">
                {presetQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="rounded-full border border-border bg-bg/60 px-2.5 py-1 text-[11px] text-text-main transition-colors hover:bg-bg hover:text-primary"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputValue);
            }}
            className="mt-3 flex gap-2 border-t border-border pt-3"
          >
            <input
              type="text"
              placeholder="Ask a question..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text-main placeholder-text-muted/50 focus:border-primary/50 focus:outline-none"
            />
            <button
              type="submit"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-primary to-accent text-white transition-opacity hover:opacity-90"
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
