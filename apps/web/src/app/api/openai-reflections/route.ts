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

function buildPrompt(chatSummary: string) {
  return `You are generating reflections for an AI experiment planning assistant.

Return only valid JSON with this shape:
{
  "styleRules": ["..."],
  "content": ["..."]
}

Write concise, actionable reflections based on the conversation and current canvas. Focus on what should guide future responses, recurring preferences, and any constraints worth remembering.

Conversation and canvas summary:
${chatSummary}
`;
}

function formatSummary(messages: ChatMessage[], artifactContent?: string) {
  const latestMessages = messages.slice(-12);
  const transcript = latestMessages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n");

  return [artifactContent ? `Current canvas:\n${artifactContent}` : "", transcript]
    .filter(Boolean)
    .join("\n\n");
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: { messages?: unknown; artifactContent?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = cleanMessages(body.messages);
  if (!messages.length) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  const artifactContent =
    typeof body.artifactContent === "string" ? body.artifactContent : "";

  const openAIResponse = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
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
            content: buildPrompt(formatSummary(messages, artifactContent)),
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
    }
  );

  if (!openAIResponse.ok) {
    const errorText = await openAIResponse.text();
    return NextResponse.json(
      {
        error: "OpenAI request failed",
        details: errorText,
      },
      { status: openAIResponse.status }
    );
  }

  const json = await openAIResponse.json();
  const content = json?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    return NextResponse.json(
      { error: "OpenAI response did not include content" },
      { status: 500 }
    );
  }

  try {
    const parsed = JSON.parse(content) as {
      styleRules?: unknown;
      content?: unknown;
    };

    const styleRules = Array.isArray(parsed.styleRules)
      ? parsed.styleRules.filter((item): item is string => typeof item === "string")
      : [];
    const contentRules = Array.isArray(parsed.content)
      ? parsed.content.filter((item): item is string => typeof item === "string")
      : [];

    return NextResponse.json({
      styleRules,
      content: contentRules,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to parse reflections",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}