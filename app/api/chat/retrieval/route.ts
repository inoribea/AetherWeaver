import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

import { ChatOpenAI } from "@langchain/openai";
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAlibabaTongyi } from "@langchain/community/chat_models/alibaba_tongyi";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { BaseChatModel, BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { AIMessageChunk } from "@langchain/core/messages";
import { 
  createVectorStore, 
  getBestEmbeddingProvider, 
  SimpleVectorStore,
  enhancedRetrieval
} from "../../../../utils/vectorstore";
import { CloudflareEmbeddings } from "../../../../utils/embeddings";
import { wrapWithErrorHandling } from "@/utils/errorHandler";

// Helper function to create Alibaba Tongyi model
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

// Helper function to get available model with token counting
function getAvailableModel(): { model: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>, modelName: string } {
  // Token counting callbacks
  const tokenCountingCallbacks = [
    {
      handleLLMStart: async (llm: any, prompts: string[]) => {
        console.log(`[${new Date().toISOString()}] 🚀 Retrieval Model Started`);
        console.log(`[${new Date().toISOString()}] 📝 Prompts: ${prompts.length} prompt(s)`);
      },
      handleLLMEnd: async (output: any) => {
        if (output.llmOutput?.tokenUsage) {
          const usage = output.llmOutput.tokenUsage;
          console.log(`[${new Date().toISOString()}] 📊 Retrieval Token Usage:`);
          console.log(`  - Prompt Tokens: ${usage.promptTokens || 0}`);
          console.log(`  - Completion Tokens: ${usage.completionTokens || 0}`);
          console.log(`  - Total Tokens: ${usage.totalTokens || 0}`);
        }
      },
      handleLLMError: async (error: any) => {
        console.error(`[${new Date().toISOString()}] ❌ Retrieval Model Error:`, error);
      },
    },
  ];

  // Try different models in order of preference
  if (process.env.OPENAI_API_KEY || process.env.NEKO_API_KEY) {
    return {
      model: new ChatOpenAI({
        model: "gpt-4o-mini",
        temperature: 0.2,
        streaming: true,
        apiKey: process.env.NEKO_API_KEY || process.env.OPENAI_API_KEY,
        configuration: { baseURL: process.env.NEKO_BASE_URL || process.env.OPENAI_BASE_URL },
        callbacks: tokenCountingCallbacks,
      }),
      modelName: "gpt-4o-mini"
    };
  } else if (process.env.GOOGLE_API_KEY) {
    return {
      model: new ChatGoogleGenerativeAI({
        model: "gemini-2.5-flash-lite-preview-06-17",
        temperature: 0.2,
        streaming: true,
        apiKey: process.env.GOOGLE_API_KEY,
        callbacks: tokenCountingCallbacks,
      }),
      modelName: "gemini-flash-lite"
    };
  } else if (process.env.DEEPSEEK_API_KEY) {
    return {
      model: new ChatDeepSeek({
        model: "deepseek-chat",
        temperature: 0.2,
        streaming: true,
        apiKey: process.env.DEEPSEEK_API_KEY,
        callbacks: tokenCountingCallbacks,
      }),
      modelName: "deepseek-chat"
    };
  } else if (process.env.DASHSCOPE_API_KEY) {
    return {
      model: new ChatAlibabaTongyi({
        model: "qwen-turbo-latest",
        temperature: 0.2,
        streaming: true,
        alibabaApiKey: process.env.DASHSCOPE_API_KEY,
        callbacks: tokenCountingCallbacks,
      }),
      modelName: "qwen-turbo"
    };
  } else {
    throw new Error("No API keys configured. Please set up at least one model provider.");
  }
}

const combineDocumentsFn = (docs: Document[]) => {
  const serializedDocs = docs.map((doc) => doc.pageContent);
  return serializedDocs.join("\n\n");
};

const formatVercelMessages = (chatHistory: VercelChatMessage[]) => {
  const formattedDialogueTurns = chatHistory.map((message) => {
    if (message.role === "user") {
      return `Human: ${message.content}`;
    } else if (message.role === "assistant") {
      return `Assistant: ${message.content}`;
    } else {
      return `${message.role}: ${message.content}`;
    }
  });
  return formattedDialogueTurns.join("\n");
};

const CONDENSE_QUESTION_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question, in its original language.

<chat_history>
  {chat_history}
</chat_history>

Follow Up Input: {question}
Standalone question:`;

const condenseQuestionPrompt = PromptTemplate.fromTemplate(CONDENSE_QUESTION_TEMPLATE);

const ANSWER_TEMPLATE = `You are an energetic talking puppy named Dana, and must answer all questions like a happy, talking dog would.
Use lots of puns!

Answer the question based only on the following context and chat history:
<context>
  {context}
</context>

<chat_history>
  {chat_history}
</chat_history>

Question: {question}
`;

const answerPrompt = PromptTemplate.fromTemplate(ANSWER_TEMPLATE);

/**
 * This handler provides a retrieval-style chat using enhanced vector store
 * with Cloudflare embeddings support and sample documents fallback.
 */
export async function POST(req: NextRequest) {
  return wrapWithErrorHandling("retrieval_chat_POST", async () => {
    try {
      const body = await req.json();
      const messages = body.messages ?? [];
      const previousMessages = messages.slice(0, -1);
      const currentMessageContent = messages[messages.length - 1].content;

      // Get available model with token counting
      const { model, modelName } = getAvailableModel();
      console.log(`[Retrieval] Using model: ${modelName}`);

      // Sample documents for demonstration (enhanced with Cloudflare context)
      const sampleDocuments = [
        new Document({
          pageContent: "LangChain is a framework for developing applications powered by language models. BEEP BOOP! It provides tools for prompt management, chains, and agents. Dana the puppy loves using LangChain because it makes building AI applications paw-some! Woof woof!",
          metadata: { source: "langchain_docs", type: "framework" }
        }),
        new Document({
          pageContent: "Vector databases store high-dimensional vectors and enable similarity search. They are essential for RAG (Retrieval-Augmented Generation) applications. Dana thinks vectors are like fetch - you throw a query and get back the most similar results! It's totally paws-itive!",
          metadata: { source: "vector_db_guide", type: "database" }
        }),
        new Document({
          pageContent: "Retrieval-Augmented Generation (RAG) combines the power of retrieval systems with generative models to provide more accurate and contextual responses. It's like having a super smart dog that can fetch exactly the right information! Ruff ruff!",
          metadata: { source: "rag_guide", type: "technique" }
        }),
        new Document({
          pageContent: "Cloudflare Workers AI provides embedding models like BGE (BAAI General Embedding) that can be used for vector similarity search. Dana says it's like having a super-fast nose for sniffing out the right documents! Arf arf!",
          metadata: { source: "cloudflare_embeddings", type: "embedding" }
        }),
        new Document({
          pageContent: "Dana is an energetic talking puppy who loves helping with AI and machine learning questions. She's always ready to fetch the best answers and make lots of puns along the way! Her tail never stops wagging when talking about embeddings and retrieval! Woof!",
          metadata: { source: "dana_bio", type: "character" }
        }),
      ];

      // Try to use enhanced vector store with Cloudflare embeddings
      let relevantDocs: Document[] = [];
      let retrievalMethod = "keyword-based";

      try {
        // Attempt to create vector store with embeddings
        const embeddingProvider = getBestEmbeddingProvider();
        if (embeddingProvider) {
          console.log(`[Retrieval] Using ${embeddingProvider.name} embeddings`);
          const { vectorStore } = await createVectorStore(sampleDocuments);
          relevantDocs = await enhancedRetrieval(vectorStore, currentMessageContent, {
            k: 3,
            scoreThreshold: 0.1
          });
          retrievalMethod = `vector-based (${embeddingProvider.name})`;
        } else {
          throw new Error("No embedding providers available");
        }
      } catch (error) {
        console.warn("[Retrieval] Vector search failed, falling back to keyword search:", error);
        // Fallback to simple keyword-based retrieval
        const query = currentMessageContent.toLowerCase();
        relevantDocs = sampleDocuments.filter(doc => {
          const content = doc.pageContent.toLowerCase();
          const queryWords = query.split(' ');
          return queryWords.some((word: string) => word.length > 2 && content.includes(word));
        });
      }

      // If no relevant docs found, use all docs
      const docsToUse = relevantDocs.length > 0 ? relevantDocs : sampleDocuments;
      const context = combineDocumentsFn(docsToUse);

      console.log(`[Retrieval] Found ${docsToUse.length} relevant documents using ${retrievalMethod}`);

      // Create standalone question chain
      const standaloneQuestionChain = RunnableSequence.from([
        condenseQuestionPrompt,
        model,
        new StringOutputParser(),
      ]);

      // Create answer chain
      const answerChain = RunnableSequence.from([
        answerPrompt,
        model,
        new StringOutputParser(),
      ]);

      // Create the full conversational retrieval chain
      const conversationalRetrievalQAChain = RunnableSequence.from([
        {
          question: standaloneQuestionChain,
          chat_history: (input: any) => input.chat_history,
        },
        {
          context: () => context,
          chat_history: (input: any) => input.chat_history,
          question: (input: any) => input.question,
        },
        answerChain,
      ]);

      const stream = await conversationalRetrievalQAChain.stream({
        question: currentMessageContent,
        chat_history: formatVercelMessages(previousMessages),
      });

      // Create serialized sources for the response headers
      const serializedSources = Buffer.from(
        JSON.stringify(
          docsToUse.map((doc) => {
            return {
              pageContent: doc.pageContent.slice(0, 50) + "...",
              metadata: doc.metadata,
            };
          }),
        ),
      ).toString("base64");

      // Convert stream to ReadableStream for StreamingTextResponse
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
          "X-Model-Used": modelName,
          "X-Model-Provider": "Multiple",
          "X-Feature": "Retrieval Chat",
          "X-Retrieval-Method": retrievalMethod,
          "X-Documents-Found": docsToUse.length.toString(),
          "x-message-index": (previousMessages.length + 1).toString(),
          "x-sources": serializedSources,
        },
      });
    } catch (e: any) {
      console.error('Retrieval API error:', e);
      return NextResponse.json({ 
        error: e.message || "Internal server error",
        details: "The retrieval endpoint encountered an error. Please check your API configuration."
      }, { 
        status: e.status ?? 500 
      });
    }
  });
}
