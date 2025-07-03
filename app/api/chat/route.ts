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
    config: { apiKey: process.env.NEKO_API_KEY, baseURL: process.env.NEKO_BASE_URL },
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
  'qwen/qwen3-8b:free': {
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
  // Prioritize OpenAI if available, then DeepSeek, then Google
  if (process.env.OPENAI_API_KEY) {
    console.log("Using OpenAI as fallback model");
    return new ChatOpenAI({
      temperature: 0.7,
      streaming: true,
      apiKey: process.env.OPENAI_API_KEY,
      // Prefer a capable model like gpt-4o-mini if available, otherwise a basic one.
      model: process.env.NEKO_BASE_URL ? 'gpt-4o-all' : 'gpt-4o-mini', // Assuming NEKO_BASE_URL implies Neko/O3, use gpt-4o-all
      // Correctly configure baseURL via configuration object
      configuration: {
        baseURL: process.env.NEKO_BASE_URL || process.env.OPENAI_BASE_URL,
      },
    });
  } else if (process.env.DEEPSEEK_API_KEY) {
    console.log("Using DeepSeek as fallback model");
    return new ChatDeepSeek({
      temperature: 0.7,
      streaming: true,
      configuration: {
        apiKey: process.env.DEEPSEEK_API_KEY,
      },
      model: 'deepseek-chat', // Or 'deepseek-reasoner' if preferred for fallback
    });
  } else if (process.env.GOOGLE_API_KEY) {
    console.log("Using Google Gemini as fallback model");
    return new ChatGoogleGenerativeAI({
      temperature: 0.7,
      streaming: true,
      apiKey: process.env.GOOGLE_API_KEY,
      model: 'gemini-pro', // Or 'gemini-flash'
    });
  }
  // Add other fallbacks if necessary (e.g., Cloudflare, Tencent)
  
  throw new Error("No available API keys found for fallback model. Please configure OPENAI_API_KEY, DEEPSEEK_API_KEY, or GOOGLE_API_KEY.");
}

// Core logic: auto-detect and return the appropriate LLM instance and LangChain Chain
async function determineModelAndChain(
  formattedMessages: BaseMessage[],
): Promise<{ llmInstance: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> | BaseLLM<BaseLLMCallOptions>, chain: Runnable<any, string> }> {

  try {
    // 1. Prioritize vision models if image content is present
    const hasImage = containsImage(formattedMessages);
    if (hasImage) {
      const visionModelName = Object.keys(MODEL_PROVIDERS).find(name =>
        MODEL_PROVIDERS[name].capabilities.vision
      );

      if (visionModelName) {
        const providerEntry = MODEL_PROVIDERS[visionModelName];
        // Check if the required API key for this vision model is available
        let apiKeyEnvVar: string | undefined;
        // This logic needs to be robust for all potential API key env var names
        if (providerEntry.config.apiKey) apiKeyEnvVar = providerEntry.config.apiKey.replace('process.env.', '');
        else if (providerEntry.config.deepseekApiKey) apiKeyEnvVar = providerEntry.config.deepseekApiKey.replace('process.env.', '');
        else if (providerEntry.config.secretId && providerEntry.config.secretKey) apiKeyEnvVar = "TENCENT_HUNYUAN_SECRET_KEY"; // Placeholder logic
        else if (providerEntry.config.cloudflareAccountId && providerEntry.config.cloudflareApiToken) apiKeyEnvVar = "CLOUDFLARE_API_TOKEN"; // Placeholder logic
        // Add more checks for other API key types if needed

        const isApiKeyAvailable = apiKeyEnvVar ? !!process.env[apiKeyEnvVar] : false;

        if (isApiKeyAvailable) {
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
          return { llmInstance, chain };
        } else {
          console.log(`[Auto-detect] Vision model ${visionModelName} selected, but API key is missing.`);
        }
      } else {
        console.log("[Auto-detect] Image input detected, but no vision model found with available API key.");
      }
    }

    // 2. Attempt to use Agent for reasoning and tool calling
    const agentCapableModelName = Object.keys(MODEL_PROVIDERS).find(name => {
      const provider = MODEL_PROVIDERS[name];
      // Prioritize models that can handle tool_calling and reasoning
      return provider.capabilities.reasoning && provider.capabilities.tool_calling;
    });

    // Check if a suitable agent model and TAVILY_API_KEY are available
    if (agentCapableModelName && process.env.TAVILY_API_KEY) {
      const providerEntry = MODEL_PROVIDERS[agentCapableModelName];
      let apiKeyEnvVar: string | undefined;
      if (providerEntry.config.apiKey) apiKeyEnvVar = providerEntry.config.apiKey.replace('process.env.', '');
      else if (providerEntry.config.deepseekApiKey) apiKeyEnvVar = providerEntry.config.deepseekApiKey.replace('process.env.', '');
      // Add more checks for other API key types if needed

      const isApiKeyAvailable = apiKeyEnvVar ? !!process.env[apiKeyEnvVar] : false;

      if (isApiKeyAvailable) {
        try {
          console.log(`[Auto-detect] Attempting to initialize Agent with model: ${agentCapableModelName}`);
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

          // Use locally defined prompt, avoid fetching from hub
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

          const agentExecutor = await initializeAgentExecutorWithOptions(tools, agentLLMInstance, {
            agentType: "openai-functions", // Assumes the model supports OpenAI's function calling format
            memory,
            returnIntermediateSteps: true,
            agentArgs: {
              prefix: `Do your best to answer the questions. Feel free to use any tools available to look up relevant information, only if necessary.`,
            },
          });

          // AgentExecutor itself handles messages, so we can pipe it.
          // The input to agentExecutor should be structured correctly by the RunnableSequence.
          const agentChain = RunnableSequence.from([
            {
              // Map the incoming messages to the agent's expected input format
              input: (i: { messages: BaseMessage[] }) => {
                // Get the last human message content
                const lastMessage = i.messages[i.messages.length - 1];
                if (lastMessage._getType() === "human") {
                  if (Array.isArray(lastMessage.content)) {
                    // Extract text part if content is complex (with images, etc.)
                    const textPart = lastMessage.content.find((part) => typeof part === 'object' && part !== null && part.type === 'text') as { text: string };
                    return textPart ? textPart.text : "";
                  }
                  return lastMessage.content as string; // Plain string content
                }
                return ""; // Should not happen if last message is always human
              },
              chat_history: (i: { messages: BaseMessage[] }) => i.messages.slice(0, -1), // All messages except the last one for history
            },
            agentExecutor,
            new StringOutputParser(), // Parse the final output from the agent
          ]);

          console.log(`[Auto-detect] Successfully initialized Agent Chain with model: ${agentCapableModelName}`);
          // AgentExecutor itself needs the LLM, so return it.
          return { llmInstance: agentLLMInstance, chain: agentChain };

        } catch (agentError: any) { // Use 'any' or 'Error' for type safety
          console.warn(`[Auto-detect] Agent initialization failed: ${agentError.message}. Falling back to simple model.`);
          // If agent initialization fails, we will fall through to the next logic.
        }
      } else {
        console.log(`[Auto-detect] Agent model ${agentCapableModelName} selected, but API key is missing.`);
      }
    } else {
      if (!process.env.TAVILY_API_KEY) console.log("[Auto-detect] Agent model selected, but TAVILY_API_KEY is missing.");
      else console.log("[Auto-detect] No agent-capable model found with available API key.");
    }

    // 3. Fallback to simple reasoning models
    const reasoningModelName = Object.keys(MODEL_PROVIDERS).find(name =>
      MODEL_PROVIDERS[name].capabilities.reasoning
    );

    if (reasoningModelName) {
      const providerEntry = MODEL_PROVIDERS[reasoningModelName];
      let apiKeyEnvVar: string | undefined;
      if (providerEntry.config.apiKey) apiKeyEnvVar = providerEntry.config.apiKey.replace('process.env.', '');
      // Add other API key checks if needed for this provider

      const isApiKeyAvailable = apiKeyEnvVar ? !!process.env[apiKeyEnvVar] : false;

      if (isApiKeyAvailable) {
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
          return { llmInstance, chain };
        } catch (error: any) { // Use 'any' or 'Error' for type safety
          console.warn(`[Auto-detect] Reasoning model ${reasoningModelName} initialization failed: ${error.message}`);
          // Fall through if this model also fails to initialize
        }
      } else {
        console.log(`[Auto-detect] Reasoning model ${reasoningModelName} selected, but API key is missing.`);
      }
    } else {
      console.log("[Auto-detect] No reasoning model found with available API key.");
    }

    // 4. Final fallback to any available simple model
    console.log("[Auto-detect] Falling back to a generally available simple model.");
    const fallbackModel = createFallbackModel(); // This function already handles API key checks and throws if none found.
    const simplePrompt = ChatPromptTemplate.fromMessages(formattedMessages);
    const simpleChain = simplePrompt.pipe(fallbackModel).pipe(new StringOutputParser());
    return { llmInstance: fallbackModel, chain: simpleChain };

  } catch (error: any) { // Catch-all for any unforeseen errors during model/chain determination
    console.error("[Auto-detect] An unexpected error occurred during model/chain determination:", error);
    
    // If all attempts fail, provide a very basic fallback.
    // This might not handle complex messages like images.
    console.warn("[Auto-detect] All model initialization attempts failed, using a most basic fallback.");
    
    const basicFallback = createFallbackModel(); // This will throw if no keys are set at all
    const basicPrompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful AI assistant."],
      // For the absolute basic fallback, assume text-only input
      ["human", "{input}"] 
    ]);
    const basicChain = basicPrompt.pipe(basicFallback).pipe(new StringOutputParser());
    return { llmInstance: basicFallback, chain: basicChain };
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('API request received');
    
    const body = await req.json();
    const messages = body.messages ?? [];

    if (!messages.length) {
      console.error('No messages provided');
      return new Response("No messages provided", { status: 400 });
    }

    // Check if at least one API key is available across all providers
    const allApiKeysPresent = 
      !!process.env.OPENAI_API_KEY || 
      !!process.env.DEEPSEEK_API_KEY || 
      !!process.env.GOOGLE_API_KEY ||
      !!process.env.NEKO_API_KEY || 
      !!process.env.O3_API_KEY || 
      !!process.env.OPENROUTER_API_KEY || 
      !!process.env.DASHSCOPE_API_KEY || 
      !!process.env.CLOUDFLARE_API_TOKEN || 
      (!!process.env.TENCENT_HUNYUAN_SECRET_ID && !!process.env.TENCENT_HUNYUAN_SECRET_KEY);
    
    if (!allApiKeysPresent) {
      console.error('No API keys found in environment variables. Please configure keys for supported providers.');
      return new Response(
        JSON.stringify({ error: "No API keys configured for any supported AI provider." }), 
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log('Formatting messages...');
    const formattedMessages = messages.map(formatMessage);

    console.log('Determining model and chain...');
    // The determineModelAndChain function now correctly uses the formattedMessages directly.
    const { llmInstance, chain } = await determineModelAndChain(formattedMessages);

    if (!llmInstance || !chain) {
      console.error('Failed to create model instance or chain');
      return new Response(
        JSON.stringify({ error: "Failed to initialize AI model" }), 
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if the model instance supports streaming. Some models might only support invoke.
    // LangChain's BaseChatModel doesn't have a 'stream' method directly, but its Runnable adapter does.
    // A more reliable check is to see if the chain can be streamed.
    // However, for simpler cases, we might assume streaming if 'streaming: true' was set.
    // A robust check would be more complex, checking specific model implementations.
    // For now, let's assume 'chain.stream' will work if the model was configured for streaming.

    console.log('Starting stream...');
    try {
      const stream = await chain.stream({
        messages: formattedMessages, // Pass the correctly formatted messages
      });

      return new StreamingTextResponse(stream);

    } catch (streamError: any) {
      console.error("Streaming failed, attempting to invoke:", streamError);
      // If streaming fails, try a non-streaming invoke.
      try {
        // The input to chain.invoke might need to match the expected input structure.
        // For a typical chain like prompt.pipe(model).pipe(parser), it's often { input: ..., chat_history: ... } or just { messages: ... }
        // Since our chain is `prompt.pipe(llmInstance).pipe(parser)`, it expects the input format matching the prompt.
        // `ChatPromptTemplate.fromMessages(formattedMessages)` doesn't explicitly define input variables like `input` or `chat_history`.
        // However, `agentExecutor` in the AgentChain part does define `input` and `chat_history`.
        // Let's assume `chain.invoke` can handle an object with `messages` if the chain was built that way.
        // For chains constructed with fromMessages, it usually expects the variable name used in the prompt, or just implicitly uses the messages.
        // The most common pattern for prompt.pipe(model) is expecting an object that gets passed to the prompt.
        // Since `fromMessages` takes the full message array, the chain might expect `{ messages: formattedMessages }` or similar.
        // If the chain was built using `messages:formattedMessages`, the invoke might need a compatible object.
        // Let's try passing the formattedMessages directly if it's a simple chain.
        
        const result = await chain.invoke({ messages: formattedMessages });

        // If invoke succeeds, return it as a plain text response.
        return new Response(result, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      } catch (invokeError: any) {
        console.error("Invoke also failed:", invokeError);
        // If both stream and invoke fail, return an error.
        return new Response(
          JSON.stringify({
            error: `AI processing failed. Streaming error: ${streamError.message}, Invoke error: ${invokeError.message}`,
            details: {
              streamError: streamError.message,
              invokeError: invokeError.message,
              invokeStack: invokeError.stack,
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
} // <-- Semicolon added here to ensure statement termination.

