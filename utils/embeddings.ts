import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { OpenAIEmbeddings } from "@langchain/openai";

/**
 * Cloudflare Embeddings 参数接口
 */
export interface CloudflareEmbeddingsParams extends EmbeddingsParams {
  /** Cloudflare API token */
  apiToken?: string;
  /** Cloudflare account ID */
  accountId?: string;
  /** Model name to use for embeddings */
  modelName?: string;
  /** Base URL for Cloudflare Workers AI API */
  baseUrl?: string;
  /** Batch size for embedding requests */
  batchSize?: number;
  /** Whether to strip new lines from documents */
  stripNewLines?: boolean;
}

/**
 * Cloudflare Workers AI Embeddings
 * 
 * This class provides embeddings using Cloudflare Workers AI platform.
 * It supports various embedding models available on Cloudflare Workers AI.
 */
export class CloudflareEmbeddings extends Embeddings implements CloudflareEmbeddingsParams {
  apiToken: string;
  accountId: string;
  modelName: string;
  baseUrl: string;
  batchSize: number;
  stripNewLines: boolean;

  constructor(fields?: CloudflareEmbeddingsParams) {
    super(fields ?? {});

    this.apiToken = fields?.apiToken ?? process.env.CLOUDFLARE_API_TOKEN ?? "";
    this.accountId = fields?.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
    this.modelName = fields?.modelName ?? process.env.CLOUDFLARE_EMBEDDING_MODEL ?? "@cf/baai/bge-base-en-v1.5";
    this.baseUrl = fields?.baseUrl ?? `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/`;
    this.batchSize = fields?.batchSize ?? 100;
    this.stripNewLines = fields?.stripNewLines ?? true;

    if (!this.apiToken) {
      throw new Error("Cloudflare API token is required. Please set CLOUDFLARE_API_TOKEN environment variable.");
    }
    if (!this.accountId) {
      throw new Error("Cloudflare account ID is required. Please set CLOUDFLARE_ACCOUNT_ID environment variable.");
    }
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const batches = chunkArray(
      this.stripNewLines ? texts.map((t) => t.replace(/\n/g, " ")) : texts,
      this.batchSize
    );

    const batchRequests = batches.map((batch) => this.embeddingWithRetry(batch));
    const batchResponses = await Promise.all(batchRequests);

    const embeddings: number[][] = [];
    for (let i = 0; i < batchResponses.length; i += 1) {
      const batch = batchResponses[i];
      embeddings.push(...batch);
    }

    return embeddings;
  }

  async embedQuery(text: string): Promise<number[]> {
    const cleanedText = this.stripNewLines ? text.replace(/\n/g, " ") : text;
    const embeddings = await this.embeddingWithRetry([cleanedText]);
    return embeddings[0];
  }

  private async embeddingWithRetry(texts: string[]): Promise<number[][]> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.callCloudflareAPI(texts);
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error("Failed to generate embeddings after multiple attempts");
  }

  private async callCloudflareAPI(texts: string[]): Promise<number[][]> {
    const url = `${this.baseUrl}${this.modelName}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: texts,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudflare API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.result && Array.isArray(data.result)) {
      return data.result.map((item: any) => {
        if (Array.isArray(item)) {
          return item;
        } else if (item.embedding && Array.isArray(item.embedding)) {
          return item.embedding;
        } else if (item.data && Array.isArray(item.data)) {
          return item.data;
        } else {
          throw new Error("Unexpected embedding format in API response");
        }
      });
    } else if (data.result && data.result.data && Array.isArray(data.result.data)) {
      return data.result.data.map((item: any) => {
        if (Array.isArray(item)) {
          return item;
        } else if (item.embedding && Array.isArray(item.embedding)) {
          return item.embedding;
        } else {
          throw new Error("Unexpected embedding format in API response");
        }
      });
    } else {
      throw new Error("Unexpected API response format");
    }
  }
}

/**
 * Factory function to create CloudflareEmbeddings instance
 * @param params Optional parameters for CloudflareEmbeddings
 * @returns CloudflareEmbeddings instance
 */
export function createCloudflareEmbeddings(params?: CloudflareEmbeddingsParams): CloudflareEmbeddings {
  return new CloudflareEmbeddings(params);
}

/**
 * OpenAI Embeddings 参数接口
 */
export interface OpenAIEmbeddingsParams extends EmbeddingsParams {
  apiKey?: string;
  model?: string;
  batchSize?: number;
  dimensions?: number;
  configuration?: object;
}

/**
 * Factory function to create OpenAIEmbeddings instance
 * @param params Optional parameters for OpenAIEmbeddings
 * @returns OpenAIEmbeddings instance
 */
export function createOpenAIEmbeddings(params?: OpenAIEmbeddingsParams): OpenAIEmbeddings {
  return new OpenAIEmbeddings({
    apiKey: params?.apiKey ?? process.env.OPENAI_API_KEY,
    model: params?.model ?? process.env.OPENAI_EMBEDDINGS_MODEL ?? "text-embedding-3-small",
    batchSize: params?.batchSize ?? 512,
    dimensions: params?.dimensions ?? 1536,
    configuration: params?.configuration,
  });
}

/**
 * Available Cloudflare embedding models
 */
export const CLOUDFLARE_EMBEDDING_MODELS = {
  BGE_BASE_EN: "@cf/baai/bge-base-en-v1.5",
  BGE_LARGE_EN: "@cf/baai/bge-large-en-v1.5", 
  BGE_SMALL_EN: "@cf/baai/bge-small-en-v1.5",
} as const;

/**
 * Helper function to get embedding model dimensions
 * @param modelName The embedding model name
 * @returns The dimension size of the embedding model
 */
export function getEmbeddingModelDimensions(modelName: string): number {
  switch (modelName) {
    case CLOUDFLARE_EMBEDDING_MODELS.BGE_BASE_EN:
      return 768;
    case CLOUDFLARE_EMBEDDING_MODELS.BGE_LARGE_EN:
      return 1024;
    case CLOUDFLARE_EMBEDDING_MODELS.BGE_SMALL_EN:
      return 384;
    default:
      return 768; // Default to base model dimensions
  }
}

/**
 * Get available embedding providers based on environment variables
 */
export function getAvailableEmbeddingProviders() {
  const providers = [];

  // OpenAI Embeddings
  if (process.env.OPENAI_API_KEY) {
    try {
      const openaiEmbeddings = createOpenAIEmbeddings();
      providers.push({
        name: "OpenAI",
        instance: openaiEmbeddings,
        dimensions: openaiEmbeddings.dimensions ?? 1536,
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
        modelName: process.env.CLOUDFLARE_EMBEDDING_MODEL ?? CLOUDFLARE_EMBEDDING_MODELS.BGE_BASE_EN,
      });
      providers.push({
        name: "Cloudflare",
        instance: cloudflareEmbeddings,
        dimensions: getEmbeddingModelDimensions(cloudflareEmbeddings.modelName),
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
 * Supports environment variable EMBEDDING_PROVIDER to force select provider by name
 */
export function getBestEmbeddingProvider() {
  const providers = getAvailableEmbeddingProviders();

  if (providers.length === 0) {
    return null;
  }

  const forcedProviderName = process.env.EMBEDDING_PROVIDER;

  if (forcedProviderName) {
    const forcedProvider = providers.find(p => p.name.toLowerCase() === forcedProviderName.toLowerCase());
    if (forcedProvider) {
      return forcedProvider;
    }
  }

  // Default preference: Cloudflare first, then OpenAI
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
