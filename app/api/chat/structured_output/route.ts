import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { ChatOpenAI } from "@langchain/openai";
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAlibabaTongyi } from "@langchain/community/chat_models/alibaba_tongyi";
import { ChatTencentHunyuan } from "@langchain/community/chat_models/tencent_hunyuan";
import { PromptTemplate } from "@langchain/core/prompts";
import { BaseChatModel, BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { AIMessageChunk } from "@langchain/core/messages";

// export const runtime = "edge"; // Commented out to avoid edge runtime issues

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

// Helper function to get available model for structured output
function getAvailableStructuredOutputModel(): BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> {
  // Try models that support structured output/function calling
  if (process.env.OPENAI_API_KEY || process.env.NEKO_API_KEY) {
    return new ChatOpenAI({
      temperature: 0.8,
      model: "gpt-4o-mini",
      apiKey: process.env.NEKO_API_KEY || process.env.OPENAI_API_KEY,
      configuration: { baseURL: process.env.NEKO_BASE_URL || process.env.OPENAI_BASE_URL },
    });
  } else if (process.env.TENCENT_HUNYUAN_SECRET_ID && process.env.TENCENT_HUNYUAN_SECRET_KEY) {
    return new ChatTencentHunyuan({
      temperature: 0.8,
      model: "hunyuan-turbos-latest",
      tencentSecretId: process.env.TENCENT_HUNYUAN_SECRET_ID,
      tencentSecretKey: process.env.TENCENT_HUNYUAN_SECRET_KEY,
    });
  } else if (process.env.GOOGLE_API_KEY) {
    return new ChatGoogleGenerativeAI({
      temperature: 0.8,
      model: "gemini-2.5-flash-lite-preview-06-17",
      apiKey: process.env.GOOGLE_API_KEY,
    });
  } else if (process.env.DASHSCOPE_API_KEY) {
    return createAlibabaTongyiModel({
      temperature: 0.8,
      model: "qwen-turbo-latest",
      apiKey: process.env.DASHSCOPE_API_KEY,
    });
  } else {
    throw new Error("No API keys configured for structured output models. Please set up OpenAI, Tencent Hunyuan, Google, or Alibaba Tongyi API keys.");
  }
}

const TEMPLATE = `Extract the requested fields from the input.

The field "entity" refers to the first mentioned entity in the input.

Input:

{input}`;

/**
 * This handler initializes and calls a structured output chain with enhanced model support.
 * See the docs for more information:
 *
 * https://js.langchain.com/v0.2/docs/how_to/structured_output
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const currentMessageContent = messages[messages.length - 1].content;

    const prompt = PromptTemplate.fromTemplate(TEMPLATE);
    
    // Get available model that supports structured output
    const model = getAvailableStructuredOutputModel();

    /**
     * We use Zod (https://zod.dev) to define our schema for convenience,
     * but you can pass JSON schema if desired.
     */
 const schema = z
  .object({
    tone: z
      .enum(["positive", "negative", "neutral"])
      .describe("The overall tone of the input"),
    entity: z.string().describe("The entity mentioned in the input"),
    word_count: z.number().describe("The number of words in the input"),
    chat_response: z.string().describe("A response to the human's input"),
    final_punctuation: z
      .string()
      .describe("The final punctuation mark in the input, or empty string if none."),
  })
  .describe("Should always be used to properly format output");

    /**
     * Bind schema to the OpenAI model.
     * Future invocations of the returned model will always match the schema.
     *
     * Under the hood, uses tool calling by default.
     */
    const functionCallingModel = model.withStructuredOutput(schema, {
      name: "output_formatter",
    });

    /**
     * Returns a chain with the function calling model.
     */
    const chain = prompt.pipe(functionCallingModel);

    const result = await chain.invoke({
      input: currentMessageContent,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
