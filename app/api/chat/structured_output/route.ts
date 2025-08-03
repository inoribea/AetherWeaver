import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { ChatOpenAI } from '@langchain/openai';
import { ChatDeepSeek } from '@langchain/deepseek';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi';
import { ChatTencentHunyuan } from '@langchain/community/chat_models/tencent_hunyuan'; 
import { PromptTemplate } from '@langchain/core/prompts';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { routeRequest, RoutingRequest } from '@/utils/unified-router';

async function getAvailableStructuredOutputModel(messages: any[]): Promise<{ model: BaseChatModel; modelName: string }> {
  try {
    const routingRequest: RoutingRequest = {
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      capabilities: {
        structured_output: true,
        tool_calling: true,
      },
    };

    const decision = await routeRequest(routingRequest);
    const selectedModel = decision.selectedModel;

    let model: BaseChatModel;

    if (selectedModel.includes("gpt") || selectedModel.includes("openai")) {
      model = new ChatOpenAI({
        temperature: 0.8,
        model: selectedModel,
        apiKey: process.env.OPENAI_API_KEY,
      });
    } else if (selectedModel.includes("hunyuan")) {
      model = new ChatTencentHunyuan({
        temperature: 0.8,
        model: selectedModel,
        tencentSecretId: process.env.TENCENT_SECRET_ID,
        tencentSecretKey: process.env.TENCENT_SECRET_KEY,
      });
    } else if (selectedModel.includes("google")) {
      model = new ChatGoogleGenerativeAI({
        temperature: 0.8,
        model: selectedModel,
        apiKey: process.env.GOOGLE_API_KEY,
      });
    } else if (selectedModel.includes("qwen")) {
      model = new ChatAlibabaTongyi({
        temperature: 0.8,
        model: selectedModel,
        alibabaApiKey: process.env.ALIBABA_API_KEY,
      });
    } else if (selectedModel.includes("deepseek")) {
      model = new ChatDeepSeek({
        temperature: 0.8,
        model: selectedModel,
        apiKey: process.env.DEEPSEEK_API_KEY,
      });
    } else {
      model = new ChatOpenAI({
        temperature: 0.8,
        model: "gpt-4o-mini",
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    return { model, modelName: selectedModel };
  } catch (error) {
    console.error("Routing failed, using fallback model", error);
    if (process.env.OPENAI_API_KEY) {
      return {
        model: new ChatOpenAI({
          temperature: 0.8,
          model: "gpt-4o-mini",
          apiKey: process.env.OPENAI_API_KEY,
        }),
        modelName: "gpt-4o-mini",
      };
    }
    throw new Error("No API keys configured for structured output models.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      console.error('Invalid or empty messages array in /api/chat/structured_output POST:', body.messages);
      return NextResponse.json(
        {
          error: 'Invalid or empty messages array',
          message: 'Request body must contain non-empty messages array',
        },
        { status: 400 }
      );
    }

    const messages = body.messages;
    const currentMessage = messages[messages.length - 1];

    if (!currentMessage || typeof currentMessage.content !== 'string' || currentMessage.content.trim().length === 0) {
      console.error('Invalid last message content in /api/chat/structured_output POST:', currentMessage);
      return NextResponse.json(
        {
          error: 'Invalid last message content',
          message: 'The last message must have a non-empty content string',
        },
        { status: 400 }
      );
    }

    const { model, modelName } = await getAvailableStructuredOutputModel(messages);

    // 定义zod schema用于结构化输出
    const schema = z.object({
      tone: z.enum(["positive", "negative", "neutral"]).describe("The sentiment of the input text"),
      entity: z.string().describe("The first mentioned entity in the input"),
      word_count: z.number().describe("Number of words in the input text"),
      chat_response: z.string().describe("A suitable response to the input"),
      final_punctuation: z.string().describe("The final punctuation mark in the input"),
    });

    // 使用LangChain的withStructuredOutput方法
    const structuredModel = model.withStructuredOutput(schema);

    // 直接调用结构化模型
    const result = await structuredModel.invoke([
      {
        role: "user",
        content: `Extract the requested fields from the following input:
- tone: Determine the sentiment (positive/negative/neutral)
- entity: Find the first mentioned entity
- word_count: Count the number of words
- chat_response: Provide an appropriate response
- final_punctuation: Identify the final punctuation mark

Input: ${currentMessage.content.trim()}`
      }
    ]);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "X-Model-Used": modelName,
        "X-Feature": "Structured Output",
      },
    });
  } catch (e: any) {
    console.error('POST /api/chat/structured_output error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
