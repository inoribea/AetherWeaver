import { NextRequest } from 'next/server';
import { Message as VercelChatMessage, StreamingTextResponse } from 'ai';
import { z } from 'zod';
import { selectBestModelForAuto, OpenAICompletionRequest, smartFormatModelInjection } from '@/utils/openai-compat';
import { routeToModel, OpenAIMessage, RoutingRequest, routeRequest } from '@/utils/unified-router';

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
import { Runnable, RunnableLambda, RunnableSequence, RunnableBranch, RouterRunnable } from '@langchain/core/runnables';

// Model imports
import { ChatOpenAI } from '@langchain/openai';
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatTencentHunyuan } from '@langchain/community/chat_models/tencent_hunyuan';

// Tools and Agents imports
import { Tool } from "@langchain/core/tools";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { BufferMemory } from "langchain/memory";

// Retrieval imports
import { Document } from "@langchain/core/documents";
import { PromptTemplate } from '@langchain/core/prompts';

// Helper function to format messages
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
          return { type: 'image_url', image_url: { url: String(part.image_url.url) } };
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

// Helper function to safely extract text content from messages
function extractTextContent(content: MessageContent | string): string {
  if (typeof content === 'string') {
    return content;
  }
  
  if (Array.isArray(content)) {
    const textPart = content.find((part: any) => part.type === 'text');
    return (textPart as any)?.text || '';
  }
  
  return '';
}

// 用户意图分析 Schema
const UserIntentSchema = z.object({
  intent: z.enum([
    "vision_request",
    "web_search_request",
    "complex_reasoning_request",
    "simple_chat_request",
    "document_retrieval_request",
    "agent_task_request",
    "structured_output_request",
    "model_switch_request",
  ]).describe("The user's intent based on the conversation history and current message."),
  query: z.string().nullable().optional().describe("A concise query extracted from the user's message."),
  requiresChineseOptimization: z.boolean().optional().describe("Whether the request would benefit from Chinese language optimization."),
  complexity: z.enum(["low", "medium", "high"]).optional().describe("The estimated complexity of the request."),
  contextDependency: z.boolean().optional().describe("Whether the request heavily depends on conversation history."),
  tools: z.array(z.string()).optional().describe("List of tools that might be needed for this request."),
  structuredOutput: z.boolean().optional().describe("Whether the response should be structured."),
  suggestedModel: z.string().optional().describe("Suggested model for better handling this request."),
  switchReason: z.string().optional().describe("Reason for suggesting model switch."),
});

// Structured Output Schema
const StructuredResponseSchema = z.object({
  tone: z.enum(["positive", "negative", "neutral"]).describe("The overall tone of the input"),
  entity: z.string().describe("The main entity mentioned in the input"),
  word_count: z.number().describe("The number of words in the input"),
  chat_response: z.string().describe("A response to the human's input"),
  final_punctuation: z.string().describe("The final punctuation mark in the input, or empty string if none."),
  confidence: z.number().min(0).max(1).describe("Confidence score for the analysis"),
}).describe("Structured response format for detailed analysis");

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

// LangChain Model Providers Configuration
const LANGCHAIN_MODEL_PROVIDERS: Record<string, {
  type: string;
  model: new (...args: any[]) => BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;
  config: {
    apiKey?: string;
    baseURL?: string;
    model?: string;
    temperature?: number;
    configuration?: any;
  };
  capabilities: {
    vision?: boolean;
    reasoning?: boolean;
    tool_calling?: boolean;
    search?: boolean;
    chinese?: boolean;
    structured_output?: boolean;
    agents?: boolean;
    code_generation?: boolean;
    creative_writing?: boolean;
    mathematical_computation?: boolean;
    web_search?: boolean;
  };
}> = {
  // OpenAI Compatible Models
  'gpt-4o-all': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: { 
      apiKey: process.env.NEKO_API_KEY, 
      configuration: { baseURL: process.env.NEKO_BASE_URL }, 
      model: 'gpt-4o-all',
      temperature: 0.7
    },
    capabilities: {
      vision: true,
      reasoning: true,
      tool_calling: true,
      structured_output: true,
      agents: true,
      code_generation: true,
      creative_writing: true,
      mathematical_computation: true,
      web_search: true
    },
  },
  'claude-sonnet-4-all': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: { 
      apiKey: process.env.NEKO_API_KEY, 
      configuration: { baseURL: process.env.NEKO_BASE_URL }, 
      model: 'claude-sonnet-4-all',
      temperature: 0.7
    },
    capabilities: {
      vision: true,
      reasoning: true,
      structured_output: true,
      agents: true,
      code_generation: true,
      creative_writing: true,
      mathematical_computation: true
    },
  },
  'o4-mini': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: { 
      apiKey: process.env.NEKO_API_KEY, 
      configuration: { baseURL: process.env.NEKO_BASE_URL }, 
      model: 'o4-mini',
      temperature: 0.7
    },
    capabilities: {
      reasoning: true,
      structured_output: true,
      agents: true,
      code_generation: true,
      mathematical_computation: true
    },
  },
  // DeepSeek Models
  'deepseek-chat': {
    type: 'deepseek',
    model: ChatDeepSeek,
    config: { 
      apiKey: process.env.DEEPSEEK_API_KEY, 
      model: 'deepseek-chat',
      temperature: 0.7
    },
    capabilities: { 
      reasoning: true, 
      chinese: true,
      structured_output: true
    }
  },
  'deepseek-reasoner': {
    type: 'deepseek',
    model: ChatDeepSeek,
    config: { 
      apiKey: process.env.DEEPSEEK_API_KEY, 
      model: 'deepseek-reasoner',
      temperature: 0.7
    },
    capabilities: {
      reasoning: true,
      chinese: true,
      structured_output: true,
      code_generation: true,
      mathematical_computation: true
    }
  },
  // Aliyun Models
  'qwen-turbo': {
    type: 'alibaba_tongyi',
    model: ChatAlibabaTongyi,
    config: { 
      apiKey: process.env.DASHSCOPE_API_KEY, 
      model: 'qwen-turbo-latest',
      temperature: 0.7
    },
    capabilities: {
      reasoning: true,
      tool_calling: true,
      chinese: true,
      structured_output: true,
      code_generation: true,
      creative_writing: true,
      mathematical_computation: true
    }
  },
  'qvq-plus': {
    type: 'alibaba_tongyi',
    model: ChatAlibabaTongyi,
    config: { 
      apiKey: process.env.DASHSCOPE_API_KEY, 
      model: 'qvq-plus',
      temperature: 0.7
    },
    capabilities: {
      vision: true,
      chinese: true,
      reasoning: true,
      code_generation: true,
      mathematical_computation: true
    }
  },
  // Google Gemini Models
  'gemini-flash-lite': {
    type: 'google_gemini',
    model: ChatGoogleGenerativeAI,
    config: { 
      apiKey: process.env.GOOGLE_API_KEY, 
      model: 'models/gemini-2.5-flash-lite-preview-06-17',
      temperature: 0.7
    },
    capabilities: {
      reasoning: true,
      tool_calling: true,
      structured_output: true,
      code_generation: true,
      creative_writing: true,
      mathematical_computation: true
    }
  },
  'gemini-flash': {
    type: 'google_gemini',
    model: ChatGoogleGenerativeAI,
    config: { 
      apiKey: process.env.GOOGLE_API_KEY, 
      model: 'gemini-2.5-flash-preview-05-20',
      temperature: 0.7
    },
    capabilities: {
      reasoning: true,
      tool_calling: true,
      search: true,
      structured_output: true,
      agents: true,
      code_generation: true,
      creative_writing: true,
      mathematical_computation: true,
      web_search: true
    }
  },
  // Neko Provider Models (gpt4.1) - 与官方GPT-4功能一致，web search首选
  'gpt4.1': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: {
      apiKey: process.env.NEKO_API_KEY,
      configuration: { baseURL: process.env.NEKO_BASE_URL },
      model: 'gpt4.1',
      temperature: 0.7
    },
    capabilities: {
      vision: true,
      reasoning: true,
      tool_calling: true,
      structured_output: true,
      agents: true,
      code_generation: true,
      creative_writing: true,
      mathematical_computation: true,
      search: true,
      web_search: true,
      chinese: false
    },
  },
  // O3 Provider Models
  'Qwen/Qwen3-235B-A22B-search': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: {
      apiKey: process.env.O3_API_KEY,
      configuration: { baseURL: process.env.O3_BASE_URL },
      model: 'Qwen/Qwen3-235B-A22B-search',
      temperature: 0.7
    },
    capabilities: {
      reasoning: true,
      tool_calling: true,
      structured_output: true,
      agents: true,
      chinese: true,
      search: true,
      code_generation: true
    },
  },
  'deepseek-ai/DeepSeek-V3-search': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: {
      apiKey: process.env.O3_API_KEY,
      configuration: { baseURL: process.env.O3_BASE_URL },
      model: 'deepseek-ai/DeepSeek-V3-search',
      temperature: 0.7
    },
    capabilities: {
      reasoning: true,
      tool_calling: true,
      structured_output: true,
      agents: true,
      chinese: true,
      search: true,
      code_generation: true
    },
  },
  // Tencent Hunyuan Models
  'hunyuan-turbos-latest': {
    type: 'tencent_hunyuan',
    model: ChatTencentHunyuan,
    config: {
      apiKey: process.env.TENCENT_HUNYUAN_SECRET_ID,
      configuration: {
        tencentSecretId: process.env.TENCENT_HUNYUAN_SECRET_ID,
        tencentSecretKey: process.env.TENCENT_HUNYUAN_SECRET_KEY
      },
      model: 'hunyuan-turbos-latest',
      temperature: 0.7
    },
    capabilities: {
      reasoning: true,
      tool_calling: true,
      chinese: true,
      structured_output: true,
      agents: true
    }
  },
  'hunyuan-t1-latest': {
    type: 'tencent_hunyuan',
    model: ChatTencentHunyuan,
    config: {
      apiKey: process.env.TENCENT_HUNYUAN_SECRET_ID,
      configuration: {
        tencentSecretId: process.env.TENCENT_HUNYUAN_SECRET_ID,
        tencentSecretKey: process.env.TENCENT_HUNYUAN_SECRET_KEY
      },
      model: 'hunyuan-t1-latest',
      temperature: 0.7
    },
    capabilities: {
      reasoning: true,
      tool_calling: true,
      chinese: true,
      structured_output: true,
      agents: true,
      code_generation: true,
      creative_writing: true,
      mathematical_computation: true
    }
  }
};

// Helper function to get model instance with token counting
function getModel(modelName: string): { llmInstance: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>, modelName: string } {
  const providerEntry = LANGCHAIN_MODEL_PROVIDERS[modelName];
  if (!providerEntry) {
    console.warn(`Model configuration for ${modelName} not found. Using fallback.`);
    return createFallbackModel();
  }

  try {
    let modelInstance: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;
    
    // Token counting callbacks
    const tokenCountingCallbacks = [
      {
        handleLLMStart: async (llm: any, prompts: string[]) => {
          console.log(`[${new Date().toISOString()}] 🚀 Model Started: ${modelName}`);
          console.log(`[${new Date().toISOString()}] 📝 Prompts: ${prompts.length} prompt(s)`);
        },
        handleLLMEnd: async (output: any) => {
          if (output.llmOutput?.tokenUsage) {
            const usage = output.llmOutput.tokenUsage;
            console.log(`[${new Date().toISOString()}] 📊 Token Usage for ${modelName}:`);
            console.log(`  - Prompt Tokens: ${usage.promptTokens || 0}`);
            console.log(`  - Completion Tokens: ${usage.completionTokens || 0}`);
            console.log(`  - Total Tokens: ${usage.totalTokens || 0}`);
          }
        },
        handleLLMError: async (error: any) => {
          console.error(`[${new Date().toISOString()}] ❌ Model Error for ${modelName}:`, error);
        },
      },
    ];
    
    if (providerEntry.type === 'openai_compatible') {
      modelInstance = new ChatOpenAI({
        temperature: providerEntry.config.temperature || 0.7,
        streaming: true,
        apiKey: providerEntry.config.apiKey!,
        configuration: providerEntry.config.configuration,
        model: providerEntry.config.model || modelName,
        callbacks: tokenCountingCallbacks,
      });
    } else if (providerEntry.type === 'deepseek') {
      modelInstance = new ChatDeepSeek({
        temperature: providerEntry.config.temperature || 0.7,
        streaming: true,
        apiKey: providerEntry.config.apiKey!,
        model: providerEntry.config.model || modelName,
        callbacks: tokenCountingCallbacks,
      });
    } else if (providerEntry.type === 'alibaba_tongyi') {
      modelInstance = new ChatAlibabaTongyi({
        temperature: providerEntry.config.temperature || 0.7,
        streaming: true,
        model: providerEntry.config.model || modelName,
        alibabaApiKey: providerEntry.config.apiKey,
        callbacks: tokenCountingCallbacks,
      });
    } else if (providerEntry.type === 'google_gemini') {
      modelInstance = new ChatGoogleGenerativeAI({
        temperature: providerEntry.config.temperature || 0.7,
        streaming: true,
        apiKey: providerEntry.config.apiKey!,
        model: providerEntry.config.model || modelName,
        callbacks: tokenCountingCallbacks,
      });
    } else if (providerEntry.type === 'tencent_hunyuan') {
      modelInstance = new ChatTencentHunyuan({
        temperature: providerEntry.config.temperature || 0.7,
        streaming: true,
        tencentSecretId: providerEntry.config.configuration?.tencentSecretId || process.env.TENCENT_HUNYUAN_SECRET_ID!,
        tencentSecretKey: providerEntry.config.configuration?.tencentSecretKey || process.env.TENCENT_HUNYUAN_SECRET_KEY!,
        model: providerEntry.config.model || modelName,
        callbacks: tokenCountingCallbacks,
      });
    } else if (providerEntry.type === 'o3_provider') {
      // O3 provider uses OpenAI compatible interface
      modelInstance = new ChatOpenAI({
        temperature: providerEntry.config.temperature || 0.7,
        streaming: true,
        apiKey: providerEntry.config.apiKey!,
        configuration: providerEntry.config.configuration,
        model: providerEntry.config.model || modelName,
        callbacks: tokenCountingCallbacks,
      });
    } else {
      throw new Error(`Unsupported model type: ${providerEntry.type}`);
    }

    return { llmInstance: modelInstance, modelName: modelName };
  } catch (error) {
    console.error(`Failed to initialize model ${modelName}:`, error);
    return createFallbackModel();
  }
}

// Create fallback model
function createFallbackModel(): { llmInstance: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>, modelName: string } {
  let fallbackModel: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;
  let fallbackModelName: string;
  
  // 优先使用 gemini-flash-lite 作为回退模型（速度最快）
  if (process.env.GOOGLE_API_KEY) {
    console.log("使用 Google Gemini Flash Lite 作为回退模型（速度优先）");
    fallbackModelName = 'gemini-flash-lite';
    fallbackModel = new ChatGoogleGenerativeAI({
      temperature: 0.7,
      streaming: true,
      apiKey: process.env.GOOGLE_API_KEY,
      model: 'models/gemini-2.5-flash-lite-preview-06-17',
    });
  } else if (process.env.DEEPSEEK_API_KEY) {
    console.log("使用 DeepSeek 作为回退模型");
    fallbackModelName = 'deepseek-chat';
    fallbackModel = new ChatDeepSeek({
      temperature: 0.7,
      streaming: true,
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: 'deepseek-chat',
    });
  } else if (process.env.OPENAI_API_KEY) {
    console.log("使用 OpenAI 作为回退模型");
    fallbackModelName = 'gpt-4o-mini';
    fallbackModel = new ChatOpenAI({
      temperature: 0.7,
      streaming: true,
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
    });
  } else {
    throw new Error("未找到可用的 API 密钥，请在 .env.local 文件中配置 GOOGLE_API_KEY、OPENAI_API_KEY 或 DEEPSEEK_API_KEY");
  }
  
  return { llmInstance: fallbackModel, modelName: fallbackModelName };
}

// 基于LangChain官方RouterRunnable的智能路由系统
const RouteSchema = z.object({
  destination: z.enum([
    "vision_processing",
    "complex_reasoning",
    "creative_writing",
    "code_generation",
    "mathematical_computation",
    "web_search",
    "document_retrieval",
    "structured_analysis",
    "agent_execution",
    "chinese_conversation",
    "simple_chat"
  ]).describe("The destination chain for handling this request"),
  selectedModel: z.string().describe("The best model for this task"),
  confidence: z.number().min(0).max(1).describe("Confidence score for routing decision"),
  reasoning: z.string().describe("Detailed reasoning for the routing decision")
});

// 创建路由提示模板 - 基于项目实际模型能力
const ROUTER_TEMPLATE = `You are an intelligent routing system for a LangChain application.
Analyze the user's request and route it to the most appropriate destination with the best model.

Available Models and Their Capabilities:
- gemini-flash-lite: **FASTEST MODEL** - Ultra-fast response, reasoning, tool calling, structured output, code generation, creative writing (速度优先首选)
- gpt4.1: Vision processing, tool calling, complex reasoning, structured output, agents, web search
- gpt-4o-all: Vision processing, tool calling, complex reasoning, structured output, agents, web search
- claude-sonnet-4-all: Vision processing, long-form analysis, creative writing, complex reasoning, structured output, agents
- o4-mini: Fast reasoning, simple tasks, structured output, agents
- deepseek-chat: Chinese conversation, programming, fast response, structured output
- deepseek-reasoner: Mathematical reasoning, logical analysis, code explanation, structured output
- qwen-turbo: Chinese optimization, fast response, tool calling, structured output
- qvq-plus: Vision processing, Chinese language
- gemini-flash: Reasoning, tool calling, web search, structured output, agents
- hunyuan-turbos-latest: Chinese conversation, fast response, tool calling, structured output, agents
- hunyuan-t1-latest: Advanced reasoning, Chinese conversation, complex tasks, structured output, agents
- Qwen/Qwen3-235B-A22B-search: Chinese conversation, web search, code generation, structured output
- deepseek-ai/DeepSeek-V3-search: Chinese conversation, web search, code generation, mathematical computation

Available Destinations:
- vision_processing: For image analysis and visual content (models: gpt-4o-all, qvq-plus, claude-sonnet-4-all, gemini-flash-lite)
- complex_reasoning: For logical reasoning and problem-solving (models: gemini-flash-lite, deepseek-reasoner, claude-sonnet-4-all, hunyuan-t1-latest)
- creative_writing: For creative tasks and storytelling (models: gemini-flash-lite, claude-sonnet-4-all, hunyuan-t1-latest, gpt-4o-all)
- code_generation: For programming and technical tasks (models: gemini-flash-lite, deepseek-chat, gpt4.1, claude-sonnet-4-all)
- mathematical_computation: For math and calculations (models: gemini-flash-lite, deepseek-reasoner, hunyuan-t1-latest, gpt-4o-all)
- web_search: For current information retrieval (models: gemini-flash-lite, gpt4.1, Qwen/Qwen3-235B-A22B-search, deepseek-ai/DeepSeek-V3-search)
- document_retrieval: For RAG and knowledge base queries (models: gemini-flash-lite, gemini-flash, claude-sonnet-4-all)
- structured_analysis: For data extraction and formatting (models: gemini-flash-lite, hunyuan-turbos-latest, gpt-4o-all, qwen-turbo)
- agent_execution: For complex multi-step tasks (models: gemini-flash-lite, hunyuan-t1-latest, gpt-4o-all, claude-sonnet-4-all)
- chinese_conversation: For Chinese language tasks (models: gemini-flash-lite, hunyuan-turbos-latest, hunyuan-t1-latest, qwen-turbo)
- simple_chat: For general conversation (models: gemini-flash-lite, hunyuan-turbos-latest, o4-mini, deepseek-chat)

**PRIORITY: Always prefer gemini-flash-lite for fastest response unless specific capabilities are absolutely required.**

User Request: {input}

Analyze the request and provide routing decision with model selection.`;

// 创建智能路由器
async function createIntelligentRouter(): Promise<Runnable> {
  const routerModel = getModel('gemini-flash-lite').llmInstance;
  
  const routerPrompt = ChatPromptTemplate.fromTemplate(ROUTER_TEMPLATE);
  const routerChain = routerPrompt
    .pipe(routerModel.withStructuredOutput(RouteSchema))
    .pipe(RunnableLambda.from((output: z.infer<typeof RouteSchema>) => {
      console.log(`[Router] Destination: ${output.destination}, Model: ${output.selectedModel}`);
      console.log(`[Router] Confidence: ${output.confidence}, Reasoning: ${output.reasoning}`);
      return output;
    }));

  return routerChain;
}

// 模型能力匹配函数
function getModelByCapability(capability: string, fallback: string = 'gemini-flash-lite'): string {
  const capabilityMap: Record<string, string[]> = {
    'vision_processing': ['gpt-4o-all', 'qvq-plus', 'claude-sonnet-4-all', 'gemini-flash-lite'],
    'complex_reasoning': ['gemini-flash-lite', 'deepseek-reasoner', 'claude-sonnet-4-all', 'hunyuan-t1-latest'],
    'creative_writing': ['gemini-flash-lite', 'claude-sonnet-4-all', 'hunyuan-t1-latest', 'gpt-4o-all'],
    'code_generation': ['gemini-flash-lite', 'deepseek-chat', 'gpt4.1', 'claude-sonnet-4-all'],
    'mathematical_computation': ['gemini-flash-lite', 'deepseek-reasoner', 'hunyuan-t1-latest', 'gpt-4o-all'],
    'web_search': ['gpt4.1', 'gemini-flash-lite', 'Qwen/Qwen3-235B-A22B-search', 'deepseek-ai/DeepSeek-V3-search'],
    'document_retrieval': ['gemini-flash-lite', 'gemini-flash', 'claude-sonnet-4-all'],
    'structured_analysis': ['gemini-flash-lite', 'hunyuan-turbos-latest', 'gpt-4o-all', 'qwen-turbo'],
    'agent_execution': ['gemini-flash-lite', 'hunyuan-t1-latest', 'gpt-4o-all', 'claude-sonnet-4-all'],
    'chinese_conversation': ['gemini-flash-lite', 'hunyuan-turbos-latest', 'hunyuan-t1-latest', 'qwen-turbo'],
    'simple_chat': ['gemini-flash-lite', 'hunyuan-turbos-latest', 'o4-mini', 'deepseek-chat']
  };

  const models = capabilityMap[capability] || [fallback];
  
  // 返回第一个可用的模型
  for (const model of models) {
    if (LANGCHAIN_MODEL_PROVIDERS[model]) {
      return model;
    }
  }
  
  return fallback;
}

// 智能模型切换分析器 - 基于RouterRunnable
async function analyzeModelSwitchNeed(
  messages: BaseMessage[],
  currentModel: string
): Promise<{ shouldSwitch: boolean; suggestedModel?: string; reason?: string }> {
  try {
    const router = await createIntelligentRouter();
    const lastMessage = messages[messages.length - 1];
    const messageText = extractTextContent(lastMessage.content);

    // 使用路由器分析请求
    const routingResult = await router.invoke({ input: messageText });
    
    // 获取建议的模型
    const suggestedModel = routingResult.selectedModel ||
                          getModelByCapability(routingResult.destination);
    
    // 检查是否需要切换
    const shouldSwitch = suggestedModel !== currentModel.replace(' (auto-selected)', '').replace(' (智能切换)', '');
    
    return {
      shouldSwitch,
      suggestedModel: shouldSwitch ? suggestedModel : undefined,
      reason: shouldSwitch ? `路由建议切换到更适合的模型: ${routingResult.reasoning}` : undefined
    };

  } catch (error) {
    console.error('智能路由分析失败:', error);
    return { shouldSwitch: false };
  }
}

// 创建专门的处理链
function createVisionChain(messages: BaseMessage[]): { chain: Runnable<any, string>, modelName: string } {
  const modelName = getModelByCapability('vision_processing');
  const { llmInstance } = getModel(modelName);
  const prompt = ChatPromptTemplate.fromMessages(messages);
  return {
    chain: prompt.pipe(llmInstance).pipe(new StringOutputParser()),
    modelName
  };
}

function createReasoningChain(messages: BaseMessage[]): { chain: Runnable<any, string>, modelName: string } {
  const modelName = getModelByCapability('complex_reasoning');
  const { llmInstance } = getModel(modelName);
  const prompt = ChatPromptTemplate.fromMessages(messages);
  return {
    chain: prompt.pipe(llmInstance).pipe(new StringOutputParser()),
    modelName
  };
}

function createSearchChain(messages: BaseMessage[], messageText: string): { chain: Runnable<any, string>, modelName: string } {
  const modelName = getModelByCapability('web_search');
  const { llmInstance } = getModel(modelName);
  
  // 创建Tavily搜索工具
  const searchTool = new TavilySearchResults({
    maxResults: 5,
    apiKey: process.env.TAVILY_API_KEY,
  });
  
  // 增强的搜索链，集成Tavily实时搜索
  const searchPrompt = ChatPromptTemplate.fromMessages([
    ["system", `You are a helpful AI assistant with access to real-time web search through Tavily.
    When users ask about recent events, current information, or need real-time data,
    use the search results to provide accurate and up-to-date responses.
    
    Always cite your sources when using search results.`],
    ["human", "Search Query: {query}\n\nSearch Results: {searchResults}\n\nUser Question: {question}"],
  ]);
  
  return {
    chain: RunnableSequence.from([
      {
        query: () => messageText,
        question: () => messageText,
        searchResults: RunnableLambda.from(async () => {
          try {
            if (process.env.TAVILY_API_KEY) {
              const searchResults = await searchTool.invoke(messageText);
              return Array.isArray(searchResults)
                ? searchResults.map((result: any) =>
                    `**${result.title}**\n${result.content}\nSource: ${result.url}`
                  ).join('\n\n')
                : 'No search results found.';
            } else {
              return 'Search functionality is not available. Please configure TAVILY_API_KEY.';
            }
          } catch (error) {
            console.error('Tavily search error:', error);
            return 'Search temporarily unavailable. Please try again later.';
          }
        }),
      },
      searchPrompt,
      llmInstance,
      new StringOutputParser(),
    ]),
    modelName
  };
}

function createStructuredChain(messageText: string): { chain: Runnable<any, string>, modelName: string } {
  const modelName = getModelByCapability('structured_analysis');
  const { llmInstance } = getModel(modelName);
  
  const TEMPLATE = `Extract the requested fields from the input and provide a structured response.
        
Input: {input}`;
  
  const prompt = PromptTemplate.fromTemplate(TEMPLATE);
  const functionCallingModel = llmInstance.withStructuredOutput(StructuredResponseSchema);
  
  return {
    chain: RunnableSequence.from([
      { input: () => messageText },
      prompt,
      functionCallingModel,
      RunnableLambda.from((output: z.infer<typeof StructuredResponseSchema>) => {
        return `**Structured Analysis:**

**Tone:** ${output.tone}
**Main Entity:** ${output.entity}
**Word Count:** ${output.word_count}
**Final Punctuation:** ${output.final_punctuation || "None"}
**Confidence:** ${Math.round(output.confidence * 100)}%

**Response:** ${output.chat_response}`;
      }),
    ]),
    modelName
  };
}

function createRetrievalChain(messageText: string): { chain: Runnable<any, string>, modelName: string } {
  const modelName = getModelByCapability('document_retrieval');
  const { llmInstance } = getModel(modelName);
  
  const documents = [
    new Document({
      pageContent: "LangChain is a framework for developing applications powered by language models. It provides tools for prompt management, chains, and agents.",
      metadata: { source: "langchain_docs" }
    }),
    new Document({
      pageContent: "Vector databases store high-dimensional vectors and enable similarity search. They are essential for RAG applications.",
      metadata: { source: "vector_db_guide" }
    }),
    new Document({
      pageContent: "Retrieval-Augmented Generation (RAG) combines retrieval systems with generative models for better responses.",
      metadata: { source: "rag_guide" }
    }),
  ];
  
  const relevantDocs = documents.filter(doc =>
    doc.pageContent.toLowerCase().includes(messageText.toLowerCase()) ||
    messageText.toLowerCase().includes('langchain') ||
    messageText.toLowerCase().includes('rag') ||
    messageText.toLowerCase().includes('vector')
  );
  
  const context = relevantDocs.length > 0
    ? relevantDocs.map(doc => doc.pageContent).join('\n\n')
    : "No relevant documents found in the knowledge base.";
  
  const retrievalPrompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful AI assistant. Use the following context to answer the user's question."],
    ["human", "Context: {context}\n\nQuestion: {question}"],
  ]);
  
  return {
    chain: RunnableSequence.from([
      {
        context: () => context,
        question: () => messageText,
      },
      retrievalPrompt,
      llmInstance,
      new StringOutputParser(),
    ]),
    modelName
  };
}

function createSimpleChatChain(messages: BaseMessage[]): { chain: Runnable<any, string>, modelName: string } {
  const modelName = getModelByCapability('simple_chat');
  const { llmInstance } = getModel(modelName);
  const prompt = ChatPromptTemplate.fromMessages(messages);
  return {
    chain: prompt.pipe(llmInstance).pipe(new StringOutputParser()),
    modelName
  };
}

function createAgentChain(messages: BaseMessage[], messageText: string): { chain: Runnable<any, string>, modelName: string } {
  const modelName = getModelByCapability('agent_execution');
  const { llmInstance } = getModel(modelName);
  
  const agentPrompt = ChatPromptTemplate.fromMessages([
    ["system", `You are a helpful AI assistant that can break down complex tasks into steps.
    Analyze the user's request and provide a structured approach to solving it.`],
    ["human", "Task: {task}\n\nPlease provide a step-by-step approach to accomplish this task."],
  ]);
  
  return {
    chain: RunnableSequence.from([
      {
        task: () => messageText,
      },
      agentPrompt,
      llmInstance,
      new StringOutputParser(),
    ]),
    modelName
  };
}

// 创建智能路由分支
async function createIntelligentRoutingChain(messages: BaseMessage[]): Promise<Runnable> {
  const router = await createIntelligentRouter();
  const lastMessage = messages[messages.length - 1];
  const messageText = extractTextContent(lastMessage.content);
  
  // 创建路由分支
  const routingBranch = RunnableBranch.from([
    [
      // 视觉处理分支
      (input: any) => input.destination === "vision_processing",
      RunnableLambda.from(() => {
        const { chain } = createVisionChain(messages);
        return chain;
      })
    ],
    [
      // 复杂推理分支
      (input: any) => input.destination === "complex_reasoning",
      RunnableLambda.from(() => {
        const { chain } = createReasoningChain(messages);
        return chain;
      })
    ],
    [
      // 网络搜索分支
      (input: any) => input.destination === "web_search",
      RunnableLambda.from(() => {
        const { chain } = createSearchChain(messages, messageText);
        return chain;
      })
    ],
    [
      // 结构化分析分支
      (input: any) => input.destination === "structured_analysis",
      RunnableLambda.from(() => {
        const { chain } = createStructuredChain(messageText);
        return chain;
      })
    ],
    [
      // 文档检索分支
      (input: any) => input.destination === "document_retrieval",
      RunnableLambda.from(() => {
        const { chain } = createRetrievalChain(messageText);
        return chain;
      })
    ],
    [
      // 代理执行分支
      (input: any) => input.destination === "agent_execution",
      RunnableLambda.from(() => {
        const { chain } = createAgentChain(messages, messageText);
        return chain;
      })
    ],
    // 默认分支 - 简单聊天
    RunnableLambda.from(() => {
      const { chain } = createSimpleChatChain(messages);
      return chain;
    })
  ]);
  
  // 组合路由器和分支
  return RunnableSequence.from([
    {
      input: () => messageText,
    },
    router,
    routingBranch,
  ]);
}

// 基于LangChain官方RouterRunnable的智能路由系统
export async function POST(req: NextRequest) {
  try {
    console.log('[Intelligent Router] Request received');
    const body = await req.json();
    const messages = body.messages ?? [];
    
    if (!messages.length) {
      return new Response("No messages provided", { status: 400 });
    }

    const formattedMessages = messages.map(formatMessage);
    const requestedModel = body.model;
    
    // 提取消息文本
    const lastMessage = formattedMessages[formattedMessages.length - 1];
    const messageText = extractTextContent(lastMessage.content);
    
    // 检查是否有图像
    const hasImage = formattedMessages.some((msg: BaseMessage) =>
      msg._getType() === 'human' && Array.isArray(msg.content) &&
      msg.content.some((part: any) => part.type === 'image_url')
    );

    let selectedChain: Runnable<any, string>;
    let modelNameForOutput: string;
    let featureType = 'chat';

    // 处理明确指定的模型
    if (requestedModel && requestedModel !== 'auto' && LANGCHAIN_MODEL_PROVIDERS[requestedModel]) {
      console.log(`[Specific Model] Using requested model: ${requestedModel}`);
      const { llmInstance } = getModel(requestedModel);
      const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
      selectedChain = prompt.pipe(llmInstance).pipe(new StringOutputParser());
      modelNameForOutput = requestedModel;
    } else {
      // 使用新的统一路由器进行决策
      console.log('[Unified Router] Using smart routing');
      
      // 转换消息格式为统一路由器格式
      const routingMessages: OpenAIMessage[] = formattedMessages.map((msg: BaseMessage) => ({
        role: msg._getType() === 'human' ? 'user' as const :
              msg._getType() === 'ai' ? 'assistant' as const : 'system' as const,
        content: extractTextContent(msg.content)
      }));
      
      const routingRequest: RoutingRequest = {
        messages: routingMessages
      };
      
      const routingResult = await routeRequest(routingRequest);
      
      console.log(`[Router] Model: ${routingResult.selectedModel}`);
      console.log(`[Router] Confidence: ${routingResult.confidence}, Reasoning: ${routingResult.reasoning}`);
      
      // 直接使用路由结果创建处理链
      const { llmInstance } = getModel(routingResult.selectedModel);
      modelNameForOutput = routingResult.selectedModel;
      featureType = 'chat'; // 简化为通用聊天
      
      // 检测特殊处理需求
      if (hasImage) {
        // 视觉处理
        const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
        selectedChain = prompt.pipe(llmInstance).pipe(new StringOutputParser());
        featureType = 'vision';
        
      } else if (messageText.toLowerCase().includes('json') || messageText.toLowerCase().includes('structure')) {
        // 结构化输出
        const result = createStructuredChain(messageText);
        selectedChain = result.chain;
        featureType = 'structured';
        
      } else if (messageText.toLowerCase().includes('search') || messageText.toLowerCase().includes('latest')) {
        // 搜索
        const result = createSearchChain(formattedMessages, messageText);
        selectedChain = result.chain;
        featureType = 'search';
        
      } else if (messageText.toLowerCase().includes('document') || messageText.toLowerCase().includes('rag')) {
        // 文档检索
        const result = createRetrievalChain(messageText);
        selectedChain = result.chain;
        featureType = 'retrieval';
        
      } else {
        // 通用处理链
        const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
        selectedChain = prompt.pipe(llmInstance).pipe(new StringOutputParser());
      }
    }

    // 执行链并流式返回响应
    const stream = await selectedChain.stream({ messages: formattedMessages });
    
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          let isFirstChunk = true;
          let accumulatedContent = '';
          
          for await (const chunk of stream) {
            const text = typeof chunk === 'string' ? chunk : String(chunk);
            
            if (isFirstChunk && text.trim()) {
              // 使用智能格式化注入模型信息
              const formattedText = smartFormatModelInjection(text, modelNameForOutput);
              controller.enqueue(new TextEncoder().encode(formattedText));
              isFirstChunk = false;
            } else {
              controller.enqueue(new TextEncoder().encode(text));
            }
            
            accumulatedContent += text;
          }
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new StreamingTextResponse(readableStream, {
      headers: {
        'X-Model-Used': modelNameForOutput,
        'X-Model-Provider': 'LangChain',
        'X-Feature': featureType,
        'X-Routing-Confidence': '0.95',
      },
    });

  } catch (error) {
    console.error('Enhanced Chat API error:', error);
    
    // Fallback error handling
    try {
      const fallback = createFallbackModel();
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", "You are a helpful AI assistant."],
        ["human", "I apologize, but I encountered an error. How can I help you?"],
      ]);
      
      const chain = prompt.pipe(fallback.llmInstance).pipe(new StringOutputParser());
      const stream = await chain.stream({});
      
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const text = typeof chunk === 'string' ? chunk : String(chunk);
              controller.enqueue(new TextEncoder().encode(text));
            }
            controller.close();
          } catch (streamError) {
            console.error('Fallback streaming error:', streamError);
            controller.error(streamError);
          }
        },
      });

      return new StreamingTextResponse(readableStream, {
        headers: {
          'X-Model-Used': fallback.modelName,
          'X-Error-Fallback': 'true',
        },
      });
    } catch (fallbackError) {
      console.error('Fallback error:', fallbackError);
      return new Response(
        JSON.stringify({ 
          error: 'Internal server error', 
          message: 'All models are currently unavailable' 
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  }
}
