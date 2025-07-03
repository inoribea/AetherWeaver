import { NextRequest } from 'next/server';
import { Message as VercelChatMessage, StreamingTextResponse } from 'ai';

// Core LangChain imports
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  AIMessageChunk,
  BaseMessage,
  MessageContent 
} from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { BaseChatModel, BaseChatModelCallOptions } from '@langchain/core/language_models/chat_models';
import { BaseLLM, BaseLLMCallOptions } from '@langchain/core/language_models/llms';
import { Runnable, RunnableLambda, RunnableSequence } from '@langchain/core/runnables';

// LangChain Integration Imports
import { ChatOpenAI } from '@langchain/openai';
import { ChatDeepSeek } from '@langchain/deepseek';
import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi';
import { CloudflareWorkersAI } from '@langchain/cloudflare';
import { ChatTencentHunyuan } from '@langchain/community/chat_models/tencent_hunyuan';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

// --- Imports for Tools and Agents ---
import { Tool } from "@langchain/core/tools";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { AgentStep } from "@langchain/core/agents";
import { BufferMemory } from "langchain/memory";

export const runtime = 'edge';

// Helper function to format messages from Vercel AI SDK to LangChain format
interface ContentPart { 
  type?: string;
  text?: string;
  image_url?: { url: any };
}

function formatMessage(message: VercelChatMessage): BaseMessage {
  if (message.role === 'user') {
    if (Array.isArray(message.content)) {
      const contentParts: ContentPart[] = message.content.map(part => {
        if (part.type === 'text') {
          return { type: 'text', text: part.text };
        } else if (part.type === 'image_url') {
          return { type: 'image_url', image_url: { url: part.image_url.url } };
        }
        return { type: 'text', text: (part as any).text || String(part) };
      });
      return new HumanMessage({ content: contentParts as MessageContent });
    }
    return new HumanMessage(message.content as string);
  } else if (message.role === 'assistant') {
    return new AIMessage(message.content as string);
  } else {
    return new SystemMessage(message.content as string);
  }
}

import { ChatPromptValueInterface } from "@langchain/core/prompt_values";

const messagesToText = new RunnableLambda({
  func: (input: ChatPromptValueInterface) => {
    const messages = input.messages;
    return messages.map((m: BaseMessage) => {
      if (m._getType() === 'human' && Array.isArray(m.content)) {
        return `Human: ${m.content.map(part => {
          if (part.type === 'text') return part.text;
          if (part.type === 'image_url') return `[Image: ${part.image_url.url}]`;
          return '';
        }).join(' ')}`;
      }
      return `${m._getType()}: ${m.content}`;
    }).join("\n");
  },
});

// 定义模型配置映射
const MODEL_PROVIDERS: Record<string, {
  type: string;
  model: new (...args: any[]) => BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> | BaseLLM<BaseLLMCallOptions>;
  config: Record<string, any>;
  capabilities: {
    vision?: boolean;
    reasoning?: boolean;
    tool_calling?: boolean;
  };
}> = {
  // --- Base Models (OpenAI) ---
  'gpt4.1': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: { apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL },
    capabilities: { vision: true, reasoning: true, tool_calling: true },
  },
  // --- Custom Models (OpenAI Compatible via Neko/O3) ---
  'gpt-4o-all': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: { apiKey: process.env.NEKO_API_KEY, baseURL: process.env.NEKO_BASE_URL },
    capabilities: { vision: true, reasoning: true, tool_calling: true },
  },
  'o4-mini': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: { apiKey: process.env.NEKO_API_KEY, baseURL: process.env.NEKO_BASE_URL },
    capabilities: { reasoning: true },
  },
  'claude-sonnet-4-all': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: { apiKey: process.env.NEKO_API_KEY, baseURL: process.env.NEKO_BASE_URL },
    capabilities: { vision: true, reasoning: true },
  },
  'deepseek-ai/DeepSeek-V3-search': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: { apiKey: process.env.O3_API_KEY, baseURL: process.env.O3_BASE_URL },
    capabilities: { reasoning: true, tool_calling: true },
  },
  'deepseek-ai/DeepSeek-R1-search': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: { apiKey: process.env.O3_API_KEY, baseURL: process.env.O3_BASE_URL },
    capabilities: { reasoning: true, tool_calling: true },
  },
  // --- OpenRouter Models ---
  'rekaai/reka-flash-3:free': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL,
      extraHeaders: {
        "HTTP-Referer": process.env.VERCEL_APP_URL || "https://your-vercel-app-url.com",
        "X-Title": process.env.APP_TITLE || "Your App Title",
      },
    },
    capabilities: { reasoning: true },
  },
  'mistralai/devstral-small:free': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL,
      extraHeaders: {
        "HTTP-Referer": process.env.VERCEL_APP_URL || "https://your-vercel-app-url.com",
        "X-Title": process.env.APP_TITLE || "Your App Title",
      },
    },
    capabilities: { reasoning: true },
  },
  // --- DeepSeek Models ---
  'deepseek-chat': {
    type: 'deepseek',
    model: ChatDeepSeek,
    config: { deepseekApiKey: process.env.DEEPSEEK_API_KEY },
    capabilities: { reasoning: true },
  },
  'deepseek-reasoner': {
    type: 'deepseek',
    model: ChatDeepSeek,
    config: { deepseekApiKey: process.env.DEEPSEEK_API_KEY, model: 'deepseek-reasoner' },
    capabilities: { reasoning: true },
  },
  // --- Aliyun Bailian (Tongyi) Models ---
  'qwen-turbo': {
    type: 'alibaba_tongyi',
    model: ChatAlibabaTongyi,
    config: { apiKey: process.env.DASHSCOPE_API_KEY, model: 'qwen-turbo-latest' },
    capabilities: { reasoning: true, tool_calling: true },
  },
  'qvq-plus': {
    type: 'alibaba_tongyi',
    model: ChatAlibabaTongyi,
    config: { apiKey: process.env.DASHSCOPE_API_KEY, model: 'qvq-plus' },
    capabilities: { reasoning: true },
  },
  // --- Cloudflare Workers AI Models ---
  'cloudflare-llama-3-8b-instruct': {
    type: 'cloudflare',
    model: CloudflareWorkersAI,
    config: {
      cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
      model: '@cf/meta/llama-3-8b-instruct',
      temperature: 0.7,
    },
    capabilities: { reasoning: true },
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
    capabilities: { reasoning: true },
  },
  // --- Tencent Hunyuan Models ---
  'tencent-hunyuan-t1': {
    type: 'tencent_hunyuan',
    model: ChatTencentHunyuan,
    config: {
      secretId: process.env.TENCENT_HUNYUAN_SECRET_ID,
      secretKey: process.env.TENCENT_HUNYUAN_SECRET_KEY,
      model: 'hunyuan-t1-latest',
      temperature: 0.7,
    },
    capabilities: { reasoning: true },
  },
  'tencent-hunyuan-turbo': {
    type: 'tencent_hunyuan',
    model: ChatTencentHunyuan,
    config: {
      secretId: process.env.TENCENT_HUNYUAN_SECRET_ID,
      secretKey: process.env.TENCENT_HUNYUAN_SECRET_KEY,
      model: 'hunyuan-turbos-latest',
      temperature: 0.7,
    },
    capabilities: { reasoning: true },
  },
  // --- Google Gemini Models ---
  'gemini-pro': {
    type: 'google_gemini',
    model: ChatGoogleGenerativeAI,
    config: { apiKey: process.env.GOOGLE_API_KEY, model: 'gemini-2.5-pro-preview-05-06' },
    capabilities: { reasoning: true, tool_calling: true },
  },
  'gemini-pro-vision': {
    type: 'google_gemini',
    model: ChatGoogleGenerativeAI,
    config: { apiKey: process.env.GOOGLE_API_KEY, model: 'gemini-pro-vision' },
    capabilities: { vision: true, reasoning: true },
  },
  'gemini-flash': {
    type: 'google_gemini',
    model: ChatGoogleGenerativeAI,
    config: { apiKey: process.env.GOOGLE_API_KEY, model: 'gemini-2.5-flash-preview-05-20' },
    capabilities: { reasoning: true, tool_calling: true },
  },
};

// Helper function to check if messages contain image content
function containsImage(messages: BaseMessage[]): boolean {
  for (const msg of messages) {
    if (msg._getType() === 'human' && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (typeof part === 'string') {
          continue;
        }
        if (part.type === 'image_url') {
          return true;
        }
      }
    }
  }
  return false;
}

// 创建一个简单的回退模型
function createFallbackModel(): BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> {
  const apiKey = process.env.OPENAI_API_KEY || 
                 process.env.DEEPSEEK_API_KEY || 
                 process.env.GOOGLE_API_KEY;
  
  if (process.env.OPENAI_API_KEY) {
    return new ChatOpenAI({
      temperature: 0.7,
      streaming: true,
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
    });
  } else if (process.env.DEEPSEEK_API_KEY) {
    return new ChatDeepSeek({
      temperature: 0.7,
      streaming: true,
      deepseekApiKey: process.env.DEEPSEEK_API_KEY,
      model: 'deepseek-chat',
    });
  } else if (process.env.GOOGLE_API_KEY) {
    return new ChatGoogleGenerativeAI({
      temperature: 0.7,
      streaming: true,
      apiKey: process.env.GOOGLE_API_KEY,
      model: 'gemini-pro',
    });
  }
  
  throw new Error("No available API keys found for fallback model");
}

// 核心逻辑：自动判断并返回合适的 LLM 实例和 LangChain Chain
async function determineModelAndChain(
  formattedMessages: BaseMessage[],
): Promise<{ llmInstance: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> | BaseLLM<BaseLLMCallOptions>, chain: Runnable<any, string> }> {

  try {
    // 1. 优先判断是否需要视觉模型 (有图像输入)
    const hasImage = containsImage(formattedMessages);
    if (hasImage) {
      const visionModelName = Object.keys(MODEL_PROVIDERS).find(name =>
        MODEL_PROVIDERS[name].capabilities.vision
      );

      if (visionModelName) {
        const providerEntry = MODEL_PROVIDERS[visionModelName];
        // 检查该视觉模型的 API key 是否可用
        const configKeys = Object.keys(providerEntry.config);
        const hasRequiredKey = configKeys.some(key => 
          key.includes('apiKey') || key.includes('Api') ? process.env[providerEntry.config[key]?.replace('process.env.', '')] : true
        );
        
        if (hasRequiredKey) {
          console.log(`[自动判断] 检测到图像输入，选择视觉模型: ${visionModelName}`);
          const llmInstance = new providerEntry.model({
            temperature: 0.7,
            streaming: true,
            ...providerEntry.config,
            model: providerEntry.config.model || visionModelName,
          }) as BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;

          const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
          const chain = prompt.pipe(llmInstance).pipe(new StringOutputParser());
          return { llmInstance, chain };
        }
      }
    }

    // 2. 尝试使用 Agent 处理（如果有合适的模型和工具）
    const agentCapableModelName = Object.keys(MODEL_PROVIDERS).find(name => {
      const provider = MODEL_PROVIDERS[name];
      return provider.capabilities.reasoning && provider.capabilities.tool_calling;
    });

    if (agentCapableModelName && process.env.TAVILY_API_KEY) {
      const providerEntry = MODEL_PROVIDERS[agentCapableModelName];
      
      // 检查该模型的 API key 是否可用
      let hasRequiredKey = false;
      try {
        const agentLLMInstance = new providerEntry.model({
          temperature: 0.7,
          streaming: true,
          ...providerEntry.config,
          model: providerEntry.config.model || agentCapableModelName,
        }) as BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;

        // 创建工具
        const tools: Tool[] = [
          new TavilySearchResults({ maxResults: 5, apiKey: process.env.TAVILY_API_KEY }),
        ];

        // 使用本地定义的 prompt，避免从 Hub 拉取
        const agentPrompt = ChatPromptTemplate.fromMessages([
          ["system", "You are a helpful AI assistant. You have access to tools to help answer questions. Use them when necessary to provide accurate and up-to-date information."],
          new MessagesPlaceholder("chat_history"),
          ["human", "{input}"],
          new MessagesPlaceholder("agent_scratchpad"),
        ]);

        const memory = new BufferMemory({
          memoryKey: "chat_history",
          returnMessages: true,
        });

        const agentExecutor = await initializeAgentExecutorWithOptions(tools, agentLLMInstance, {
          agentType: "openai-functions",
          memory,
          returnIntermediateSteps: true,
          agentArgs: {
            prefix: `Do your best to answer the questions. Feel free to use any tools available to look up relevant information, only if necessary.`,
          },
        });

        const agentChain = RunnableSequence.from([
          {
            input: (i: { messages: BaseMessage[] }) => {
              const lastMessage = i.messages[i.messages.length - 1];
              if (lastMessage._getType() === "human") {
                if (Array.isArray(lastMessage.content)) {
                  const textPart = lastMessage.content.find((part) => part.type === "text") as { text: string };
                  return textPart ? textPart.text : "";
                }
                return lastMessage.content as string;
              }
              return "";
            },
            chat_history: (i: { messages: BaseMessage[] }) => i.messages.slice(0, -1),
          },
          agentExecutor,
          new StringOutputParser(),
        ]);

        console.log(`[自动判断] 将使用 Agent Chain 处理请求，模型: ${agentCapableModelName}`);
        return { llmInstance: agentLLMInstance, chain: agentChain };

      } catch (agentError) {
        console.warn(`[自动判断] Agent 初始化失败: ${agentError.message}，回退到简单模型`);
      }
    }

    // 3. 回退到简单的推理模型
    const reasoningModelName = Object.keys(MODEL_PROVIDERS).find(name =>
      MODEL_PROVIDERS[name].capabilities.reasoning
    );

    if (reasoningModelName) {
      const providerEntry = MODEL_PROVIDERS[reasoningModelName];
      try {
        console.log(`[自动判断] 使用推理模型: ${reasoningModelName}`);
        const llmInstance = new providerEntry.model({
          temperature: 0.7,
          streaming: true,
          ...providerEntry.config,
          model: providerEntry.config.model || reasoningModelName,
        }) as BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;

        const prompt = ChatPromptTemplate.fromMessages([
          ["system", "You are a helpful AI assistant."],
          ...formattedMessages.map(msg => [msg._getType(), msg.content])
        ]);
        const chain = prompt.pipe(llmInstance).pipe(new StringOutputParser());
        return { llmInstance, chain };
      } catch (error) {
        console.warn(`[自动判断] 推理模型 ${reasoningModelName} 初始化失败: ${error.message}`);
      }
    }

    // 4. 最终回退到简单的可用模型
    console.log("[自动判断] 回退到简单可用模型");
    const fallbackModel = createFallbackModel();
    const simplePrompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful AI assistant."],
      ...formattedMessages.map(msg => [msg._getType(), msg.content])
    ]);
    const simpleChain = simplePrompt.pipe(fallbackModel).pipe(new StringOutputParser());
    return { llmInstance: fallbackModel, chain: simpleChain };

  } catch (error: any) {
    console.error("[自动判断] 所有模型初始化都失败，使用最基本的回退:", error);
    
    // 最后的回退策略
    const basicFallback = createFallbackModel();
    const basicPrompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful AI assistant."],
      ["human", "{input}"]
    ]);
    const basicChain = basicPrompt.pipe(basicFallback).pipe(new StringOutputParser());
    return { llmInstance: basicFallback, chain: basicChain };
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('API request received');
    
    const body = await req.json();
    const messages = body.messages ?? [];

    if (!messages.length) {
      console.error('No messages provided');
      return new Response("No messages provided", { status: 400 });
    }

    // 检查至少有一个可用的 API key
    const hasApiKey = process.env.OPENAI_API_KEY || 
                      process.env.DEEPSEEK_API_KEY || 
                      process.env.GOOGLE_API_KEY ||
                      process.env.NEKO_API_KEY ||
                      process.env.O3_API_KEY ||
                      process.env.OPENROUTER_API_KEY ||
                      process.env.DASHSCOPE_API_KEY ||
                      process.env.CLOUDFLARE_API_TOKEN ||
                      process.env.TENCENT_HUNYUAN_SECRET_KEY;
    
    if (!hasApiKey) {
      console.error('No API keys found in environment variables');
      return new Response(
        JSON.stringify({ error: "No API keys configured" }), 
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log('Formatting messages...');
    const formattedMessages = messages.map(formatMessage);

    console.log('Determining model and chain...');
    const { llmInstance, chain } = await determineModelAndChain(formattedMessages);

    if (!llmInstance || !chain) {
      console.error('Failed to create model instance or chain');
      return new Response(
        JSON.stringify({ error: "Failed to initialize AI model" }), 
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 检查是否支持流式输出
    if (typeof (llmInstance as any).stream !== 'function') {
      console.warn("Model does not support streaming, using invoke instead");
      try {
        const result = await chain.invoke({ messages: formattedMessages });
        return new Response(result, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      } catch (invokeError: any) {
        console.error("Invoke failed:", invokeError);
        return new Response(
          JSON.stringify({
            error: `Invoke execution failed: ${invokeError.message}`,
            stack: invokeError.stack,
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    console.log('Starting stream...');
    const stream = await chain.stream({
      messages: formattedMessages,
    });

    return new StreamingTextResponse(stream);

  } catch (error: any) {
    console.error('API Error - Full details:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        stack: error.stack,
        name: error.name
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

