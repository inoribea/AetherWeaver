import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAlibabaTongyi } from "@langchain/community/chat_models/alibaba_tongyi";
import { SerpAPI } from "@langchain/community/tools/serpapi";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { Calculator } from "@langchain/community/tools/calculator";
import { Tool } from "@langchain/core/tools";
import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { BaseChatModel, BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { AIMessageChunk } from "@langchain/core/messages";

// export const runtime = "edge"; // Commented out to avoid edge runtime issues

const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};

const convertLangChainMessageToVercelMessage = (message: BaseMessage) => {
  if (message._getType() === "human") {
    return { content: message.content, role: "user" };
  } else if (message._getType() === "ai") {
    return {
      content: message.content,
      role: "assistant",
      tool_calls: (message as AIMessage).tool_calls,
    };
  } else {
    return { content: message.content, role: message._getType() };
  }
};

// Helper function to create Alibaba Tongyi model
function createAlibabaTongyiModel(config: {
  temperature?: number;
  model?: string;
  apiKey?: string;
}) {
  return new ChatAlibabaTongyi({
    temperature: config.temperature,
    model: config.model,
    alibabaApiKey: config.apiKey
  });
}

// Helper function to get available model for agents with token counting
function getAvailableAgentModel(): { model: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>, modelName: string } {
  // Token counting callbacks
  const tokenCountingCallbacks = [
    {
      handleLLMStart: async (llm: any, prompts: string[]) => {
        console.log(`[${new Date().toISOString()}] 🚀 Agent Model Started`);
        console.log(`[${new Date().toISOString()}] 📝 Prompts: ${prompts.length} prompt(s)`);
      },
      handleLLMEnd: async (output: any) => {
        if (output.llmOutput?.tokenUsage) {
          const usage = output.llmOutput.tokenUsage;
          console.log(`[${new Date().toISOString()}] 📊 Agent Token Usage:`);
          console.log(`  - Prompt Tokens: ${usage.promptTokens || 0}`);
          console.log(`  - Completion Tokens: ${usage.completionTokens || 0}`);
          console.log(`  - Total Tokens: ${usage.totalTokens || 0}`);
        }
      },
      handleLLMError: async (error: any) => {
        console.error(`[${new Date().toISOString()}] ❌ Agent Model Error:`, error);
      },
    },
  ];

  // Try models that support tool calling for agents
  if (process.env.OPENAI_API_KEY || process.env.NEKO_API_KEY) {
    return {
      model: new ChatOpenAI({
        model: "gpt-4o-mini",
        temperature: 0.2,
        apiKey: process.env.NEKO_API_KEY || process.env.OPENAI_API_KEY,
        configuration: { baseURL: process.env.NEKO_BASE_URL || process.env.OPENAI_BASE_URL },
        callbacks: tokenCountingCallbacks,
      }),
      modelName: "gpt-4o-mini"
    };
  } else if (process.env.GOOGLE_API_KEY) {
    return {
      model: new ChatGoogleGenerativeAI({
        model: "gemini-2.5-flash-preview-05-20",
        temperature: 0.2,
        apiKey: process.env.GOOGLE_API_KEY,
        callbacks: tokenCountingCallbacks,
      }),
      modelName: "gemini-flash"
    };
  } else if (process.env.DASHSCOPE_API_KEY) {
    return {
      model: new ChatAlibabaTongyi({
        model: "qwen-turbo-latest",
        temperature: 0.2,
        alibabaApiKey: process.env.DASHSCOPE_API_KEY,
        callbacks: tokenCountingCallbacks,
      }),
      modelName: "qwen-turbo"
    };
  } else {
    throw new Error("No API keys configured for agent models. Please set up OpenAI, Google, or Alibaba Tongyi API keys.");
  }
}

const AGENT_SYSTEM_TEMPLATE = `You are a talking parrot named Polly. All final responses must be how a talking parrot would respond. Squawk often!`;

/**
 * This handler initializes and calls an tool caling ReAct agent.
 * See the docs for more information:
 *
 * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const returnIntermediateSteps = body.show_intermediate_steps;
    /**
     * We represent intermediate steps as system messages for display purposes,
     * but don't want them in the chat history.
     */
    const messages = (body.messages ?? [])
      .filter(
        (message: VercelChatMessage) =>
          message.role === "user" || message.role === "assistant",
      )
      .map(convertVercelMessageToLangChainMessage);

    // Setup tools - try different search providers
    const tools: Tool[] = [new Calculator()];
    
    // Add search tool if available
    if (process.env.SERPAPI_API_KEY) {
      tools.push(new SerpAPI());
    } else if (process.env.TAVILY_API_KEY) {
      tools.push(new TavilySearchResults({ maxResults: 5, apiKey: process.env.TAVILY_API_KEY }));
    }
    
    const { model: chat, modelName } = getAvailableAgentModel();
    console.log(`[Agents] Using model: ${modelName}`);

    /**
     * Use a prebuilt LangGraph agent.
     */
    const agent = createReactAgent({
      llm: chat,
      tools,
      /**
       * Modify the stock prompt in the prebuilt agent. See docs
       * for how to customize your agent:
       *
       * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
       */
      messageModifier: new SystemMessage(AGENT_SYSTEM_TEMPLATE),
    });

    if (!returnIntermediateSteps) {
      /**
       * Stream back all generated tokens and steps from their runs.
       *
       * We do some filtering of the generated events and only stream back
       * the final response as a string.
       *
       * For this specific type of tool calling ReAct agents with OpenAI, we can tell when
       * the agent is ready to stream back final output when it no longer calls
       * a tool and instead streams back content.
       *
       * See: https://langchain-ai.github.io/langgraphjs/how-tos/stream-tokens/
       */
      const eventStream = await agent.streamEvents(
        { messages },
        { version: "v2" },
      );

      const textEncoder = new TextEncoder();
      const transformStream = new ReadableStream({
        async start(controller) {
          for await (const { event, data } of eventStream) {
            if (event === "on_chat_model_stream") {
              // Intermediate chat model generations will contain tool calls and no content
              if (!!data.chunk.content) {
                controller.enqueue(textEncoder.encode(data.chunk.content));
              }
            }
          }
          controller.close();
        },
      });

      return new StreamingTextResponse(transformStream, {
        headers: {
          "X-Model-Used": modelName,
          "X-Model-Provider": "Multiple",
          "X-Feature": "Agent Chat",
        },
      });
    } else {
      /**
       * We could also pick intermediate steps out from `streamEvents` chunks, but
       * they are generated as JSON objects, so streaming and displaying them with
       * the AI SDK is more complicated.
       */
      const result = await agent.invoke({ messages });

      return NextResponse.json(
        {
          messages: result.messages.map(convertLangChainMessageToVercelMessage),
        },
        { status: 200 },
      );
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
