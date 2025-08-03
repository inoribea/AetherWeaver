import { NextRequest, NextResponse } from "next/server";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import {
  createVectorStore,
  getBestEmbeddingProvider,
  getAvailableEmbeddingProviders,
  SimpleVectorStore,
  EmbeddingProvider,
} from "../../../../utils/vectorstore";
import { CloudflareEmbeddings } from "../../../../utils/embeddings";

// export const runtime = "edge"; // Commented out to avoid edge runtime issues

/**
 * Enhanced document ingestion handler with multi-provider embedding support.
 *
 * This handler takes input text, splits it into chunks, and embeds those chunks
 * using the best available embedding provider (Cloudflare, OpenAI, etc.).
 *
 * Supports:
 * - Cloudflare Workers AI embeddings
 * - OpenAI embeddings
 * - Automatic provider selection
 * - In-memory vector storage for demo
 */

// In-memory storage for demo purposes
let globalVectorStore: SimpleVectorStore | null = null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, options = {} } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text content is required" },
        { status: 400 }
      );
    }

    if (process.env.NEXT_PUBLIC_DEMO === "true") {
      return NextResponse.json(
        {
          error: [
            "Ingest is not supported in demo mode.",
            "Please set up your own version of the repo here: https://github.com/langchain-ai/langchain-nextjs-template",
          ].join("\n"),
        },
        { status: 403 }
      );
    }

    // Get available embedding providers
    const availableProviders = getAvailableEmbeddingProviders();
    if (availableProviders.length === 0) {
      return NextResponse.json(
        {
          error:
            "No embedding providers available. Please configure CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID or OPENAI_API_KEY.",
          availableProviders: [],
        },
        { status: 400 }
      );
    }

    // Configure text splitter
    const chunkSize = parseInt(process.env.DOCUMENT_CHUNK_SIZE || "1000");
    const chunkOverlap = parseInt(process.env.DOCUMENT_CHUNK_OVERLAP || "200");

    const splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
      chunkSize,
      chunkOverlap,
    });

    console.log(
      `Splitting text into chunks (size: ${chunkSize}, overlap: ${chunkOverlap})`
    );
    const splitDocuments = await splitter.createDocuments([text]);
    console.log(`Created ${splitDocuments.length} document chunks`);

    // Create or get vector store
    let vectorStore: SimpleVectorStore;
    let provider: EmbeddingProvider | null = null;

    if (globalVectorStore) {
      vectorStore = globalVectorStore;
      provider = getBestEmbeddingProvider() ?? null;
      console.log(`Using existing vector store with ${provider?.name} embeddings`);
    } else {
      const result = await createVectorStore();
      vectorStore = result.vectorStore as SimpleVectorStore;
      provider = result.provider ?? null;
      globalVectorStore = vectorStore;
      console.log(`Created new vector store with ${provider?.name ?? "unknown"} embeddings`);
    }

    // Add documents to vector store
    if (!vectorStore) throw new Error("Vector store not initialized.");
    console.log("Generating embeddings and adding documents to vector store...");
    await vectorStore.addDocuments(splitDocuments);

    // Return success response with details
    return NextResponse.json(
      {
        success: true,
        message: "Documents successfully ingested",
        details: {
          documentsProcessed: splitDocuments.length,
          embeddingProvider: provider?.name || "unknown",
          embeddingModel:
            provider?.name === "Cloudflare"
              ? process.env.CLOUDFLARE_EMBEDDING_MODEL || "@cf/baai/bge-base-en-v1.5"
              : process.env.OPENAI_EMBEDDINGS_MODEL || "text-embedding-3-small",
          chunkSize,
          chunkOverlap,
          totalCharacters: text.length,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Document ingestion error:", e);
    return NextResponse.json(
      {
        error: e.message || "Internal server error",
        details: "Failed to ingest documents. Please check your embedding provider configuration.",
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check ingestion status and available providers
 */
export async function GET(req: NextRequest) {
  try {
    const availableProviders = getAvailableEmbeddingProviders();
    const bestProvider = getBestEmbeddingProvider();

    return NextResponse.json({
      status: "ready",
      availableProviders: availableProviders.map((p: EmbeddingProvider) => ({
        name: p.name,
        dimensions: p.dimensions,
        available: p.available,
      })),
      bestProvider: bestProvider
        ? {
            name: bestProvider.name,
            dimensions: bestProvider.dimensions,
          }
        : null,
      hasDocuments: globalVectorStore !== null,
      configuration: {
        chunkSize: parseInt(process.env.DOCUMENT_CHUNK_SIZE || "1000"),
        chunkOverlap: parseInt(process.env.DOCUMENT_CHUNK_OVERLAP || "200"),
        cloudflareModel: process.env.CLOUDFLARE_EMBEDDING_MODEL || "@cf/baai/bge-base-en-v1.5",
        openaiModel: process.env.OPENAI_EMBEDDINGS_MODEL || "text-embedding-3-small",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, status: "error" }, { status: 500 });
  }
}

/**
 * DELETE endpoint to clear the vector store
 */
export async function DELETE(req: NextRequest) {
  try {
    globalVectorStore = null;

    return NextResponse.json({
      success: true,
      message: "Vector store cleared successfully",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
