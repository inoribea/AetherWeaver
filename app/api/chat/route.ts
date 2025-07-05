import { NextRequest } from 'next/server';
import { Message as VercelChatMessage, StreamingTextResponse } from 'ai';
import { z } from 'zod';

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
import { Runnable, RunnableLambda, RunnableSequence, RunnableBranch } from '@langchain/core/runnables';

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

// Enhanced Router Output Schema
const RouterOutputSchema = z.object({
  intent: z.enum([
    "vision_request",
    "web_search_request", 
    "complex_reasoning_request",
    "simple_chat_request",
    "document_retrieval_request",
    "agent_task_request",
    "structured_output_request",
  ]).describe("The user's intent based on the conversation history and current message."),
  query: z.string().nullable().optional().describe("A concise query extracted from the user's message."),
  requiresChineseOptimization: z.boolean().describe("Whether the request would benefit from Chinese language optimization."),
  complexity: z.enum(["low", "medium", "high"]).describe("The estimated complexity of the request."),
  contextDependency: z.boolean().describe("Whether the request heavily depends on conversation history."),
  tools: z.array(z.string()).optional().describe("List of tools that might be needed for this request."),
  structuredOutput: z.boolean().describe("Whether the response should be structured."),
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

// Helper function to get model instance
function getModel(modelName: string): { llmInstance: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>, modelName: string } {
  const providerEntry = MODEL_PROVIDERS[modelName];
  if (!providerEntry) {
    console.warn(`Model configuration for ${modelName} not found. Using fallback.`);
    return createFallbackModel();
  }

  try {
    let modelInstance: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;
    
    if (providerEntry.type === 'openai_compatible') {
      modelInstance = new ChatOpenAI({
        temperature: providerEntry.config.temperature || 0.7,
        streaming: true,
        apiKey: providerEntry.config.apiKey!,
        configuration: providerEntry.config.configuration,
        model: providerEntry.config.model || modelName,
      });
    } else if (providerEntry.type === 'deepseek') {
      modelInstance = new ChatDeepSeek({
        temperature: providerEntry.config.temperature || 0.7,
        streaming: true,
        apiKey: providerEntry.config.apiKey!,
        model: providerEntry.config.model || modelName,
      });
    } else if (providerEntry.type === 'alibaba_tongyi') {
      modelInstance = createAlibabaTongyiModel({
        temperature: providerEntry.config.temperature || 0.7,
        streaming: true,
        model: providerEntry.config.model || modelName,
        apiKey: providerEntry.config.apiKey
      });
    } else if (providerEntry.type === 'google_gemini') {
      modelInstance = new ChatGoogleGenerativeAI({
        temperature: providerEntry.config.temperature || 0.7,
        streaming: true,
        apiKey: providerEntry.config.apiKey!,
        model: providerEntry.config.model || modelName,
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
  
  if (process.env.NEKO_API_KEY || process.env.OPENAI_API_KEY) {
    console.log("使用 OpenAI 兼容模型作为回退模型");
    fallbackModelName = 'gpt-4o-all';
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
    fallbackModelName = 'gemini-flash-lite';
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
      apiKey: process.env.DASHSCOPE_API_KEY
    });
  } else {
    throw new Error("未找到可用的 API 密钥，无法创建回退模型。请配置 OPENAI_API_KEY, DEEPSEEK_API_KEY, GOOGLE_API_KEY 或 DASHSCOPE_API_KEY。");
  }
  return { llmInstance: fallbackModel, modelName: fallbackModelName };
}

// Enhanced POST handler with integrated features
export async function POST(req: NextRequest) {
  try {
    console.log('Enhanced Chat API request received');
    const body = await req.json();
    const messages = body.messages ?? [];
    
    if (!messages.length) {
      return new Response("No messages provided", { status: 400 });
    }

    const formattedMessages = messages.map(formatMessage);
    
    // Simple intent detection based on message content
    const lastMessage = formattedMessages[formattedMessages.length - 1];
    const messageText = Array.isArray(lastMessage.content) 
      ? lastMessage.content.find((part: any) => part.type === 'text')?.text || ""
      : lastMessage.content as string;

    // Check for images
    const hasImage = formattedMessages.some((msg: BaseMessage) => 
      msg._getType() === 'human' && Array.isArray(msg.content) && 
      msg.content.some((part: any) => part.type === 'image_url')
    );

    let selectedModel: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;
    let modelNameForOutput: string;
    let chain: Runnable<any, string>;

    if (hasImage) {
      // Vision processing
      console.log("[Enhanced Router] Image detected, using vision model");
      const visionModels = ['gpt-4o-all', 'qvq-plus', 'claude-sonnet-4-all'];
      let visionModel = null;
      let visionModelName = '';
      
      for (const modelName of visionModels) {
        try {
          const { llmInstance, modelName: actualName } = getModel(modelName);
          visionModel = llmInstance;
          visionModelName = actualName;
          break;
        } catch (e) {
          console.warn(`Vision model ${modelName} unavailable`);
        }
      }
      
      if (!visionModel) {
        const fallback = getModel('gemini-flash-lite');
        visionModel = fallback.llmInstance;
        visionModelName = fallback.modelName;
      }
      
      selectedModel = visionModel;
      modelNameForOutput = visionModelName;
      const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
      chain = prompt.pipe(selectedModel).pipe(new StringOutputParser());
      
    } else if (messageText.toLowerCase().includes('search') || 
               messageText.toLowerCase().includes('最新') || 
               messageText.toLowerCase().includes('current')) {
      // Web search processing
      console.log("[Enhanced Router] Search request detected");
      
      if (process.env.TAVILY_API_KEY) {
        try {
          const { llmInstance: searchModel, modelName: searchModelName } = getModel('gpt-4o-all');
          const tools: Tool[] = [new TavilySearchResults({ maxResults: 5, apiKey: process.env.TAVILY_API_KEY })];
          
          const agentPrompt = ChatPromptTemplate.fromMessages([
            ["system", "You are a helpful AI assistant with access to web search. Use search when you need current information."],
            new MessagesPlaceholder("chat_history"),
            ["human", "{input}"],
            new MessagesPlaceholder("agent_scratchpad"),
          ]);
          
          const memory = new BufferMemory({
            memoryKey: "chat_history",
            returnMessages: true,
          });
          
          const agentExecutor = await initializeAgentExecutorWithOptions(tools, searchModel, {
            agentType: "openai-functions",
            memory,
            returnIntermediateSteps: true,
          });
          
          selectedModel = searchModel;
          modelNameForOutput = searchModelName;
          chain = RunnableSequence.from([
            {
              input: () => messageText,
              chat_history: () => formattedMessages.slice(0, -1),
            },
            agentExecutor,
            new StringOutputParser(),
          ]);
        } catch (error) {
          console.error("Failed to initialize search agent:", error);
          const fallback = getModel('gemini-flash');
          selectedModel = fallback.llmInstance;
          modelNameForOutput = fallback.modelName;
          const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
          chain = prompt.pipe(selectedModel).pipe(new StringOutputParser());
        }
      } else {
        const fallback = getModel('gemini-flash');
        selectedModel = fallback.llmInstance;
        modelNameForOutput = fallback.modelName;
        const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
        chain = prompt.pipe(selectedModel).pipe(new StringOutputParser());
      }
      
    } else if (messageText.toLowerCase().includes('analyze') || 
               messageText.toLowerCase().includes('structure') || 
               messageText.toLowerCase().includes('format')) {
      // Structured output processing
      console.log("[Enhanced Router] Structured output request detected");
      
      try {
        const { llmInstance: structuredModel, modelName: structuredModelName } = getModel('gpt-4o-all');
        
        const TEMPLATE = `Extract the requested fields from the input and provide a structured response.
        
Input: {input}`;
        
        const prompt = PromptTemplate.fromTemplate(TEMPLATE);
        const functionCallingModel = structuredModel.withStructuredOutput(StructuredResponseSchema);
        
        selectedModel = structuredModel;
        modelNameForOutput = structuredModelName;
        chain = RunnableSequence.from([
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
        ]);
      } catch (error) {
        console.error("Failed to initialize structured output:", error);
        const fallback = getModel('gemini-flash');
        selectedModel = fallback.llmInstance;
        modelNameForOutput = fallback.modelName;
        const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
        chain = prompt.pipe(selectedModel).pipe(new StringOutputParser());
      }
      
    } else if (messageText.toLowerCase().includes('langchain') || 
               messageText.toLowerCase().includes('rag') || 
               messageText.toLowerCase().includes('vector')) {
      // Document retrieval processing
      console.log("[Enhanced Router] Document retrieval request detected");
      
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
      
      const { llmInstance: retrievalModel, modelName: retrievalModelName } = getModel('gemini-flash');
      
      const retrievalPrompt = ChatPromptTemplate.fromMessages([
        ["system", "You are a helpful AI assistant. Use the following context to answer the user's question."],
        ["human", "Context: {context}\n\nQuestion: {question}"],
      ]);
      
      selectedModel = retrievalModel;
      modelNameForOutput = retrievalModelName;
      chain = RunnableSequence.from([
        {
          context: () => context,
          question: () => messageText,
        },
        retrievalPrompt,
        selectedModel,
        new StringOutputParser(),
      ]);
      
    } else {
      // Simple chat processing
      console.log("[Enhanced Router] Simple chat request");
      
      const chatModels = ['gemini-flash-lite', 'qwen-turbo', 'deepseek-chat'];
      let chatModel = null;
      let chatModelName = '';
      
      for (const modelName of chatModels) {
        try {
          const { llmInstance, modelName: actualName } = getModel(modelName);
          chatModel = llmInstance;
          chatModelName = actualName;
          break;
        } catch (e) {
          console.warn(`Chat model ${modelName} unavailable`);
        }
      }
      
      if (!chatModel) {
        const fallback = createFallbackModel();
        chatModel = fallback.llmInstance;
        chatModelName = fallback.modelName;
      }
      
      selectedModel = chatModel;
      modelNameForOutput = chatModelName;
      const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
      chain = prompt.pipe(selectedModel).pipe(new StringOutputParser());
    }

    // Execute the chain and stream the response
    const stream = await chain.stream({ messages: formattedMessages });
    
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = typeof chunk === 'string' ? chunk : String(chunk);
            controller.enqueue(new TextEncoder().encode(text));
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
        'Content-Type': 'text/plain; charset=utf-8',
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
