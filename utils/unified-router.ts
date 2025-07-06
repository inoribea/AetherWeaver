import { Message as VercelChatMessage } from 'ai';
import fs from 'fs';
import path from 'path';

// OpenAI兼容的消息接口
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
  name?: string;
  function_call?: any;
  tool_calls?: any[];
  tool_call_id?: string;
}

// OpenAI兼容的请求接口
export interface OpenAICompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: any[];
  tool_choice?: any;
  response_format?: any;
}

// 统一路由器核心接口
export interface UnifiedRouter {
  route(request: RoutingRequest): Promise<RoutingDecision>;
  registerModel(model: ModelDefinition): void;
  getAvailableModels(): ModelInfo[];
  analyzeCapabilities(modelId: string): ModelCapabilities;
  reloadConfiguration(): Promise<void>;
}

// 路由请求接口
export interface RoutingRequest {
  messages: OpenAIMessage[];
  userIntent?: string; // 明确指定的模型或意图
  context?: ConversationContext;
  capabilities?: RequiredCapabilities;
  tools?: any[];
  temperature?: number;
  stream?: boolean;
}

// 路由决策接口
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
    speedRating?: number;
  };
}

// 模型定义接口
export interface ModelDefinition {
  id: string;
  type: string;
  config: ModelConfig;
  capabilities: ModelCapabilities;
  priority: Record<string, number>;
  cost_per_1k_tokens: number;
  speed_rating: number;
  quality_rating: number;
  description?: string;
  complexity_threshold?: 'low' | 'medium' | 'high';
}

// 模型配置接口
export interface ModelConfig {
  apiKey?: string;
  baseURL?: string;
  model: string;
  temperature: number;
  secretId?: string;
  secretKey?: string;
}

// 模型能力接口
export interface ModelCapabilities {
  vision?: boolean;
  reasoning?: boolean;
  tool_calling?: boolean;
  structured_output?: boolean;
  agents?: boolean;
  chinese?: boolean;
  search?: boolean;
  web_search?: boolean;
  code_generation?: boolean;
  creative_writing?: boolean;
  mathematical_computation?: boolean;
}

// 模型信息接口
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: ModelCapabilities;
  available: boolean;
  cost_per_1k_tokens: number;
  speed_rating: number;
  quality_rating: number;
}

// 对话上下文接口
export interface ConversationContext {
  previousModel?: string;
  taskType?: string;
  complexity?: number;
  language?: string;
}

// 所需能力接口
export interface RequiredCapabilities {
  vision?: boolean;
  reasoning?: boolean;
  tool_calling?: boolean;
  structured_output?: boolean;
  agents?: boolean;
  chinese?: boolean;
  search?: boolean;
  web_search?: boolean;
  code_generation?: boolean;
  creative_writing?: boolean;
  mathematical_computation?: boolean;
}

// 意图分析结果
export interface IntentAnalysis {
  type: 'explicit_model' | 'semantic' | 'capability_based';
  targetModel?: string;
  intents?: Array<{ intent: string; score: number }>;
  complexity?: number;
  confidence: number;
  detectedCapabilities?: string[];
}

// 动态模型注册系统
export class ModelRegistry {
  private models: Map<string, ModelDefinition> = new Map();
  private capabilityIndex: Map<string, string[]> = new Map();
  private availabilityCache: Map<string, boolean> = new Map();
  private lastConfigLoad: number = 0;
  private configPath: string;

  constructor() {
    this.configPath = path.join(process.cwd(), 'models-config.json');
    this.loadConfiguration();
  }

  // 加载配置文件
  async loadConfiguration(): Promise<void> {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(configData);
      
      // 清空现有模型
      this.models.clear();
      this.capabilityIndex.clear();
      this.availabilityCache.clear();

      // 注册所有模型
      for (const [modelId, modelConfig] of Object.entries(config.models)) {
        this.registerModel({
          id: modelId,
          ...(modelConfig as any)
        });
      }

      this.lastConfigLoad = Date.now();
      console.log(`✅ 已加载 ${this.models.size} 个模型配置`);
    } catch (error) {
      console.error('❌ 加载模型配置失败:', error);
      // 加载默认配置
      this.loadDefaultConfiguration();
    }
  }

  // 加载默认配置
  private loadDefaultConfiguration(): void {
    const defaultModels: ModelDefinition[] = [
      {
        id: 'gpt-4o-all',
        type: 'openai_compatible',
        config: {
          apiKey: 'NEKO_API_KEY',
          baseURL: 'NEKO_BASE_URL',
          model: 'gpt-4o-all',
          temperature: 0.7
        },
        capabilities: {
          vision: true,
          reasoning: true,
          tool_calling: true,
          structured_output: true,
          agents: true,
          chinese: false,
          search: true,
          code_generation: true,
          creative_writing: true,
          mathematical_computation: true
        },
        priority: {
          vision_processing: 1,
          complex_reasoning: 3,
          creative_writing: 2,
          code_generation: 2,
          mathematical_computation: 2,
          web_search: 2,
          structured_analysis: 1,
          agent_execution: 1
        },
        cost_per_1k_tokens: 0.005,
        speed_rating: 8,
        quality_rating: 9
      }
    ];

    defaultModels.forEach(model => this.registerModel(model));
  }

  // 注册模型
  registerModel(definition: ModelDefinition): void {
    this.models.set(definition.id, definition);
    this.updateCapabilityIndex(definition);
    
    // 检测模型可用性
    this.testModelAvailability(definition).then(available => {
      this.availabilityCache.set(definition.id, available);
    });
  }

  // 更新能力索引
  private updateCapabilityIndex(definition: ModelDefinition): void {
    Object.entries(definition.capabilities).forEach(([capability, hasCapability]) => {
      if (hasCapability) {
        if (!this.capabilityIndex.has(capability)) {
          this.capabilityIndex.set(capability, []);
        }
        this.capabilityIndex.get(capability)!.push(definition.id);
      }
    });
  }

  // 测试模型可用性
  async testModelAvailability(model: ModelDefinition): Promise<boolean> {
    try {
      if (model.config.apiKey) {
        return !!process.env[model.config.apiKey];
      }
      if (model.config.secretId && model.config.secretKey) {
        return !!(process.env[model.config.secretId] && process.env[model.config.secretKey]);
      }
      return false;
    } catch (error) {
      console.error(`❌ 测试模型 ${model.id} 可用性失败:`, error);
      return false;
    }
  }

  // 获取可用模型
  getAvailableModels(): string[] {
    return Array.from(this.models.keys()).filter(modelId => 
      this.availabilityCache.get(modelId) !== false
    );
  }

  // 根据能力查找模型
  findModelsByCapability(capability: string): ModelDefinition[] {
    const modelIds = this.capabilityIndex.get(capability) || [];
    return modelIds
      .map(id => this.models.get(id))
      .filter((model): model is ModelDefinition => model !== undefined)
      .filter(model => this.availabilityCache.get(model.id) !== false)
      .sort((a, b) => (b.priority[capability] || 0) - (a.priority[capability] || 0));
  }

  // 获取模型定义
  getModel(modelId: string): ModelDefinition | undefined {
    return this.models.get(modelId);
  }

  // 获取所有模型
  getAllModels(): ModelDefinition[] {
    return Array.from(this.models.values());
  }

  // 获取所有能力
  getAllCapabilities(): ModelCapabilities {
    const allCapabilities: ModelCapabilities = {};
    
    this.models.forEach(model => {
      Object.entries(model.capabilities).forEach(([capability, hasCapability]) => {
        if (hasCapability) {
          (allCapabilities as any)[capability] = true;
        }
      });
    });

    return allCapabilities;
  }

  // 检查模型是否可用
  isModelAvailable(modelId: string): boolean {
    return this.availabilityCache.get(modelId) !== false;
  }

  // 热重载配置
  async reloadConfiguration(): Promise<void> {
    await this.loadConfiguration();
  }
}

// 语义路由引擎
export class SemanticRouter {
  private intentPatterns: Map<string, RegExp[]> = new Map();
  
  constructor() {
    this.initializeIntentPatterns();
  }

  // 初始化意图模式
  private initializeIntentPatterns(): void {
    // 明确模型指定模式
    this.intentPatterns.set('explicit_model', [
      /让(\w+)来(.+)/,
      /用(\w+)模型(.+)/,
      /切换到(\w+)/,
      /使用(\w+)处理/,
      /(\w+)来(.+)/,
      /请(\w+)(.+)/,
      /换成(\w+)/,
      /改用(\w+)/,
      /换到(\w+)/,
      /要(\w+)/,
      /想要(\w+)/,
      /希望(\w+)/,
      /用(\w+)/,
      /(\w+)回答/,
      /(\w+)处理/,
      /(\w+)分析/,
      /with\s+(\w+)/i,
      /use\s+(\w+)/i,
      /switch\s+to\s+(\w+)/i,
      /change\s+to\s+(\w+)/i
    ]);

    // 能力相关模式
    this.intentPatterns.set('vision', [
      /图片|图像|照片|视觉|看|分析图|photo|picture|image/,
      /这是什么|识别|检测|描述.*图/
    ]);

    this.intentPatterns.set('reasoning', [
      /推理|逻辑|分析|reasoning|logic|analyze|思考|解决|problem|为什么|怎么|如何/,
      /复杂|详细|深入|全面|系统/
    ]);

    this.intentPatterns.set('search', [
      /搜索|search|最新|latest|current|news|今天|现在|查询|找/,
      /什么时候|最近|新闻|实时/
    ]);

    this.intentPatterns.set('code_generation', [
      /代码|编程|code|program|function|class|算法|debug|bug|写.*代码/,
      /实现|开发|编写|创建.*程序/
    ]);

    this.intentPatterns.set('mathematical_computation', [
      /数学|计算|math|calculate|equation|formula|solve|算|计算题/,
      /求解|运算|公式|方程/
    ]);

    this.intentPatterns.set('creative_writing', [
      /创作|写作|故事|creative|write|story|poem|小说|诗歌|文章/,
      /写.*故事|创作.*文章|编写.*内容/
    ]);

    this.intentPatterns.set('structured_output', [
      /结构化|格式|extract|parse|json|xml|table|列表|表格/,
      /整理|归纳|总结.*格式/
    ]);
  }

  // 分析用户意图
  async analyzeIntent(messages: OpenAIMessage[]): Promise<IntentAnalysis> {
    const lastMessage = messages[messages.length - 1];
    const content = Array.isArray(lastMessage.content)
      ? lastMessage.content.map(c => c.type === 'text' ? c.text : '').join(' ')
      : lastMessage.content;

    // 1. 检测明确的模型指定
    const explicitModel = this.detectExplicitModelRequest(content);
    if (explicitModel) {
      return {
        type: 'explicit_model',
        targetModel: explicitModel,
        confidence: 0.95,
        detectedCapabilities: []
      };
    }

    // 2. 检测能力需求
    const detectedCapabilities = this.detectCapabilities(content, messages);
    
    // 3. 分析复杂度
    const complexity = this.analyzeComplexity(content);

    // 4. 语义相似度分析（简化版）
    const intents = this.calculateIntentScores(content);

    return {
      type: detectedCapabilities.length > 0 ? 'capability_based' : 'semantic',
      intents,
      complexity,
      confidence: Math.max(...intents.map(i => i.score), 0.3),
      detectedCapabilities
    };
  }

  // 检测明确的模型指定
  private detectExplicitModelRequest(content: string): string | null {
    const patterns = this.intentPatterns.get('explicit_model') || [];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const modelName = this.normalizeModelName(match[1]);
        console.log(`🎯 检测到明确模型请求: ${modelName}`);
        return modelName;
      }
    }
    return null;
  }

  // 标准化模型名称
  private normalizeModelName(name: string): string {
    const nameMap: Record<string, string> = {
      // GPT 4.1 系列 - 重要：确保 gpt4.1 映射到自己
      'gpt4.1': 'gpt4.1',
      'gpt-4.1': 'gpt4.1',
      '4.1': 'gpt4.1',
      
      // GPT 4o 系列
      'gpt4o': 'gpt-4o-all',
      'gpt4': 'gpt-4o-all',
      'gpt': 'gpt-4o-all',
      '4o': 'gpt-4o-all',
      
      // 其他模型
      'qvq': 'qvq-plus',
      'claude': 'claude-sonnet-4-all',
      'sonnet': 'claude-sonnet-4-all',
      'deepseek': 'deepseek-reasoner',
      'reasoner': 'deepseek-reasoner',
      'gemini': 'gemini-flash-lite',
      'flash': 'gemini-flash-lite',
      'lite': 'gemini-flash-lite',
      'qwen': 'qwen-turbo',
      'hunyuan': 'hunyuan-turbos-latest',
      '混元': 'hunyuan-turbos-latest',
      't1': 'hunyuan-t1-latest'
    };

    return nameMap[name.toLowerCase()] || name;
  }

  // 检测能力需求
  private detectCapabilities(content: string, messages: OpenAIMessage[]): string[] {
    const capabilities: string[] = [];

    // 检查是否包含图片
    const hasImage = messages.some(msg =>
      Array.isArray(msg.content) &&
      msg.content.some(c => c.type === 'image_url')
    );

    if (hasImage) {
      capabilities.push('vision');
    }

    // 检测其他能力
    for (const [capability, patterns] of this.intentPatterns.entries()) {
      if (capability === 'explicit_model') continue;
      
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          capabilities.push(capability);
          break;
        }
      }
    }

    return [...new Set(capabilities)]; // 去重
  }

  // 分析复杂度
  private analyzeComplexity(content: string): number {
    let complexity = 0;

    // 基于长度
    if (content.length > 1000) complexity += 3;
    else if (content.length > 500) complexity += 2;
    else if (content.length > 200) complexity += 1;

    // 基于高复杂度关键词
    const highComplexKeywords = [
      '复杂', '详细', '深入', '全面', '系统', '分析', '推理', '逻辑',
      'complex', 'detailed', 'comprehensive', 'analyze', 'reasoning', 'logic',
      '创作', '写作', '代码', '算法', '数学', '计算', '解决',
      'creative', 'writing', 'code', 'algorithm', 'math', 'solve'
    ];
    const complexMatches = highComplexKeywords.filter(keyword => content.includes(keyword)).length;
    complexity += Math.min(complexMatches, 3);

    // 基于问题类型
    const questionWords = ['为什么', '怎么', '如何', 'why', 'how', 'what', 'when', 'where'];
    const questionCount = questionWords.filter(word => content.includes(word)).length;
    complexity += Math.min(questionCount, 2);

    // 检测多任务请求
    const taskIndicators = ['步骤', '阶段', '首先', '然后', '接下来', 'step', 'first', 'then', 'next'];
    if (taskIndicators.some(indicator => content.includes(indicator))) {
      complexity += 2;
    }

    return Math.min(complexity, 7); // 最大复杂度为7
  }

  // 将数值复杂度转换为阈值级别
  private getComplexityThreshold(complexity: number): 'low' | 'medium' | 'high' {
    if (complexity >= 5) return 'high';
    if (complexity >= 3) return 'medium';
    return 'low';
  }

  // 计算意图得分
  private calculateIntentScores(content: string): Array<{ intent: string; score: number }> {
    const scores: Array<{ intent: string; score: number }> = [];

    for (const [intent, patterns] of this.intentPatterns.entries()) {
      if (intent === 'explicit_model') continue;
      
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          score += 0.3;
        }
      }
      
      if (score > 0) {
        scores.push({ intent, score: Math.min(score, 1) });
      }
    }

    return scores.sort((a, b) => b.score - a.score);
  }
}

// 智能降级链
export class FallbackChain {
  constructor(private modelRegistry: ModelRegistry) {}

  // 生成降级链
  generateFallbackChain(
    targetModel: string,
    requiredCapabilities: string[]
  ): string[] {
    const chain = [targetModel];

    if (!this.modelRegistry.isModelAvailable(targetModel)) {
      // 基于能力相似度生成降级链
      const alternatives = this.findAlternativeModels(targetModel, requiredCapabilities);
      chain.push(...alternatives);
    }

    return chain;
  }

  // 查找替代模型
  private findAlternativeModels(
    targetModel: string,
    capabilities: string[]
  ): string[] {
    const targetModelDef = this.modelRegistry.getModel(targetModel);
    if (!targetModelDef) {
      return this.getDefaultFallbackChain(capabilities);
    }

    const targetCapabilities = targetModelDef.capabilities;
    const availableModels = this.modelRegistry.getAvailableModels();

    return availableModels
      .filter(modelId => modelId !== targetModel)
      .map(modelId => {
        const modelDef = this.modelRegistry.getModel(modelId);
        if (!modelDef) return null;

        const similarity = this.calculateCapabilitySimilarity(
          targetCapabilities,
          modelDef.capabilities
        );

        return {
          id: modelId,
          similarity,
          quality: modelDef.quality_rating,
          speed: modelDef.speed_rating
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => {
        // 优先考虑能力相似度，然后是质量
        if (Math.abs(a.similarity - b.similarity) > 0.1) {
          return b.similarity - a.similarity;
        }
        return b.quality - a.quality;
      })
      .slice(0, 3)
      .map(item => item.id);
  }

  // 计算能力相似度
  private calculateCapabilitySimilarity(
    capabilities1: ModelCapabilities,
    capabilities2: ModelCapabilities
  ): number {
    const allCapabilities = new Set([
      ...Object.keys(capabilities1),
      ...Object.keys(capabilities2)
    ]);

    let matches = 0;
    let total = 0;

    for (const capability of allCapabilities) {
      const has1 = (capabilities1 as any)[capability] || false;
      const has2 = (capabilities2 as any)[capability] || false;
      
      if (has1 === has2) {
        matches++;
      }
      total++;
    }

    return total > 0 ? matches / total : 0;
  }

  // 获取默认降级链
  private getDefaultFallbackChain(capabilities: string[]): string[] {
    const defaultChain = ['gemini-flash-lite', 'gpt-4o-all', 'claude-sonnet-4-all', 'gemini-flash', 'qwen-turbo'];
    return defaultChain.filter(modelId => this.modelRegistry.isModelAvailable(modelId));
  }
}

// 统一智能路由器主类
export class IntelligentRouterUnified implements UnifiedRouter {
  private modelRegistry: ModelRegistry;
  private semanticRouter: SemanticRouter;
  private fallbackChain: FallbackChain;

  constructor() {
    this.modelRegistry = new ModelRegistry();
    this.semanticRouter = new SemanticRouter();
    this.fallbackChain = new FallbackChain(this.modelRegistry);
  }

  // 主路由方法
  async route(request: RoutingRequest): Promise<RoutingDecision> {
    console.log('🚀 开始智能路由分析...');
    console.log(`📝 接收到 userIntent: ${request.userIntent}`);

    try {
      // 1. 优先检查直接指定的 userIntent
      if (request.userIntent) {
        console.log(`🎯 直接使用 userIntent 指定的模型: ${request.userIntent}`);
        
        // 验证模型是否存在
        const model = this.modelRegistry.getModel(request.userIntent);
        if (model) {
          const fallbackChain = this.fallbackChain.generateFallbackChain(request.userIntent, []);
          
          return {
            selectedModel: request.userIntent,
            confidence: 0.95,
            reasoning: `用户通过 userIntent 明确指定模型: ${request.userIntent}`,
            fallbackChain,
            metadata: {
              routingStrategy: 'explicit',
              userIntentDetected: true,
              capabilityMatch: 1.0,
              costEstimate: this.estimateCost(request.userIntent),
              speedRating: this.getSpeedRating(request.userIntent)
            }
          };
        } else {
          console.log(`⚠️ userIntent 指定的模型 ${request.userIntent} 不存在，继续语义分析`);
        }
      }

      // 2. 分析用户意图
      const intentAnalysis = await this.semanticRouter.analyzeIntent(request.messages);
      
      // 3. 确定目标模型
      let selectedModel: string;
      let routingStrategy: RoutingDecision['metadata']['routingStrategy'];
      let confidence = intentAnalysis.confidence;

      if (intentAnalysis.type === 'explicit_model' && intentAnalysis.targetModel) {
        // 明确指定模型
        selectedModel = intentAnalysis.targetModel;
        routingStrategy = 'explicit';
        console.log(`🎯 语义分析检测到明确指定模型: ${selectedModel}`);
      } else if (intentAnalysis.detectedCapabilities && intentAnalysis.detectedCapabilities.length > 0) {
        // 基于能力选择
        selectedModel = this.selectModelByCapabilities(intentAnalysis.detectedCapabilities, intentAnalysis.complexity);
        routingStrategy = 'capability';
        console.log(`🔧 基于能力选择模型: ${selectedModel} (需要: ${intentAnalysis.detectedCapabilities.join(', ')}, 复杂度: ${intentAnalysis.complexity || 'unknown'})`);
      } else {
        // 语义路由
        selectedModel = this.selectModelBySemantics(intentAnalysis);
        routingStrategy = 'semantic';
        console.log(`🧠 基于语义选择模型: ${selectedModel} (复杂度: ${intentAnalysis.complexity || 'unknown'})`);
      }

      // 3. 生成降级链
      const fallbackChain = this.fallbackChain.generateFallbackChain(
        selectedModel,
        intentAnalysis.detectedCapabilities || []
      );

      // 4. 计算能力匹配度
      const capabilityMatch = this.calculateCapabilityMatch(
        selectedModel,
        intentAnalysis.detectedCapabilities || []
      );

      // 5. 生成推理说明
      const reasoning = this.generateReasoning(
        selectedModel,
        intentAnalysis,
        routingStrategy
      );

      const decision: RoutingDecision = {
        selectedModel,
        confidence,
        reasoning,
        fallbackChain,
        metadata: {
          routingStrategy,
          userIntentDetected: intentAnalysis.type === 'explicit_model',
          capabilityMatch,
          costEstimate: this.estimateCost(selectedModel),
          speedRating: this.getSpeedRating(selectedModel)
        }
      };

      console.log(`✅ 路由决策完成: ${selectedModel} (置信度: ${confidence.toFixed(2)})`);
      return decision;

    } catch (error) {
      console.error('❌ 路由决策失败:', error);
      
      // 降级到默认模型
      const fallbackModel = this.getDefaultModel();
      return {
        selectedModel: fallbackModel,
        confidence: 0.1,
        reasoning: `路由失败，降级到默认模型: ${error}`,
        fallbackChain: [fallbackModel],
        metadata: {
          routingStrategy: 'fallback',
          userIntentDetected: false,
          capabilityMatch: 0
        }
      };
    }
  }

  // 基于能力选择模型
  private selectModelByCapabilities(capabilities: string[], complexity?: number): string {
    const complexityThreshold = complexity ? this.getComplexityThreshold(complexity) : 'medium';
    
    for (const capability of capabilities) {
      const models = this.modelRegistry.findModelsByCapability(capability);
      
      // 根据复杂度阈值筛选模型
      const suitableModels = models.filter(model => {
        if (!model.complexity_threshold) return true; // 没有阈值限制的模型可处理任何复杂度
        
        // Claude模型只处理高复杂度任务
        if (model.complexity_threshold === 'high') {
          return complexityThreshold === 'high';
        }
        
        return true;
      });
      
      if (suitableModels.length > 0) {
        return suitableModels[0].id;
      }
    }
    
    return this.getDefaultModelByComplexity(complexityThreshold);
  }

  // 基于语义选择模型
  private selectModelBySemantics(analysis: IntentAnalysis): string {
    if (!analysis.intents || analysis.intents.length === 0) {
      return this.getDefaultModel();
    }

    const complexityThreshold = analysis.complexity ? this.getComplexityThreshold(analysis.complexity) : 'medium';
    const topIntent = analysis.intents[0];
    const models = this.modelRegistry.findModelsByCapability(topIntent.intent);
    
    // 根据复杂度阈值筛选模型
    const suitableModels = models.filter(model => {
      if (!(model as any).complexity_threshold) return true; // 没有阈值限制的模型可处理任何复杂度
      
      // Claude模型只处理高复杂度任务
      if ((model as any).complexity_threshold === 'high') {
        return complexityThreshold === 'high';
      }
      
      return true;
    });
    
    if (suitableModels.length > 0) {
      return suitableModels[0].id;
    }

    return this.getDefaultModelByComplexity(complexityThreshold);
  }

  // 计算能力匹配度
  private calculateCapabilityMatch(modelId: string, requiredCapabilities: string[]): number {
    const model = this.modelRegistry.getModel(modelId);
    if (!model || requiredCapabilities.length === 0) {
      return 1.0;
    }

    let matches = 0;
    for (const capability of requiredCapabilities) {
      if ((model.capabilities as any)[capability]) {
        matches++;
      }
    }

    return matches / requiredCapabilities.length;
  }

  // 生成推理说明
  private generateReasoning(
    selectedModel: string,
    analysis: IntentAnalysis,
    strategy: RoutingDecision['metadata']['routingStrategy']
  ): string {
    const model = this.modelRegistry.getModel(selectedModel);
    if (!model) {
      return `选择了模型 ${selectedModel}，但无法获取详细信息`;
    }

    let reasoning = `选择模型 ${selectedModel} (${model.type})`;

    switch (strategy) {
      case 'explicit':
        reasoning += `，因为用户明确指定了此模型`;
        break;
      case 'capability':
        reasoning += `，因为它具备所需能力: ${analysis.detectedCapabilities?.join(', ')}`;
        break;
      case 'semantic':
        reasoning += `，基于语义分析，最匹配的意图是: ${analysis.intents?.[0]?.intent}`;
        break;
      case 'fallback':
        reasoning += `，作为降级选择`;
        break;
    }

    reasoning += `。模型评分 - 质量: ${model.quality_rating}/10, 速度: ${model.speed_rating}/10`;

    return reasoning;
  }

  // 估算成本
  private estimateCost(modelId: string): number {
    const model = this.modelRegistry.getModel(modelId);
    return model ? model.cost_per_1k_tokens : 0;
  }

  // 获取速度评分
  private getSpeedRating(modelId: string): number {
    const model = this.modelRegistry.getModel(modelId);
    return model ? model.speed_rating : 0;
  }

  // 获取默认模型
  private getDefaultModel(): string {
    return this.getDefaultModelByComplexity('medium');
  }

  // 根据复杂度获取默认模型
  private getDefaultModelByComplexity(complexityThreshold: 'low' | 'medium' | 'high'): string {
    const availableModels = this.modelRegistry.getAvailableModels();
    
    // 从环境变量获取复杂度模型列表
    const preferredOrder = this.getComplexityModelList(complexityThreshold);

    // 筛选符合复杂度阈值的可用模型
    for (const modelId of preferredOrder) {
      if (availableModels.includes(modelId)) {
        const model = this.modelRegistry.getModel(modelId);
        if (model) {
          // 检查模型是否适合当前复杂度
          if (!(model as any).complexity_threshold ||
              (model as any).complexity_threshold === complexityThreshold ||
              ((model as any).complexity_threshold === 'high' && complexityThreshold === 'high')) {
            return modelId;
          }
        }
      }
    }

    // 如果没找到合适的，返回第一个可用模型
    return availableModels[0] || 'gemini-flash-lite';
  }

  // 从环境变量获取复杂度模型列表
  private getComplexityModelList(complexityThreshold: 'low' | 'medium' | 'high'): string[] {
    let envVar: string;
    let defaultModels: string[];
    
    switch (complexityThreshold) {
      case 'high':
        envVar = process.env.COMPLEXITY_HIGH_MODELS || '';
        defaultModels = ['gemini-flash-lite', 'claude-sonnet-4-all', 'gpt-4o-all', 'deepseek-reasoner', 'hunyuan-t1-latest'];
        break;
      case 'medium':
        envVar = process.env.COMPLEXITY_MEDIUM_MODELS || '';
        defaultModels = ['gemini-flash-lite', 'gpt-4o-all', 'gemini-flash', 'qwen-turbo', 'hunyuan-turbos-latest'];
        break;
      case 'low':
        envVar = process.env.COMPLEXITY_LOW_MODELS || '';
        defaultModels = ['gemini-flash-lite', 'gemini-flash', 'qwen-turbo', 'hunyuan-turbos-latest', 'gpt-4o-all'];
        break;
      default:
        return ['gemini-flash-lite'];
    }

    // 如果环境变量存在且不为空，解析逗号分隔的模型列表
    if (envVar.trim()) {
      const models = envVar.split(',').map(model => model.trim()).filter(model => model);
      if (models.length > 0) {
        console.log(`🔧 使用环境变量配置的${complexityThreshold}复杂度模型列表: ${models.join(', ')}`);
        return models;
      }
    }

    // 使用默认配置
    console.log(`🔧 使用默认的${complexityThreshold}复杂度模型列表: ${defaultModels.join(', ')}`);
    return defaultModels;
  }

  // 将数值复杂度转换为阈值级别
  private getComplexityThreshold(complexity: number): 'low' | 'medium' | 'high' {
    if (complexity >= 5) return 'high';
    if (complexity >= 3) return 'medium';
    return 'low';
  }

  // 注册模型
  registerModel(model: ModelDefinition): void {
    this.modelRegistry.registerModel(model);
  }

  // 获取可用模型
  getAvailableModels(): ModelInfo[] {
    return this.modelRegistry.getAllModels().map(model => ({
      id: model.id,
      name: model.id,
      provider: model.type,
      capabilities: model.capabilities,
      available: this.modelRegistry.isModelAvailable(model.id),
      cost_per_1k_tokens: model.cost_per_1k_tokens,
      speed_rating: model.speed_rating,
      quality_rating: model.quality_rating
    }));
  }

  // 分析模型能力
  analyzeCapabilities(modelId: string): ModelCapabilities {
    const model = this.modelRegistry.getModel(modelId);
    return model ? model.capabilities : {};
  }

  // 重新加载配置
  async reloadConfiguration(): Promise<void> {
    await this.modelRegistry.reloadConfiguration();
  }
}

// 导出单例实例
export const intelligentRouter = new IntelligentRouterUnified();

// 导出便捷函数
export async function routeRequest(request: RoutingRequest): Promise<RoutingDecision> {
  return intelligentRouter.route(request);
}

export function getAvailableModels(): ModelInfo[] {
  return intelligentRouter.getAvailableModels();
}

export function analyzeModelCapabilities(modelId: string): ModelCapabilities {
  return intelligentRouter.analyzeCapabilities(modelId);
}

export async function reloadModelConfiguration(): Promise<void> {
  return intelligentRouter.reloadConfiguration();
}