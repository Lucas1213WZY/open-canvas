import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type CanvasAction =
  | "new_artifact"
  | "rewrite_artifact"
  | "ask_clarifying_question";

type CanvasResponse = {
  action: CanvasAction;
  artifactTitle: string;
  artifactMarkdown: string;
  chatMessage: string;
  nextQuestions: string[];
};

const DEFAULT_CODE_PROMPT_RULES =
  "- Do NOT include triple backticks when generating code. The code should be in plain text.";

const STUDY_ARTIFACT_TEMPLATE = `# What experiment do you want to conduct?

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
[specify: the AI model/agent that learns from the training data and produces the predictions participants evaluate.]`;

const STRUCTURED_CANVAS_PROMPT = `You are an expert HCI (human-computer interaction) research methodologist embedded in the "HCI Experiment Designer". You help researchers design experiments whose data will be used for agent training.

You must behave like Open Canvas: keep the canvas artifact and the chat response separate.

Return ONLY a valid JSON object with this exact shape:
{
  "action": "new_artifact" | "rewrite_artifact" | "ask_clarifying_question",
  "artifactTitle": "a short editable title for the canvas artifact",
  "artifactMarkdown": "the complete markdown artifact for the canvas",
  "chatMessage": "a short conversational response that summarizes the update and asks what to do next",
  "nextQuestions": ["2 to 4 concise questions the user can answer next"]
}

Artifact rules:
- artifactTitle must be concise, specific to the study, and 3 to 8 words.
- If the user explicitly asks to generate, rename, or change the title, update artifactTitle.
- artifactMarkdown must be the full canvas document, not a summary.
- artifactMarkdown MUST start with "# What experiment do you want to conduct?"
- Keep the seven sections in this exact order: Research Questions; Variables; Study Design; Participants; Apparatus & Materials; Procedure; Dataset & Agent.
- Keep all markdown headings, numbering, table columns, and table separator rows from the template.
- Only replace "[specify]" placeholders when the user provided enough information.
- Leave "[specify]" where more information is needed.
- Do not wrap artifactMarkdown in triple backticks or XML tags.
- Section titles MUST use "#"/"##" markdown headings, never numbered list items or bold text.
- Be methodologically rigorous: surface confounds, unmeasured outcomes, design/counterbalancing mismatches, and under-powered participant counts as inline notes (e.g. "> Note: ..."), and propose fixes rather than silently filling fields.
${DEFAULT_CODE_PROMPT_RULES}

Chat rules:
- chatMessage must NOT repeat the full artifact.
- chatMessage should be 1 to 2 short sentences.
- chatMessage should mention the section changed or created.
- chatMessage should ask one useful next-step question.
- nextQuestions should help the user fill missing or weak parts of the plan.
- If asking about participant tasks, do NOT ask "What specific tasks will participants perform with the model?"
- Instead, state that this planner supports two participant task types: forward simulation and counterfactual simulation.
- Use this concise wording when relevant: "Which supported task should participants perform: forward simulation (predict the model output from an input) or counterfactual simulation (change an input and predict how the model output changes)?"
- Do not suggest unsupported participant task types unless the user explicitly asks to discuss limitations or future extensions.

Template to reproduce for new artifacts or preserve for rewrites:
${STUDY_ARTIFACT_TEMPLATE}`;

function buildUserContextPrompt(artifactContent: unknown) {
  if (typeof artifactContent === "string" && artifactContent.trim()) {
    return `Current canvas artifact:
<artifact>
${artifactContent.trim()}
</artifact>

Use the user's latest message and chat history to rewrite the complete artifact. Preserve the fixed HCI study-design structure.`;
  }

  return `There is no current canvas artifact yet. Create a new HCI study-design artifact using the fixed template.`;
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

function normalizeCanvasResponse(value: unknown): CanvasResponse | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = value as Partial<CanvasResponse>;
  const action = candidate.action;
  const artifactTitle = candidate.artifactTitle;
  const artifactMarkdown = candidate.artifactMarkdown;
  const chatMessage = candidate.chatMessage;
  const nextQuestions = candidate.nextQuestions;

  if (
    !["new_artifact", "rewrite_artifact", "ask_clarifying_question"].includes(
      String(action)
    ) ||
    typeof artifactTitle !== "string" ||
    typeof artifactMarkdown !== "string" ||
    typeof chatMessage !== "string" ||
    !Array.isArray(nextQuestions)
  ) {
    return undefined;
  }

  return {
    action: action as CanvasAction,
    artifactTitle: artifactTitle.trim() || "Untitled document",
    artifactMarkdown,
    chatMessage,
    nextQuestions: nextQuestions.filter(
      (question): question is string =>
        typeof question === "string" && Boolean(question.trim())
    ),
  };
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
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: STRUCTURED_CANVAS_PROMPT,
        },
        {
          role: "system",
          content: buildUserContextPrompt(body.artifactContent),
        },
        ...messages,
      ],
    }),
  });

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

  const responseJson = await openAIResponse.json();
  const content = responseJson.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    return NextResponse.json(
      { error: "OpenAI returned an empty canvas response" },
      { status: 502 }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return NextResponse.json(
      { error: "OpenAI returned invalid JSON", details: content },
      { status: 502 }
    );
  }

  const canvasResponse = normalizeCanvasResponse(parsed);
  if (!canvasResponse) {
    return NextResponse.json(
      { error: "OpenAI returned an invalid canvas response", details: parsed },
      { status: 502 }
    );
  }

  return NextResponse.json(canvasResponse);
}
