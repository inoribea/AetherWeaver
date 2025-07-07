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
  
  // GPT 4.1 模型映射 - 重要：gpt4.1 映射到自己
  'gpt4.1': 'gpt4.1',
  'gpt-4.1': 'gpt4.1',
  
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
  
  // 腾讯混元模型映射
  'hunyuan-turbo': 'hunyuan-turbos-latest',
  'hunyuan-turbos': 'hunyuan-turbos-latest',
  'hunyuan-turbos-latest': 'hunyuan-turbos-latest',
  'hunyuan-t1': 'hunyuan-t1-latest',
  'hunyuan-t1-latest': 'hunyuan-t1-latest',
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
    // 根据复杂度选择中文模型
    if (content.length > 300 || lowerContent.includes('复杂') || lowerContent.includes('详细')) {
      return 'hunyuan-t1-latest'; // 复杂中文任务
    }
    return 'hunyuan-turbos-latest'; // 一般中文任务
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

// 检测模型切换请求
export function detectModelSwitchRequest(content: string): string | null {
  const lowerContent = content.toLowerCase();
  
  // 扩展的模型切换关键词
  const switchKeywords = [
    '切换到', '使用', '换成', '改用', '换到', '用',
    '让', '请', '要', '想要', '希望',
    '换个', '来个', '要个', '用个',
    'switch to', 'use', 'change to', 'with'
  ];
  
  // 检查是否包含切换关键词
  const hasSwitchKeyword = switchKeywords.some(keyword => lowerContent.includes(keyword));
  
  if (hasSwitchKeyword) {
    // 模型名称映射（包括常用别名）
    const modelMappings = {
      // GPT 4.1 系列 - 修正：gpt4.1 应该映射到自己
      'gpt4.1': 'gpt4.1',
      'gpt-4.1': 'gpt4.1',
      '4.1': 'gpt4.1',
      
      // GPT 4o 系列
      'gpt-4o': 'gpt-4o-all',
      'gpt4o': 'gpt-4o-all',
      'gpt4': 'gpt-4o-all',
      'gpt': 'gpt-4o-all',
      '4o': 'gpt-4o-all',
      
      // Claude 系列
      'claude': 'claude-sonnet-4-all',
      'sonnet': 'claude-sonnet-4-all',
      
      // DeepSeek 系列
      'deepseek': 'deepseek-reasoner',
      'reasoner': 'deepseek-reasoner',
      
      // Qwen 系列
      'qwen': 'qwen-turbo',
      'qvq': 'qvq-plus',
      
      // Gemini 系列
      'gemini': 'gemini-flash-lite',
      'flash': 'gemini-flash-lite',
      'lite': 'gemini-flash-lite',
      
      // 混元系列
      'hunyuan': 'hunyuan-turbos-latest',
      '混元': 'hunyuan-turbos-latest',
      't1': 'hunyuan-t1-latest',
      
      // 其他模型
      'o4': 'o4-mini',
      'mini': 'o4-mini'
    };
    
    // 检查"高级模型"等形容词请求
    const qualityKeywords = [
      '高级', '更好', '强', '厉害', '顶级', '最好',
      '高级的', '更好的', '强的', '厉害的', '顶级的', '最好的',
      '高级点', '更好点', '强点', '厉害点', '顶级点',
      '高级点的', '更好点的', '强点的', '厉害点的', '顶级点的',
      'better', 'advanced', 'premium', 'top', 'best'
    ];
    
    const hasQualityKeyword = qualityKeywords.some(keyword => lowerContent.includes(keyword));
    
    if (hasQualityKeyword) {
      // 智能选择高质量模型
      // 根据models-config.json中的quality_rating选择
      const highQualityModels = [
        'claude-sonnet-4-all',  // quality_rating: 10
        'gpt4.1',               // quality_rating: 10
        'gpt-4o-all',           // quality_rating: 9
        'hunyuan-t1-latest',    // quality_rating: 9
        'deepseek-reasoner'     // quality_rating: 9
      ];
      
      // 返回最高质量的模型
      return highQualityModels[0]; // claude-sonnet-4-all
    }
    
    // 检查所有可能的模型名称
    for (const [alias, modelName] of Object.entries(modelMappings)) {
      if (lowerContent.includes(alias)) {
        return modelName;
      }
    }
    
    // 直接匹配完整模型名称
    const fullModelRegex = /(gpt4\.1|gpt-4o-all|claude-sonnet-4-all|o4-mini|deepseek-chat|deepseek-reasoner|qwen-turbo|gemini-flash-lite|gemini-flash|hunyuan-turbos-latest|hunyuan-t1-latest|qvq-plus)/g;
    const match = fullModelRegex.exec(lowerContent);
    if (match) {
      return match[0];
    }
  }
  
  return null;
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
    if (isComplete) {
      // 完成块
      return {
        id,
        object: 'chat.completion.chunk',
        created: timestamp,
        model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }]
      };
    } else {
      // 内容块
      return {
        id,
        object: 'chat.completion.chunk',
        created: timestamp,
        model,
        choices: [{
          index: 0,
          delta: {
            role: 'assistant',
            content: content
          },
          finish_reason: null
        }]
      };
    }
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
      owned_by: 'langchain',
      // 补充能力描述，确保 openai format 客户端能识别
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
      description: '自动智能路由模型，支持所有功能，自动选择最佳底层模型'
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
      id: 'hunyuan-turbos-latest',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'tencent'
    },
    {
      id: 'hunyuan-t1-latest',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'tencent'
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

// 格式化模型信息注入
export function formatModelInjection(
  content: string,
  modelName: string,
  options: {
    useMarkdown?: boolean;
    addSeparator?: boolean;
    compact?: boolean;
    detectStructured?: boolean;
  } = {}
): string {
  const {
    useMarkdown = true,
    addSeparator = true,
    compact = false,
    detectStructured = true
  } = options;

  // 如果内容为空，直接返回
  if (!content || !content.trim()) {
    return content;
  }

  // 检测内容类型
  const isStructuredContent = detectStructured && (
    content.includes('```') ||
    content.includes('```json') ||
    content.includes('```javascript') ||
    content.includes('```python') ||
    content.includes('```sql') ||
    content.includes('**') ||
    content.includes('##') ||
    content.includes('###') ||
    content.includes('- ') ||
    content.includes('1. ') ||
    content.includes('| ') // 表格
  );

  // 检测是否为错误信息或技术内容
  const isTechnicalContent =
    content.includes('error') ||
    content.includes('Error') ||
    content.includes('undefined') ||
    content.includes('Cannot read properties') ||
    content.includes('API') ||
    content.includes('配置') ||
    content.includes('参数');

  let modelInfo: string;
  let separator: string;

  if (compact) {
    // 紧凑格式
    modelInfo = `🤖 ${modelName}`;
    separator = ' • ';
  } else if (useMarkdown) {
    // 标准Markdown格式
    modelInfo = `🤖 **Model:** ${modelName}`;
    separator = addSeparator ? '\n\n---\n\n' : '\n\n';
  } else {
    // 纯文本格式
    modelInfo = `🤖 Model: ${modelName}`;
    separator = addSeparator ? '\n---\n' : '\n';
  }

  // 对于结构化内容，使用代码块格式
  if (isStructuredContent && useMarkdown && !compact) {
    return `\`\`\`\n${modelInfo}\n${addSeparator ? '---' : ''}\n\`\`\`\n\n${content}`;
  }

  // 对于技术内容，使用引用格式
  if (isTechnicalContent && useMarkdown && !compact) {
    return `> ${modelInfo}\n\n${content}`;
  }

  // 标准格式
  return `${modelInfo}${separator}${content}`;
}

// 检测内容是否需要特殊格式化
export function detectContentType(content: string): {
  isCode: boolean;
  isStructured: boolean;
  isTechnical: boolean;
  isLongForm: boolean;
} {
  const isCode = content.includes('```') ||
                 /^[\s]*[{}\[\]()=;]/.test(content) ||
                 content.includes('function') ||
                 content.includes('const ') ||
                 content.includes('let ') ||
                 content.includes('var ');

  const isStructured = content.includes('**') ||
                       content.includes('##') ||
                       content.includes('###') ||
                       content.includes('- ') ||
                       content.includes('1. ') ||
                       content.includes('| ') ||
                       content.includes('```');

  const isTechnical = content.includes('error') ||
                      content.includes('Error') ||
                      content.includes('API') ||
                      content.includes('配置') ||
                      content.includes('参数') ||
                      content.includes('undefined') ||
                      content.includes('Cannot read');

  const isLongForm = content.length > 500;

  return {
    isCode,
    isStructured,
    isTechnical,
    isLongForm
  };
}

// 智能格式化函数 - 根据内容类型自动选择最佳格式
export function smartFormatModelInjection(
  content: string,
  modelName: string
): string {
  const contentType = detectContentType(content);
  
  // 根据内容类型选择格式化选项
  let options = {
    useMarkdown: true,
    addSeparator: true,
    compact: false,
    detectStructured: true
  };

  // 对于代码内容，使用紧凑格式
  if (contentType.isCode) {
    options.compact = true;
    options.addSeparator = false;
  }
  
  // 对于技术内容，使用引用格式
  if (contentType.isTechnical) {
    options.addSeparator = false;
  }
  
  // 对于长内容，使用标准格式
  if (contentType.isLongForm) {
    options.addSeparator = true;
  }

  return formatModelInjection(content, modelName, options);
}
