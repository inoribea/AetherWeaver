import { NextRequest, NextResponse } from "next/server";
import { Message as VercelMessage, StreamingTextResponse } from "ai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AlibabaTongyiEmbeddings } from "@langchain/community/embeddings/alibaba_tongyi";
import { SerpAPI } from "@langchain/community/tools/serpapi";
import { TavilySearch } from "@langchain/tavily";
import { Calculator } from "@langchain/community/tools/calculator";
import { Tool } from "@langchain/core/tools";

import { AIMessage, BaseMessage, ChatMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";

import {
  convertVercelMessageToLangChainMessage,
  convertLangChainMessageToVercelMessage,
} from "@/utils/messageFormat";

const AGENT_SYSTEM_PROMPT = `You are a helpful assistant.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const showIntermediate = body.showIntermediateSteps;
    const messages = (body.messages ?? [])
      .filter((msg: VercelMessage) => msg.role === "user" || msg.role === "assistant")
      .map(convertVercelMessageToLangChainMessage);

    const tools: Tool[] = [];

    if (process.env.SERPAPI_API_KEY) {
      tools.push(new SerpAPI());
    }
    if (process.env.TAVILY_API_KEY) {
      tools.push(new TavilySearch({ maxResults: 5, apiKey: process.env.TAVILY_API_KEY }));
    }

    tools.push(new Calculator());

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key is not configured." }, { status: 500 });
    }

    // 动态模型选择
    const modelName = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";

    const chatModel = new ChatOpenAI({
      temperature: 0,
      modelName,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const agent = createReactAgent({
      llm: chatModel,
      tools,
      messageModifier: new SystemMessage(AGENT_SYSTEM_PROMPT),
    });

    if (!showIntermediate) {
      const eventStream = await agent.streamEvents({ messages }, { version: "v2" });
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          for await (const { event, data } of eventStream) {
            if (event === "onChatModelStream" && data.chunk.content) {
              controller.enqueue(encoder.encode(data.chunk.content));
            }
          }
          controller.close();
        },
      });
      return new StreamingTextResponse(stream);
    } else {
      const result = await agent.invoke({ messages });
      return NextResponse.json({
        messages: result.messages.map(convertLangChainMessageToVercelMessage),
      });
    }
  } catch (error: any) {
    // 区分错误类型，避免敏感信息泄露
    const status = error.status ?? 500;
    const message = status === 500 ? "Internal Server Error" : error.message;
    return NextResponse.json({ error: message }, { status });
  }
}