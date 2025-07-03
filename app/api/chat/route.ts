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

//export const runtime = 'edge'; // Keep this commented unless you intend to use edge runtime

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
          // Ensure image_url.url is treated correctly; it might need to be a string
          return { type: 'image_url', image_url: { url: String(part.image_url.url) } };
        }
        // Fallback for unexpected part types
        return { type: 'text', text: (part as any).text || String(part) };
      });
      // Cast to MessageContent as it can be string or MessageContentComplex[]
      return new HumanMessage({ content: contentParts as MessageContent });
    }
    return new HumanMessage(message.content as string);
  } else if (message.role === 'assistant') {
    // AIMessage content is typically string, but can be MessageContent if it contains tool calls etc.
    // For simplicity here, assuming string content from assistant for now.
    return new AIMessage(message.content as string);
  } else { // Assuming system message for other roles
    return new SystemMessage(message.content as string);
  }
}

import { ChatPromptValueInterface } from "@langchain/core/prompt_values";

// Helper to convert chat messages to a text string, useful for debugging or specific models.
// Note: This might not be used directly in the current chain logic but can be helpful.
const messagesToText = new RunnableLambda({
  func: (input: ChatPromptValueInterface) => {
    const messages = input.messages;
    return messages.map((m: BaseMessage) => {
      if (m._getType() === 'human' && Array.isArray(m.content)) {
        return `Human: ${m.content.map(part => {
          if (part.type === 'text') return part.text;
          if (part.type === 'image_url') return `[Image: ${part.image_url.url}]`;
          return ''; // Ignore other types for this text conversion
        }).join(' ')}`;
      }
      return `${m._getType()}: ${m.content}`;
    }).join("\n");
  },
});

// Define model configuration mapping
const MODEL_PROVIDERS: Record<string, {
  type: string;
  model: new (...args: any[]) => BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> | BaseLLM<BaseLLMCallOptions>;
  config: Record<string, any>;
  capabilities: {
    vision?: boolean;
    reasoning?: boolean;
    tool_calling?: boolean;
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
  'claude-sonnet-4-all': {
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
  // --- OpenRouter Models ---
  'rekaai/reka-flash-3:free': {
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
    config: { apiKey: process.env.DEEPSEEK_API_KEY }, // CORRECTED: apiKey in configuration
    capabilities: { reasoning: true },
  },
  'deepseek-reasoner': {
    type: 'deepseek',
    model: ChatDeepSeek,
    config: { apiKey: process.env.DEEPSEEK_API_KEY, model: 'deepseek-reasoner' }, // CORRECTED: apiKey in configuration
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
  'gemini-pro-vision': {
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

// Helper function to check if messages contain image content
function containsImage(messages: BaseMessage[]): boolean {
  for (const msg of messages) {
    if (msg._getType() === 'human' && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        // Ensure part is not a string before accessing properties
        if (typeof part === 'object' && part !== null && part.type === 'image_url') {
          return true;
        }
      }
    }
  }
  return false;
}

// Create a fallback model
function createFallbackModel(): BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> {
  console.log("[Fallback] Attempting to create fallback model...");
  // Prioritize OpenAI if available, then DeepSeek, then Google
  if (process.env.OPENAI_API_KEY) {
    console.log("[Fallback] Using OpenAI as fallback model");
    return new ChatOpenAI({
      temperature: 0.7,
      streaming: true,
      // OpenAI requires apiKey directly in the constructor or via configuration.baseURL
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.NEKO_BASE_URL ? 'gpt-4o-all' : 'gpt-4o-mini', // Assuming NEKO_BASE_URL implies Neko/O3, use gpt-4o-all
      configuration: { // Configuration for baseURL
        baseURL: process.env.NEKO_BASE_URL || process.env.OPENAI_BASE_URL,
      },
    });
  } else if (process.env.DEEPSEEK_API_KEY) {
    console.log("[Fallback] Using DeepSeek as fallback model");
    return new ChatDeepSeek({
      temperature: 0.7,
      streaming: true,
      // CORRECTED: Pass apiKey within configuration object
      configuration: {
        apiKey: process.env.DEEPSEEK_API_KEY,
      },
      model: 'deepseek-chat', // Or 'deepseek-reasoner' if preferred for fallback
    });
  } else if (process.env.GOOGLE_API_KEY) {
    console.log("[Fallback] Using Google Gemini as fallback model");
    return new ChatGoogleGenerativeAI({
      temperature: 0.7,
      streaming: true,
      apiKey: process.env.GOOGLE_API_KEY,
      model: 'gemini-pro', // Or 'gemini-flash'
    });
  }
  // Add other fallbacks if necessary (e.g., Cloudflare, Tencent)
  
  console.error("[Fallback] No available API keys found for fallback model. Please configure OPENAI_API_KEY, DEEPSEEK_API_KEY, or GOOGLE_API_KEY.");
  throw new Error("No available API keys found for fallback model. Please configure OPENAI_API_KEY, DEEPSEEK_API_KEY, or GOOGLE_API_KEY.");
}

// Core logic: auto-detect and return the appropriate LLM instance and LangChain Chain
async function determineModelAndChain(
  formattedMessages: BaseMessage[],
): Promise<{ llmInstance: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> | BaseLLM<BaseLLMCallOptions>, chain: Runnable<any, string> }> {

  try {
    console.log("[Auto-detect] Starting model and chain determination.");

    // 1. Prioritize vision models if image content is present
    const hasImage = containsImage(formattedMessages);
    if (hasImage) {
      console.log("[Auto-detect] Image input detected. Checking for vision models.");
      const visionModelName = Object.keys(MODEL_PROVIDERS).find(name =>
        MODEL_PROVIDERS[name].capabilities.vision
      );

      if (visionModelName) {
        const providerEntry = MODEL_PROVIDERS[visionModelName];
        // Check if the required API key for this vision model is available
        let apiKeyConfigured = false;
        if (providerEntry.type === 'openai_compatible' || providerEntry.type === 'deepseek' || providerEntry.type === 'google_gemini') {
           apiKeyConfigured = !!providerEntry.config.apiKey;
        } else if (providerEntry.type === 'cloudflare') {
           apiKeyConfigured = !!providerEntry.config.cloudflareApiToken;
        } else if (providerEntry.type === 'tencent_hunyuan') {
           apiKeyConfigured = !!providerEntry.config.secretId && !!providerEntry.config.secretKey;
        }
        // Add other checks for different provider types if needed

        if (apiKeyConfigured) {
          console.log(`[Auto-detect] Image input detected, selecting vision model: ${visionModelName}`);
          const llmInstance = new providerEntry.model({
            temperature: 0.7,
            streaming: true,
            ...providerEntry.config,
            model: providerEntry.config.model || visionModelName,
          }) as BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;

          // Use the already correctly formatted BaseMessage array
          const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
          const chain = prompt.pipe(llmInstance).pipe(new StringOutputParser());
          console.log(`[Auto-detect] Successfully created chain for vision model: ${visionModelName}`);
          return { llmInstance, chain };
        } else {
          console.log(`[Auto-detect] Vision model ${visionModelName} selected, but its API key/config is missing.`);
        }
      } else {
        console.log("[Auto-detect] Image input detected, but no vision model found with available API key.");
      }
    }

    // 2. Attempt to use Agent for reasoning and tool calling
    console.log("[Auto-detect] Checking for Agent-capable models.");
    const agentCapableModelName = Object.keys(MODEL_PROVIDERS).find(name => {
      const provider = MODEL_PROVIDERS[name];
      // Prioritize models that can handle tool_calling and reasoning
      return provider.capabilities.reasoning && provider.capabilities.tool_calling;
    });

    // Check if a suitable agent model and TAVILY_API_KEY are available
    if (agentCapableModelName && process.env.TAVILY_API_KEY) {
      console.log(`[Auto-detect] Agent model ${agentCapableModelName} identified and TAVILY_API_KEY is present.`);
      const providerEntry = MODEL_PROVIDERS[agentCapableModelName];
      let apiKeyConfigured = false;
      if (providerEntry.type === 'openai_compatible' || providerEntry.type === 'deepseek' || providerEntry.type === 'google_gemini') {
         apiKeyConfigured = !!providerEntry.config.apiKey;
      }
      // Add other checks for different provider types if needed

      if (apiKeyConfigured) {
        try {
          console.log(`[Auto-detect] Initializing Agent with model: ${agentCapableModelName}`);
          const agentLLMInstance = new providerEntry.model({
            temperature: 0.7,
            streaming: true,
            ...providerEntry.config,
            model: providerEntry.config.model || agentCapableModelName,
          }) as BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;

          // Create tools
          const tools: Tool[] = [
            new TavilySearchResults({ maxResults: 5, apiKey: process.env.TAVILY_API_KEY }),
          ];

          // Use locally defined prompt
          const agentPrompt = ChatPromptTemplate.fromMessages([
            ["system", "You are a helpful AI assistant. You have access to tools to help answer questions. Use them when necessary to provide accurate and up-to-date information."],
            new MessagesPlaceholder("chat_history"),
            ["human", "{input}"],
            new MessagesPlaceholder("agent_scratchpad"),
          ]);

          const memory = new BufferMemory({
            memoryKey: "chat_history",
            returnMessages: true,
          });

          // Using 'openai-functions' agent type, which is common and works with many models that support tool calling.
          const agentExecutor = await initializeAgentExecutorWithOptions(tools, agentLLMInstance, {
            agentType: "openai-functions", 
            memory,
            returnIntermediateSteps: true,
            agentArgs: {
              prefix: `Do your best to answer the questions. Feel free to use any tools available to look up relevant information, only if necessary.`,
            },
          });

          // AgentExecutor itself handles messages, so we can pipe it.
          const agentChain = RunnableSequence.from([
            {
              input: (i: { messages: BaseMessage[] }) => {
                const lastMessage = i.messages[i.messages.length - 1];
                if (lastMessage._getType() === "human") {
                  if (Array.isArray(lastMessage.content)) {
                    const textPart = lastMessage.content.find((part) => typeof part === 'object' && part !== null && part.type === 'text') as { text: string };
                    return textPart ? textPart.text : "";
                  }
                  return lastMessage.content as string;
                }
                return ""; 
              },
              chat_history: (i: { messages: BaseMessage[] }) => i.messages.slice(0, -1),
            },
            agentExecutor,
            new StringOutputParser(), 
          ]);

          console.log(`[Auto-detect] Successfully initialized Agent Chain with model: ${agentCapableModelName}`);
          return { llmInstance: agentLLMInstance, chain: agentChain };

        } catch (agentError: any) { 
          console.warn(`[Auto-detect] Agent initialization failed for ${agentCapableModelName}: ${agentError.message}. Falling back to simple model.`);
        }
      } else {
        console.log(`[Auto-detect] Agent model ${agentCapableModelName} selected, but its API key/config is missing.`);
      }
    } else {
      if (!process.env.TAVILY_API_KEY) console.log("[Auto-detect] Agent model selected, but TAVILY_API_KEY is missing.");
      else console.log("[Auto-detect] No agent-capable model found with available API key.");
    }

    // 3. Fallback to simple reasoning models
    console.log("[Auto-detect] Checking for reasoning models (non-agent).");
    const reasoningModelName = Object.keys(MODEL_PROVIDERS).find(name =>
      MODEL_PROVIDERS[name].capabilities.reasoning
    );

    if (reasoningModelName) {
      console.log(`[Auto-detect] Reasoning model ${reasoningModelName} identified.`);
      const providerEntry = MODEL_PROVIDERS[reasoningModelName];
      let apiKeyConfigured = false;
      if (providerEntry.type === 'openai_compatible' || providerEntry.type === 'deepseek' || providerEntry.type === 'google_gemini') {
         apiKeyConfigured = !!providerEntry.config.apiKey;
      }
      // Add other checks for different provider types if needed

      if (apiKeyConfigured) {
        try {
          console.log(`[Auto-detect] Using reasoning model: ${reasoningModelName}`);
          const llmInstance = new providerEntry.model({
            temperature: 0.7,
            streaming: true,
            ...providerEntry.config,
            model: providerEntry.config.model || reasoningModelName,
          }) as BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>;

          const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
          const chain = prompt.pipe(llmInstance).pipe(new StringOutputParser());
          console.log(`[Auto-detect] Successfully created chain for reasoning model: ${reasoningModelName}`);
          return { llmInstance, chain };
        } catch (error: any) { 
          console.warn(`[Auto-detect] Reasoning model ${reasoningModelName} initialization failed: ${error.message}`);
        }
      } else {
        console.log(`[Auto-detect] Reasoning model ${reasoningModelName} selected, but its API key/config is missing.`);
      }
    } else {
      console.log("[Auto-detect] No reasoning model found with available API key.");
    }

    // 4. Final fallback to any available simple model
    console.log("[Auto-detect] All specific detections failed or models misconfigured. Falling back to a generally available simple model.");
    const fallbackModel = createFallbackModel(); // This function already handles API key checks and throws if none found.
    const simplePrompt = ChatPromptTemplate.fromMessages(formattedMessages);
    const simpleChain = simplePrompt.pipe(fallbackModel).pipe(new StringOutputParser());
    console.log("[Auto-detect] Successfully created chain for fallback model.");
    return { llmInstance: fallbackModel, chain: simpleChain };

  } catch (error: any) { // Catch-all for any unforeseen errors during model/chain determination
    console.error("[Auto-detect] An unexpected error occurred during model/chain determination:", error);
    console.error('Error stack:', error.stack);
    
    console.warn("[Auto-detect] All model initialization attempts failed, using a most basic fallback.");
    
    const basicFallback = createFallbackModel(); // This will throw if no keys are set at all
    const basicPrompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful AI assistant."],
      ["human", "{input}"] 
    ]);
    const basicChain = basicPrompt.pipe(basicFallback).pipe(new StringOutputParser());
    return { llmInstance: basicFallback, chain: basicChain };
  }
}

export async function POST(req: NextRequest) {
  console.log('[API] POST request received.');
  try {
    const body = await req.json();
    const messages = body.messages ?? [];

    if (!messages.length) {
      console.error('[API] Error: No messages provided in request body.');
      return new Response(
        JSON.stringify({ error: "No messages provided." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if at least one API key is available across all providers
    const isAnyApiKeyPresent = 
      !!process.env.OPENAI_API_KEY || 
      !!process.env.NEKO_API_KEY || 
      !!process.env.O3_API_KEY || 
      !!process.env.OPENROUTER_API_KEY || 
      !!process.env.DEEPSEEK_API_KEY || 
      !!process.env.DASHSCOPE_API_KEY || 
      !!process.env.CLOUDFLARE_API_TOKEN || 
      (!!process.env.TENCENT_HUNYUAN_SECRET_ID && !!process.env.TENCENT_HUNYUAN_SECRET_KEY) ||
      !!process.env.GOOGLE_API_KEY;
    
    if (!isAnyApiKeyPresent) {
      console.error('API Error: No API keys found in environment variables. Please configure keys for supported providers.');
      return new Response(
        JSON.stringify({ error: "No API keys configured for any supported AI provider. Please check your environment variables." }), 
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log('[API] Formatting messages...');
    const formattedMessages = messages.map(formatMessage);
    console.log(`[API] Formatted ${formattedMessages.length} messages.`);

    console.log('[API] Determining model and chain...');
    const { llmInstance, chain } = await determineModelAndChain(formattedMessages);

    if (!llmInstance || !chain) {
      console.error('[API] Error: Failed to create model instance or chain.');
      return new Response(
        JSON.stringify({ error: "Failed to initialize AI model" }), 
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Log the selected model if possible
    const modelName = llmInstance.modelName || (llmInstance as any).model || 'Unknown Model';
    console.log(`[API] Model selected for processing: ${modelName}`);

    console.log('[API] Attempting to stream response...');
    try {
      // Pass the formattedMessages directly to the stream function
      const stream = await chain.stream({ messages: formattedMessages });
      console.log('[API] Stream initialized successfully. Returning StreamingTextResponse.');
      return new StreamingTextResponse(stream);

    } catch (streamError: any) {
      console.error("[API] Streaming failed:", streamError);
      console.error('Streaming error stack:', streamError.stack);
      
      // If streaming fails, try a non-streaming invoke.
      console.log("[API] Streaming failed, attempting non-streaming invoke...");
      try {
        // For chains built with prompt.pipe(model), invoke expects an object that can be passed to the prompt.
        // In our case, `ChatPromptTemplate.fromMessages(formattedMessages)` creates a chain that implicitly expects `messages`.
        const result = await chain.invoke({ messages: formattedMessages }); 
        console.log('[API] Non-streaming invoke succeeded.');
        
        return new Response(result, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      } catch (invokeError: any) {
        console.error("[API] Non-streaming invoke also failed:", invokeError);
        console.error('Invoke error stack:', invokeError.stack);
        
        // If both stream and invoke fail, return a detailed error.
        return new Response(
          JSON.stringify({
            error: "AI processing failed. Both streaming and invoking returned errors.",
            details: {
              streamingError: streamError.message,
              invokeError: invokeError.message,
              invokeStack: invokeError.stack,
              streamingStack: streamError.stack // Include streaming error stack for completeness
            }
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

  } catch (error: any) { // Catch-all for errors during request parsing, message formatting, etc.
    console.error('API Error - Request processing failed:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error during request processing',
        message: error.message,
        stack: error.stack,
        name: error.name
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

