// src/app/api/chat/route.ts

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
import { BaseLLM, BaseLLMCallOptions } from '@langchain/core/language_models/llms'; // 修正 BaseLLM 泛型参数
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
import { TavilySearchResults } from "@langchain/community/tools/tavily_search"; // For "联网"功能
import { AgentExecutor, createReactAgent } from "langchain/agents"; // For Agent功能
import { pull } from "langchain/hub"; // For pulling agent prompts from LangChain Hub
import { AgentStep } from "@langchain/core/agents"; // 导入 AgentStep


// Helper function to format messages from Vercel AI SDK to LangChain format
// 支持多模态内容（特别是图像 URL）
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

// 这个 RunnableLambda 的作用是将 LangChain 消息数组转换为单个字符串
// 主要用于那些不支持消息数组输入的旧版或特定 LLM
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
  // 修正 BaseLLM 类型参数
  model: new (...args: any[]) => BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> | BaseLLM<BaseLLMCallOptions>;
  config: Record<string, any>;
  // 新增 capabilities 字段，用于自动判断模型能力
  capabilities: {
    vision?: boolean; // 是否支持视觉输入 (处理图像)
    reasoning?: boolean; // 是否是“思考模型” (更强的推理能力)
    tool_calling?: boolean; // 是否支持工具调用 (如 OpenAI functions, Gemini tools)
    // 可以添加更多能力，例如: code_generation?: boolean; long_context?: boolean;
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
  'claude-sonnet-4-all': { // 注意：如果实际是 Claude 模型，应使用 @langchain/anthropic
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
  // --- OpenRouter Models (OpenAI Compatible) ---
  // OpenRouter models require setting HTTP-Referer and X-Title headers
  'rekaai/reka-flash-3:free': {
    type: 'openai_compatible',
    model: ChatOpenAI,
    config: {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL,
      extraHeaders: {
        "HTTP-Referer": process.env.VERCEL_APP_URL || "https://your-vercel-app-url.com", // 替换为你的 Vercel 应用 URL
        "X-Title": process.env.APP_TITLE || "Your App Title", // 替换为你的应用标题
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
  'gemini-pro-vision': { // 显式添加一个视觉模型入口
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

// --- 定义可供 Agent 使用的工具 ---
const tools: Tool[] = [
  new TavilySearchResults({ maxResults: 5, apiKey: process.env.TAVILY_API_KEY }), // 联网搜索工具
  // 在这里添加你的其他工具，例如：
  // new Calculator(), // 假设你有一个计算器工具，需要从 @langchain/community/tools/calculator 导入
  // new CustomDatabaseTool(), // 自定义数据库查询工具
];

// Helper function to check if messages contain image content
function containsImage(messages: BaseMessage[]): boolean {
  for (const msg of messages) {
    if (msg._getType() === 'human' && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (typeof part === 'string') {
          continue; // Strings cannot be image URLs
        }
        if (part.type === 'image_url') {
          return true; // Found an image URL
        }
      }
    }
  }
  return false; // No image URLs found
}

// *** 核心逻辑：自动判断并返回合适的 LLM 实例和 LangChain Chain ***
async function determineModelAndChain(
  formattedMessages: BaseMessage[],
  // 修正 BaseLLM 类型参数
): Promise<{ llmInstance: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> | BaseLLM<BaseLLMCallOptions>, chain: Runnable<any, string> }> {

  // 1. 优先判断是否需要视觉模型 (有图像输入)
  const hasImage = containsImage(formattedMessages);
  if (hasImage) {
    // 查找第一个支持视觉的模型
    const visionModelName = Object.keys(MODEL_PROVIDERS).find(name =>
      MODEL_PROVIDERS[name].capabilities.vision
    );

    if (visionModelName) {
      console.log(`[自动判断] 检测到图像输入，选择视觉模型: ${visionModelName}`);
      const providerEntry = MODEL_PROVIDERS[visionModelName];
      const llmInstance = new providerEntry.model({
        temperature: 0.7,
        streaming: true,
        ...providerEntry.config,
        model: providerEntry.config.model || visionModelName,
      }) as BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>; // 视觉模型通常是 ChatModel

      // 对于视觉模型，直接将所有消息（包括图像）传递给模型
      // ChatPromptTemplate.fromMessages 可以处理包含 MessageContent 数组的消息
      const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
      const chain = prompt.pipe(llmInstance).pipe(new StringOutputParser());
      return { llmInstance, chain };
    } else {
      console.warn("[自动判断] 检测到图像输入，但未找到支持视觉功能的模型。将尝试使用Agent处理（Agent可能无法处理图像内容，仅处理文本）。");
      // Fallback: 如果没有视觉模型，继续尝试 Agent 逻辑
    }
  }

  // 2. 如果没有图像，或者没有找到视觉模型，则尝试使用 Agent 处理（思考、联网、工具调用）
  // 寻找一个既有推理能力又支持工具调用的模型作为 Agent 的基底
  const agentCapableModelName = Object.keys(MODEL_PROVIDERS).find(name =>
    MODEL_PROVIDERS[name].capabilities.reasoning && MODEL_PROVIDERS[name].capabilities.tool_calling
  );

  let agentLLMInstance: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>; // Agent 总是需要 ChatModel
  if (agentCapableModelName) {
    console.log(`[自动判断] 选择支持工具调用和推理的 Agent 基模型: ${agentCapableModelName}`);
    const providerEntry = MODEL_PROVIDERS[agentCapableModelName];
    // 确保选中的模型是 ChatModel，因为 Agent 需要它
    if (!("prototype" in providerEntry.model) || !(providerEntry.model.prototype instanceof BaseChatModel)) {
      throw new Error(`模型 ${agentCapableModelName} 不是 ChatModel 类型，无法用作 Agent 的基底。`);
    }
    agentLLMInstance = new providerEntry.model({
      temperature: 0.7,
      streaming: true,
      ...providerEntry.config,
      model: providerEntry.config.model || agentCapableModelName,
    }) as BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;
  } else {
    // 悲观回退：如果连 Agent 的基模型都找不到，则回退到一个普通的思考模型
    const fallbackReasoningModelName = Object.keys(MODEL_PROVIDERS).find(name =>
      MODEL_PROVIDERS[name].capabilities.reasoning
    );
    if (fallbackReasoningModelName) {
      console.warn(`[自动判断] 未找到支持工具调用的模型，回退到普通思考模型: ${fallbackReasoningModelName}`);
      const providerEntry = MODEL_PROVIDERS[fallbackReasoningModelName];
      if (!("prototype" in providerEntry.model) || !(providerEntry.model.prototype instanceof BaseChatModel)) {
        throw new Error(`回退模型 ${fallbackReasoningModelName} 不是 ChatModel 类型。`);
      }
      agentLLMInstance = new providerEntry.model({
        temperature: 0.7,
        streaming: true,
        ...providerEntry.config,
        model: providerEntry.config.model || fallbackReasoningModelName,
      }) as BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;
      // 在这种情况下，Agent 将无法使用工具，只会进行纯文本推理。
    } else {
      throw new Error("无法找到任何支持推理或工具调用的模型。请检查 MODEL_PROVIDERS 配置。");
    }
  }

  // 构建 Agent (使用 ReAct 代理范式)
  // 从 LangChain Hub 拉取 Agent Prompt。'hwchase17/react' 是一个经典的 ReAct 提示模板
  const agentPrompt = await pull<ChatPromptTemplate>("hwchase17/react");
  // 你也可以自定义 prompt，但需要包含 MessagesPlaceholder("agent_scratchpad") 和 MessagesPlaceholder("chat_history")
  // const agentPrompt = ChatPromptTemplate.fromMessages([
  //   ["system", "You are a helpful AI assistant. You have access to the following tools: {tools}"],
  //   new MessagesPlaceholder("chat_history"), // 聊天历史
  //   ["human", "{input}"], // 当前用户输入
  //   new MessagesPlaceholder("agent_scratchpad"), // Agent 的思考过程和工具调用记录
  // ]);


  // createReactAgent 返回一个 Runnable，兼容 AgentExecutor 的 agent 参数
  const agent = createReactAgent({
    llm: agentLLMInstance,
    tools,
    prompt: agentPrompt,
  });

  const agentExecutor = AgentExecutor.fromAgentAndTools({
    agent: agent, // 传入创建好的 Agent Runnable
    tools: tools, // 传入可用的工具列表
    verbose: true, // 开启 Agent 的详细日志，方便调试其思考过程
  });

  // Agent Chain: 适配 LangChain Agent 的输入输出
  const agentChain = RunnableSequence.from([
    {
      // 提取当前用户输入
      input: (i: { messages: BaseMessage[] }) => {
        const lastMessage = i.messages[i.messages.length - 1];
        // Agent 通常期望纯文本输入作为 'input'
        if (lastMessage._getType() === 'human') {
          if (Array.isArray(lastMessage.content)) {
            // 从多模态内容中提取文本部分作为 Agent 的 input
            const textPart = lastMessage.content.find(part => part.type === 'text') as { text: string };
            return textPart ? textPart.text : "";
          }
          return lastMessage.content as string;
        }
        return ""; // Fallback
      },
      // 将历史消息（除了最新一条）作为 chat_history 传递给 Agent
      chat_history: (i: { messages: BaseMessage[] }) => i.messages.slice(0, -1),
      // `tools` 字段在 `AgentExecutor` 中已经定义，这里不需要再显式传递
    },
    agentExecutor, // 执行 Agent
    new StringOutputParser(), // 将 Agent 的最终输出转换为字符串
  ]);

  console.log("[自动判断] 将使用 Agent Chain 处理请求。");
  return { llmInstance: agentLLMInstance, chain: agentChain };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const messages = body.messages ?? [];

  // 1. 格式化 Vercel AI SDK 消息为 LangChain 格式 (支持多模态)
  const formattedMessages = messages.map(formatMessage);

  let chosenLLMInstance: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> | BaseLLM<BaseLLMCallOptions>;
  let finalChain: Runnable<any, string>;

  // 2. 调用自动判断逻辑，获取合适的 LLM 实例和 Chain
  try {
    const { llmInstance, chain } = await determineModelAndChain(formattedMessages);
    chosenLLMInstance = llmInstance;
    finalChain = chain;
  } catch (error: any) {
    console.error("自动模型判断或构建链失败:", error);
    return new Response(JSON.stringify({ error: `自动模型选择或构建链失败: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. 确保获取到的 LLM 实例有效
  // 检查 chosenLLMInstance 是否有 stream 方法 (用于流式响应)
  if (!chosenLLMInstance || typeof (chosenLLMInstance as any).stream !== 'function') {
    // 如果没有 stream 方法，尝试使用 invoke 方法
    if (typeof (chosenLLMInstance as any).invoke === 'function') {
      console.warn("Chosen LLM instance does not support streaming, will use invoke.");
      // 对于不支持流式输出的模型，我们可以先完整运行，然后将结果一次性返回
      // 这是一个简化的处理，实际生产中可能需要更复杂的适配
      try {
        const result = await finalChain.invoke({ messages: formattedMessages });
        return new Response(result, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      } catch (invokeError: any) {
        console.error("Invoke failed:", invokeError);
        return new Response(JSON.stringify({ error: `Invoke 模式执行失败: ${invokeError.message}` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return new Response(JSON.stringify({ error: `无效的 LLM 实例，它既没有 stream 也没有 invoke 方法。` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 4. 定义并执行流式传输过程
  const stream = await finalChain.stream({
    messages: formattedMessages, // 将完整的格式化消息数组传递给链
  });

  // 5. 返回流式响应
  return new StreamingTextResponse(stream);
}

