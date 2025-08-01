import { detectIntentFromRequest } from './openai-compat';

export interface IntentAnalysis {
  type: 'explicit_model' | 'semantic' | 'capability_based';
  targetModel?: string;
  detectedCapabilities?: string[];
  intents?: Array<{ intent: string; score: number }>;
  confidence: number;
  complexity?: number;
}

export interface RoutingRequest {
  messages: any[];
  userIntent?: string;
  context?: any;
  capabilities?: any;
  tools?: any[];
  temperature?: number;
  stream?: boolean;
}

export interface RoutingDecision {
  selectedModel: string;
  confidence: number;
  reasoning: string;
  fallbackChain: string[];
  metadata: {
    routingStrategy: 'explicit' | 'semantic' | 'capability' | 'fallback';
    userIntentDetected?: boolean;
    capabilityMatch: number;
    costEstimate?: number;
    speedRating: number;
  };
}

export interface UnifiedRouter {
  registerModel(name: string, config: any): void;
  getAvailableModels(): string[];
  analyzeCapabilities(capabilities: string[]): string[];
  reloadConfiguration(): void;
  route(request: RoutingRequest): Promise<RoutingDecision>;
}

export class IntelligentRouterUnified implements UnifiedRouter {
  private intentCache = new Map<string, IntentAnalysis>();
  private models: Map<string, any> = new Map();

  // 语义分析器，模拟实现
  private semantic = {
    analyze: async (messages: any[]): Promise<IntentAnalysis> => {
      // 这里放置语义分析的具体实现，示例返回默认值
      return {
        type: 'semantic',
        confidence: 0.5,
        detectedCapabilities: [],
        intents: [],
      };
    },
  };

  registerModel(name: string, config: any) {
    this.models.set(name, config);
  }

  getAvailableModels(): string[] {
    return Array.from(this.models.keys());
  }

  analyzeCapabilities(capabilities: string[]): string[] {
    return this.getAvailableModels().filter(model => {
      const config = this.models.get(model);
      return config?.capabilities?.some((cap: string) => capabilities.includes(cap));
    });
  }

  reloadConfiguration() {
    // 重新加载配置逻辑
  }

  async route(request: RoutingRequest): Promise<RoutingDecision> {
    const key = JSON.stringify(request.messages);
    let intent = this.intentCache.get(key);
    if (!intent) {
      intent = await this.semantic.analyze(request.messages);
      if (!intent) {
        intent = {
          type: 'semantic',
          confidence: 0,
        };
      }
      this.intentCache.set(key, intent);
    }

    let selected = '';
    let strategy: RoutingDecision['metadata']['routingStrategy'] = 'fallback';

    if (intent.type === 'explicit_model' && intent.targetModel) {
      selected = intent.targetModel;
      strategy = 'explicit';
    } else if (intent.detectedCapabilities && intent.detectedCapabilities.length > 0) {
      const candidates = this.analyzeCapabilities(intent.detectedCapabilities);
      selected = candidates.length > 0 ? candidates[0] : '';
      strategy = 'capability';
    } else {
      const models = this.getAvailableModels();
      selected = models.length > 0 ? models[0] : '';
      strategy = 'semantic';
    }

    const fallbackChain = this.getAvailableModels().filter(m => m !== selected);
    const capabilityMatch = intent.detectedCapabilities ? intent.detectedCapabilities.length : 0;
    const reasoning = `Selected model ${selected} using strategy ${strategy}`;

    return {
      selectedModel: selected,
      confidence: intent.confidence,
      reasoning,
      fallbackChain,
      metadata: {
        routingStrategy: strategy,
        userIntentDetected: intent.type === 'explicit_model',
        capabilityMatch,
        costEstimate: undefined,
        speedRating: 1,
      },
    };
  }
}
export async function routeRequest(request: RoutingRequest): Promise<RoutingDecision> {
  const intelligentRouter = new IntelligentRouterUnified();
  return intelligentRouter.route(request);
}