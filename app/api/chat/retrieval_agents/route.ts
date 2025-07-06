import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAlibabaTongyi } from "@langchain/community/chat_models/alibaba_tongyi";
import { ChatTencentHunyuan } from "@langchain/community/chat_models/tencent_hunyuan";
import { createRetrieverTool } from "langchain/tools/retriever";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { Document } from "@langchain/core/documents";
import { BaseRetriever } from "@langchain/core/retrievers";
import { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";
import { BaseChatModel, BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { AIMessageChunk } from "@langchain/core/messages";
import { Tool } from "@langchain/core/tools";

// export const runtime = "edge"; // Commented out to avoid edge runtime issues

const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};

const convertLangChainMessageToVercelMessage = (message: BaseMessage) => {
  if (message._getType() === "human") {
    return { content: message.content, role: "user" };
  } else if (message._getType() === "ai") {
    return {
      content: message.content,
      role: "assistant",
      tool_calls: (message as AIMessage).tool_calls,
    };
  } else {
    return { content: message.content, role: message._getType() };
  }
};

// Helper function to create Alibaba Tongyi model
function createAlibabaTongyiModel(config: {
  temperature?: number;
  model?: string;
  apiKey?: string;
}) {
  return new ChatAlibabaTongyi({
    temperature: config.temperature,
    model: config.model,
    alibabaApiKey: config.apiKey
  });
}

// Helper function to get available model for retrieval agents
function getAvailableRetrievalAgentModel(): BaseChatModel<BaseChatModelCallOptions, AIMessageChunk> {
  // Try models that support tool calling for agents
  if (process.env.OPENAI_API_KEY || process.env.NEKO_API_KEY) {
    return new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.2,
      apiKey: process.env.NEKO_API_KEY || process.env.OPENAI_API_KEY,
      configuration: { baseURL: process.env.NEKO_BASE_URL || process.env.OPENAI_BASE_URL },
    });
  } else if (process.env.TENCENT_HUNYUAN_SECRET_ID && process.env.TENCENT_HUNYUAN_SECRET_KEY) {
    return new ChatTencentHunyuan({
      model: "hunyuan-t1-latest",
      temperature: 0.2,
      tencentSecretId: process.env.TENCENT_HUNYUAN_SECRET_ID,
      tencentSecretKey: process.env.TENCENT_HUNYUAN_SECRET_KEY,
    });
  } else if (process.env.GOOGLE_API_KEY) {
    return new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash-preview-05-20",
      temperature: 0.2,
      apiKey: process.env.GOOGLE_API_KEY,
    });
  } else if (process.env.DASHSCOPE_API_KEY) {
    return createAlibabaTongyiModel({
      model: "qwen-turbo-latest",
      temperature: 0.2,
      apiKey: process.env.DASHSCOPE_API_KEY,
    });
  } else {
    throw new Error("No API keys configured for retrieval agent models. Please set up OpenAI, Tencent Hunyuan, Google, or Alibaba Tongyi API keys.");
  }
}

// Simple in-memory retriever for demo purposes
class SimpleRetriever extends BaseRetriever {
  lc_namespace = ["langchain", "retrievers"];
  private documents: Document[];

  constructor(documents: Document[]) {
    super();
    this.documents = documents;
  }

  async _getRelevantDocuments(
    query: string,
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
    // Simple keyword-based retrieval
    const queryLower = query.toLowerCase();
    const relevantDocs = this.documents.filter(doc => {
      const content = doc.pageContent.toLowerCase();
      const queryWords = queryLower.split(' ');
      return queryWords.some((word: string) => word.length > 2 && content.includes(word));
    });
    
    // Return top 3 most relevant documents, or all if less than 3
    return relevantDocs.slice(0, 3);
  }
}

const AGENT_SYSTEM_TEMPLATE = `You are a stereotypical robot named Robbie and must answer all questions like a stereotypical robot. Use lots of interjections like "BEEP" and "BOOP".

If you don't know how to answer a question, use the available tools to look up relevant information. You should particularly do this for questions about LangChain.`;

/**
 * This handler initializes and calls a tool calling ReAct agent with retrieval capabilities.
 * See the docs for more information:
 *
 * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
 * https://js.langchain.com/docs/use_cases/question_answering/conversational_retrieval_agents
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    /**
     * We represent intermediate steps as system messages for display purposes,
     * but don't want them in the chat history.
     */
    const messages = (body.messages ?? [])
      .filter(
        (message: VercelChatMessage) =>
          message.role === "user" || message.role === "assistant",
      )
      .map(convertVercelMessageToLangChainMessage);
    const returnIntermediateSteps = body.show_intermediate_steps;

    const chatModel = getAvailableRetrievalAgentModel();

    // Sample documents for retrieval
    const sampleDocuments = [
      new Document({
        pageContent: "LangChain is a framework for developing applications powered by language models. BEEP BOOP! It provides tools for prompt management, chains, and agents. Robbie thinks it's very efficient for building AI applications!",
        metadata: { source: "langchain_docs", type: "framework" }
      }),
      new Document({
        pageContent: "Vector databases store high-dimensional vectors and enable similarity search. BEEP! They are essential for RAG (Retrieval-Augmented Generation) applications. Robbie computes that vectors are like organized data storage!",
        metadata: { source: "vector_db_guide", type: "database" }
      }),
      new Document({
        pageContent: "Retrieval-Augmented Generation (RAG) combines retrieval systems with generative models. BOOP BEEP! It provides more accurate and contextual responses by fetching relevant information first. Robbie processes this as optimal information retrieval!",
        metadata: { source: "rag_guide", type: "technique" }
      }),
      new Document({
        pageContent: "Agents in LangChain can use tools to perform actions and make decisions. BEEP BOOP BEEP! They can search the web, perform calculations, and access databases. Robbie computes that agents are like robotic assistants!",
        metadata: { source: "agents_guide", type: "concept" }
      }),
      new Document({
        pageContent: "Robbie is a stereotypical robot who loves helping with AI and machine learning questions. BEEP BOOP! He processes information efficiently and always uses robot interjections. His circuits are optimized for helpful responses!",
        metadata: { source: "robbie_bio", type: "character" }
      }),
    ];

    // Create simple retriever
    const retriever = new SimpleRetriever(sampleDocuments);

    /**
     * Wrap the retriever in a tool to present it to the agent in a
     * usable form.
     */
    const tool = createRetrieverTool(retriever, {
      name: "search_latest_knowledge",
      description: "Searches and returns up-to-date general information about LangChain, AI, and machine learning topics. BEEP BOOP!",
    });

    /**
     * Use a prebuilt LangGraph agent.
     */
    const agent = await createReactAgent({
      llm: chatModel,
      tools: [tool],
      /**
       * Modify the stock prompt in the prebuilt agent. See docs
       * for how to customize your agent:
       *
       * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
       */
      messageModifier: new SystemMessage(AGENT_SYSTEM_TEMPLATE),
    });

    if (!returnIntermediateSteps) {
      /**
       * Stream back all generated tokens and steps from their runs.
       *
       * We do some filtering of the generated events and only stream back
       * the final response as a string.
       *
       * For this specific type of tool calling ReAct agents with OpenAI, we can tell when
       * the agent is ready to stream back final output when it no longer calls
       * a tool and instead streams back content.
       *
       * See: https://langchain-ai.github.io/langgraphjs/how-tos/stream-tokens/
       */
      const eventStream = await agent.streamEvents(
        {
          messages,
        },
        { version: "v2" },
      );

      const textEncoder = new TextEncoder();
      const transformStream = new ReadableStream({
        async start(controller) {
          for await (const { event, data } of eventStream) {
            if (event === "on_chat_model_stream") {
              // Intermediate chat model generations will contain tool calls and no content
              if (!!data.chunk.content) {
                controller.enqueue(textEncoder.encode(data.chunk.content));
              }
            }
          }
          controller.close();
        },
      });

      return new StreamingTextResponse(transformStream);
    } else {
      /**
       * We could also pick intermediate steps out from `streamEvents` chunks, but
       * they are generated as JSON objects, so streaming and displaying them with
       * the AI SDK is more complicated.
       */
      const result = await agent.invoke({ messages });
      return NextResponse.json(
        {
          messages: result.messages.map(convertLangChainMessageToVercelMessage),
        },
        { status: 200 },
      );
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
