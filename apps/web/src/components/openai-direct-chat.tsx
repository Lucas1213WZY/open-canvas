"use client";

import { Send } from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";

type DirectChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function OpenAIDirectChat() {
  const [messages, setMessages] = useState<DirectChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canSend = useMemo(
    () => input.trim().length > 0 && !isRunning,
    [input, isRunning]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const userText = input.trim();
    if (!userText || isRunning) return;

    const nextMessages: DirectChatMessage[] = [
      ...messages,
      { role: "user", content: userText },
    ];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setIsRunning(true);

    try {
      const response = await fetch("/api/openai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!response.ok || !response.body) {
        const error = await response.json().catch(() => undefined);
        throw new Error(error?.error || "The chat request failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        setMessages((current) => {
          const updated = [...current];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + chunk,
            };
          }
          return updated;
        });
        requestAnimationFrame(() => {
          scrollRef.current?.scrollIntoView({ block: "end" });
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The chat request failed.";
      setMessages((current) => {
        const updated = [...current];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant" && !last.content) {
          updated[updated.length - 1] = {
            role: "assistant",
            content: message,
          };
          return updated;
        }
        return [...updated, { role: "assistant", content: message }];
      });
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-6">
        <header className="border-b border-zinc-800 pb-4">
          <h1 className="text-xl font-semibold">XAIkit Chat</h1>
          <p className="mt-1 text-sm text-zinc-400">
            OpenAI-powered chatbot running from your Vercel server.
          </p>
        </header>

        <section className="flex-1 overflow-y-auto py-5">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[50vh] items-center justify-center text-center text-zinc-400">
              <p className="max-w-sm text-sm">
                Ask a question to start chatting.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[82%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm leading-6 ${
                      message.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-900 text-zinc-100 ring-1 ring-zinc-800"
                    }`}
                  >
                    {message.content || "Thinking..."}
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          )}
        </section>

        <form
          onSubmit={handleSubmit}
          className="flex gap-2 border-t border-zinc-800 pt-4"
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            className="min-h-[48px] flex-1 resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 outline-none transition focus:border-blue-500"
            placeholder="Type your message..."
          />
          <button
            type="submit"
            disabled={!canSend}
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </main>
  );
}
