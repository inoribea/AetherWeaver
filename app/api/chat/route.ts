import { NextRequest } from "next/server";
import { HumanMessage } from "@langchain/core/messages";

import { OptimizedEnhancedRouter } from "../../components/routing/optimizedEnhancedRouter";
import { createBasicChain } from "../../../src/chains/basic-chain";
import { createRAGChain } from "../../../src/chains/rag-chain";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

import { SmartRouterComponent } from "../../components/routing/smart-router";
import { ModelManager } from "../../admin/models/ModelManager";

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

// 只声明一次环境变量与函数，避免重复声明错误
const openAIApiBaseUrl = process.env.OPENAI_BASE_URL;

/**
 * 创建 ChatOpenAI 实例，支持自定义 OpenAI Base URL
 * @param apiKey OpenAI API Key
 * @param model 模型名称
 */
function createChatOpenAIInstance(apiKey: string, model: string) {
  return new ChatOpenAI({
    model: model || "gpt-4o",
    temperature: 0,
    openAIApiKey: apiKey,
    ...(openAIApiBaseUrl ? { configuration: { baseURL: openAIApiBaseUrl } } : {}),
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
    // 如果 result 有 content 属性，优先取 content
    if ("content" in result && typeof result.content === "string") {
      return result.content;
    }
    // 如果是数组，拼接其字符串表示
    if (Array.isArray(result)) {
      return result.map(item => typeof item === "string" ? item : JSON.stringify(item)).join("\n");
    }
    // 否则转成 JSON 字符串
    return JSON.stringify(result);
  }
  // 其他类型转字符串
  return String(result);
}

/**
 * 美化路由名称为带 Unicode 符号的字符串
 * @param route route字符串
 * @returns 美化后的字符串
 */
function beautifyRouteName(route: string): string {
/**
 * 从结果中提取文本内容，兼容字符串、对象或数组
 * @param result 调用链返回结果
 * @returns 文本字符串
 */
function extractTextFromResult(result: any): string {
  if (!result) return "";
  if (typeof result === "string") return result;
  if (typeof result === "object") {
    // 如果 result 有 content 属性，优先取 content
    if ("content" in result && typeof result.content === "string") {
      return result.content;
    }
    // 如果是数组，拼接其字符串表示
    if (Array.isArray(result)) {
      return result.map(item => typeof item === "string" ? item : JSON.stringify(item)).join("\n");
    }
    // 否则转成 JSON 字符串
    return JSON.stringify(result);
  }
  // 其他类型转字符串
  return String(result);
}
  switch (route) {
    case "basic":
      return "🟢 Basic";
    case "enhanced":
      return "✨ Enhanced";
    case "rag":
      return "📚 RAG";
    case "agent":
      return "🤖 Agent";
    case "tavily":
      return "🔮 Tavily";
    case "webbrowser":
      return "🌐 WebBrowser";
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
      // 这里取 messages 数组第一个消息内容作为后续处理
      const firstMessage = messages[0];
      safeMessageContent =
        typeof firstMessage === "string" ? firstMessage.trim() : firstMessage.content.trim();
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
    const router = new SmartRouterComponent({
      analysis_mode: "hybrid",
      confidence_threshold: 0.6,
    });

    const routingResult = await router.invoke(new HumanMessage(safeMessageContent));

    // 模型选择
    const modelManager = await ModelManager.getCurrentModel();

    // 创建 ChatOpenAI 实例，支持环境变量 OPENAI_BASE_URL 自定义请求URL
    const apiKey = modelManager.apiKey ?? "";
    const model = modelManager.model ?? "gpt-4o";
    const llm = createChatOpenAIInstance(apiKey, model);

    const embeddings = new OpenAIEmbeddings();

    // 初始化工具（这里省略）

    // 选择对应的链或工具
    const route = routingResult.route as
      | "basic"
      | "enhanced"
      | "rag"
      | "agent"
      | "tavily"
      | "webbrowser";

    let result;

    switch (route) {
      case "basic":
      case "enhanced":
      case "agent": {
        const chain = createBasicChain();
        result = await chain.invoke({ input: safeMessageContent });
        break;
      }
      case "rag": {
        const chain = createRAGChain();
        result = await chain.invoke({ input: safeMessageContent, context_documents: [] });
        break;
      }
      // 其他情况省略
      default: {
        const chain = createBasicChain();
        result = await chain.invoke({ input: safeMessageContent });
        break;
      }
    }

    const formattedResponse = formatResponseMainContent(
      extractTextFromResult(result),
      routingResult.route,
      routingResult.confidence ?? 1,
      modelManager.model
    );

    return new Response(
      JSON.stringify({
        response: formattedResponse,
        routing: {
          route: beautifyRouteName(routingResult.route),
          confidence: beautifyConfidence(routingResult.confidence ?? 1),
          model: modelManager.model,
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

