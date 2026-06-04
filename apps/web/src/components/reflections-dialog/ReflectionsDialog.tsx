import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { BrainCog, Loader } from "lucide-react";
import { ConfirmClearDialog } from "./ConfirmClearDialog";
import { TooltipIconButton } from "../ui/assistant-ui/tooltip-icon-button";
import { TighterText } from "../ui/header";
import { useStore } from "@/hooks/useStore";
import { useToast } from "@/hooks/use-toast";
import { Assistant } from "@langchain/langgraph-sdk";
import { Badge } from "../ui/badge";
import { getIcon } from "../assistant-select/utils";
import { useGraphContext } from "@/contexts/GraphContext";
import { convertToOpenAIFormat } from "@/lib/convert_messages";
import { BaseMessage } from "@langchain/core/messages";
import useLocalStorage from "@/hooks/useLocalStorage";
import { Reflections as ReflectionsType } from "@opencanvas/shared/types";

const OPENAI_DIRECT_CHAT = true;
const LOCAL_REFLECTIONS_KEY = "xaikit-local-reflections";

export interface NoReflectionsProps {
  selectedAssistant: Assistant | undefined;
  getReflections: (assistantId: string) => Promise<void>;
}

function NoReflections(props: NoReflectionsProps) {
  const { selectedAssistant } = props;
  const { toast } = useToast();

  const getReflections = async () => {
    if (!selectedAssistant) {
      toast({
        title: "Error",
        description: "Assistant ID not found.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }
    await props.getReflections(selectedAssistant.assistant_id);
  };

  return (
    <div className="flex flex-col items-center mt-6 mb-[-24px] gap-3">
      <TighterText>No reflections have been generated yet.</TighterText>
      <TighterText className="text-sm text-gray-500">
        Reflections generate after 30s of inactivity. If none appear, try again
        later.
      </TighterText>
      <Button onClick={getReflections} variant="secondary" size="sm">
        <TighterText>Search for reflections</TighterText>
      </Button>
    </div>
  );
}

interface ReflectionsDialogProps {
  selectedAssistant: Assistant | undefined;
}

export function ReflectionsDialog(props: ReflectionsDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { selectedAssistant } = props;
  const {
    graphData: { messages, artifact },
  } = useGraphContext();
  const [localReflections, setLocalReflections] = useLocalStorage<
    (ReflectionsType & { updatedAt: string }) | undefined
  >(LOCAL_REFLECTIONS_KEY, undefined);
  const {
    isLoadingReflections,
    reflections,
    getReflections,
    deleteReflections,
  } = useStore();

  const artifactContent = useMemo(() => {
    if (!artifact) return "";

    const current = artifact.contents.find((content) => content.index === artifact.currentIndex);
    if (!current) return "";

    return current.type === "text" ? current.fullMarkdown : current.code;
  }, [artifact]);

  const mappedMessages = useMemo(
    () => messages.map((message) => convertToOpenAIFormat(message as BaseMessage)),
    [messages]
  );

  const [isGeneratingLocalReflections, setIsGeneratingLocalReflections] = useState(false);

  const storedReflections = OPENAI_DIRECT_CHAT ? localReflections : reflections;

  useEffect(() => {
    if (OPENAI_DIRECT_CHAT) return;
    if (!selectedAssistant || typeof window === "undefined") return;
    // Don't re-fetch reflections if they already exist & are for the same assistant
    if (
      (reflections?.content || reflections?.styleRules) &&
      reflections.assistantId === selectedAssistant.assistant_id
    )
      return;

    getReflections(selectedAssistant.assistant_id);
  }, [selectedAssistant]);

  const handleDelete = async () => {
    if (OPENAI_DIRECT_CHAT) {
      setLocalReflections(undefined);
      setOpen(false);
      return true;
    }

    if (!selectedAssistant) {
      toast({
        title: "Error",
        description: "Assistant ID not found.",
        variant: "destructive",
        duration: 5000,
      });
      return false;
    }
    setOpen(false);
    return await deleteReflections(selectedAssistant.assistant_id);
  };

  const handleGenerateLocalReflections = async () => {
    if (!mappedMessages.length) {
      toast({
        title: "No chat history yet",
        description: "Start a chat before generating reflections.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    setIsGeneratingLocalReflections(true);
    try {
      const response = await fetch("/api/openai-reflections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: mappedMessages,
          artifactContent,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => undefined);
        throw new Error(error?.error || "Failed to generate reflections");
      }

      const result = (await response.json()) as {
        styleRules: string[];
        content: string[];
      };

      const nextReflections = {
        styleRules: result.styleRules ?? [],
        content: result.content ?? [],
        updatedAt: new Date().toISOString(),
      };

      setLocalReflections(nextReflections);
    } catch (error) {
      toast({
        title: "Failed to generate reflections",
        description:
          error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsGeneratingLocalReflections(false);
    }
  };

  const iconData = (selectedAssistant?.metadata as Record<string, any>)
    ?.iconData;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <TooltipIconButton
          tooltip="Reflections"
          variant="ghost"
          className="w-fit h-fit p-2"
          onClick={() => setOpen(true)}
        >
          <BrainCog className="w-6 h-6 text-gray-600" />
        </TooltipIconButton>
      </DialogTrigger>
      <DialogContent className="max-w-xl p-8 bg-white rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <TighterText className="text-3xl font-light text-gray-800">
              Reflections
            </TighterText>
            {selectedAssistant && !OPENAI_DIRECT_CHAT && (
              <Badge
                style={{
                  ...(iconData
                    ? {
                        color: iconData.iconColor,
                        backgroundColor: `${iconData.iconColor}20`, // 33 in hex is ~20% opacity
                      }
                    : {
                        color: "#000000",
                        backgroundColor: "#00000020",
                      }),
                }}
                className="flex items-center justify-center gap-2 px-2 py-1"
              >
                <span className="flex items-center justify-start w-4 h-4">
                  {getIcon(
                    (selectedAssistant?.metadata as Record<string, any>)
                      ?.iconData?.iconName
                  )}
                </span>
                {selectedAssistant?.name}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="mt-2 text-md font-light text-gray-600">
            <TighterText>
              {OPENAI_DIRECT_CHAT ? (
                isGeneratingLocalReflections ? (
                  "Generating reflections..."
                ) : storedReflections?.content || storedReflections?.styleRules ? (
                  "Current reflections generated from your browser chat session."
                ) : (
                  "Generate reflections from your current OpenAI chat session."
                )
              ) : isLoadingReflections ? (
                "Loading reflections..."
              ) : storedReflections?.content || storedReflections?.styleRules ? (
                "Current reflections generated by the assistant for content generation."
              ) : (
                <NoReflections
                  selectedAssistant={selectedAssistant}
                  getReflections={getReflections}
                />
              )}
            </TighterText>
          </DialogDescription>
        </DialogHeader>
        <div className="mt-6 max-h-[60vh] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {OPENAI_DIRECT_CHAT ? (
            isGeneratingLocalReflections ? (
              <div className="flex justify-center items-center h-32">
                <Loader className="h-8 w-8 animate-spin" />
              </div>
            ) : storedReflections?.content || storedReflections?.styleRules ? (
              <>
                {storedReflections?.styleRules && (
                  <div className="mb-6">
                    <TighterText className="text-xl font-light text-gray-800 sticky top-0 bg-white py-2 mb-3">
                      Style Reflections:
                    </TighterText>
                    <ul className="list-disc list-inside space-y-2">
                      {storedReflections.styleRules?.map((rule, index) => (
                        <li key={index} className="flex items-baseline">
                          <span className="mr-2">•</span>
                          <TighterText className="text-gray-600 font-light">
                            {rule}
                          </TighterText>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {storedReflections?.content && (
                  <div className="mb-6">
                    <TighterText className="text-xl font-light text-gray-800 sticky top-0 bg-white py-2 mb-3">
                      Content Reflections:
                    </TighterText>
                    <ul className="list-disc list-inside space-y-2">
                      {storedReflections.content.map((rule, index) => (
                        <li key={index} className="flex items-baseline">
                          <span className="mr-2">•</span>
                          <TighterText className="text-gray-600 font-light">
                            {rule}
                          </TighterText>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : null
          ) : isLoadingReflections ? (
            <div className="flex justify-center items-center h-32">
              <Loader className="h-8 w-8 animate-spin" />
            </div>
          ) : storedReflections?.content || storedReflections?.styleRules ? (
            <>
              {storedReflections?.styleRules && (
                <div className="mb-6">
                  <TighterText className="text-xl font-light text-gray-800 sticky top-0 bg-white py-2 mb-3">
                    Style Reflections:
                  </TighterText>
                  <ul className="list-disc list-inside space-y-2">
                    {storedReflections.styleRules?.map((rule, index) => (
                      <li key={index} className="flex items-baseline">
                        <span className="mr-2">•</span>
                        <TighterText className="text-gray-600 font-light">
                          {rule}
                        </TighterText>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {storedReflections?.content && (
                <div className="mb-6">
                  <TighterText className="text-xl font-light text-gray-800 sticky top-0 bg-white py-2 mb-3">
                    Content Reflections:
                  </TighterText>
                  <ul className="list-disc list-inside space-y-2">
                    {storedReflections.content.map((rule, index) => (
                      <li key={index} className="flex items-baseline">
                        <span className="mr-2">•</span>
                        <TighterText className="text-gray-600 font-light">
                          {rule}
                        </TighterText>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : null}
        </div>
        <div className="mt-6 flex justify-between">
          {storedReflections?.content || storedReflections?.styleRules ? (
            <ConfirmClearDialog handleDeleteReflections={handleDelete} />
          ) : OPENAI_DIRECT_CHAT ? (
            <Button
              onClick={handleGenerateLocalReflections}
              variant="secondary"
              disabled={isGeneratingLocalReflections}
            >
              <TighterText>
                {isGeneratingLocalReflections
                  ? "Generating..."
                  : "Generate reflections"}
              </TighterText>
            </Button>
          ) : null}
          <Button
            onClick={() => setOpen(false)}
            className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded shadow transition"
          >
            <TighterText>Close</TighterText>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
