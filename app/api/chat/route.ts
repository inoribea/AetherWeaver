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
import { Runnable, RunnableLambda, RunnableSequence, RunnableBranch } from '@langchain/core/runnables';
import { StructuredTool } from "@langchain/core/tools";
import { z } from 'zod';

// LangChain Integration Imports
import { ChatOpenAI } from '@langchain/openai';
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi';
import { CloudflareWorkersAI } from '@langchain/cloudflare';
import { ChatTencentHunyuan } from '@langchain/community/chat_models/tencent_hunyuan';

// Model wrapper functions
function createAlibabaTongyiModel(config: {
  temperature?: number;
  streaming?: boolean;
  model?: string;
  apiKey?: string;
}) {
  return new ChatAlibabaTongyi({
    temperature: config.temperature,
    streaming: config.streaming,
    model: config.model,
    alibabaApiKey: config.apiKey
  });
}

function createTencentHunyuanModel(config: {
  temperature?: number;
  streaming?: boolean;
  model?: string;
  secretId?: string;
  secretKey?: string;
}) {
  return new ChatTencentHunyuan({
    temperature: config.temperature,
    streaming: config.streaming,
    model: config.model,
    tencentSecretId: config.secretId, // Corrected: direct tencentSecretId
    tencentSecretKey: config.secretKey // Corrected: direct tencentSecretKey
  });
}
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

// --- Imports for Tools and Agents ---
import { Tool } from "@langchain/core/tools";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { AgentStep } from "@langchain/core/agents";
import { BufferMemory } from "langchain/memory";

//export const runtime = 'edge'; // Keep this commented unless you intend to use edge runtime

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
          // Ensure image_url.url is treated correctly; it might need to be a string
          return { type: 'image_url', image_url: { url: String(part.image_url.url) } };
        }
        // Fallback for unexpected part types
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

// Router Output Schema with enhanced intent classification
const RouterOutputSchema = z.object({
  intent: z.enum([
    "vision_request",
    "web_search_request",
    "complex_reasoning_request",
    "simple_chat_request",
  ]).describe("The user's intent based on the conversation history and current message."),
  query: z.string().nullable().optional().describe("A concise query extracted from the user's message, relevant to the detected intent."),
  requiresChineseOptimization: z.boolean().describe("Whether the request would benefit from Chinese language optimization."),
  complexity: z.enum(["low", "medium", "high"]).describe("The estimated complexity of the request to help with model selection."),
  contextDependency: z.boolean().describe("Whether the request heavily depends on conversation history/context."),
});

// 定义模型配置映射 – note that we now give configuration an extraHeaders property.
const MODEL_PROVIDERS: Record<string, {
  type: string;
  model: new (...args: any[]) => BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> | BaseLLM<BaseLLMCallOptions>;
  config: {
    apiKey?: string;
    baseURL?: string;
    model?: string;
    secretId?: string;
    secretKey?: string;
    temperature?: number;
    extraHeaders?: Record<string, string>;
    configuration?: {
      baseURL?: string;
      apiKey?: string;
      secretId?: string;
      secretKey?: string;
      cloudflareAccountId?: string;
      cloudflareApiToken?: string;
      extraHeaders?: Record<string, string>;
    };
  };
  capabilities: {
    vision?: boolean;
    reasoning?: boolean;
    tool_calling?: boolean;
    search?: boolean;
    chinese?: boolean;
  };
}> = {
  // --- OpenAI Compatible Models (via Neko/O3/OpenRouter) ---
  'gpt-4o-all': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: { apiKey: process.env.NEKO_API_KEY, configuration: { baseURL: process.env.NEKO_BASE_URL }, model: 'gpt-4o-all' },
    capabilities: { vision: true, reasoning: true, tool_calling: true },
  },
  'o4-mini': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: { apiKey: process.env.NEKO_API_KEY, configuration: { baseURL: process.env.NEKO_BASE_URL }, model: 'o4-mini' },
    capabilities: { reasoning: true },
  },
  'claude-sonnet-4-all': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: { apiKey: process.env.NEKO_API_KEY, configuration: { baseURL: process.env.NEKO_BASE_URL }, model: 'claude-sonnet-4-all' },
    capabilities: { vision: true, reasoning: true },
  },
  'Qwen/QwQ-32B-search': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: { apiKey: process.env.O3_API_KEY, configuration: { baseURL: process.env.O3_BASE_URL }, model: 'Qwen/QwQ-32B-search' },
    capabilities: { reasoning: true, tool_calling: true, search: true },
  },
  'deepseek-ai/DeepSeek-R1-search': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: { apiKey: process.env.O3_API_KEY, configuration: { baseURL: process.env.O3_BASE_URL }, model: 'deepseek-ai/DeepSeek-R1-search' },
    capabilities: { reasoning: true, tool_calling: true, search: true },
  },
  'rekaai/reka-flash-3:free': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: {
      apiKey: process.env.OPENROUTER_API_KEY,
      configuration: {
        baseURL: process.env.OPENROUTER_BASE_URL,
        extraHeaders: {
          "HTTP-Referer": process.env.VERCEL_APP_URL || "https://your-vercel-app-url.com",
          "X-Title": process.env.APP_TITLE || "Your App Title"
        }
      },
      model: 'rekaai/reka-flash-3:free'
    },
    capabilities: { reasoning: true, search: true },
  },
  'qwen/qwen3-8b:free': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: {
      apiKey: process.env.OPENROUTER_API_KEY,
      configuration: {
        baseURL: process.env.OPENROUTER_BASE_URL,
        extraHeaders: {
          "HTTP-Referer": process.env.VERCEL_APP_URL || "https://your-vercel-app-url.com",
          "X-Title": process.env.APP_TITLE || "Your App Title"
        }
      },
      model: 'qwen/qwen3-8b:free'
    },
    capabilities: { reasoning: true }
  },
  // --- DeepSeek Models ---
  'deepseek-chat': {
    type: 'deepseek',
    model: ChatDeepSeek,
    config: { configuration: { apiKey: process.env.DEEPSEEK_API_KEY }, model: 'deepseek-chat' },
    capabilities: { reasoning: true, chinese: true }
  },
  'deepseek-reasoner': {
    type: 'deepseek',
    model: ChatDeepSeek,
    config: { configuration: { apiKey: process.env.DEEPSEEK_API_KEY }, model: 'deepseek-reasoner' },
    capabilities: { reasoning: true, chinese: true }
  },
  // --- Aliyun Bailian (Tongyi) Models ---
  'qwen-turbo': {
    type: 'alibaba_tongyi',
    model: ChatAlibabaTongyi,
    config: { apiKey: process.env.DASHSCOPE_API_KEY, model: 'qwen-turbo-latest' },
    capabilities: { reasoning: true, tool_calling: true, chinese: true }
  },
  'qvq-plus': {
    type: 'alibaba_tongyi',
    model: ChatAlibabaTongyi,
    config: { apiKey: process.env.DASHSCOPE_API_KEY, model: 'qvq-plus' },
    capabilities: { vision: true, chinese: true }
  },
  // --- Tencent Hunyuan Models ---
  'hunyuan-t1': {
    type: 'tencent_hunyuan',
    model: ChatTencentHunyuan,
    config: {
      secretId: process.env.TENCENT_HUNYUAN_SECRET_ID,
      secretKey: process.env.TENCENT_HUNYUAN_SECRET_KEY,
      model: 'hunyuan-t1-latest',
      temperature: 0.7
    },
    capabilities: { reasoning: true, chinese: true }
  },
  'hunyuan-turbos': {
    type: 'tencent_hunyuan',
    model: ChatTencentHunyuan,
    config: {
      secretId: process.env.TENCENT_HUNYUAN_SECRET_ID,
      secretKey: process.env.TENCENT_HUNYUAN_SECRET_KEY,
      model: 'hunyuan-turbos-latest',
      temperature: 0.7
    },
    capabilities: { reasoning: true, chinese: true }
  },
  // --- Google Gemini Models ---
  'gemini-flash-lite': {
    type: 'google_gemini',
    model: ChatGoogleGenerativeAI,
    config: { apiKey: process.env.GOOGLE_API_KEY, model: 'models/gemini-2.5-flash-lite-preview-06-17' },
    capabilities: { reasoning: true, tool_calling: true }
  },
  'gemini-flash': {
    type: 'google_gemini',
    model: ChatGoogleGenerativeAI,
    config: { apiKey: process.env.GOOGLE_API_KEY, model: 'gemini-2.5-flash-preview-05-20' },
    capabilities: { reasoning: true, tool_calling: true, search: true }
  }
};

// 辅助函数：检查消息是否包含图片内容
function containsImage(messages: BaseMessage[]): boolean {
  for (const msg of messages) {
    if (msg._getType() === 'human' && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (typeof part === 'object' && part !== null && part.type === 'image_url') {
          return true;
        }
      }
    }
  }
  return false;
}

// 辅助函数：检查文本是否主要为中文
function isChinese(text: string): boolean {
  const chineseChars = (text.match(/[\u4E00-\u9FFF]/g) || []).length; // Corrected regex for Chinese characters
  const totalChars = text.length;
  return totalChars > 0 && (chineseChars / totalChars) > 0.5;
}

// 辅助函数：获取模型实例
function getModel(modelName: string): { llmInstance: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>, modelName: string } {
  const providerEntry = MODEL_PROVIDERS[modelName];
  if (!providerEntry) {
    console.warn(`Model configuration for ${modelName} not found. Attempting fallback.`);
    return createFallbackModel();
  }

  // Simplified API key check – only checking for properties we expect.
  let isApiKeyAvailable = false;
  if (providerEntry.config.apiKey) {
    isApiKeyAvailable = true;
  } else if (providerEntry.config.secretId && providerEntry.config.secretKey) {
    isApiKeyAvailable = true;
  } else if (providerEntry.type === 'google_gemini' && providerEntry.config.apiKey) {
    isApiKeyAvailable = true;
  }
  if (!isApiKeyAvailable) {
    console.warn(`API key for model ${modelName} is missing. Attempting fallback.`);
    return createFallbackModel();
  }

  try {
    console.log(`Initializing model: ${modelName}`);
    let modelInstance: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;
    if (providerEntry.type === 'openai_compatible') {
      modelInstance = new ChatOpenAI({
        temperature: 0.7,
        streaming: true,
        apiKey: providerEntry.config.apiKey!,
        configuration: providerEntry.config.configuration,
        model: providerEntry.config.model || modelName,
      }) as BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;
    } else if (providerEntry.type === 'deepseek') {
      modelInstance = new ChatDeepSeek({
        temperature: 0.7,
        streaming: true,
        apiKey: providerEntry.config.apiKey!, 
        model: providerEntry.config.model || modelName,
      }) as BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;
    } else if (providerEntry.type === 'alibaba_tongyi') {
      modelInstance = createAlibabaTongyiModel({
        temperature: 0.7,
        streaming: true,
        model: providerEntry.config.model || modelName,
        apiKey: providerEntry.config.apiKey // Use apiKey for alibabaApiKey
      });
    } else if (providerEntry.type === 'tencent_hunyuan') {
      modelInstance = createTencentHunyuanModel({
        temperature: 0.7,
        streaming: true,
        model: providerEntry.config.model || modelName,
        secretId: providerEntry.config.secretId,
        secretKey: providerEntry.config.secretKey
      });
    } else if (providerEntry.type === 'google_gemini') {
      modelInstance = new ChatGoogleGenerativeAI({
        temperature: 0.7,
        streaming: true,
        apiKey: providerEntry.config.apiKey!,
        model: providerEntry.config.model || modelName,
      }) as BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;
    } else {
      throw new Error(`Unsupported model type: ${providerEntry.type}`);
    }
    return { llmInstance: modelInstance, modelName: modelName };
  } catch (error) {
    console.error(`Failed to initialize model ${modelName}:`, error);
    return createFallbackModel();
  }
}

// 创建一个通用的回退模型
function createFallbackModel(): { llmInstance: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>, modelName: string } {
  let fallbackModel: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;
  let fallbackModelName: string;
  if (process.env.NEKO_API_KEY || process.env.OPENAI_API_KEY) {
    console.log("使用 OpenAI 兼容模型作为回退模型");
    fallbackModelName = process.env.NEKO_BASE_URL ? 'gpt-4o-all' : 'gpt-4o-mini';
    fallbackModel = new ChatOpenAI({
      temperature: 0.7,
      streaming: true,
      apiKey: process.env.NEKO_API_KEY || process.env.OPENAI_API_KEY,
      configuration: { baseURL: process.env.NEKO_BASE_URL || process.env.OPENAI_BASE_URL },
      model: fallbackModelName,
    });
  } else if (process.env.DEEPSEEK_API_KEY) {
    console.log("使用 DeepSeek 作为回退模型");
    fallbackModelName = 'deepseek-chat';
    fallbackModel = new ChatDeepSeek({
      temperature: 0.7,
      streaming: true,
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: fallbackModelName,
    });
  } else if (process.env.GOOGLE_API_KEY) {
    console.log("使用 Google Gemini 作为回退模型");
    fallbackModelName = 'gemini-pro';
    fallbackModel = new ChatGoogleGenerativeAI({
      temperature: 0.7,
      streaming: true,
      apiKey: process.env.GOOGLE_API_KEY,
      model: fallbackModelName,
    });
  } else if (process.env.DASHSCOPE_API_KEY) {
    console.log("使用 Aliyun Tongyi 作为回退模型");
    fallbackModelName = 'qwen-turbo-latest';
    fallbackModel = createAlibabaTongyiModel({
      temperature: 0.7,
      streaming: true,
      model: fallbackModelName,
      apiKey: process.env.DASHSCOPE_API_KEY // Use apiKey for alibabaApiKey
    });
  } else if (process.env.TENCENT_HUNYUAN_SECRET_ID && process.env.TENCENT_HUNYUAN_SECRET_KEY) {
    console.log("使用 Tencent Hunyuan 作为回退模型");
    fallbackModelName = 'hunyuan-turbos-latest';
    fallbackModel = createTencentHunyuanModel({
      temperature: 0.7,
      streaming: true,
      model: fallbackModelName,
      secretId: process.env.TENCENT_HUNYUAN_SECRET_ID,
      secretKey: process.env.TENCENT_HUNYUAN_SECRET_KEY
    });
  } else {
    throw new Error("未找到可用的 API 密钥，无法创建回退模型。请配置 OPENAI_API_KEY, DEEPSEEK_API_KEY, GOOGLE_API_KEY, DASHSCOPE_API_KEY 或 TENCENT_HUNYUAN_SECRET_KEY。");
  }
  return { llmInstance: fallbackModel, modelName: fallbackModelName };
}

// --- Router Chain ---
const ROUTER_MODEL_NAME = 'Qwen/QwQ-32B-search';
const ROUTER_FALLBACK_MODEL_NAME = 'qwen/qwen3-8b:free';
const { llmInstance: routerModel, modelName: actualRouterModelName } = getModel(ROUTER_MODEL_NAME);
const { llmInstance: routerFallbackModel } = getModel(ROUTER_FALLBACK_MODEL_NAME);

const routerPrompt = ChatPromptTemplate.fromMessages([
  ["system", "You are an intelligent routing assistant. Analyze user messages and conversation history to:\n\n" +
             "1. Classify the user's intent as one of:\n" +
             "- `vision_request`: Requests involving image analysis or visual content\n" +
             "- `web_search_request`: Requests needing recent information, factual queries, real-time data, or web search\n" +
             "- `complex_reasoning_request`: Multi-step reasoning, logic analysis, code generation, or complex problem-solving\n" +
             "- `simple_chat_request`: Simple conversations, greetings, or general queries not requiring specific tools\n\n" +
             "2. For each request, determine:\n" +
             "- Chinese Optimization: Whether the request would benefit from Chinese language optimization\n" +
             "- Complexity Level: low/medium/high based on reasoning steps and context needed\n" +
             "- Context Dependency: Whether the request heavily relies on conversation history\n\n" +
             "3. Extract a concise query when applicable.\n\n" +
             "Guidelines:\n" +
             "- For vision_request: Set complexity based on the type of visual analysis needed\n" +
             "- For web_search_request: Always include a clear, searchable query\n" +
             "- For complex_reasoning_request: Assess steps needed and context requirements\n" +
             "- For simple_chat_request: Focus on language optimization and context dependency\n"
  ],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
]);

const routerChain = RunnableSequence.from([
  {
    input: (input: { messages: BaseMessage[] }) => {
      const lastMessage = input.messages[input.messages.length - 1];
      if (lastMessage._getType() === "human") {
        if (Array.isArray(lastMessage.content)) {
          const textPart = lastMessage.content.find((part) => typeof part === 'object' && part !== null && part.type === 'text') as { text: string };
          return textPart ? textPart.text : "";
        }
        return lastMessage.content as string;
      }
      return "";
    },
    chat_history: (input: { messages: BaseMessage[] }) => input.messages.slice(0, -1),
  },
  routerPrompt,
  routerModel.withStructuredOutput(RouterOutputSchema, {
    name: "RouterOutput", // Optional: provide a name for better context
  }).withFallbacks({ fallbacks: [routerFallbackModel] }),
]);

// --- Responder Chains ---

// Vision Responder
const visionResponderChain = RunnableLambda.from(async (input: { messages: BaseMessage[] }) => {
  const models = [
    'gpt-4o-all',
    'qvq-plus',
    'claude-sonnet-4-all',
  ];
  let selectedModel: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> | null = null;
  let selectedModelName: string | null = null;
  for (const modelName of models) {
    try {
      const { llmInstance, modelName: actualName } = getModel(modelName);
      selectedModel = llmInstance;
      selectedModelName = actualName;
      console.log(`Vision Responder: Using model ${selectedModelName}`);
      break;
    } catch (e) {
      console.warn(`Vision Responder: Model ${modelName} unavailable or API key missing. Trying next.`, e);
    }
  }
  if (!selectedModel) {
    console.error("Vision Responder: No vision models available. Falling back to general chat.");
    const fallback = getModel('gemini-flash-lite');
    selectedModel = fallback.llmInstance;
    selectedModelName = fallback.modelName;
  }
  const prompt = ChatPromptTemplate.fromMessages(input.messages);
  const chain = prompt.pipe(selectedModel).pipe(new StringOutputParser());
  return { chain, llmInstance: selectedModel };
});

// Web Search / Agent Responder
const webSearchResponderChain = RunnableLambda.from(async (input: { messages: BaseMessage[], query?: string | null }) => {
  const models = [
    'gemini-flash',
    'deepseek-ai/DeepSeek-R1-search',
    'gpt-4o-all',
    'Qwen/QwQ-32B-search',
    'rekaai/reka-flash-3:free',
  ];
  let selectedModel: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> | null = null;
  let selectedModelName: string | null = null;
  for (const modelName of models) {
    try {
      const { llmInstance, modelName: actualName } = getModel(modelName);
      selectedModel = llmInstance;
      selectedModelName = actualName;
      console.log(`Web Search Responder: Using model ${selectedModelName}`);
      break;
    } catch (e) {
      console.warn(`Web Search Responder: Model ${modelName} unavailable or API key missing. Trying next.`, e);
    }
  }
  if (!selectedModel) {
    console.error("Web Search Responder: No search models available. Falling back to general chat.");
    const fallback = getModel('gemini-flash-lite');
    selectedModel = fallback.llmInstance;
    selectedModelName = fallback.modelName;
  }
  // 只允许 openai_compatible 类型模型走 agent
  if (
    selectedModelName &&
    MODEL_PROVIDERS[selectedModelName]?.type === 'openai_compatible' &&
    (MODEL_PROVIDERS[selectedModelName]?.capabilities.search || MODEL_PROVIDERS[selectedModelName]?.capabilities.tool_calling) &&
    process.env.TAVILY_API_KEY
  ) {
    console.log(`Web Search Responder: Initializing agent with ${selectedModelName}`);
    const tools: Tool[] = [
      new TavilySearchResults({ maxResults: 5, apiKey: process.env.TAVILY_API_KEY }),
    ];
    const agentPrompt = ChatPromptTemplate.fromMessages([
      ["system", "你是一个有用的AI助手。你可以使用工具来帮助回答问题。在必要时使用它们来提供准确和最新的信息。"],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);
    const memory = new BufferMemory({
      memoryKey: "chat_history",
      returnMessages: true,
    });
    const agentExecutor = await initializeAgentExecutorWithOptions(tools, selectedModel, {
      agentType: "openai-functions",
      memory,
      returnIntermediateSteps: true,
      agentArgs: {
        prefix: `尽力回答问题。如果需要，可以随意使用任何可用的工具来查找相关信息。`,
      },
    });
    const chain = RunnableSequence.from([
      {
        input: (i: { messages: BaseMessage[], query?: string }) =>
          i.query || (i.messages[i.messages.length - 1] as HumanMessage).content,
        chat_history: (i: { messages: BaseMessage[] }) => i.messages.slice(0, -1),
      },
      agentExecutor,
      new StringOutputParser(),
    ]);
    return { chain, llmInstance: selectedModel };
  } else {
    console.log(`Web Search Responder: Using simple chat for ${selectedModelName} (not openai_compatible or no agent/search capability or missing TAVILY_API_KEY).`);
    const prompt = ChatPromptTemplate.fromMessages(input.messages);
    const chain = prompt.pipe(selectedModel).pipe(new StringOutputParser());
    return { chain, llmInstance: selectedModel };
  }
});

// Complex Reasoning Responder
const complexReasoningResponderChain = RunnableLambda.from(async (input: { messages: BaseMessage[], query?: string | null }) => {
  const models = [
    'gemini-flash',
    'deepseek-reasoner',
    'hunyuan-t1',
    'o4-mini',
    'claude-sonnet-4-all',
  ];
  const lastMessageText = (input.messages[input.messages.length - 1] as HumanMessage).content;
  const isChineseRequest = typeof lastMessageText === 'string' && isChinese(lastMessageText);
  let selectedModel: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> | null = null;
  let selectedModelName: string | null = null;
  for (const modelName of models) {
    const providerEntry = MODEL_PROVIDERS[modelName];
    if (providerEntry) {
      if (isChineseRequest && providerEntry.capabilities.chinese) {
        try {
          const { llmInstance, modelName: actualName } = getModel(modelName);
          selectedModel = llmInstance;
          selectedModelName = actualName;
          console.log(`Complex Reasoning Responder: Using Chinese-preferred model ${selectedModelName}`);
          break;
        } catch (e) {
          console.warn(`Complex Reasoning Responder: Chinese model ${modelName} unavailable. Trying next.`, e);
        }
      } else if (!isChineseRequest && !providerEntry.capabilities.chinese) {
        try {
          const { llmInstance, modelName: actualName } = getModel(modelName);
          selectedModel = llmInstance;
          selectedModelName = actualName;
          console.log(`Complex Reasoning Responder: Using model ${selectedModelName}`);
          break;
        } catch (e) {
          console.warn(`Complex Reasoning Responder: Model ${modelName} unavailable. Trying next.`, e);
        }
      }
    }
  }
  if (!selectedModel) {
    console.error("Complex Reasoning Responder: No suitable reasoning models available. Falling back to general chat.");
    const fallback = getModel('gemini-flash-lite');
    selectedModel = fallback.llmInstance;
    selectedModelName = fallback.modelName;
  }
  const prompt = ChatPromptTemplate.fromMessages(input.messages);
  const chain = prompt.pipe(selectedModel).pipe(new StringOutputParser());
  return { chain, llmInstance: selectedModel };
});

// General Chat Responder
const generalChatResponderChain = RunnableLambda.from(async (input: { messages: BaseMessage[] }) => {
  const defaultModels = [
    'gemini-flash-lite',
    'gpt4.1',
    'hunyuan-turbos',
    'deepseek-chat',
    'qwen-turbo',
  ];
  const chineseModels = [
    'hunyuan-turbos',
    'deepseek-chat',
    'gemini-flash-lite',
    'gpt4.1',
    'qwen-turbo',
  ];
  const lastMessageText = (input.messages[input.messages.length - 1] as HumanMessage).content;
  const isChineseRequest = typeof lastMessageText === 'string' && isChinese(lastMessageText);
  const modelsToTry = isChineseRequest ? chineseModels : defaultModels;
  let selectedModel: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> | null = null;
  let selectedModelName: string | null = null;
  for (const modelName of modelsToTry) {
    try {
      const { llmInstance, modelName: actualName } = getModel(modelName);
      selectedModel = llmInstance;
      selectedModelName = actualName;
      console.log(`General Chat Responder: Using model ${selectedModelName} (Chinese preference: ${isChineseRequest})`);
      break;
    } catch (e) {
      console.warn(`General Chat Responder: Model ${modelName} unavailable. Trying next.`, e);
    }
  }
  if (!selectedModel) {
    console.error("General Chat Responder: No general chat models available. Falling back to a generic model.");
    const fallback = createFallbackModel();
    selectedModel = fallback.llmInstance;
    selectedModelName = fallback.modelName;
  }
  const prompt = ChatPromptTemplate.fromMessages(input.messages);
  const chain = prompt.pipe(selectedModel).pipe(new StringOutputParser());
  return { chain, llmInstance: selectedModel };
});

export async function POST(req: NextRequest) {
  try {
    console.log('API request received');
    const body = await req.json();
    const messages = body.messages ?? [];
    if (!messages.length) {
      console.error('No messages provided');
      return new Response("No messages provided", { status: 400 });
    }
    console.log('Formatting messages...');
    const formattedMessages = messages.map(formatMessage);
    let finalChain: Runnable<any, string>;
    let llmInstance: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> | BaseLLM<BaseLLMCallOptions>;
    let selectedModelName: string | undefined;
    const hasImage = containsImage(formattedMessages);
    if (hasImage) {
      console.log("[Main Router] Image input detected, routing to Vision Responder.");
      const result = await visionResponderChain.invoke({ messages: formattedMessages });
      finalChain = result.chain;
      llmInstance = result.llmInstance;
      // 获取模型名
      selectedModelName = (llmInstance as any)?.model || (llmInstance as any)?.modelName || (llmInstance as any)?.constructor?.name || "UnknownModel";
    } else {
      console.log("[Main Router] No image input, routing through Router Chain.");
      const routerOutput = await routerChain.invoke({ messages: formattedMessages }) as z.infer<typeof RouterOutputSchema>;
      const intent = routerOutput.intent;
      const query = routerOutput.query || "";
      console.log(`[Main Router] Detected intent: ${intent}, Query: ${query}`);

      const branch = RunnableBranch.from([
        [
          (output: z.infer<typeof RouterOutputSchema>) => output.intent === "web_search_request",
          RunnableLambda.from(async (output: z.infer<typeof RouterOutputSchema>) => {
            const result = await webSearchResponderChain.invoke({ messages: formattedMessages, query: output.query ?? undefined });
            return { chain: result.chain, llmInstance: result.llmInstance };
          }),
        ],
        [
          (output: z.infer<typeof RouterOutputSchema>) => output.intent === "complex_reasoning_request",
          RunnableLambda.from(async (output: z.infer<typeof RouterOutputSchema>) => {
            const result = await complexReasoningResponderChain.invoke({ messages: formattedMessages, query: output.query ?? undefined });
            return { chain: result.chain, llmInstance: result.llmInstance };
          }),
        ],
        [
          (output: z.infer<typeof RouterOutputSchema>) => output.intent === "simple_chat_request",
          RunnableLambda.from(async () => {
            const result = await generalChatResponderChain.invoke({ messages: formattedMessages });
            return { chain: result.chain, llmInstance: result.llmInstance };
          }),
        ],
        // Default case if no intent matches (should not happen with enum, but good for robustness)
        RunnableLambda.from(async () => {
          console.warn("[Main Router] No specific intent matched, falling back to general chat.");
          const result = await generalChatResponderChain.invoke({ messages: formattedMessages });
          return { chain: result.chain, llmInstance: result.llmInstance };
        }),
      ]);

      const branchResult = await branch.invoke(routerOutput);
      finalChain = branchResult.chain;
      llmInstance = branchResult.llmInstance;
      // 获取模型名
      selectedModelName = (llmInstance as any)?.model || (llmInstance as any)?.modelName || (llmInstance as any)?.constructor?.name || "UnknownModel";
    }
    if (!llmInstance || !finalChain) {
      console.error('Failed to create model instance or chain after routing');
      return new Response(
        JSON.stringify({ error: "Failed to initialize AI model after routing" }), 
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    // 统一输出模型名
    const modelNameForOutput = selectedModelName || (llmInstance as any)?.model || (llmInstance as any)?.modelName || (llmInstance as any)?.constructor?.name || "UnknownModel";
    console.log('Starting stream...');
    try {
      const stream = await finalChain.stream({ messages: formattedMessages });
      // 包装 stream，在开头插入模型名
      const encoder = new TextEncoder();
      const transformedStream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(`${modelNameForOutput}:\n`));
          for await (const chunk of stream) {
            controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
          }
          controller.close();
        }
      });
      return new StreamingTextResponse(transformedStream);
    } catch (streamError: any) {
      console.error("Streaming failed, attempting to invoke:", streamError);
      try {
        const result = await finalChain.invoke({ messages: formattedMessages });
        return new Response(`${modelNameForOutput}:\n${result}`, { status: 200, headers: { 'Content-Type': 'text/plain' } });
      } catch (invokeError: any) {
        console.error("Invoke also failed:", invokeError);
        return new Response(
          JSON.stringify({
            error: `AI processing failed. Streaming error: ${streamError.message}, Invoke error: ${invokeError.message}`,
            details: {
              streamError: streamError.message,
              invokeError: invokeError.message,
              invokeStack: invokeError.stack,
            }
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  } catch (error: any) {
    console.error('API Error - Request processing failed:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error during request processing',
        message: error.message,
        stack: error.stack,
        name: error.name
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}