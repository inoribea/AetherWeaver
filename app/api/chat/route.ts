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
      const contentParts: ContentPart[] = message.content.map((part: ContentPart) => {
        if (part.type === 'text') {
          return { type: 'text', text: part.text };
        } else if (part.type === 'image_url') {
          return { type: 'image_url', image_url: { url: String(part.image_url?.url) } };
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

// ...（后续内容保持不变，未修改）
