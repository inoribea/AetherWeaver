import { Runnable } from "@langchain/core/runnables";
import { BaseMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai"; // 导入 ChatOpenAI
import modelsConfig from "../../../models-config.json";
import { segmentViaLambda } from "../../../app/api/jieba/lambdaClient"; // 导入 Jieba 分词客户端

type RouteType = "basic" | keyof typeof modelsConfig.routing_rules;

interface SmartRoutingResult {
  route: RouteType;
  confidence: number;
  analysis_method: string;
  has_memory: boolean;
  memory_format: string;
  conversation_history: string;
  original_user_input: string;
  routing_is_chinese: boolean;
  langchain_ready: boolean;
  matchedModelKey?: string;
}

export class SmartRouterComponent extends Runnable<BaseMessage> {
  lc_namespace = ["langchain", "custom", "smart_router"];
  private llm: any;
  private config: any;

  constructor(config: any = {}, llm?: any) {
    super();
    this.config = { ...config }; // 创建副本以避免修改原始对象
    this.llm = llm;

    // 从环境变量加载配置，如果未提供则使用现有config或默认值
    if (typeof process !== "undefined" && process.env) {
      this.config.analysis_mode =
        process.env.ANALYSIS_MODE || this.config.analysis_mode || "rule_based";

      const memorySupportEnv = process.env.LANGFLOW_ROUTER_MEMORY_SUPPORT;
      if (memorySupportEnv) {
        try {
          // 假设环境变量是 JSON 字符串，例如 {"enabled": true}
          const memoryConfig = JSON.parse(memorySupportEnv);
          this.config.supportMemory = memoryConfig.enabled ?? true;
        } catch {
          // 如果解析失败，回退到简单布尔值检查
          this.config.supportMemory = ['true', '1'].includes(memorySupportEnv.toLowerCase());
        }
      } else {
        this.config.supportMemory = this.config.supportMemory ?? true;
      }
    }
  }

  async invoke(input: BaseMessage): Promise<SmartRoutingResult> {
    if (!input || !input.content || typeof input.content !== "string") {
      throw new Error(
        "SmartRouterComponent.invoke: input must be BaseMessage with a string content"
      );
    }
    if (!input.additional_kwargs) {
      input.additional_kwargs = {};
    }
    if (typeof process !== "undefined" && process.env && process.env.VERCEL) {
      this.config.vercel_mode = true;
    }
    return await this.invokeWithRetry(input);
  }

  private detectChinese(text: string): boolean {
    const chineseChars = text.match(/[u4e00-u9fff]/g);
    return chineseChars ? chineseChars.length > text.length * 0.3 : false;
  }

  private async analyzeByRules(
    text: string,
    isChinese: boolean
  ): Promise<Partial<SmartRoutingResult>> {
    const lower = text.toLowerCase();
    let segmentedWords: string[] = [];

    if (isChinese) {
      try {
        segmentedWords = await segmentViaLambda(text);
        console.log("Jieba segmented words:", segmentedWords);
      } catch (error) {
        console.error("Jieba segmentation failed:", error);
        // 如果分词失败，仍然使用原始文本进行匹配
      }
    }

    // ---------- 显式模型名检测（优先级高） ----------
    // 遍历 modelsConfig.models，构建一个模型标识到模型键的映射
    const modelIdentifierToKey: Record<string, string> = {};
    for (const key of Object.keys(modelsConfig.models)) {
      const modelEntry: any = modelsConfig.models[key as keyof typeof modelsConfig.models];
      // model key 本身（如 "claude-sonnet-4-all"）
      modelIdentifierToKey[key.toLowerCase()] = key;
      // config.model 字段（如 "claude-sonnet-4-all"）
      if (modelEntry.config && (modelEntry.config as any).model) {
        modelIdentifierToKey[((modelEntry.config as any).model as string).toLowerCase()] = key;
      }
      // 也把 key 的分段词加入映射（如 "sonnet" => key）
      const keyParts = key.toLowerCase().split(/[-_/.]/).filter(Boolean);
      for (const part of keyParts) {
        modelIdentifierToKey[part] = key;
      }
      // 如果有 display_name 字段也加入
      if (modelEntry.display_name && typeof modelEntry.display_name === "string") {
        modelIdentifierToKey[(modelEntry.display_name as string).toLowerCase()] = key;
      }
    }

    // 检查分词结果或原始文本中是否包含任何模型标识
    const identifiersToSearch = segmentedWords.length > 0 ? segmentedWords.map(s => s.toLowerCase()) : [lower];
    for (const token of identifiersToSearch) {
      for (const ident in modelIdentifierToKey) {
        if (token.includes(ident) || ident.includes(token)) {
          const matchedModelKey = modelIdentifierToKey[ident];
          // 找到包含该模型的路由（首选模型列表中包含）
          for (const routeName in modelsConfig.routing_rules) {
            const routeRule = modelsConfig.routing_rules[routeName as keyof typeof modelsConfig.routing_rules];
            if (routeRule && Array.isArray(routeRule.preferred_models) && routeRule.preferred_models.includes(matchedModelKey)) {
              // 直接返回该路由，置信度较高，并返回 matchedModelKey
              return { route: routeName as RouteType, confidence: 0.95, analysis_method: "explicit_model", matchedModelKey };
            }
          }
          // 如果没有找到包含该模型的路由，也可直接选择该模型所在的默认路由（暂回退到 basic），并返回 matchedModelKey
          return { route: "basic", confidence: 0.8, analysis_method: "explicit_model", matchedModelKey };
        }
      }
    }

    let bestRoute: RouteType = "basic";
    let maxConfidence = 0.6; // Default confidence for basic

    for (const routeName in modelsConfig.routing_rules) {
      const rule = modelsConfig.routing_rules[routeName as keyof typeof modelsConfig.routing_rules];
      let score = 0;

      const keywordName = routeName.replace('_tasks', '');
      const relevantKeywords = modelsConfig.keywords[keywordName as keyof typeof modelsConfig.keywords];
      if (relevantKeywords) {
        // 优先匹配分词结果，如果分词结果为空或非中文，则回退到原始文本匹配
        if (segmentedWords.length > 0) {
          score += relevantKeywords.reduce((acc, kw) => acc + (segmentedWords.some(word => word.toLowerCase() === kw.toLowerCase()) ? 1 : 0), 0);
          // 如果分词逐词匹配没有命中，则尝试更宽松的匹配：
          // 1) 将所有分词拼接为一个字符串（joinedSeg），匹配像 "图"+"片" 被拆开的情况（joinedSeg 包含 "图片"）
          // 2) 检查相邻两词拼接（bigram），匹配可能被拆开的短词
          if (segmentedWords.length > 0 && score === 0) {
            const joinedSeg = segmentedWords.join('').toLowerCase();
            score += relevantKeywords.reduce((acc, kw) => {
              const k = kw.toLowerCase();
              // joined match
              if (joinedSeg.includes(k)) return acc + 1;
              // bigram match
              for (let i = 0; i < segmentedWords.length - 1; i++) {
                if ((segmentedWords[i] + segmentedWords[i + 1]).toLowerCase() === k) {
                  return acc + 1;
                }
              }
              return acc;
            }, 0);
          }
        } else {
          score += relevantKeywords.reduce((acc, kw) => acc + (lower.includes(kw.toLowerCase()) ? 1 : 0), 0);
        }
      }

      if (score > 0) {
        let currentConfidence = 0.5 + (score * 0.1);
        if (currentConfidence > 1) currentConfidence = 1;

        if (currentConfidence > maxConfidence || (currentConfidence === maxConfidence && bestRoute === "basic" && routeName !== "basic")) {
          maxConfidence = currentConfidence;
          bestRoute = routeName as RouteType;
        }
      }
    }

    const keywordMatchCounts: Record<string, number> = {};
          let totalMatches = 0;
          for (const rn in modelsConfig.routing_rules) {
            const kname = rn.replace('_tasks', '');
            const rks = modelsConfig.keywords[kname as keyof typeof modelsConfig.keywords] || [];
            for (const kw of rks) {
              const k = kw.toLowerCase();
              const match = segmentedWords.length > 0
                ? (segmentedWords.some(word => word.toLowerCase() === k) ||
                   segmentedWords.join('').toLowerCase().includes(k) ||
                   (() => {
                     for (let i = 0; i < segmentedWords.length - 1; i++) {
                       if ((segmentedWords[i] + segmentedWords[i + 1]).toLowerCase() === k) return true;
                     }
                     return false;
                   })())
                : lower.includes(k);
              if (match) {
                keywordMatchCounts[kw] = (keywordMatchCounts[kw] || 0) + 1;
                totalMatches++;
              }
            }
          }
          const joinedSeg = segmentedWords.join('').toLowerCase();
          const visionKeywords = modelsConfig.keywords?.vision || [];
          const hasImageHint = visionKeywords.some((vk: string) => {
            const k = vk.toLowerCase();
            return segmentedWords.length > 0
              ? (segmentedWords.some(w => w.toLowerCase() === k) || joinedSeg.includes(k))
              : lower.includes(k);
          });
          return {
            route: bestRoute,
            confidence: maxConfidence,
            analysis_method: "rule_based",
            segmentedWords,
            joinedSeg,
            keywordMatchCounts,
            totalMatches,
            hasImageHint
          };
  }

  private async enhanceWithLLM(
    ruleResult: Partial<SmartRoutingResult>,
    text: string
  ): Promise<Partial<SmartRoutingResult>> {
    const routingModelName = process.env.ROUTING_MODEL_NAME;
    const routingPromptTemplate = process.env.ROUTING_PROMPT || `
请基于以下用户输入和规则分析结果，判断最合适的路由模式（${Object.keys(modelsConfig.routing_rules).join(", ")}, basic），并给出置信度（0-1）：
用户输入：{text}
规则分析结果：{ruleResult}

请仅返回JSON格式：
{
  "route": "路由名称",
  "confidence": 置信度,
  "analysis_method": "llm_enhanced"
}
`;
    const routingTemperature = parseFloat(process.env.ROUTING_TEMPERATURE || "0");
    const routingTopP = parseFloat(process.env.ROUTING_TOP_P || "1");

    let llm = this.llm;
    if (routingModelName) {
      llm = new ChatOpenAI({
        model: routingModelName,
        temperature: routingTemperature,
        modelKwargs: {
          top_p: routingTopP,
        },
      });
    }

    if (!llm) {
      return ruleResult;
    }

    const prompt = routingPromptTemplate
      .replace("{text}", text)
      .replace("{ruleResult}", JSON.stringify(ruleResult));

    try {
      const response = await llm.invoke({ content: prompt });
      const content = response.content;
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        const jsonStr = content.substring(start, end + 1);
        const parsed = JSON.parse(jsonStr);
        if (parsed.route && typeof parsed.confidence === "number") {
          return {
            route: parsed.route,
            confidence: parsed.confidence,
            analysis_method: "llm_enhanced",
          };
        }
      }
    } catch {
      // 解析失败，返回规则结果
    }
    return ruleResult;
  }

  private async invokeWithRetry(
    input: BaseMessage,
    maxRetries = 3
  ): Promise<SmartRoutingResult> {
    let attempt = 0;
    let lastResult: Partial<SmartRoutingResult> | null = null;
    const threshold = this.config.confidence_threshold || 0.6;

    while (attempt < maxRetries) {
      const ruleRes = await this.analyzeByRules(
        input.content.toString(),
        this.detectChinese(input.content.toString())
      );
      const enhancedRes =
        this.config.analysis_mode === "llm_enhanced"
          ? await this.enhanceWithLLM(ruleRes, input.content.toString())
          : ruleRes;

      if (enhancedRes.confidence && enhancedRes.confidence >= threshold) {
        const kwargs = input.additional_kwargs || {};
        const hasMemory = this.config.supportMemory && (kwargs.hasMemory || (kwargs.memory && Object.keys(kwargs.memory).length > 0));

        return {
          route: enhancedRes.route || "basic",
          confidence: enhancedRes.confidence,
          analysis_method: enhancedRes.analysis_method || "rule_based",
          has_memory: hasMemory,
          memory_format: hasMemory ? (kwargs.memoryFormat || "unknown") : "none",
          conversation_history: hasMemory ? (kwargs.conversationHistory || "") : "",
          original_user_input: input.content.toString(),
          routing_is_chinese: this.detectChinese(input.content.toString()),
          langchain_ready: true,
          matchedModelKey: (enhancedRes as any).matchedModelKey,
        };
      }
      lastResult = enhancedRes;
      attempt++;
    }

    const kwargs = input.additional_kwargs || {};
    const hasMemory = this.config.supportMemory && (kwargs.hasMemory || (kwargs.memory && Object.keys(kwargs.memory).length > 0));

    return {
      route: lastResult?.route || "basic",
      confidence: lastResult?.confidence || 0.5,
      analysis_method: lastResult?.analysis_method || "rule_based",
      has_memory: hasMemory,
      memory_format: hasMemory ? (kwargs.memoryFormat || "unknown") : "none",
      conversation_history: hasMemory ? (kwargs.conversationHistory || "") : "",
      original_user_input: input.content.toString(),
      routing_is_chinese: this.detectChinese(input.content.toString()),
      langchain_ready: true,
      matchedModelKey: (lastResult as any).matchedModelKey,
    };
  }
}