import { createClient } from "@/hooks/utils";
import { StreamConfig } from "./streamWorker.types";

export class StreamWorkerService {
  constructor() {}

  async *streamData(config: StreamConfig): AsyncGenerator<any, void, unknown> {
    const { threadId, assistantId, input, modelName, modelConfigs } = config;
    const client = createClient();
    const stream = client.runs.stream(threadId, assistantId, {
      input: input as Record<string, unknown>,
      streamMode: "events",
      config: {
        configurable: {
          customModelName: modelName,
          modelConfig: modelConfigs[modelName as keyof typeof modelConfigs],
        },
      },
    });

    for await (const chunk of stream) {
      yield chunk;
    }
  }

  terminate() {}
}
