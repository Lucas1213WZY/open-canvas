import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function cleanMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => {
      if (
        !message ||
        typeof message !== "object" ||
        !("role" in message) ||
        !("content" in message)
      ) {
        return undefined;
      }

      const role = (message as { role: unknown }).role;
      const content = (message as { content: unknown }).content;
      if (
        !["system", "user", "assistant"].includes(String(role)) ||
        typeof content !== "string" ||
        !content.trim()
      ) {
        return undefined;
      }

      return {
        role: role as ChatMessage["role"],
        content: content.trim(),
      };
    })
    .filter((message): message is ChatMessage => Boolean(message));
}

function openAIStreamToTextStream(responseBody: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return responseBody.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const data = trimmed.slice("data:".length).trim();
          if (!data || data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (typeof content === "string") {
              controller.enqueue(encoder.encode(content));
            }
          } catch {
            // Ignore incomplete/non-JSON stream frames.
          }
        }
      },
    })
  );
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = cleanMessages(body.messages);
  if (!messages.length) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a concise, helpful AI assistant. Answer clearly and ask a brief follow-up only when it is useful.",
        },
        ...messages,
      ],
      stream: true,
    }),
  });

  if (!openAIResponse.ok || !openAIResponse.body) {
    const errorText = await openAIResponse.text();
    return NextResponse.json(
      {
        error: "OpenAI request failed",
        details: errorText,
      },
      { status: openAIResponse.status }
    );
  }

  return new Response(openAIStreamToTextStream(openAIResponse.body), {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
