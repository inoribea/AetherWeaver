// src/app/api/chat/route.ts

import { NextRequest } from 'next/server';
import { Message as VercelChatMessage, StreamingTextResponse } from 'ai';

// Core LangChain imports
import { AIMessage, HumanMessage, SystemMessage, AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { BaseChatModel, BaseChatModelCallOptions } from '@langchain/core/language_models/chat_models'; // To type hint llmInstance
import { BaseLLM, BaseLLMCallOptions } from '@langchain/core/language_models/llms';
import { Runnable, RunnableLambda } from '@langchain/core/runnables';

// LangChain Integration Imports
import { ChatOpenAI } from '@langchain/openai';
import { ChatDeepSeek } from '@langchain/deepseek';
import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi';
import { CloudflareWorkersAI } from '@langchain/cloudflare';
import { ChatTencentHunyuan } from '@langchain/community/chat_models/tencent_hunyuan';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

// --- Other imports (if any, keep them here) ---
// import { ... } from '...';

// Helper function to format messages from Vercel AI SDK to LangChain format
function formatMessage(message: VercelChatMessage) {
  if (message.role === 'user') {
    return new HumanMessage(message.content);
  } else if (message.role === 'assistant') {
    return new AIMessage(message.content);
  } else {
    // Treat other roles (e.g., 'system') as SystemMessage
    return new SystemMessage(message.content);
  }
}

import { ChatPromptValueInterface } from "@langchain/core/prompt_values";

const messagesToText = new RunnableLambda({
  func: (input: ChatPromptValueInterface) => {
    const messages = input.messages;
    return messages.map((m: BaseMessage) => `${m._getType()}: ${m.content}`).join("\n");
  },
});

// Define a map for model configurations
const MODEL_PROVIDERS: Record<string, {
  type: string;
  model: new (...args: any[]) => BaseChatModel<any, any> | BaseLLM; // Type hint for the model class constructor
  config: Record<string, any>;
}> = {
  // --- Custom Models (OpenAI Compatible) ---
  'custom-provider-a-model': {
    type: 'openai_compatible', // Custom type
    model: ChatOpenAI, // Use ChatOpenAI class
    config: {
      apiKey: process.env.CUSTOM_PROVIDER_A_API_KEY,
      baseURL: process.env.CUSTOM_PROVIDER_A_BASE_URL,
    },
  },
  'custom-provider-b-model': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: {
      apiKey: process.env.CUSTOM_PROVIDER_B_API_KEY,
      baseURL: process.env.CUSTOM_PROVIDER_B_BASE_URL,
    },
  },
  // --- OpenRouter Models (OpenAI Compatible) ---
  'openrouter-gpt-4o': { // Model name sent by LobeChat
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL,
      // Replace with your Vercel app URL for HTTP-Referer
      extraHeaders: {
        "HTTP-Referer": "https://your-vercel-app-url.vercel.app",
        "X-Title": "LangChain Vercel API",
      },
    },
  },
  // You can continue to add other OpenRouter supported models
  'openrouter-gemini-pro': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL,
      extraHeaders: {
        "HTTP-Referer": "https://your-vercel-app-url.vercel.app",
        "X-Title": "LangChain Vercel API",
      },
    },
  },

  // --- DeepSeek Models ---
  'deepseek-chat': { // DeepSeek's primary model name
    type: 'deepseek',
    model: ChatDeepSeek, // Use ChatDeepSeek class
    config: {
      deepseekApiKey: process.env.DEEPSEEK_API_KEY, // DeepSeek's API Key variable name
      // Add other DeepSeek configuration options here if any
    },
  },
  'deepseek-reasoner': { // Another DeepSeek model
    type: 'deepseek',
    model: ChatDeepSeek,
    config: {
      deepseekApiKey: process.env.DEEPSEEK_API_KEY,
      model: 'deepseek-reasoner', // Explicitly specify model name
    },
  },

  // --- Aliyun Bailian (Tongyi) Models ---
  'qwen-turbo': { // Tongyi Qianwen turbo version
    type: 'alibaba_tongyi',
    model: ChatAlibabaTongyi, // Use ChatAlibabaTongyi class
    config: {
      apiKey: process.env.DASHSCOPE_API_KEY, // DashScope's API Key variable name (for Aliyun Tongyi)
      model: 'qwen-turbo',
      // If you need to use DashScope's OpenAI compatible interface, configure as follows:
      // baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      // model: 'qwen-plus', // Or other models supporting compatible mode
    },
  },
  'qwen-plus': {
    type: 'alibaba_tongyi',
    model: ChatAlibabaTongyi,
    config: {
      apiKey: process.env.DASHSCOPE_API_KEY,
      model: 'qwen-plus',
    },
  },

  // --- Cloudflare Workers AI Models ---
  'cloudflare-llama-3-8b-instruct': {
    type: 'cloudflare',
    model: CloudflareWorkersAI,
    config: {
      cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
      model: '@cf/meta/llama-3-8b-instruct',
      temperature: 0.7,   },
 },
  'cloudflare-gemma-7b-it': {
    type: 'cloudflare',
    model: CloudflareWorkersAI,
    config: {
      cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
      model: '@cf/google/gemma-7b-it',
      temperature: 0.7,
    },
   },
  // --- Tencent Hunyuan Models ---
  'tencent-hunyuan-lite': {
    type: 'tencent_hunyuan',
    model: ChatTencentHunyuan,
    config: {
      secretId: process.env.TENCENT_HUNYUAN_SECRET_ID,
      secretKey: process.env.TENCENT_HUNYUAN_SECRET_KEY,
      model: 'hunyuan-lite',
      temperature: 0.7,
      // Optional: Specify region or endpoint if needed
      // region: process.env.TENCENT_HUNYUAN_REGION,
      // endpoint: process.env.TENCENT_HUNYUAN_ENDPOINT,
    },
  },
  'tencent-hunyuan-pro': {
    type: 'tencent_hunyuan',
    model: ChatTencentHunyuan,
    config: {
      secretId: process.env.TENCENT_HUNYUAN_SECRET_ID,
      secretKey: process.env.TENCENT_HUNYUAN_SECRET_KEY,
      model: 'hunyuan-pro',
      temperature: 0.7,
    },
  },

  // --- Google Gemini Models ---
  // Example model names, e.g., "gemini-pro", "gemini-pro-vision"
  'gemini-pro': {
    type: 'google_gemini',
    model: ChatGoogleGenerativeAI,
    config: {
      apiKey: process.env.GOOGLE_API_KEY,
      model: 'gemini-pro',
      // Optional: Set a specific base URL if needed
      // baseUrl: process.env.GOOGLE_BASE_URL,
    },
  },
  'gemini-pro-vision': {
    type: 'google_gemini',
    model: ChatGoogleGenerativeAI,
    config: {
      apiKey: process.env.GOOGLE_API_KEY,
      model: 'gemini-pro-vision',
    },
  },
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const messages = body.messages ?? [];
  const modelName = body.model; // Get model name from the request

  // Format messages to LangChain format
  // Ensure formatMessage returns LangChain's BaseMessage type
  const formattedMessages = messages.map(formatMessage);
  // For ChatPromptTemplate, the last message is usually the HumanMessage (current user input)
  const currentMessage = formattedMessages[formattedMessages.length - 1] as HumanMessage;
  const historyMessages = formattedMessages.slice(0, -1);


  const providerEntry = MODEL_PROVIDERS[modelName];

  if (!providerEntry) {
    return new Response(JSON.stringify({ error: `Model ${modelName} not configured.` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let llmInstance: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> | BaseLLM<BaseLLMCallOptions>;
  try {
    switch (providerEntry.type) {
      case 'openai_compatible':
        llmInstance = new providerEntry.model({
          temperature: 0.7,
          streaming: true,
          ...providerEntry.config,
          // Pass the model name from the config, or use a default if not specified
          model: providerEntry.config.model || modelName,
        });
        break;
      case 'deepseek':
        llmInstance = new providerEntry.model({
          temperature: 0.7,
          streaming: true,
          // ChatDeepSeek uses deepseekApiKey
          deepseekApiKey: providerEntry.config.deepseekApiKey,
          model: providerEntry.config.model || modelName, // Ensure model name is passed
        });
        break;
      case 'alibaba_tongyi':
        llmInstance = new providerEntry.model({
          temperature: 0.7,
          streaming: true,
          // ChatAlibabaTongyi uses apiKey (for DashScope)
          apiKey: providerEntry.config.apiKey,
          model: providerEntry.config.model || modelName,
          // Pass baseURL if present in config
          baseURL: providerEntry.config.baseURL,
        });
        break;
      case 'cloudflare':
        llmInstance = new providerEntry.model({
          temperature: 0.7,
          streaming: true,
          cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
          cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
          model: providerEntry.config.model || modelName,
        }) as BaseLLM<BaseLLMCallOptions>;
        break;
      case 'tencent_hunyuan':
        llmInstance = new providerEntry.model({
          temperature: 0.7,
          streaming: true,
          // ChatTencentHunyuan uses secretId and secretKey
          secretId: providerEntry.config.secretId,
          secretKey: providerEntry.config.secretKey,
          model: providerEntry.config.model || modelName,
          // Optional: region and endpoint (default to undefined if not provided)
          region: providerEntry.config.region,
          endpoint: providerEntry.config.endpoint,
        });
        break;
      case 'google_gemini':
        llmInstance = new providerEntry.model({
          temperature: 0.7,
          streaming: true,
          ...providerEntry.config,
          model: providerEntry.config.model || modelName,
        }) as BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown provider type for model ${modelName}.` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
    }
  } catch (error: any) {
    console.error("Error initializing LLM instance:", error);
    return new Response(JSON.stringify({ error: `Failed to initialize LLM for model ${modelName}. Check environment variables and configuration.`, details: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Ensure llmInstance is a ChatModel compatible with ChatPromptTemplate
  if (!llmInstance || typeof llmInstance.invoke !== 'function' && typeof llmInstance.stream !== 'function') {
    return new Response(JSON.stringify({ error: `Invalid LLM instance for model ${modelName}. It does not have invoke or stream methods.` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ... (Your existing code before this section)
  // Ensure llmInstance has invoke or stream methods
  if (!llmInstance || (typeof (llmInstance as any).invoke !== 'function' && typeof (llmInstance as any).stream !== 'function')) {
    return new Response(JSON.stringify({ error: `Invalid LLM instance for model ${modelName}. It does not have invoke or stream methods.` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Create your LangChain Chain (LCEL)
  // Define the prompt template based on history and current message
  const prompt = ChatPromptTemplate.fromMessages([
    // System message (optional, but good for setting context/persona)
    // If you have a system message in your Vercel AI SDK messages,
    // ensure it's at the beginning of `historyMessages`.
    // Example: new SystemMessage("You are a helpful AI assistant."),
    // Pass previous messages for context. These are already formatted by `formatMessage`.
    ...historyMessages,
    // The current user input is always the last message and will be mapped to the 'input' variable
    // for the final human message in the prompt.
    currentMessage, // This is already a HumanMessage, no need to wrap again.
  ]);
  let chain: Runnable<any, string>; // Changed to Runnable to be more general
  if (llmInstance instanceof BaseChatModel) {
    chain = prompt.pipe(llmInstance).pipe(new StringOutputParser());
  } else if (llmInstance instanceof BaseLLM) {
    chain = prompt.pipe(messagesToText).pipe(llmInstance).pipe(new StringOutputParser());
  } else {
    return new Response(JSON.stringify({ error: `Unsupported LLM instance type for model ${modelName}.` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Define the streaming process
  const stream = await chain.stream({
  });
  // Return the streaming response
  return new StreamingTextResponse(stream);
} 
