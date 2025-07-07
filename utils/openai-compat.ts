import { Message as VercelChatMessage } from 'ai';

// OpenAI API 请求格式
export interface OpenAICompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: OpenAITool[];
  tool_choice?: string | object;
  user?: string;
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | OpenAIMessageContent[];
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export interface OpenAIMessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: object;
  };
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// OpenAI API 响应格式
export interface OpenAICompletionResponse {
  id: string;
  object: 'chat.completion' | 'chat.completion.chunk';
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIChoice {
  index: number;
  message?: OpenAIMessage;
  delta?: Partial<OpenAIMessage>;
  finish_reason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

// 真实模型友好名映射（仅保留 models-config.json 中实际存在的模型）
export const MODEL_DISPLAY_NAME: Record<string, string> = {
  'gpt-4o-all': 'GPT-4o',
  'claude-sonnet-4-all': 'Claude 4 Sonnet',
  'deepseek-reasoner': 'DeepSeek Reasoner',
  'gemini-flash': 'Gemini Flash',
  'gemini-flash-lite': 'Gemini Flash Lite',
  'qwen-turbo': 'Qwen Turbo',
  'qvq-plus': 'Qwen Vision Plus',
  'hunyuan-turbos-latest': 'Hunyuan Turbo',
  'hunyuan-t1-latest': 'Hunyuan T1',
  'gpt-4o-search': 'GPT-4o Search',
  'gpt4.1': 'GPT-4.1',
  'Qwen/Qwen3-235B-A22B-search': 'Qwen3-235B-Search',
  'deepseek-ai/DeepSeek-V3-search': 'DeepSeek-V3-Search',
};

// 真实模型映射（仅保留实际存在的模型，o3 -search 模型直接用真实 id）
export const MODEL_MAPPING: Record<string, string> = {
  'gpt-4o-all': 'gpt-4o-all',
  'claude-sonnet-4-all': 'claude-sonnet-4-all',
  'deepseek-reasoner': 'deepseek-reasoner',
  'gemini-flash': 'gemini-flash',
  'gemini-flash-lite': 'gemini-flash-lite',
  'qwen-turbo': 'qwen-turbo',
  'qvq-plus': 'qvq-plus',
  'hunyuan-turbos-latest': 'hunyuan-turbos-latest',
  'hunyuan-t1-latest': 'hunyuan-t1-latest',
  'gpt-4o-search': 'gpt-4o-search',
  'gpt4.1': 'gpt4.1',
  'Qwen/Qwen3-235B-A22B-search': 'Qwen/Qwen3-235B-A22B-search',
  'deepseek-ai/DeepSeek-V3-search': 'deepseek-ai/DeepSeek-V3-search',
};

// 智能选择模型（优先按 search 能力和优先级，严格按 models-config.json 路由规则）
export function selectBestModelForAuto(request: OpenAICompletionRequest): string {
  const lastMessage = request.messages[request.messages.length - 1];
  const content = Array.isArray(lastMessage.content)
    ? lastMessage.content.map(c => c.type === 'text' ? c.text : '').join(' ')
    : lastMessage.content;

  const lowerContent = content.toLowerCase();

  // 检查是否包含图片
  const hasImage = request.messages.some(msg =>
    Array.isArray(msg.content) &&
    msg.content.some(c => c.type === 'image_url')
  );
  if (hasImage) {
    return 'gpt-4o-all';
  }

  // 检查 search 关键词，优先 o3 search
  if (
    lowerContent.includes('search') ||
    lowerContent.includes('最新') ||
    lowerContent.includes('current') ||
    lowerContent.includes('news') ||
    lowerContent.includes('今天') ||
    lowerContent.includes('现在') ||
    lowerContent.includes('查询') ||
    lowerContent.includes('找')
  ) {
    // 按 routing_rules.search_tasks.preferred_models 顺序
    return 'Qwen/Qwen3-235B-A22B-search';
  }

  // 检查推理
  if (
    lowerContent.includes('reasoning') ||
    lowerContent.includes('推理') ||
    lowerContent.includes('analyze') ||
    lowerContent.includes('分析') ||
    lowerContent.includes('logic') ||
    lowerContent.includes('why') ||
    lowerContent.includes('怎么') ||
    lowerContent.includes('如何')
  ) {
    return 'deepseek-reasoner';
  }

  // 检查中文
  const chineseChars = (content.match(/[\u4E00-\u9FFF]/g) || []).length;
  const totalChars = content.length;
  const isChineseContent = totalChars > 0 && (chineseChars / totalChars) > 0.3;
  if (isChineseContent) {
    if (content.length > 300) {
      return 'hunyuan-t1-latest';
    }
    return 'hunyuan-turbos-latest';
  }

  // 默认
  return 'gemini-flash-lite';
}

// 将 OpenAI 格式转换为 LangChain 格式
export function convertOpenAIToLangChain(request: OpenAICompletionRequest): {
  messages: VercelChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
} {
  const messages: VercelChatMessage[] = request.messages.map(msg => {
    if (msg.role === 'tool') {
      return {
      id: Math.random().toString(36),
      role: 'tool' as const,
      content: JSON.stringify(msg.content)
    };
    }
    return {
      id: Math.random().toString(36),
      role: msg.role as 'user' | 'assistant' | 'system',
      content: Array.isArray(msg.content)
        ? msg.content.map(c => c.type === 'text' ? c.text : c).join(' ')
        : msg.content
    };
  });

  const mappedModel = MODEL_MAPPING[request.model] || request.model;

  return {
    messages,
    model: mappedModel,
    temperature: request.temperature,
    maxTokens: request.max_tokens,
    stream: request.stream ?? true
  };
}

// 获取支持的模型列表（严格同步 models-config.json，o3 search 靠前）
export function getSupportedModels() {
  return [
    {
      id: 'auto',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'virtual',
      capabilities: {
        vision: true,
        reasoning: true,
        tool_calling: true,
        structured_output: true,
        agents: true,
        chinese: true,
        search: true,
        web_search: true,
        code_generation: true,
        creative_writing: true,
        mathematical_computation: true
      },
      display_name: 'Auto',
      description: '自动根据任务内容智能分流到最佳模型，支持多模型切换与能力路由。'
    },
    {
      id: 'Qwen/Qwen3-235B-A22B-search',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'o3',
      capabilities: {
        vision: false,
        reasoning: true,
        tool_calling: true,
        structured_output: true,
        agents: true,
        chinese: true,
        search: true,
        web_search: true,
        code_generation: true,
        creative_writing: true,
        mathematical_computation: true
      },
      display_name: MODEL_DISPLAY_NAME['Qwen/Qwen3-235B-A22B-search'],
      description: 'Qwen联网版模型'
    },
    {
      id: 'deepseek-ai/DeepSeek-V3-search',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'o3',
      capabilities: {
        vision: false,
        reasoning: true,
        tool_calling: true,
        structured_output: true,
        agents: true,
        chinese: true,
        search: true,
        web_search: true,
        code_generation: true,
        creative_writing: false,
        mathematical_computation: true
      },
      display_name: MODEL_DISPLAY_NAME['deepseek-ai/DeepSeek-V3-search'],
      description: 'DeepSeek联网版模型'
    },
    {
      id: 'gpt-4o-all',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'openai',
      capabilities: {
        vision: true,
        reasoning: true,
        tool_calling: true,
        structured_output: true,
        agents: true,
        chinese: false,
        search: true,
        web_search: true,
        code_generation: true,
        creative_writing: true,
        mathematical_computation: true
      },
      display_name: MODEL_DISPLAY_NAME['gpt-4o-all'],
      description: 'OpenAI GPT-4o 支持多模态输入，强于复杂推理、代码、创意写作，适合通用对话和企业级应用。'
    },
    {
      id: 'claude-sonnet-4-all',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'anthropic',
      capabilities: {
        vision: true,
        reasoning: true,
        tool_calling: true,
        structured_output: true,
        agents: true,
        chinese: false,
        search: false,
        web_search: false,
        code_generation: true,
        creative_writing: true,
        mathematical_computation: true
      },
      display_name: MODEL_DISPLAY_NAME['claude-sonnet-4-all'],
      description: '专门处理最复杂的推理和创作任务'
    },
    {
      id: 'deepseek-reasoner',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'deepseek',
      capabilities: {
        vision: false,
        reasoning: true,
        tool_calling: false,
        structured_output: false,
        agents: false,
        chinese: true,
        search: false,
        web_search: false,
        code_generation: true,
        creative_writing: false,
        mathematical_computation: true
      },
      display_name: MODEL_DISPLAY_NAME['deepseek-reasoner'],
      description: 'DeepSeek Reasoner 专注于数学推理、逻辑分析和代码解释，适合需要高精度推理和复杂问题分解的场景。'
    },
    {
      id: 'gemini-flash',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'google',
      capabilities: {
        vision: true,
        reasoning: true,
        tool_calling: true,
        structured_output: true,
        agents: true,
        chinese: false,
        search: true,
        web_search: true,
        code_generation: true,
        creative_writing: true,
        mathematical_computation: true
      },
      display_name: MODEL_DISPLAY_NAME['gemini-flash'],
      description: 'Google Gemini Flash，主打极速响应，支持推理、联网搜索、结构化输出和多任务代理，适合对速度和多功能有要求的场景。'
    },
    {
      id: 'gemini-flash-lite',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'google',
      capabilities: {
        vision: false,
        reasoning: true,
        tool_calling: false,
        structured_output: false,
        agents: false,
        chinese: false,
        search: false,
        web_search: false,
        code_generation: true,
        creative_writing: true,
        mathematical_computation: false
      },
      display_name: MODEL_DISPLAY_NAME['gemini-flash-lite'],
      description: 'Google Gemini Flash Lite，极致轻量和高速，适合实时对话、快速推理和低延迟场景。'
    },
    {
      id: 'qwen-turbo',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'alibaba',
      capabilities: {
        vision: false,
        reasoning: true,
        tool_calling: true,
        structured_output: true,
        agents: false,
        chinese: true,
        search: false,
        web_search: false,
        code_generation: true,
        creative_writing: true,
        mathematical_computation: true
      },
      display_name: MODEL_DISPLAY_NAME['qwen-turbo'],
      description: '中文优化大模型，支持工具调用、结构化输出和创意写作，适合中文场景和企业知识问答。'
    },
    {
      id: 'qvq-plus',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'alibaba',
      capabilities: {
        vision: true,
        reasoning: true,
        tool_calling: false,
        structured_output: false,
        agents: false,
        chinese: true,
        search: false,
        web_search: false,
        code_generation: true,
        creative_writing: false,
        mathematical_computation: true
      },
      display_name: MODEL_DISPLAY_NAME['qvq-plus'],
      description: '支持图像理解和中文多模态任务，适合图片分析、视觉问答等场景。'
    },
    {
      id: 'hunyuan-turbos-latest',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'tencent',
      capabilities: {
        vision: false,
        reasoning: true,
        tool_calling: true,
        structured_output: true,
        agents: true,
        chinese: true,
        search: false,
        web_search: false,
        code_generation: true,
        creative_writing: true,
        mathematical_computation: true
      },
      display_name: MODEL_DISPLAY_NAME['hunyuan-turbos-latest'],
      description: '主打中文对话、推理和工具调用，适合中文助手、企业知识库和多轮复杂任务。'
    },
    {
      id: 'hunyuan-t1-latest',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'tencent',
      capabilities: {
        vision: false,
        reasoning: true,
        tool_calling: false,
        structured_output: false,
        agents: false,
        chinese: true,
        search: false,
        web_search: false,
        code_generation: true,
        creative_writing: true,
        mathematical_computation: true
      },
      display_name: MODEL_DISPLAY_NAME['hunyuan-t1-latest'],
      description: '面向高复杂度推理、长文本分析和多任务场景，支持中文创作、代码和数学计算。'
    },
    {
      id: 'gpt-4o-search',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'openai',
      capabilities: {
        vision: true,
        reasoning: true,
        tool_calling: true,
        structured_output: true,
        agents: true,
        chinese: false,
        search: true,
        web_search: true,
        code_generation: true,
        creative_writing: true,
        mathematical_computation: true
      },
      display_name: MODEL_DISPLAY_NAME['gpt-4o-search'],
      description: '集成联网搜索能力，适合需要实时信息检索和知识增强的高级对话场景。'
    },
    {
      id: 'gpt4.1',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'openai',
      capabilities: {
        vision: true,
        reasoning: true,
        tool_calling: true,
        structured_output: true,
        agents: true,
        chinese: false,
        search: true,
        web_search: true,
        code_generation: true,
        creative_writing: true,
        mathematical_computation: true
      },
      display_name: MODEL_DISPLAY_NAME['gpt4.1'],
      description: '与官方GPT-4功能一致，web search首选'
    }
  ];
}

// 其余辅助函数保持不变...

// ====== 兼容 OpenAI API 的流式响应与模型切换相关工具函数 ======

/**
 * 构造 OpenAI 兼容响应对象（支持流式和非流式）
 * @param content 响应内容
 * @param model 模型名
 * @param isFinal 是否为最终块
 * @param isStream 是否为流式
 */
export function createOpenAIResponse(
  content: string,
  model: string,
  isFinal: boolean = false,
  isStream: boolean = false
): any {
  // 简化实现，流式时每行为一个 chunk，非流式时为完整内容
  if (isStream) {
    return {
      id: `chatcmpl-${Math.random().toString(36).slice(2)}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          delta: { content },
          index: 0,
          finish_reason: isFinal ? 'stop' : null
        }
      ]
    };
  } else {
    return {
      id: `chatcmpl-${Math.random().toString(36).slice(2)}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          message: { role: 'assistant', content },
          index: 0,
          finish_reason: 'stop'
        }
      ]
    };
  }
}

/**
 * 格式化流式 chunk 为 OpenAI SSE 格式
 */
export function formatStreamChunk(chunk: any): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * 生成流式响应结束标记
 */
export function createStreamEnd(): string {
  return 'data: [DONE]\n\n';
}

/**
 * 检测用户消息中的模型切换意图，返回模型名或 undefined
 * @param userContent 用户消息内容
 */
export function detectModelSwitchRequest(userContent: string): string | undefined {
  if (!userContent || typeof userContent !== 'string') return undefined;
  // 支持常见“切换到xxx模型”/“用xxx”/“gpt4.1回答”等表达
  const match = userContent.match(/(?:切换到|用|换成|改用|要|希望|switch to|use)\s*([a-zA-Z0-9\-.\/]+)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  // 兼容“gpt4.1回答”等
  const match2 = userContent.match(/([a-zA-Z0-9\-.\/]+)\s*(模型)?(回答|处理|分析)?/i);
  if (match2 && match2[1]) {
    // 排除无意义短词
    if (match2[1].length > 2 && !['模型', '回答', '处理', '分析'].includes(match2[1])) {
      return match2[1].trim();
    }
  }
  return undefined;
}

/**
 * 检测请求意图，返回目标 API 路径（如 /api/chat/route）
 * @param body OpenAICompletionRequest
 */
export async function detectIntentFromRequest(body: OpenAICompletionRequest): Promise<string> {
  // 简单实现：如消息包含“结构化”或“json”则走 structured_output，否则默认 /api/chat/route
  const lastMsg = body.messages?.[body.messages.length - 1];
  const content = lastMsg && typeof lastMsg.content === 'string'
    ? lastMsg.content
    : Array.isArray(lastMsg?.content)
      ? lastMsg.content.map((c: any) => c.text || '').join(' ')
      : '';
  if (/结构化|json|structure/i.test(content)) {
    return '/api/chat/structured_output/route';
  }
  if (/检索|rag|document|知识库/i.test(content)) {
    return '/api/chat/retrieval/route';
  }
  if (/agent|工具|tool/i.test(content)) {
    return '/api/chat/agents/route';
  }
  // 默认
  return '/api/chat/route';
}

/**
 * 智能格式化注入模型信息（用于流式首包输出）
 * @param text 原始输出文本
 * @param modelName 模型名
 * @returns 注入模型信息后的文本
 */
export function smartFormatModelInjection(text: string, modelName: string): string {
  if (!text) return text;
  const firstLine = text.split('\n')[0];
  if (firstLine.includes(modelName) || /【模型[:：]/.test(firstLine)) {
    return text;
  }
  return `【模型：${modelName}】\n${text}`;
}
