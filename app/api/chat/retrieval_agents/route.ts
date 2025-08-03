import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Document } from '@langchain/core/documents';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { NeonPostgres } from '@langchain/community/vectorstores/neon';
import { UpstashVectorStore } from '@langchain/community/vectorstores/upstash';
import { Index } from '@upstash/vector';
import { QdrantVectorStore } from '@langchain/qdrant';
import { Pinecone } from '@pinecone-database/pinecone';

import { tokenize, EnhancedAdvancedRetriever } from './enhancedAdvancedRetriever';

async function loadChineseStopwords(): Promise<Set<string>> {
  const filePath = path.resolve(process.cwd(), "data/chinese_stopwords.txt");
  const content = await fs.readFile(filePath, "utf-8");
  const words = content.split(/\r?\n/).map(w => w.trim()).filter(w => w.length > 0);
  return new Set(words);
}

function normalizeScores(docs: Document[]) {
  if (docs.length === 0) return docs;
  const scores = docs.map(d => (d as any).score);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const range = maxScore - minScore || 1;
  return docs.map(d => ({
    ...d,
    score: ((d as any).score - minScore) / range,
  }));
}

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

  return new EnhancedAdvancedRetriever(sampleDocuments, chineseStopwords);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = body.query;
    if (typeof query !== 'string' || query.trim() === '') {
      return new NextResponse(JSON.stringify({ error: 'Invalid query' }), { status: 400 });
    }

    const retriever = await createRetriever();
    const results = await retriever.getRelevantDocuments(query);
    const normalizedResults = normalizeScores(results);

    return NextResponse.json({ documents: normalizedResults });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new NextResponse(JSON.stringify({ error: message }), { status: 500 });
  }
}
