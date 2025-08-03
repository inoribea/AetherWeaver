import { PineconeStore } from "@langchain/pinecone";
import { NeonPostgres } from "@langchain/community/vectorstores/neon";
import { UpstashVectorStore } from "@langchain/community/vectorstores/upstash";
import { Index as UpstashIndex } from "@upstash/vector";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import { Document } from "@langchain/core/documents";
import { Embeddings } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { OpenAIEmbeddings } from "@langchain/openai";
import { CloudflareEmbeddings, createCloudflareEmbeddings, CLOUDFLARE_EMBEDDING_MODELS } from "./embeddings";

export interface EmbeddingProvider {
  name: string;
  instance: Embeddings;
  dimensions: number;
  available: boolean;
}

/**
 * Simple in-memory vector store for demonstration purposes
 */
export class SimpleVectorStore extends VectorStore {
  _vectorstoreType(): string {
    return "simple";
  }

  private documents: Document[] = [];
  private vectors: number[][] = [];

  constructor(embeddings: Embeddings) {
    super(embeddings, {});
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(doc => doc.pageContent);
    const vectors = await this.embeddings.embedDocuments(texts);
    
    this.documents.push(...documents);
    this.vectors.push(...vectors);
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    this.vectors.push(...vectors);
    this.documents.push(...documents);
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document, number][]> {
    if (this.vectors.length === 0) {
      return [];
    }

    const similarities = this.vectors.map((vector, index) => ({
      index,
      similarity: this.cosineSimilarity(query, vector),
    }));

    similarities.sort((a, b) => b.similarity - a.similarity);
    
    return similarities
      .slice(0, k)
      .map(({ index, similarity }) => [this.documents[index], similarity]);
  }

  async similaritySearchWithScore(
    query: string,
    k: number = 4
  ): Promise<[Document, number][]> {
    if (this.vectors.length === 0) {
      return [];
    }

    const queryVector = await this.embeddings.embedQuery(query);
    return this.similaritySearchVectorWithScore(queryVector, k);
  }

  async similaritySearch(query: string, k: number = 4): Promise<Document[]> {
    const results = await this.similaritySearchWithScore(query, k);
    return results.map(([doc]) => doc);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings
  ): Promise<SimpleVectorStore> {
    const store = new SimpleVectorStore(embeddings);
    await store.addDocuments(docs);
    return store;
  }
}

/**
 * Get available embedding providers based on environment variables
 */
export function getAvailableEmbeddingProviders(): EmbeddingProvider[] {
  const providers: EmbeddingProvider[] = [];

  // OpenAI Embeddings
  if (process.env.OPENAI_API_KEY || process.env.NEKO_API_KEY) {
    try {
      const openaiEmbeddings = new OpenAIEmbeddings({
        apiKey: process.env.NEKO_API_KEY || process.env.OPENAI_API_KEY,
        configuration: {
          baseURL: process.env.NEKO_BASE_URL || process.env.OPENAI_BASE_URL,
        },
        model: process.env.OPENAI_EMBEDDINGS_MODEL || "text-embedding-3-small",
      });
      
      providers.push({
        name: "OpenAI",
        instance: openaiEmbeddings,
        dimensions: parseInt(process.env.OPENAI_EMBEDDINGS_DIMENSIONS || "1536"),
        available: true,
      });
    } catch (error) {
      console.warn("Failed to initialize OpenAI embeddings:", error);
    }
  }

  // Cloudflare Embeddings
  if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
    try {
      const cloudflareEmbeddings = createCloudflareEmbeddings({
        modelName: process.env.CLOUDFLARE_EMBEDDING_MODEL || CLOUDFLARE_EMBEDDING_MODELS.BGE_BASE_EN,
      });
      
      providers.push({
        name: "Cloudflare",
        instance: cloudflareEmbeddings,
        dimensions: 768, // BGE base model default
        available: true,
      });
    } catch (error) {
      console.warn("Failed to initialize Cloudflare embeddings:", error);
    }
  }

  return providers;
}

/**
 * Get the best available embedding provider
 */
export function getBestEmbeddingProvider(): EmbeddingProvider | null {
  const providers = getAvailableEmbeddingProviders();
  
  if (providers.length === 0) {
    return null;
  }

  // Prefer Cloudflare for cost efficiency, then OpenAI for quality
  const cloudflareProvider = providers.find(p => p.name === "Cloudflare");
  if (cloudflareProvider) {
    return cloudflareProvider;
  }

  const openaiProvider = providers.find(p => p.name === "OpenAI");
  if (openaiProvider) {
    return openaiProvider;
  }

  return providers[0];
}

/**
 * Create a vector store with the best available embedding provider
 */
export async function createVectorStore(documents?: Document[], storeType?: string): Promise<{
  vectorStore: VectorStore;
  provider: EmbeddingProvider | null;
}> {
  const provider = getBestEmbeddingProvider();

  if (!provider) {
    throw new Error("No embedding providers available. Please configure OPENAI_API_KEY or CLOUDFLARE credentials.");
  }

  console.log(`Using ${provider.name} embeddings for vector store`);

  let vectorStore: VectorStore;

  switch (storeType) {
    case "pinecone":
      {
        const pinecone = new PineconeClient();
        const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);
        vectorStore = await PineconeStore.fromExistingIndex(provider.instance, {
          pineconeIndex,
          maxConcurrency: 5,
        });
      }
      break;
    case "neon":
      {
        vectorStore = await NeonPostgres.initialize(provider.instance, {
          connectionString: process.env.DATABASE_URL as string,
        });
      }
      break;
    case "upstash":
      {
        const upstashIndex = new UpstashIndex({
          url: process.env.UPSTASH_VECTOR_REST_URL!,
          token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
        });
        vectorStore = new UpstashVectorStore(provider.instance, {
          index: upstashIndex,
        });
      }
      break;
    default:
      vectorStore = documents
        ? await SimpleVectorStore.fromDocuments(documents, provider.instance)
        : new SimpleVectorStore(provider.instance);
  }

  if (documents && storeType !== "pinecone" && storeType !== "neon" && storeType !== "upstash") {
    await vectorStore.addDocuments(documents);
  }

  return { vectorStore, provider };
}

/**
 * Enhanced retrieval function with multiple strategies
 */
export async function enhancedRetrieval(
  vectorStore: VectorStore,
  query: string,
  options: {
    k?: number;
    scoreThreshold?: number;
    strategy?: "similarity" | "mmr";
  } = {}
): Promise<Document[]> {
  const { k = 4, scoreThreshold = 0.0, strategy = "similarity" } = options;

  if (strategy === "similarity") {
    const results = await vectorStore.similaritySearchWithScore(query, k * 2);
    
    // Filter by score threshold
    const filteredResults = results.filter(([, score]) => score >= scoreThreshold);
    
    return filteredResults
      .slice(0, k)
      .map(([doc]) => doc);
  }

  // For now, fallback to similarity search for MMR
  return vectorStore.similaritySearch(query, k);
}

/**
 * Batch process documents for embedding
 */
export async function batchEmbedDocuments(
  documents: Document[],
  embeddings: Embeddings,
  batchSize: number = 100
): Promise<number[][]> {
  const batches: Document[][] = [];
  
  for (let i = 0; i < documents.length; i += batchSize) {
    batches.push(documents.slice(i, i + batchSize));
  }

  const allEmbeddings: number[][] = [];
  
  for (const batch of batches) {
    const texts = batch.map(doc => doc.pageContent);
    const batchEmbeddings = await embeddings.embedDocuments(texts);
    allEmbeddings.push(...batchEmbeddings);
  }

  return allEmbeddings;
}
