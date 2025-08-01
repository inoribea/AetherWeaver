import { Runnable } from "@langchain/core/runnables";

interface ModelConfig {
  provider: string;
  model: string;
  selection_strategy: string;
  langchainjs_provider: string;
  langchainjs_field: string;
  langchainjs_ready: boolean;
}

interface PerformanceStats {
  avg_response_time: number;
  error_rate: number;
  request_count: number;
  total_response_time: number;
  error_count: number;
}

export class ModelSelectorComponent extends Runnable<any, ModelConfig> {
  lc_namespace = ["langchain", "custom", "model_selector"];

  private currentRoundRobinIndex = 0;
  private performanceStats: Record<string, PerformanceStats> = {};
  private selectionHistory: Array<{ timestamp: string; selectedModel: string; strategy: string; availableCount: number }> = [];
  private abTestRatio: number = 50;
  private enablePerformanceTracking: boolean = true;
  private strategy: string;
  private models: any[];
  private vercelMode: boolean = false;
  private enableRunnableInterface: boolean = true;
  private langchainjsExport: boolean = false;
  private flattenMetadata: boolean = true;

  constructor(models: any[], strategy: string = "round_robin", options?: {
    abTestRatio?: number;
    enablePerformanceTracking?: boolean;
    vercelMode?: boolean;
    enableRunnableInterface?: boolean;
    langchainjsExport?: boolean;
    flattenMetadata?: boolean;
  }) {
    super();
    this.models = models;
    this.strategy = strategy;
    if (options) {
      if (options.abTestRatio !== undefined) this.abTestRatio = options.abTestRatio;
      if (options.enablePerformanceTracking !== undefined) this.enablePerformanceTracking = options.enablePerformanceTracking;
      if (options.vercelMode !== undefined) this.vercelMode = options.vercelMode;
      if (options.enableRunnableInterface !== undefined) this.enableRunnableInterface = options.enableRunnableInterface;
      if (options.langchainjsExport !== undefined) this.langchainjsExport = options.langchainjsExport;
      if (options.flattenMetadata !== undefined) this.flattenMetadata = options.flattenMetadata;
    }
  }

  async invoke(input: any): Promise<ModelConfig> {
    // Detect Vercel environment if not explicitly set
    if (typeof process !== "undefined" && process.env && process.env.VERCEL) {
      this.vercelMode = true;
    }

    const availableModels = this.models.filter((m) => m.enabled);
    if (availableModels.length === 0) {
      throw new Error("No models available");
    }

    let selectedModel;
    switch (this.strategy) {
      case "round_robin":
        selectedModel = this.selectByRoundRobin(availableModels);
        break;
      case "weighted":
        selectedModel = this.selectByWeight(availableModels);
        break;
      case "load_balance":
        selectedModel = this.selectByLoadBalance(availableModels);
        break;
      case "fallback":
        selectedModel = this.selectByFallback(availableModels);
        break;
      case "a_b_test":
        selectedModel = this.selectByABTest(availableModels);
        break;
      case "fastest":
        selectedModel = this.selectByFastest(availableModels);
        break;
      default:
        selectedModel = availableModels[0];
    }

    // Record selection history
    this.selectionHistory.push({
      timestamp: new Date().toISOString(),
      selectedModel: selectedModel.id || selectedModel.name || "unknown",
      strategy: this.strategy,
      availableCount: availableModels.length,
    });

    return {
      provider: selectedModel.provider,
      model: selectedModel.name,
      selection_strategy: this.strategy,
      langchainjs_provider: this.mapToLangChainProvider(selectedModel.provider),
      langchainjs_field: "model",
      langchainjs_ready: true,
    };
  }

  private selectByRoundRobin(models: any[]) {
    const selected = models[this.currentRoundRobinIndex % models.length];
    this.currentRoundRobinIndex++;
    return selected;
  }

  private selectByWeight(models: any[]) {
    const totalWeight = models.reduce((sum, m) => sum + m.weight, 0);
    let random = Math.random() * totalWeight;

    for (const model of models) {
      random -= model.weight;
      if (random <= 0) return model;
    }
    return models[models.length - 1];
  }

  private selectByLoadBalance(models: any[]) {
    if (!this.enablePerformanceTracking) {
      return this.selectByRoundRobin(models);
    }
    let bestModel = models[0];
    let bestScore = Number.POSITIVE_INFINITY;

    for (const model of models) {
      const modelId = model.id || model.name;
      const stats = this.performanceStats[modelId] || {
        avg_response_time: 1000,
        error_rate: 0,
        request_count: 0,
        total_response_time: 0,
        error_count: 0,
      };
      const score = stats.avg_response_time + stats.error_rate * 2000;
      if (score < bestScore) {
        bestScore = score;
        bestModel = model;
      }
    }
    return bestModel;
  }

  private selectByFallback(models: any[]) {
    return models[0];
  }

  private selectByABTest(models: any[]) {
    if (models.length < 2) return models[0];
    const rand = Math.floor(Math.random() * 100);
    return rand < this.abTestRatio ? models[0] : models[1];
  }

  private selectByFastest(models: any[]) {
    if (!this.enablePerformanceTracking) {
      return this.selectByRoundRobin(models);
    }
    let fastestModel = models[0];
    let fastestTime = Number.POSITIVE_INFINITY;

    for (const model of models) {
      const modelId = model.id || model.name;
      const stats = this.performanceStats[modelId] || { avg_response_time: 1000 };
      if (stats.avg_response_time < fastestTime) {
        fastestTime = stats.avg_response_time;
        fastestModel = model;
      }
    }
    return fastestModel;
  }

  updatePerformanceStats(modelId: string, responseTime: number, success: boolean = true) {
    if (!this.enablePerformanceTracking) return;

    if (!this.performanceStats[modelId]) {
      this.performanceStats[modelId] = {
        avg_response_time: responseTime,
        error_rate: 0,
        request_count: 1,
        total_response_time: responseTime,
        error_count: success ? 0 : 1,
      };
    } else {
      const stats = this.performanceStats[modelId];
      stats.request_count++;
      stats.total_response_time += responseTime;
      stats.avg_response_time = stats.total_response_time / stats.request_count;
      if (!success) stats.error_count++;
      stats.error_rate = stats.error_count / stats.request_count;
    }
  }

  private mapToLangChainProvider(provider: string): string {
    const mapping: Record<string, string> = {
      OpenAI: "openai",
      Anthropic: "anthropic",
      Google: "google",
      DeepSeek: "deepseek",
      "OpenAI-Compatible": "openai-compatible",
    };
    return mapping[provider] || provider.toLowerCase();
  }
}