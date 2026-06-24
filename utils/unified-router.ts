import fs from 'fs/promises';
import path from 'path';
import { detectIntentFromRequest } from './openai-compat';
import { sendEvent } from './langfuseClient';

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
  private modelsConfig: any = null;

  constructor() {
    // 初始化时加载模型配置
    this.loadModelsConfig();
  }

  private async loadModelsConfig() {
    try {
      const configPath = path.join(process.cwd(), 'models-config.json');
      const configContent = await fs.readFile(configPath, 'utf-8');
      this.modelsConfig = JSON.parse(configContent);
      // 注册所有模型
      if (this.modelsConfig?.models) {
        Object.entries(this.modelsConfig.models).forEach(([name, config]) => {
          this.registerModel(name, config);
        });
      }
      console.log(`✅ 已加载 ${this.models.size} 个模型配置`);
    } catch (error) {
      console.error('❌ 加载模型配置失败:', error);
      // 添加默认模型作为fallback
      this.registerModel('gemini-flash-lite', {
        type: 'google_gemini',
        capabilities: ['reasoning', 'code_generation']
      });
    }
  }

  registerModel(name: string, config: any) {
    this.models.set(name, config);
  }

  getAvailableModels(): string[] {
    const models = Array.from(this.models.keys());
    if (models.length === 0) {
      // 如果没有模型，返回默认模型
      return ['gemini-flash-lite'];
    }
    return models;
  }

  analyzeCapabilities(capabilities: string[]): string[] {
    return this.getAvailableModels().filter(model => {
      const config = this.models.get(model);
      if (!config?.capabilities) return false;
      return capabilities.some(cap => config.capabilities[cap] === true);
    });
  }

  async reloadConfiguration() {
    this.models.clear();
    await this.loadModelsConfig();
  }

  async route(request: RoutingRequest): Promise<RoutingDecision> {
    // 确保模型已加载
    if (this.models.size === 0) {
      await this.loadModelsConfig();
    }
    const routeStart = Date.now();
    const key = JSON.stringify(request.messages);
    let intent = this.intentCache.get(key);
    if (!intent) {
      intent = await this.semantic.analyze(request.messages);
      if (!intent) {
        intent = {
          type: 'semantic',
          confidence: 0.5,
        };
      }
      this.intentCache.set(key, intent);
    }

    let selected = '';
    let strategy: RoutingDecision['metadata']['routingStrategy'] = 'fallback';

    // 优先使用userIntent（显式指定的模型）
    if (request.userIntent) {
      const availableModels = this.getAvailableModels();
      if (availableModels.includes(request.userIntent)) {
        selected = request.userIntent;
        strategy = 'explicit';
      }
    }

    // 如果没有显式指定或指定的模型不存在，使用智能选择
    if (!selected) {
      if (intent.type === 'explicit_model' && intent.targetModel) {
        selected = intent.targetModel;
        strategy = 'explicit';
      } else if (intent.detectedCapabilities && intent.detectedCapabilities.length > 0) {
        const candidates = this.analyzeCapabilities(intent.detectedCapabilities);
        selected = candidates.length > 0 ? candidates[0] : '';
        strategy = 'capability';
      } else {
        const models = this.getAvailableModels();
        selected = models.length > 0 ? models[0] : 'gemini-flash-lite';
        strategy = 'semantic';
      }
    }

    const fallbackChain = this.getAvailableModels().filter(m => m !== selected);
    const capabilityMatch = intent.detectedCapabilities ? intent.detectedCapabilities.length : 0;
    const reasoning = `Selected model ${selected} using strategy ${strategy}`;

    // Fire-and-forget routing trace
    const duration = Date.now() - routeStart;
    sendEvent({
      event: 'router.decision',
      properties: {
        selectedModel: selected || 'unknown',
        strategy,
        confidence: intent.confidence || 0.5,
        durationMs: duration,
        capabilityMatch,
      },
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    return {
      selectedModel: selected,
      confidence: intent.confidence || 0.5,
      reasoning,
      fallbackChain,
      metadata: {
        routingStrategy: strategy,
        userIntentDetected: strategy === 'explicit',
        capabilityMatch,
        costEstimate: undefined,
        speedRating: 1,
      },
    };
  }

  private semantic = {
    analyze: async (messages: any[]): Promise<IntentAnalysis> => {
      const text = messages.map(m => {
        if (typeof m.content === 'string') return m.content.toLowerCase();
        if (Array.isArray(m.content)) {
          return m.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text || '')
            .join(' ')
            .toLowerCase();
        }
        return '';
      }).join(' ');

      const keywords = (this.modelsConfig as any)?.keywords || {};
      const detectedCapabilities: string[] = [];
      const intents: Array<{ intent: string; score: number }> = [];

      for (const [category, words] of Object.entries<string[]>(keywords)) {
        const matchCount = words.filter(w => text.includes(w.toLowerCase())).length;
        if (matchCount > 0) {
          detectedCapabilities.push(category);
          intents.push({ intent: category, score: Math.min(matchCount / words.length, 0.95) });
        }
      }

      if (/[\u4e00-\u9fff]/.test(text)) {
        if (!detectedCapabilities.includes('chinese')) {
          detectedCapabilities.push('chinese');
          intents.push({ intent: 'chinese', score: 0.8 });
        }
      }

      const confidence = detectedCapabilities.length > 0
        ? intents.reduce((max, i) => Math.max(max, i.score), 0)
        : 0.3;

      return {
        type: 'semantic',
        confidence,
        detectedCapabilities,
        intents,
      };
    }
  };
}

export const intelligentRouter = new IntelligentRouterUnified();

export function reloadModelConfiguration() {
  intelligentRouter.reloadConfiguration();
}

export function getAvailableModels() {
  return intelligentRouter.getAvailableModels();
}

export function analyzeModelCapabilities(capabilities: string[]) {
  return intelligentRouter.analyzeCapabilities(capabilities);
}

export async function routeRequest(request: RoutingRequest): Promise<RoutingDecision> {
  return intelligentRouter.route(request);
}