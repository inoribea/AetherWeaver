import fs from 'fs';
import path from 'path';
import { BaseMessage } from '@langchain/core/messages';

// 模型配置接口
interface ModelConfig {
  type: string;
  config: {
    apiKey: string;
    baseURL?: string;
    model: string;
    temperature: number;
  };
  capabilities: Record<string, boolean>;
  priority: Record<string, number>;
  cost_per_1k_tokens: number;
  speed_rating: number;
  quality_rating: number;
}

interface RoutingRule {
  triggers: string[];
  required_capabilities: string[];
  fallback_destination: string;
}

interface ModelsConfig {
  models: Record<string, ModelConfig>;
  routing_rules: Record<string, RoutingRule>;
  selection_strategy: {
    primary: string;
    secondary: string;
    tertiary: string;
    fallback: string;
  };
}

// 路由决策结果
export interface RoutingDecision {
  destination: string;
  selectedModel: string;
  confidence: number;
  reasoning: string;
  alternatives: Array<{
    model: string;
    score: number;
    reason: string;
  }>;
}

// 智能路由器类
export class IntelligentRouter {
  private config!: ModelsConfig;
  private readonly configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'models-config.json');
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf-8');
      this.config = JSON.parse(configData);
    } catch (error) {
      console.error('Failed to load models config:', error);
      throw new Error('Models configuration file not found or invalid');
    }
  }

  // 重新加载配置（热更新）
  public reloadConfig(): void {
    this.loadConfig();
    console.log('✅ Models configuration reloaded');
  }

  // 主要路由决策方法
  public route(input: string, hasImage: boolean = false, conversationHistory?: BaseMessage[]): RoutingDecision {
    console.log(`[IntelligentRouter] Analyzing input: "${input.substring(0, 100)}..."`);
    
    // 1. 基于内容的目标检测
    const destination = this.detectDestination(input, hasImage);
    console.log(`[IntelligentRouter] Detected destination: ${destination}`);
    
    // 2. 获取符合条件的模型
    const eligibleModels = this.getEligibleModels(destination);
    console.log(`[IntelligentRouter] Eligible models: ${eligibleModels.map(m => m.name).join(', ')}`);
    
    // 3. 智能模型选择
    const selectedModel = this.selectBestModel(eligibleModels, input, conversationHistory);
    console.log(`[IntelligentRouter] Selected model: ${selectedModel.name}`);
    
    // 4. 生成决策结果
    return {
      destination,
      selectedModel: selectedModel.name,
      confidence: selectedModel.confidence,
      reasoning: selectedModel.reasoning,
      alternatives: eligibleModels
        .filter(m => m.name !== selectedModel.name)
        .slice(0, 3)
        .map(m => ({
          model: m.name,
          score: m.score,
          reason: m.reasoning
        }))
    };
  }

  // 检测目标处理类型
  private detectDestination(input: string, hasImage: boolean): string {
    const inputLower = input.toLowerCase();
    
    // 优先检查图像
    if (hasImage) {
      return 'vision_processing';
    }
    
    // 基于触发词检测
    for (const [destination, rule] of Object.entries(this.config.routing_rules)) {
      const matchCount = rule.triggers.filter(trigger => 
        inputLower.includes(trigger.toLowerCase())
      ).length;
      
      if (matchCount > 0) {
        console.log(`[DetectDestination] Matched "${destination}" with ${matchCount} triggers`);
        return destination;
      }
    }
    
    // 基于复杂度和长度的智能检测
    const complexity = this.analyzeComplexity(input);
    if (complexity.isComplex) {
      return 'complex_reasoning';
    }
    
    return 'simple_chat';
  }

  // 分析输入复杂度
  private analyzeComplexity(input: string): { isComplex: boolean; score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    
    // 长度检查
    if (input.length > 200) {
      score += 2;
      reasons.push('Long input text');
    }
    
    // 复杂句式检查
    const complexPatterns = [
      /如果.*那么/g,
      /因为.*所以/g,
      /不仅.*而且/g,
      /一方面.*另一方面/g,
      /if.*then/gi,
      /because.*therefore/gi,
      /not only.*but also/gi
    ];
    
    complexPatterns.forEach(pattern => {
      if (pattern.test(input)) {
        score += 1;
        reasons.push('Complex sentence structure');
      }
    });
    
    // 专业术语检查
    const technicalTerms = [
      '算法', '数据结构', '机器学习', '深度学习', '神经网络',
      'algorithm', 'data structure', 'machine learning', 'deep learning', 'neural network',
      '微积分', '线性代数', '概率论', '统计学',
      'calculus', 'linear algebra', 'probability', 'statistics'
    ];
    
    technicalTerms.forEach(term => {
      if (input.toLowerCase().includes(term.toLowerCase())) {
        score += 1;
        reasons.push('Technical terminology detected');
      }
    });
    
    return {
      isComplex: score >= 2,
      score,
      reasons
    };
  }

  // 获取符合条件的模型
  private getEligibleModels(destination: string): Array<{
    name: string;
    config: ModelConfig;
    score: number;
    confidence: number;
    reasoning: string;
  }> {
    const rule = this.config.routing_rules[destination];
    if (!rule) {
      throw new Error(`Unknown destination: ${destination}`);
    }
    
    const eligibleModels = [];
    
    for (const [modelName, modelConfig] of Object.entries(this.config.models)) {
      // 检查API密钥是否可用
      const apiKey = process.env[modelConfig.config.apiKey];
      if (!apiKey) {
        console.log(`[EligibleModels] Skipping ${modelName}: API key not available`);
        continue;
      }
      
      // 检查必需能力
      const hasRequiredCapabilities = rule.required_capabilities.every(capability => 
        modelConfig.capabilities[capability] === true
      );
      
      if (!hasRequiredCapabilities) {
        console.log(`[EligibleModels] Skipping ${modelName}: Missing required capabilities`);
        continue;
      }
      
      // 计算基础分数
      const priorityScore = modelConfig.priority[destination] || 5;
      const capabilityScore = this.calculateCapabilityScore(modelConfig, destination);
      const efficiencyScore = this.calculateEfficiencyScore(modelConfig);
      
      const totalScore = (priorityScore * 0.4) + (capabilityScore * 0.3) + (efficiencyScore * 0.3);
      
      eligibleModels.push({
        name: modelName,
        config: modelConfig,
        score: totalScore,
        confidence: Math.min(0.95, totalScore / 10),
        reasoning: `Priority: ${priorityScore}, Capability: ${capabilityScore.toFixed(1)}, Efficiency: ${efficiencyScore.toFixed(1)}`
      });
    }
    
    return eligibleModels.sort((a, b) => b.score - a.score);
  }

  // 计算能力分数
  private calculateCapabilityScore(config: ModelConfig, destination: string): number {
    let score = 0;
    const capabilities = config.capabilities;
    
    // 基础能力评分
    Object.entries(capabilities).forEach(([capability, hasCapability]) => {
      if (hasCapability) {
        score += 1;
      }
    });
    
    // 特定目标的能力加权
    const destinationWeights: Record<string, Record<string, number>> = {
      'vision_processing': { 'vision': 3, 'reasoning': 1 },
      'complex_reasoning': { 'reasoning': 3, 'mathematical_computation': 2 },
      'code_generation': { 'code_generation': 3, 'reasoning': 1 },
      'chinese_conversation': { 'chinese': 3, 'reasoning': 1 },
      'web_search': { 'search': 3, 'web_search': 3, 'reasoning': 1 },
      'mathematical_computation': { 'mathematical_computation': 3, 'reasoning': 2 },
      'structured_analysis': { 'structured_output': 3, 'reasoning': 1 },
      'creative_writing': { 'creative_writing': 3, 'reasoning': 1 },
      'agent_execution': { 'agents': 3, 'tool_calling': 2, 'reasoning': 1 }
    };
    
    const weights = destinationWeights[destination] || {};
    Object.entries(weights).forEach(([capability, weight]) => {
      if (capabilities[capability]) {
        score += weight;
      }
    });
    
    return score;
  }

  // 计算效率分数
  private calculateEfficiencyScore(config: ModelConfig): number {
    const strategy = this.config.selection_strategy;
    let score = 0;
    
    // 成本效率 (越低越好)
    const costScore = Math.max(0, 10 - (config.cost_per_1k_tokens * 1000));
    
    // 速度评分
    const speedScore = config.speed_rating;
    
    // 质量评分
    const qualityScore = config.quality_rating;
    
    // 根据策略加权
    if (strategy.secondary === 'cost_efficiency') {
      score += costScore * 0.4;
    }
    if (strategy.tertiary === 'speed_rating') {
      score += speedScore * 0.3;
    }
    if (strategy.fallback === 'quality_rating') {
      score += qualityScore * 0.3;
    }
    
    return score;
  }

  // 选择最佳模型
  private selectBestModel(
    eligibleModels: Array<{
      name: string;
      config: ModelConfig;
      score: number;
      confidence: number;
      reasoning: string;
    }>,
    input: string,
    conversationHistory?: BaseMessage[]
  ): {
    name: string;
    confidence: number;
    reasoning: string;
  } {
    if (eligibleModels.length === 0) {
      throw new Error('No eligible models found');
    }
    
    // 上下文相关性调整
    const contextAdjustedModels = this.adjustForContext(eligibleModels, input, conversationHistory);
    
    // 选择得分最高的模型
    const bestModel = contextAdjustedModels[0];
    
    return {
      name: bestModel.name,
      confidence: bestModel.confidence,
      reasoning: `Selected based on: ${bestModel.reasoning}. Context adjustment applied.`
    };
  }

  // 基于上下文调整模型选择
  private adjustForContext(
    models: Array<{
      name: string;
      config: ModelConfig;
      score: number;
      confidence: number;
      reasoning: string;
    }>,
    input: string,
    conversationHistory?: BaseMessage[]
  ): Array<{
    name: string;
    config: ModelConfig;
    score: number;
    confidence: number;
    reasoning: string;
  }> {
    return models.map(model => {
      let adjustedScore = model.score;
      let adjustmentReason = '';
      
      // 中文上下文调整
      if (this.containsChinese(input)) {
        if (model.config.capabilities.chinese) {
          adjustedScore += 2;
          adjustmentReason += 'Chinese context bonus; ';
        }
      }
      
      // 对话历史长度调整
      if (conversationHistory && conversationHistory.length > 5) {
        if (model.config.capabilities.reasoning) {
          adjustedScore += 1;
          adjustmentReason += 'Long conversation context bonus; ';
        }
      }
      
      // 输入长度调整
      if (input.length > 500) {
        if (model.config.capabilities.reasoning) {
          adjustedScore += 1;
          adjustmentReason += 'Long input context bonus; ';
        }
      }
      
      return {
        ...model,
        score: adjustedScore,
        confidence: Math.min(0.98, model.confidence + (adjustedScore - model.score) * 0.1),
        reasoning: model.reasoning + (adjustmentReason ? ` Context: ${adjustmentReason}` : '')
      };
    }).sort((a, b) => b.score - a.score);
  }

  // 检测是否包含中文
  private containsChinese(text: string): boolean {
    return /[\u4e00-\u9fff]/.test(text);
  }

  // 获取可用模型列表
  public getAvailableModels(): string[] {
    return Object.keys(this.config.models).filter(modelName => {
      const modelConfig = this.config.models[modelName];
      const apiKey = process.env[modelConfig.config.apiKey];
      return !!apiKey;
    });
  }

  // 获取模型能力
  public getModelCapabilities(modelName: string): Record<string, boolean> | null {
    const modelConfig = this.config.models[modelName];
    return modelConfig ? modelConfig.capabilities : null;
  }

  // 添加新模型（运行时）
  public addModel(modelName: string, config: ModelConfig): void {
    this.config.models[modelName] = config;
    console.log(`✅ Added new model: ${modelName}`);
  }

  // 更新模型配置
  public updateModel(modelName: string, updates: Partial<ModelConfig>): void {
    if (this.config.models[modelName]) {
      this.config.models[modelName] = {
        ...this.config.models[modelName],
        ...updates
      };
      console.log(`✅ Updated model: ${modelName}`);
    }
  }

  // 保存配置到文件
  public saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      console.log('✅ Configuration saved successfully');
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  }
}

// 单例实例
export const intelligentRouter = new IntelligentRouter();