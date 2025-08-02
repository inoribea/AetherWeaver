import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingResponse } from "ai";

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAlibaba } from "@langchain/community/chat_models/alibaba_tongyi";
import { SerpAPI } from "@langchain/community/tools/serpapi";
import { TavilySearch } from "@langchain/community/tools/tavily_search";
import { Calculator } from "@langchain/community/tools/calculator";
import { Tool } from "langchain/tools";

import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/schema";

import { convertToLangChainMessage, convertToVercelMessage } from "@/utils/messageFormat";

const AGENT_SYSTEM_PROMPT = `You are a helpful assistant.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const showIntermediate = body.showIntermediateSteps;
    const messages = (body.messages ?? [])
      .filter((msg: VercelChatMessage) => msg.role === "user" || msg.role === "assistant")
      .map(convertToLangChainMessage);

    const tools: Tool[] = [];

    if (process.env.SERPAPI_API_KEY) {
      tools.push(new SerpAPI());
    } else if (process.env.TAVILY_API_KEY) {
      tools.push(new TavilySearch({ maxResults: 5, apiKey: process.env.TAVILY_API_KEY }));
    }

    tools.push(new Calculator());

    const chatModel = new ChatOpenAI({
      temperature: 0,
      modelName: "gpt-4o-mini",
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
      return new StreamingResponse(stream);
    } else {
      const result = await agent.invoke({ messages });
      return NextResponse.json({
        messages: result.messages.map(convertToVercelMessage),
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.status ?? 500 });
  }
}