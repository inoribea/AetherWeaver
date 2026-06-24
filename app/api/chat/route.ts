import { NextRequest } from "next/server";
import { HumanMessage } from "@langchain/core/messages";

import { OptimizedEnhancedRouter } from "../../components/routing/optimizedEnhancedRouter";
import { createBasicChain } from "../../../src/chains/basic-chain";
import { createRAGChain } from "../../../src/chains/rag-chain";
import { createVisionChain } from "../../../src/chains/vision-chain";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

import { SmartRouterComponent } from "../../components/routing/smart-router";
import { intelligentRouter } from '@/utils/unified-router';
import { ModelManager } from "../../admin/models/ModelManager";
import { getDefaultOpenAICompatProvider, resolveProviderFromModelConfig } from "@/utils/openaiProvider";
import { createChatModelInstance } from "@/utils/chatModelFactory";
import modelsConfig from "../../../models-config.json"; // 导入 models-config.json

/**
 * 请求体缓存包装函数，保证Body只读取一次
 */
async function cacheRequestBody(req: NextRequest) {
  if ((req as any)._cachedBody) {
    return (req as any)._cachedBody;
  }
  const body = await req.json();
  (req as any)._cachedBody = body;
  return body;
}

function isValidMessage(message: any): message is string | { content: string } {
  if (typeof message === "string" && message.trim().length > 0) {
    return true;
  }
  if (
    message &&
    typeof message === "object" &&
    typeof message.content === "string" &&
    message.content.trim().length > 0
  ) {
    return true;
  }
  return false;
}

function isValidMessagesArray(messages: any): messages is Array<string | { content: string }> {
  return (
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.every(isValidMessage)
  );
}

// 只声明一次全局备用 Base URL（若未从模型或提供商解析到 Base URL 时使用）
const fallbackOpenAIBaseUrl = process.env.OPENAI_BASE_URL;

/**
 * 创建 ChatOpenAI 实例，支持自定义 OpenAI Base URL
 * @param apiKey OpenAI API Key
 * @param model 模型名称
 */
function createChatOpenAIInstance(apiKey: string, model: string, baseURL?: string) {
  const finalApiKey = apiKey;
  const finalBaseUrl = baseURL ?? fallbackOpenAIBaseUrl;

  console.log(`[ChatOpenAI] Initializing with:`);
  console.log(`  - Model: ${model || "gpt-5"}`);
  console.log(`  - API Key Set: ${!!finalApiKey}`);
  console.log(`  - Base URL: ${finalBaseUrl || 'Default (OpenAI Official)'}`);

  return new ChatOpenAI({
    model: model || "gpt-5",
    temperature: 0,
    apiKey: finalApiKey,
    ...(finalBaseUrl ? { configuration: { baseURL: finalBaseUrl } } : {}),
  });
}
/**
 * 从结果中提取文本内容，兼容字符串、对象或数组
 * @param result 调用链返回结果
 * @returns 文本字符串
 */
function extractTextFromResult(result: any): string {
  if (!result) return "";
  if (typeof result === "string") return result;
  if (typeof result === "object") {
    if ("content" in result && typeof result.content === "string") {
      return result.content;
    }
    if (Array.isArray(result)) {
      return result.map(item => typeof item === "string" ? item : JSON.stringify(item)).join("\n");
    }
    return JSON.stringify(result);
  }
  return String(result);
}

/**
 * 美化路由名称为带 Unicode 符号的字符串
 * @param route route字符串
 * @returns 美化后的字符串
 */
function beautifyRouteName(route: string): string {

  switch (route) {
    case "basic":
      return "🟢 Basic";
    case "enhanced_tasks":
      return "✨ Enhanced";
    case "rag":
      return "📚 RAG";
    case "agent":
      return "🤖 Agent";
    case "tavily":
      return "🔮 Tavily";
    case "webbrowser":
      return "🌐 WebBrowser";
    case "vision_tasks":
      return "👁️ Vision";
    case "reasoning_tasks":
      return "🧠 Reasoning";
    case "chinese_tasks":
      return "🇨🇳 Chinese";
    case "search_tasks":
      return "🔍 Search";
    case "code_tasks":
      return "💻 Code";
    case "creative_tasks":
      return "✍️ Creative";
    case "structured_output":
      return "📊 Structured";
    default:
      return "❓ Unknown";
  }
}

/**
 * 美化置信度为带进度条的字符串，如 [███████░░░] 70%
 * @param confidence 置信度数字（0-1）
 * @param length 进度条长度，默认10
 * @returns 美化后的字符串
 */
function beautifyConfidence(confidence: number, length = 10): string {
  const filledBlocks = Math.round(confidence * length);
  const emptyBlocks = length - filledBlocks;
  const bar = "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);
  const percent = Math.round(confidence * 100);
  return `[${bar}] ${percent}%`;
}

/**
 * 用分隔线和美化信息构造新的 response 字符串
 */
function formatResponseMainContent(
  mainContent: string,
  route: string,
  confidence: number,
  model: string | undefined
) {
  const sep = "───────────────";
  const beautifiedRoute = beautifyRouteName(route);
  const beautifiedConfidence = beautifyConfidence(confidence);
  const modelName = model ?? "unknown";

  return `${sep}
路由: ${beautifiedRoute}
置信度: ${beautifiedConfidence}
模型: ${modelName}
${sep}

${mainContent}
`;
}

export async function POST(req: NextRequest) {
  try {
    // 使用缓存包装函数读取请求体
    const body = await cacheRequestBody(req);
    console.log("Received request body in /api/chat POST:", JSON.stringify(body));

    const { messages, message, sessionId } = body;

    let safeMessageContent = "";

    if (messages !== undefined) {
      if (!isValidMessagesArray(messages)) {
        console.error("Invalid messages format in /api/chat POST:", messages);
        return new Response(
          JSON.stringify({
            error: "Invalid messages format",
            message:
              "Messages must be a non-empty array of non-empty strings or objects with a non-empty content string",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
      // 这里取 messages 数组最后一个消息内容作为后续处理
      const lastMessage = messages[messages.length - 1];
      safeMessageContent =
        typeof lastMessage === "string" ? lastMessage.trim() : lastMessage.content.trim();
    } else if (message !== undefined) {
      if (!isValidMessage(message)) {
        console.error("Invalid message format in /api/chat POST:", message);
        return new Response(
          JSON.stringify({
            error: "Invalid message format",
            message:
              "Message must be a non-empty string or an object with a non-empty content string",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
      safeMessageContent =
        typeof message === "string" ? message.trim() : message.content.trim();
    } else {
      console.error("No message or messages field in /api/chat POST body");
      return new Response(
        JSON.stringify({
          error: "Message field missing",
          message: "Request body must include either messages array or message field",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // 智能路由决策
    // Use IntelligentRouterUnified for model selection (Trinity Task 0)
    const routingRequest = {
      messages: [{ role: 'user', content: safeMessageContent }],
    };
    const routingResult = await intelligentRouter.route(routingRequest);
    console.log("Routing result:", JSON.stringify(routingResult, null, 2));

    // Determine route type from model capabilities (for chain selection)
    const selectedModelConfig = modelsConfig.models[routingResult.selectedModel as keyof typeof modelsConfig.models];
    const capabilities = selectedModelConfig?.capabilities || {};

    // 模型选择
    const modelManager = await ModelManager.getCurrentModel();
    let selectedModelName: string = modelManager.model ?? "gpt-5";
    let selectedApiKey: string | undefined = modelManager.apiKey;
    let selectedBaseURL: string | undefined = undefined;
    let selectedModelType: string = 'openai_compatible';

    // Use the model selected by IntelligentRouterUnified directly (Trinity Task 0)
    let detectedRoute = 'basic';
    if (selectedModelConfig) {
      selectedModelName = selectedModelConfig.config.model;
      selectedModelType = selectedModelConfig.type;
      // Determine route type from model capabilities for chain selection
      // Map first available capability to route type
      const capToRoute: Record<string, string> = {
        vision: 'vision_tasks',
        reasoning: 'reasoning_tasks',
        chinese: 'chinese_tasks',
        code_generation: 'code_tasks',
        creative_writing: 'creative_tasks',
        search: 'search_tasks',
        web_search: 'search_tasks',
        structured_output: 'structured_output',
        mathematical_computation: 'reasoning_tasks',
      };
      for (const [cap, route] of Object.entries(capToRoute)) {
        if (capabilities[cap as keyof typeof capabilities] === true) {
          detectedRoute = route;
          break;
        }
      }

      if (selectedModelConfig.type === "openai_compatible" || selectedModelConfig.type === "o3_provider") {
        const provider = resolveProviderFromModelConfig(selectedModelConfig);
        if (provider?.apiKey) selectedApiKey = provider.apiKey;
        if (provider?.baseURL) selectedBaseURL = provider.baseURL;
      } else if (selectedModelConfig.type === "deepseek") {
        selectedApiKey = process.env.DEEPSEEK_API_KEY as string;
      } else if (selectedModelConfig.type === "alibaba_tongyi") {
        selectedApiKey = process.env.DASHSCOPE_API_KEY as string;
      } else if (selectedModelConfig.type === "tencent_hunyuan") {
        selectedApiKey = process.env.TENCENT_HUNYUAN_SECRET_KEY as string;
      } else if (selectedModelConfig.type === "google_gemini") {
        selectedApiKey = process.env.GOOGLE_API_KEY as string;
      } else if (selectedModelConfig.type === "anthropic") {
        selectedApiKey = process.env.ANTHROPIC_API_KEY as string;
      } else if (selectedModelConfig.type === "cohere") {
        selectedApiKey = process.env.COHERE_API_KEY as string;
      }
    }

    // 临时诊断日志（只记录是否存在，不打印密钥值）
    console.log(`Diagnostics: selectedModelName=${selectedModelName}, selectedApiKeySet=${!!selectedApiKey}, baseURL=${selectedBaseURL || fallbackOpenAIBaseUrl || 'Default(OpenAI)'}`);
    const llm = createChatModelInstance(
      selectedModelType,
      selectedApiKey || "",
      selectedModelName,
      selectedBaseURL,
    );

    const embeddings = new OpenAIEmbeddings({
      apiKey: selectedApiKey,
      ...(selectedBaseURL ? { configuration: { baseURL: selectedBaseURL } } : fallbackOpenAIBaseUrl ? { configuration: { baseURL: fallbackOpenAIBaseUrl } } : {}),
    });

    // 初始化工具（这里省略）

    // 选择对应的链或工具
    const route = detectedRoute as
      | "basic"
      | "enhanced_tasks"
      | "rag"
      | "agent"
      | "tavily"
      | "webbrowser"
      | "vision_tasks"
      | "reasoning_tasks"
      | "chinese_tasks"
      | "search_tasks"
      | "code_tasks"
      | "creative_tasks"
      | "structured_output";

    let result;

    switch (route) {
      case "basic":
      case "agent":
      case "vision_tasks": {
        const chain = createVisionChain(llm);
        result = await chain.invoke({ input: safeMessageContent });
        break;
      }
      case "reasoning_tasks":
      case "chinese_tasks":
      case "code_tasks":
      case "creative_tasks":
      case "structured_output": {
        const chain = createBasicChain(llm);
        result = await chain.invoke({ input: safeMessageContent });
        break;
      }
      case "enhanced_tasks": {
        // 这里可以实现 enhanced 路由的增强逻辑
        // 例如，可以调用 OptimizedEnhancedRouter 进行更复杂的路由决策，
        // 或者调用一个专门的 enhanced chain
        result = { content: `您已进入增强模式。您的输入是: ${safeMessageContent}` };
        break;
      }
      case "rag":
      case "search_tasks": {
        const chain = createRAGChain(llm);
        result = await chain.invoke({ input: safeMessageContent, context_documents: [] });
        break;
      }
      // 其他情况省略
      default: {
        const chain = createBasicChain(llm);
        result = await chain.invoke({ input: safeMessageContent });
        break;
      }
    }

    return new Response(
      JSON.stringify({
        response: extractTextFromResult(result),
        routing: {
          route: beautifyRouteName(detectedRoute),
          confidence: beautifyConfidence(routingResult.confidence ?? 1),
          model: selectedModelName, // 使用实际选择的模型名称
        },
        metadata: {
          langchainjs_compatible: true,
          vercel_ready: true,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("POST /api/chat error:", error);
    return new Response(
      JSON.stringify({
        error: "Service temporarily unavailable",
        message: "Please try again later",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
