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

// 模型映射配置
export const MODEL_MAPPING: Record<string, string> = {
  // OpenAI 模型映射
  'gpt-4': 'gpt-4o-all',
  'gpt-4-turbo': 'gpt-4o-all',
  'gpt-4o': 'gpt-4o-all',
  'gpt-4o-mini': 'o4-mini',
  'gpt-3.5-turbo': 'gemini-flash-lite',
  
  // Claude 模型映射
  'claude-3-5-sonnet': 'claude-sonnet-4-all',
  'claude-3-sonnet': 'claude-sonnet-4-all',
  'claude-3-haiku': 'gemini-flash-lite',
  
  // Gemini 模型映射
  'gemini-pro': 'gemini-flash',
  'gemini-1.5-pro': 'gemini-flash',
  'gemini-1.5-flash': 'gemini-flash-lite',
  
  // 自定义模型
  'auto': 'auto', // 特殊标识，让系统自动选择最佳模型
  'langchain-chat': 'auto',
  'langchain-vision': 'gpt-4o-all',
  'langchain-search': 'gemini-flash',
  'langchain-reasoning': 'deepseek-reasoner',
  'langchain-structured': 'gpt-4o-all',
  
  // DeepSeek 模型映射
  'deepseek-chat': 'deepseek-chat',
  'deepseek-coder': 'deepseek-chat',
  
  // 通义千问模型映射
  'qwen-turbo': 'qwen-turbo',
  'qwen-plus': 'qwen-turbo',
  'qwen-max': 'qwen-turbo',
};

// Auto模型智能选择逻辑
export function selectBestModelForAuto(request: OpenAICompletionRequest): string {
  const lastMessage = request.messages[request.messages.length - 1];
  const content = Array.isArray(lastMessage.content) 
    ? lastMessage.content.map(c => c.type === 'text' ? c.text : '').join(' ')
    : lastMessage.content;

  // 检查是否包含图片 - 视觉能力
  const hasImage = request.messages.some(msg => 
    Array.isArray(msg.content) && 
    msg.content.some(c => c.type === 'image_url')
  );

  if (hasImage) {
    return 'gpt-4o-all'; // 最佳视觉模型
  }

  const lowerContent = content.toLowerCase();

  // 检测联网搜索需求
  if (lowerContent.includes('search') || 
      lowerContent.includes('latest') || 
      lowerContent.includes('current') ||
      lowerContent.includes('news') ||
      lowerContent.includes('today') ||
      lowerContent.includes('recent')) {
    return 'gemini-flash'; // 支持搜索的模型
  }

  // 检测工具调用需求
  if (request.tools && request.tools.length > 0 ||
      lowerContent.includes('tool') || 
      lowerContent.includes('function') || 
      lowerContent.includes('calculate') ||
      lowerContent.includes('compute')) {
    return 'gpt-4o-all'; // 最佳工具调用模型
  }

  // 检测复杂推理需求
  if (lowerContent.includes('analyze') || 
      lowerContent.includes('reasoning') || 
      lowerContent.includes('logic') ||
      lowerContent.includes('solve') ||
      lowerContent.includes('explain') ||
      lowerContent.includes('why') ||
      lowerContent.includes('how') ||
      content.length > 500) { // 长文本通常需要推理
    return 'deepseek-reasoner'; // 最佳推理模型
  }

  // 检测结构化输出需求
  if (lowerContent.includes('json') || 
      lowerContent.includes('format') || 
      lowerContent.includes('structure') ||
      lowerContent.includes('table') ||
      lowerContent.includes('list')) {
    return 'gpt-4o-all'; // 最佳结构化输出模型
  }

  // 检测中文内容
  const chineseChars = (content.match(/[\u4E00-\u9FFF]/g) || []).length;
  const totalChars = content.length;
  const isChineseContent = totalChars > 0 && (chineseChars / totalChars) > 0.3;

  if (isChineseContent) {
    return 'deepseek-chat'; // 中文优化模型
  }

  // 默认使用快速通用模型
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
      // 工具消息转换为系统消息
      return {
        id: Math.random().toString(36),
        role: 'system' as const,
        content: `Tool result: ${msg.content}`
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

  // 映射模型名称
  const mappedModel = MODEL_MAPPING[request.model] || request.model;

  return {
    messages,
    model: mappedModel === 'auto' ? undefined : mappedModel,
    temperature: request.temperature,
    maxTokens: request.max_tokens,
    stream: request.stream ?? true
  };
}

// 生成 OpenAI 格式的响应
export function createOpenAIResponse(
  content: string,
  model: string = 'langchain-auto',
  isComplete: boolean = false,
  isStream: boolean = true
): OpenAICompletionResponse {
  const timestamp = Math.floor(Date.now() / 1000);
  const id = `chatcmpl-${Math.random().toString(36).substring(2, 15)}`;

  if (isStream) {
    return {
      id,
      object: 'chat.completion.chunk',
      created: timestamp,
      model,
      choices: [{
        index: 0,
        delta: isComplete ? {} : { content },
        finish_reason: isComplete ? 'stop' : null
      }]
    };
  } else {
    return {
      id,
      object: 'chat.completion',
      created: timestamp,
      model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 0, // 这里可以实际计算
        completion_tokens: 0,
        total_tokens: 0
      }
    };
  }
}

// 创建流式响应的数据格式
export function formatStreamChunk(response: OpenAICompletionResponse): string {
  return `data: ${JSON.stringify(response)}\n\n`;
}

// 创建流式响应结束标记
export function createStreamEnd(): string {
  return 'data: [DONE]\n\n';
}

// 检测请求意图并返回相应的端点路径
export function detectIntentFromRequest(request: OpenAICompletionRequest): string {
  const lastMessage = request.messages[request.messages.length - 1];
  const content = Array.isArray(lastMessage.content) 
    ? lastMessage.content.map(c => c.type === 'text' ? c.text : '').join(' ')
    : lastMessage.content;

  // 检查是否包含图片
  const hasImage = request.messages.some(msg => 
    Array.isArray(msg.content) && 
    msg.content.some(c => c.type === 'image_url')
  );

  if (hasImage) {
    return '/api/chat'; // 视觉处理
  }

  const lowerContent = content.toLowerCase();

  // 检测搜索请求
  if (lowerContent.includes('search') || 
      lowerContent.includes('latest') || 
      lowerContent.includes('current') ||
      lowerContent.includes('news')) {
    return '/api/chat/agents';
  }

  // 检测结构化输出请求
  if (lowerContent.includes('analyze') || 
      lowerContent.includes('structure') || 
      lowerContent.includes('format') ||
      lowerContent.includes('json')) {
    return '/api/chat/structured_output';
  }

  // 检测文档检索请求
  if (lowerContent.includes('document') || 
      lowerContent.includes('rag') || 
      lowerContent.includes('retrieval') ||
      lowerContent.includes('langchain')) {
    return '/api/chat/retrieval';
  }

  // 检测Agent请求
  if (lowerContent.includes('tool') || 
      lowerContent.includes('function') || 
      lowerContent.includes('calculate') ||
      request.tools && request.tools.length > 0) {
    return '/api/chat/agents';
  }

  // 默认使用基础聊天
  return '/api/chat';
}

// 获取支持的模型列表
export function getSupportedModels() {
  return [
    {
      id: 'auto',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'langchain'
    },
    {
      id: 'gpt-4',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'openai'
    },
    {
      id: 'gpt-4-turbo',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'openai'
    },
    {
      id: 'gpt-3.5-turbo',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'openai'
    },
    {
      id: 'claude-3-5-sonnet',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'anthropic'
    },
    {
      id: 'gemini-pro',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'google'
    },
    {
      id: 'deepseek-chat',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'deepseek'
    },
    {
      id: 'langchain-chat',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'langchain'
    },
    {
      id: 'langchain-vision',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'langchain'
    },
    {
      id: 'langchain-search',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'langchain'
    }
  ];
}
