import { NextRequest } from 'next/server';
import { Message as VercelChatMessage, StreamingTextResponse } from 'ai';
import { z } from 'zod';
import { selectBestModelForAuto, OpenAICompletionRequest, smartFormatModelInjection } from '@/utils/openai-compat';
import { intelligentRouter, RoutingDecision } from '@/utils/intelligent-router';

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

// Enhanced Router Output Schema with Model Switching Support
const RouterOutputSchema = z.object({
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

// Model Providers Configuration
const MODEL_PROVIDERS: Record<string, {
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
      agents: true
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
      agents: true
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
      agents: true
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
      structured_output: true
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
      structured_output: true
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
      chinese: true 
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
      structured_output: true
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
      agents: true
    }
  }
};

// Helper function to get model instance with token counting
function getModel(modelName: string): { llmInstance: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>, modelName: string } {
  const providerEntry = MODEL_PROVIDERS[modelName];
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
  
  if (process.env.GOOGLE_API_KEY) {
    console.log("使用 Google Gemini 作为回退模型");
    fallbackModelName = 'gemini-flash-lite';
    fallbackModel = new ChatGoogleGenerativeAI({
      temperature: 0.7,
      streaming: true,
      apiKey: process.env.GOOGLE_API_KEY,
      model: 'models/gemini-2.5-flash-lite-preview-06-17',
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
  } else if (process.env.DEEPSEEK_API_KEY) {
    console.log("使用 DeepSeek 作为回退模型");
    fallbackModelName = 'deepseek-chat';
    fallbackModel = new ChatDeepSeek({
      temperature: 0.7,
      streaming: true,
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: 'deepseek-chat',
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
- gpt-4o-all: Vision processing, tool calling, complex reasoning, structured output, agents
- claude-sonnet-4-all: Vision processing, long-form analysis, creative writing, complex reasoning, structured output, agents
- o4-mini: Fast reasoning, simple tasks, structured output, agents
- deepseek-chat: Chinese conversation, programming, fast response, structured output
- deepseek-reasoner: Mathematical reasoning, logical analysis, code explanation, structured output
- qwen-turbo: Chinese optimization, fast response, tool calling, structured output
- qvq-plus: Vision processing, Chinese language
- gemini-flash-lite: Reasoning, tool calling, structured output
- gemini-flash: Reasoning, tool calling, web search, structured output, agents

Available Destinations:
- vision_processing: For image analysis and visual content (models: gpt-4o-all, claude-sonnet-4-all, qvq-plus)
- complex_reasoning: For logical reasoning and problem-solving (models: deepseek-reasoner, claude-sonnet-4-all, gpt-4o-all)
- creative_writing: For creative tasks and storytelling (models: claude-sonnet-4-all, gpt-4o-all)
- code_generation: For programming and technical tasks (models: deepseek-chat, gpt-4o-all, claude-sonnet-4-all)
- mathematical_computation: For math and calculations (models: deepseek-reasoner, gpt-4o-all)
- web_search: For current information retrieval (models: gemini-flash, gpt-4o-all)
- document_retrieval: For RAG and knowledge base queries (models: gemini-flash, claude-sonnet-4-all)
- structured_analysis: For data extraction and formatting (models: gpt-4o-all, gemini-flash-lite, qwen-turbo)
- agent_execution: For complex multi-step tasks (models: gpt-4o-all, claude-sonnet-4-all, gemini-flash)
- chinese_conversation: For Chinese language tasks (models: qwen-turbo, deepseek-chat, qvq-plus)
- simple_chat: For general conversation (models: o4-mini, deepseek-chat, qwen-turbo)

User Request: {input}

Analyze the request and provide routing decision with model selection.`;

// 创建智能路由器
async function createIntelligentRouter(): Promise<Runnable> {
  const routerModel = getModel('gpt-4o-all').llmInstance;
  
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
    'vision_processing': ['gpt-4o-all', 'claude-sonnet-4-all', 'qvq-plus'],
    'complex_reasoning': ['deepseek-reasoner', 'claude-sonnet-4-all', 'gpt-4o-all'],
    'creative_writing': ['claude-sonnet-4-all', 'gpt-4o-all'],
    'code_generation': ['deepseek-chat', 'gpt-4o-all', 'claude-sonnet-4-all'],
    'mathematical_computation': ['deepseek-reasoner', 'gpt-4o-all'],
    'web_search': ['gemini-flash', 'gpt-4o-all'],
    'document_retrieval': ['gemini-flash', 'claude-sonnet-4-all'],
    'structured_analysis': ['gpt-4o-all', 'gemini-flash-lite', 'qwen-turbo'],
    'agent_execution': ['gpt-4o-all', 'claude-sonnet-4-all', 'gemini-flash'],
    'chinese_conversation': ['qwen-turbo', 'deepseek-chat', 'qvq-plus'],
    'simple_chat': ['o4-mini', 'deepseek-chat', 'qwen-turbo']
  };

  const models = capabilityMap[capability] || [fallback];
  
  // 返回第一个可用的模型
  for (const model of models) {
    if (MODEL_PROVIDERS[model]) {
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
  
  // 简化的搜索链，使用增强的系统提示来模拟搜索能力
  const searchPrompt = ChatPromptTemplate.fromMessages([
    ["system", `You are a helpful AI assistant with access to current information.
    When users ask about recent events, current information, or need real-time data,
    provide the most accurate and up-to-date responses possible based on your knowledge.
    
    If you don't have current information, clearly state that and suggest how the user
    might find the most recent information.`],
    ...messages,
  ]);
  
  return {
    chain: searchPrompt.pipe(llmInstance).pipe(new StringOutputParser()),
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
    if (requestedModel && requestedModel !== 'auto' && MODEL_PROVIDERS[requestedModel]) {
      console.log(`[Specific Model] Using requested model: ${requestedModel}`);
      const { llmInstance } = getModel(requestedModel);
      const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
      selectedChain = prompt.pipe(llmInstance).pipe(new StringOutputParser());
      modelNameForOutput = requestedModel;
    } else {
      // 使用新的智能路由器进行决策 - 无需提示词消耗
      console.log('[Intelligent Router] Using smart routing (no prompt required)');
      const routingResult = intelligentRouter.route(messageText, hasImage, formattedMessages);
      
      console.log(`[Router] Destination: ${routingResult.destination}, Model: ${routingResult.selectedModel}`);
      console.log(`[Router] Confidence: ${routingResult.confidence}, Reasoning: ${routingResult.reasoning}`);
      
      // 直接使用路由结果创建处理链
      const { llmInstance } = getModel(routingResult.selectedModel);
      modelNameForOutput = routingResult.selectedModel;
      featureType = routingResult.destination.replace('_', '');
      
      // 根据目标类型创建相应的处理链
      if (routingResult.destination === 'vision_processing') {
        const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
        selectedChain = prompt.pipe(llmInstance).pipe(new StringOutputParser());
        
      } else if (routingResult.destination === 'structured_analysis') {
        const result = createStructuredChain(messageText);
        selectedChain = result.chain;
        
      } else if (routingResult.destination === 'document_retrieval') {
        const result = createRetrievalChain(messageText);
        selectedChain = result.chain;
        
      } else if (routingResult.destination === 'web_search') {
        const result = createSearchChain(formattedMessages, messageText);
        selectedChain = result.chain;
        
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
