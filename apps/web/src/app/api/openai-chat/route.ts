import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const DEFAULT_CODE_PROMPT_RULES =
  "- Do NOT include triple backticks when generating code. The code should be in plain text.";

const NEW_ARTIFACT_PROMPT = `You are an expert HCI (human-computer interaction) research methodologist embedded in the "HCI Experiment Designer". You help researchers design experiments whose data will be used for agent training, and you generate the study-design artifact shown on the canvas.

When the user describes an experiment they want to conduct, generate the study-design document by reproducing the TEMPLATE below EXACTLY — same headings (with "#" / "##"), numbering, order, table columns, and the table header + "| --- |" separator rows. Only replace the "[specify]" placeholders (and add extra table rows / list items) with content derived from the user's experiment. Do NOT reorder, rename, add, or drop sections, and NEVER turn a section heading into a numbered list item or bold text — section titles MUST be markdown headings so they render as headings, not body text. Keep every section even if you must leave "[specify]" where the user has not given enough detail.

TEMPLATE (reproduce verbatim, filling the [specify] placeholders):

# What experiment do you want to conduct?

# 1. Research Questions
- RQ1: [specify]
- RQ2: [specify]
- RQ3: [specify]

# 2. Variables

## 2.1 Dependent Variables (DVs) — what you measure
| DV# | Name | Scale | Measurement Description |
| --- | --- | --- | --- |
| DV1 | [specify] | [specify] | [specify] |

## 2.2 Independent Variables (IVs) — what you manipulate
| IV# | Name | #lvls | Levels | Description |
| --- | --- | --- | --- | --- |
| IV1 | [specify] | [specify] | [specify] | [specify] |

## 2.3a Control Variables (CVs) — held constant
| CV# | Name | #lvls | Level | Description / Rationale |
| --- | --- | --- | --- | --- |
| CV1 | [specify] | [specify] | [specify] | [specify] |

## 2.3b Random Variables (RVs) — not controlled, may vary
| RV# | Name | #lvls | Levels | Description / Rationale |
| --- | --- | --- | --- | --- |
| RV1 | [specify] | [specify] | [specify] | [specify] |

# 3. Study Design

## 3.1 Design Type
[specify: within-subject / between-subject / mixed. For mixed, state which IV is between vs. within and the factorial design, e.g. "3 (X, between) x 2 (Y, within)".]

## 3.2 Counterbalancing & Ordering
[specify: full / Latin square / none, with justification if none, plus trial/block ordering and randomisation.]

# 4. Participants
[specify: target N and per-group N, recruitment, inclusion/exclusion, consent, compensation.]

# 5. Apparatus & Materials
[specify: hardware, software, explanation/stimulus materials, questionnaires, test materials.]

# 6. Procedure
1. [specify: numbered, step-by-step session flow with durations, ending with a total estimated duration.]

# 7. Dataset & Agent

## 7.1 Trial Configuration
[specify: practice / baseline / main blocks, trials per block, training strategy, total analysed trials per participant.]

## 7.2 Agent
[specify: the AI model/agent that learns from the training data and produces the predictions participants evaluate.]

Be methodologically rigorous: surface confounds, unmeasured outcomes, design/counterbalancing mismatches, and under-powered participant counts as inline notes (e.g. "> Note: ..."), and propose fixes rather than silently filling fields. Do not reorder or drop template sections to make room for these notes.

Ensure you use markdown syntax when appropriate, as the text you generate will be rendered in markdown.

Use the full chat history as context when generating the artifact.

Follow these rules and guidelines:
<rules-guidelines>
- Do not wrap it in any XML tags you see in this prompt.
- Do not wrap the document in triple backticks.
- Section titles MUST use "#"/"##" headings exactly as in the template — never numbered list items or bold text.
${DEFAULT_CODE_PROMPT_RULES}
- Make sure you fulfill ALL aspects of a user's request.
</rules-guidelines>

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
</reflections>`;

const UPDATE_ENTIRE_ARTIFACT_PROMPT = `You are an AI assistant, and the user has requested you make an update to an artifact you generated in the past.

Here is the current content of the artifact:
<artifact>
{artifactContent}
</artifact>

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
</reflections>

Please update the artifact based on the user's request.

This artifact is an HCI study-design document. It MUST start with "# What experiment do you want to conduct?" and keep its fixed structure: the seven sections in order — "# 1. Research Questions", "# 2. Variables" (with "## 2.1 Dependent Variables (DVs)", "## 2.2 Independent Variables (IVs)", "## 2.3a Control Variables (CVs)", "## 2.3b Random Variables (RVs)" tables), "# 3. Study Design" (with "## 3.1 Design Type" and "## 3.2 Counterbalancing & Ordering"), "# 4. Participants", "# 5. Apparatus & Materials", "# 6. Procedure", and "# 7. Dataset & Agent" (with "## 7.1 Trial Configuration" and "## 7.2 Agent"). Apply the user's requested change within this structure; do NOT drop, rename, reorder, or merge sections, keep section titles as "#"/"##" markdown headings (never numbered list items or bold text), and keep the DV/IV/CV/RV markdown tables (header row + "| --- |" separator) intact. Leave "[specify]" in any cell the user has not filled.

Follow these rules and guidelines:
<rules-guidelines>
- You should respond with the ENTIRE updated artifact, with no additional text before and after.
- Do not wrap it in any XML tags you see in this prompt.
- You should use proper markdown syntax when appropriate, as the text you generate will be rendered in markdown. UNLESS YOU ARE WRITING CODE.
- When you generate code, a markdown renderer is NOT used so if you respond with code in markdown syntax, or wrap the code in tipple backticks it will break the UI for the user.
- If generating code, it is imperative you never wrap it in triple backticks, or prefix/suffix it with plain text. Ensure you ONLY respond with the code.
${DEFAULT_CODE_PROMPT_RULES}
</rules-guidelines>

Ensure you ONLY reply with the rewritten artifact and NO other content.
`;

function buildSystemPrompt(artifactContent: unknown) {
  if (typeof artifactContent === "string" && artifactContent.trim()) {
    return UPDATE_ENTIRE_ARTIFACT_PROMPT.replace(
      "{artifactContent}",
      artifactContent.trim()
    );
  }

  return NEW_ARTIFACT_PROMPT;
}

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
          content: buildSystemPrompt(body.artifactContent),
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
