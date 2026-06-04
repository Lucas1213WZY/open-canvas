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
    <main className="min-h-screen bg-white text-slate-950">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="flex min-h-[48vh] w-full flex-col border-r border-slate-200 bg-slate-50/80 lg:h-screen lg:min-h-screen lg:w-[360px]">
          <header className="border-b border-slate-200 bg-white px-5 py-4">
            <h1 className="text-base font-semibold">XAIkit Chat</h1>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Plan user studies with AI explanations.
            </p>
          </header>

          <section className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full min-h-[280px] items-center justify-center text-center text-slate-500">
                <p className="max-w-[260px] text-sm leading-6">
                  Tell me what user study or experiment you would like to
                  conduct with AI explanations.
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
                      className={`max-w-[86%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm leading-6 shadow-sm ${
                        message.role === "user"
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-800"
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
            className="border-t border-slate-200 bg-white p-4"
          >
            <div className="flex gap-2">
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
                className="min-h-[48px] flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-900"
                placeholder="Tell me what user study or experiment you would like to conduct with AI explanations."
              />
              <button
                type="submit"
                disabled={!canSend}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </aside>

        <section className="min-h-[52vh] flex-1 bg-white lg:h-screen">
          <div className="flex h-full flex-col">
            <header className="flex h-14 items-center justify-between border-b border-slate-200 px-6">
              <div>
                <h2 className="text-sm font-medium">Study Design Canvas</h2>
                <p className="text-xs text-slate-500">Untitled document</p>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-8">
              <div className="mx-auto max-w-3xl">
                {messages.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                    <h3 className="text-base font-medium text-slate-800">
                      Your canvas is ready
                    </h3>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
                      Describe the user study or experiment in chat, and use
                      this canvas area as your working space for the study plan.
                    </p>
                  </div>
                ) : (
                  <article className="prose prose-slate max-w-none">
                    <h3>Conversation Notes</h3>
                    <p>
                      The OpenAI-only deployment keeps chat online without a
                      hosted LangGraph server. The full editable artifact canvas
                      can be restored when LangGraph hosting is available.
                    </p>
                    <h4>Latest Assistant Response</h4>
                    <p className="whitespace-pre-wrap">
                      {messages
                        .filter((message) => message.role === "assistant")
                        .at(-1)?.content || "Waiting for a response..."}
                    </p>
                  </article>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
