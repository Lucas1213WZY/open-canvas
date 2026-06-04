"use client";

import { Canvas } from "@/components/canvas";
import { OpenAIDirectChat } from "@/components/openai-direct-chat";
import { AssistantProvider } from "@/contexts/AssistantContext";
import { GraphProvider } from "@/contexts/GraphContext";
import { ThreadProvider } from "@/contexts/ThreadProvider";
import { UserProvider } from "@/contexts/UserContext";
import { Suspense } from "react";

export default function Home() {
  if (process.env.NEXT_PUBLIC_OPENAI_DIRECT_CHAT !== "false") {
    return <OpenAIDirectChat />;
  }

  return (
    <Suspense>
      <UserProvider>
        <ThreadProvider>
          <AssistantProvider>
            <GraphProvider>
              <Canvas />
            </GraphProvider>
          </AssistantProvider>
        </ThreadProvider>
      </UserProvider>
    </Suspense>
  );
}
