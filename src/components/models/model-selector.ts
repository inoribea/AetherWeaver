import { Runnable } from "@langchain/core/runnables";

interface ModelConfig {
  provider: string;
  model: string;
  selection_strategy: string;
  langchainjs_provider: string;
  langchainjs_field: string;
  langchainjs_ready: boolean;
}

export class ModelSelectorComponent extends Runnable<any, ModelConfig> {
  lc_namespace = ["langchain", "custom", "model_selector"];
  
  private currentRoundRobinIndex = 0;
  
  constructor(private models: any[], private strategy: string = 'round_robin') {
    super();
  }

  async invoke(input: any): Promise<ModelConfig> {
    const availableModels = this.models.filter(m => m.enabled);
    
    let selectedModel;
    switch (this.strategy) {
      case 'round_robin':
        selectedModel = this.selectByRoundRobin(availableModels);
        break;
      case 'weighted':
        selectedModel = this.selectByWeight(availableModels);
        break;
      default:
        selectedModel = availableModels[0];
    }

    return {
      provider: selectedModel.provider,
      model: selectedModel.name,
      selection_strategy: this.strategy,
      langchainjs_provider: this.mapToLangChainProvider(selectedModel.provider),
      langchainjs_field: 'model',
      langchainjs_ready: true
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

  private mapToLangChainProvider(provider: string): string {
    const mapping: Record<string, string> = {
      'OpenAI': 'openai',
      'Anthropic': 'anthropic', 
      'Google': 'google',
      'DeepSeek': 'deepseek',
      'OpenAI-Compatible': 'openai-compatible'
    };
    return mapping[provider] || provider.toLowerCase();
  }
}
