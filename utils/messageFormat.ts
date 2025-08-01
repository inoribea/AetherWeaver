import { Message as VercelChatMessage } from 'ai';
import { BaseMessage, HumanMessage, AIMessage, ChatMessage, MessageContent, MessageContentComplex } from '@langchain/core/messages';

/**
 * 将 VercelChatMessage 转换为 LangChain 的 BaseMessage 实例
 * @param message VercelChatMessage
 * @returns BaseMessage
 */
export function convertVercelMessageToLangChainMessage(message: VercelChatMessage): BaseMessage {
  if (message.role === 'user') {
    return new HumanMessage(message.content);
  } else if (message.role === 'assistant') {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
}

/**
 * 将 LangChain 的 BaseMessage 实例转换为 VercelChatMessage 格式
 * @param message BaseMessage
 * @returns VercelChatMessage
 */
export function convertLangChainMessageToVercelMessage(message: BaseMessage): VercelChatMessage {
  // 处理 content 类型，确保为 string
  let content: string;
  if (typeof message.content === 'string') {
    content = message.content;
  } else if (Array.isArray(message.content)) {
    // 复杂内容数组，尝试拼接文本
    content = message.content
      .map((part: MessageContent | MessageContentComplex) => {
        if (typeof part === 'string') return part;
        if ('text' in part && typeof part.text === 'string') return part.text;
        return '';
      })
      .join(' ');
  } else {
    content = String(message.content);
  }

  // 处理 role 类型映射，宽泛处理
  let role: 'user' | 'assistant' | 'system' | 'tool' | 'data' = 'system';
  const type = message._getType();
  if (type === 'human') {
    role = 'user';
  } else if (type === 'ai') {
    role = 'assistant';
  } else if (['system', 'tool', 'data'].includes(type)) {
    role = type as 'system' | 'tool' | 'data';
  } else {
    role = 'system';
  }

  // 处理 tool_calls 类型兼容
  const tool_calls = (message as AIMessage).tool_calls as any;

  return {
    id: Math.random().toString(36).slice(2),
    content,
    role,
    ...(tool_calls ? { tool_calls } : {}),
  };
}