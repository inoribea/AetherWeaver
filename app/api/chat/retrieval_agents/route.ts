import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";
import { promises as fs } from "fs";
import path from "path";

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
import { ChatTencentHunyuanHunyuan } from "@langchain/community/chat_models/tencent_hunyuan";
import { createRetrieverTool } from "langchain/tools/retriever";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { Document } from "@langchain/core/documents";
import { BaseRetriever } from "@langchain/core/retrievers";
import { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";
import { BaseChatModel, BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { AIMessageChunk } from "@langchain/core/messages";
import { Tool } from "@langchain/core/tools";

import { convertVercelMessageToLangChainMessage, convertLangChainMessageToVercelMessage } from '@/utils/messageFormat';
import { wrapWithErrorHandling } from '@/utils/errorHandler';

// 保留Qdrant相关导入
import { QdrantVectorStore } from "@langchain/qdrant";
import qdrantClient from "@/utils/qdrantClient";

// 新增导入 PineconeStore, NeonPostgres, UpstashVectorStore 和 OpenAIEmbeddings
import { PineconeStore } from "@langchain/pinecone";
import { NeonPostgres } from "@langchain/community/vectorstores/neon";
import { UpstashVectorStore } from "@langchain/community/vectorstores/upstash";
import { Index } from "@upstash/vector";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Pinecone } from "@pinecone-database/pinecone";

import nodejieba from "nodejieba";

const englishStopwords = [
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at",
  "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
  "can't", "cannot", "could", "couldn't",
  "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
  "each",
  "few", "for", "from", "further",
  "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's",
  "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself",
  "let's",
  "me", "more", "most", "mustn't", "my", "myself",
  "no", "nor", "not",
  "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own",
  "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
  "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too",
  "under", "until", "up",
  "very",
  "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't",
  "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves"
];

// 异步加载中文停用词集合
async function loadChineseStopwords(): Promise<Set<string>> {
  const filePath = path.resolve(process.cwd(), "data/chinese_stopwords.txt");
  const content = await fs.readFile(filePath, "utf-8");
  const words = content.split(/\r?\n/).map(w => w.trim()).filter(w => w.length > 0);
  return new Set(words);
}

// 中文分词函数，过滤停用词，停用词集合动态传入
function chineseTokenize(text: string, stopwords: Set<string>): string[] {
  const tokens: string[] = nodejieba.cut(text);
  return tokens.filter((token: string) => token.trim() !== "" && !stopwords.has(token));
}

// 英文分词函数，使用正则分割并过滤英文停用词
function englishTokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(word => word.length > 2 && !englishStopwords.includes(word));
}

// 综合分词函数，支持中英文混合文本，异步加载中文停用词
async function tokenize(text: string, chineseStopwords: Set<string>): Promise<string[]> {
  const hasChinese = /[\u4e00-\u9fa5]/.test(text);
  if (hasChinese) {
    const chineseTokens = chineseTokenize(text, chineseStopwords);
    const englishTokens = englishTokenize(text);
    return Array.from(new Set([...chineseTokens, ...englishTokens]));
  } else {
    return englishTokenize(text);
  }
}

interface DocumentWithScore extends Document {
  score: number;
  source: "vector" | "keyword" | "fusion";
}

function normalizeScores(docs: DocumentWithScore[]) {
  if (docs.length === 0) return docs;
  const scores = docs.map(d => d.score);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const range = maxScore - minScore || 1;
  return docs.map(d => ({
    ...d,
    score: (d.score - minScore) / range,
  }));
}

const fuseRetrievalResults = (
  vectorResults: DocumentWithScore[],
  keywordResults: DocumentWithScore[],
  vectorWeight = 0.7,
  keywordWeight = 0.3,
  topK = 5
): Document[] => {
  // 归一化分数
  const normVector = normalizeScores(vectorResults);
  const normKeyword = normalizeScores(keywordResults);

  // 合并并去重，使用Map以pageContent为key
  const mergedMap = new Map<string, DocumentWithScore>();

  normVector.forEach(doc => {
    mergedMap.set(doc.pageContent, {
      ...doc,
      score: doc.score * vectorWeight,
      source: "vector",
    });
  });

  normKeyword.forEach(doc => {
    if (mergedMap.has(doc.pageContent)) {
      const existing = mergedMap.get(doc.pageContent)!;
      // 分数加权累加
      existing.score += doc.score * keywordWeight;
      // 标记来源为多策略
      existing.source = "fusion";
      mergedMap.set(doc.pageContent, existing);
    } else {
      mergedMap.set(doc.pageContent, {
        ...doc,
        score: doc.score * keywordWeight,
        source: "keyword",
      });
    }
  });

  // 转数组并排序
  const mergedArray = Array.from(mergedMap.values());
  mergedArray.sort((a, b) => b.score - a.score);

  // 返回topK文档
  return mergedArray.slice(0, topK).map(d => {
    const { score, source, ...doc } = d;
    return doc;
  });
};

async function createRetriever() {
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

  const chineseStopwords = await loadChineseStopwords();

  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    model: "text-embedding-3-small",
  });

  let retriever: BaseRetriever | null = null;

  if (process.env.PINECONE_API_KEY && process.env.PINECONE_ENVIRONMENT && process.env.PINECONE_INDEX) {
    const pineconeClient = new Pinecone();
    const pineconeIndex = pineconeClient.Index(process.env.PINECONE_INDEX);
    retriever = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
      maxConcurrency: 5,
    }) as unknown as BaseRetriever;
  } else if (process.env.DATABASE_URL) {
    retriever = await NeonPostgres.initialize(embeddings, {
      connectionString: process.env.DATABASE_URL,
    }) as unknown as BaseRetriever;
  } else if (process.env.UPSTASH_VECTOR_REST_URL && process.env.UPSTASH_VECTOR_REST_TOKEN) {
    const indexWithCredentials = new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN,
    });
    const upstashStore = new UpstashVectorStore(embeddings, {
      index: indexWithCredentials,
    });
    retriever = upstashStore.asRetriever() as BaseRetriever;
  } else {
    retriever = new QdrantVectorStore(embeddings, {
      collectionName: "default_collection",
    }) as unknown as BaseRetriever;
  }

  return retriever;
}

export { fuseRetrievalResults, createRetriever, englishTokenize, chineseTokenize, tokenize };
