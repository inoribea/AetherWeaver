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
import { ChatDeepSeek } from "@langchain/deepseek";
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

import { ChatPromptValueInterface } from "@langchain/core/prompt_values";

// Helper to convert chat messages to a text string, useful for debugging or specific models.
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

// ... 省略 model mapping 代码（保持不变）

// Helper function to check if messages contain image content
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

export async function POST(req: NextRequest) {
  console.log('[Route] 接收到 POST /api/chat 请求');
  try {
    // 解析请求体
    const body = await req.json();
    console.log('[Route] 请求体:', JSON.stringify(body));

    // 格式化消息
    const formattedMessages = (body.messages || []).map((m: VercelChatMessage) => {
      const msg = formatMessage(m);
      console.log(`[Route] 格式化消息: 角色=${m.role}, 内容=`, m.content);
      return msg;
    });

    // 检查是否含有图片
    const hasImage = containsImage(formattedMessages);
    console.log(`[Route] 是否包含图片消息: ${hasImage}`);

    // 模型选择和链路初始化
    // 这里建议你调用你自己写的 determineModelAndChain 方法，并在里面加详细日志
    let llmInstance, chain;
    try {
      const result = await determineModelAndChain(formattedMessages);
      llmInstance = result.llmInstance;
      chain = result.chain;
      console.log('[Route] 已经初始化模型和链路:', llmInstance?.constructor?.name);
    } catch (err) {
      console.error('[Route] 模型链路初始化失败:', err);
      throw err;
    }

    // 运行链路
    let responseText = '';
    try {
      responseText = await chain.invoke({ messages: formattedMessages });
      console.log('[Route] 模型输出:', responseText);
    } catch (err) {
      console.error('[Route] 执行模型链路时出错:', err);
      throw err;
    }

    // 返回 response
    return new Response(
      JSON.stringify({ result: responseText }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Route] 发生异常:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}