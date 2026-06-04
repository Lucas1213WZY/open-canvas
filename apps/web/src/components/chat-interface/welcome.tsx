import { ProgrammingLanguageOptions } from "@opencanvas/shared/types";
import { ThreadPrimitive, useThreadRuntime } from "@assistant-ui/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FC, useMemo } from "react";
import { TighterText } from "../ui/header";
import { NotebookPen } from "lucide-react";
import { ProgrammingLanguagesDropdown } from "../ui/programming-lang-dropdown";
import { Button } from "../ui/button";

const STARTER_DRAFT_MESSAGE =
  "I would like to compare ... and ... explanations, for example (decision tree) and (SHAP).";

const QUICK_START_PROMPTS_SEARCH = [
  "Plan a user study comparing example-based and counterfactual AI explanations",
  "Design an experiment on whether feature-importance explanations improve trust calibration",
  "Create a study plan for evaluating AI explanation helpfulness in clinical decision support",
  "Draft an XAI experiment comparing confidence scores, saliency maps, and natural-language rationales",
  "Plan a user study on when AI explanations increase overreliance",
  "Design an experiment to test whether explanations help users detect model errors",
  "Create a participant procedure for evaluating explanations in loan approval decisions",
  "Draft variables and measures for an XAI transparency experiment",
  "Plan a mixed-methods study about user preferences for AI explanations",
  "Design a task-based study for comparing local and global AI explanations",
];

const QUICK_START_PROMPTS = [
  "Design a user study comparing AI explanations with no-explanation baselines",
  "Plan an experiment on how explanation detail affects user trust in AI decisions",
  "Create variables and measures for evaluating AI explanation usefulness",
  "Draft a procedure for testing whether explanations help users identify AI mistakes",
  "Plan a between-subjects study on saliency maps versus text rationales",
  "Design a mixed-methods XAI study with surveys, tasks, and interviews",
  "Create a participant recruitment plan for an AI explanation experiment",
  "Draft a dataset and agent setup for training from explanation feedback",
  "Plan an experiment on AI explanations for loan approval decisions",
  "Design a study testing whether explanations reduce automation bias",
  "Compare counterfactual explanations and feature-importance explanations",
  "Create research questions for an XAI user experiment",
  "Plan a study about user mental models of AI after seeing explanations",
  "Draft an XAI experiment for evaluating explanation clarity and actionability",
];

function getRandomPrompts(prompts: string[], count: number = 4): string[] {
  return [...prompts].sort(() => Math.random() - 0.5).slice(0, count);
}

interface QuickStartButtonsProps {
  handleQuickStart: (
    type: "text" | "code",
    language?: ProgrammingLanguageOptions
  ) => void;
  composer: React.ReactNode;
  searchEnabled: boolean;
}

interface QuickStartPromptsProps {
  searchEnabled: boolean;
}

const QuickStartPrompts = ({ searchEnabled }: QuickStartPromptsProps) => {
  const threadRuntime = useThreadRuntime();

  const handleClick = (text: string) => {
    threadRuntime.append({
      role: "user",
      content: [{ type: "text", text }],
    });
  };

  const selectedPrompts = useMemo(
    () =>
      getRandomPrompts(
        searchEnabled ? QUICK_START_PROMPTS_SEARCH : QUICK_START_PROMPTS
      ),
    [searchEnabled]
  );

  return (
    <div className="flex flex-col w-full gap-2">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
        {selectedPrompts.map((prompt, index) => (
          <Button
            key={`quick-start-prompt-${index}`}
            onClick={() => handleClick(prompt)}
            variant="outline"
            className="min-h-[60px] w-full flex items-center justify-center p-6 whitespace-normal text-gray-500 hover:text-gray-700 transition-colors ease-in rounded-2xl"
          >
            <p className="text-center break-words text-sm font-normal">
              {prompt}
            </p>
          </Button>
        ))}
      </div>
    </div>
  );
};

const QuickStartButtons = (props: QuickStartButtonsProps) => {
  const handleLanguageSubmit = (language: ProgrammingLanguageOptions) => {
    props.handleQuickStart("code", language);
  };

  return (
    <div className="flex flex-col gap-8 items-center justify-center w-full">
      <div className="flex flex-col gap-6">
        <p className="text-gray-600 text-sm">Start an experiment plan</p>
        <div className="flex flex-row gap-1 items-center justify-center w-full">
          <Button
            variant="outline"
            className="text-gray-500 hover:text-gray-700 transition-colors ease-in rounded-2xl flex items-center justify-center gap-2 w-[250px] h-[64px]"
            onClick={() => props.handleQuickStart("text")}
          >
            Start planning
            <NotebookPen />
          </Button>
          <ProgrammingLanguagesDropdown handleSubmit={handleLanguageSubmit} />
        </div>
      </div>
      <div className="flex flex-col gap-6 mt-2 w-full">
        <p className="text-gray-600 text-sm">or describe your XAI study</p>
        {props.composer}
        <QuickStartPrompts searchEnabled={props.searchEnabled} />
      </div>
    </div>
  );
};

interface ThreadWelcomeProps {
  handleQuickStart: (
    type: "text" | "code",
    language?: ProgrammingLanguageOptions
  ) => void;
  composer: React.ReactNode;
  searchEnabled: boolean;
}

export const ThreadWelcome: FC<ThreadWelcomeProps> = (
  props: ThreadWelcomeProps
) => {
  return (
    <ThreadPrimitive.Empty>
      <div className="flex items-center justify-center mt-16 w-full">
        <div className="text-center max-w-3xl w-full">
          <Avatar className="mx-auto h-24 w-24 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
            <AvatarImage
              src="/xai.png"
              alt="XAIkit icon"
              className="object-contain p-1"
            />
            <AvatarFallback className="rounded-3xl">XAI</AvatarFallback>
          </Avatar>
          <div className="mx-auto mt-6 flex max-w-xl items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left shadow-sm">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              AI
            </div>
            <p className="text-sm leading-6 text-slate-700">
              {STARTER_DRAFT_MESSAGE}
            </p>
          </div>
          <TighterText className="mt-4 text-lg font-medium">
            What XAI user study or experiment would you like to plan?
          </TighterText>
          <div className="mt-4 mx-auto max-w-xl rounded-2xl border bg-white px-5 py-4 text-left text-sm leading-6 text-gray-600 shadow-sm">
            Tell me what user study or experiment you would like to conduct
            with AI explanations.
          </div>
          <div className="mt-8 w-full">
            <QuickStartButtons
              composer={props.composer}
              handleQuickStart={props.handleQuickStart}
              searchEnabled={props.searchEnabled}
            />
          </div>
        </div>
      </div>
    </ThreadPrimitive.Empty>
  );
};
