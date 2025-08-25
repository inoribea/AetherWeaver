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
}

export class SmartRouterComponent extends Runnable<BaseMessage> {
  lc_namespace = ["langchain", "custom", "smart_router"];
  private llm: any;
  private config: any;

  constructor(config: any = {}, llm?: any) {
    super();
    this.config = config;
    this.llm = llm;
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
    const chineseChars = text.match(/[\u4e00-\u9fff]/g);
    return chineseChars ? chineseChars.length > text.length * 0.3 : false;
  }

  private async analyzeByRules( // 修改为异步函数
    text: string,
    isChinese: boolean
  ): Promise<Partial<SmartRoutingResult>> { // 修改返回类型为 Promise
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

    return { route: bestRoute, confidence: maxConfidence, analysis_method: "rule_based" };
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
      const ruleRes = await this.analyzeByRules( // 调用异步函数
        input.content.toString(),
        this.detectChinese(input.content.toString())
      );
      const enhancedRes =
        this.config.analysis_mode === "llm_enhanced"
          ? await this.enhanceWithLLM(ruleRes, input.content.toString())
          : ruleRes;

      if (enhancedRes.confidence && enhancedRes.confidence >= threshold) {
        return {
          route: enhancedRes.route || "basic",
          confidence: enhancedRes.confidence,
          analysis_method: enhancedRes.analysis_method || "rule_based",
          has_memory: false,
          memory_format: "none",
          conversation_history: "",
          original_user_input: input.content.toString(),
          routing_is_chinese: this.detectChinese(input.content.toString()),
          langchain_ready: true,
        };
      }
      lastResult = enhancedRes;
      attempt++;
    }
    return {
      route: lastResult?.route || "basic",
      confidence: lastResult?.confidence || 0.5,
      analysis_method: lastResult?.analysis_method || "rule_based",
      has_memory: false,
      memory_format: "none",
      conversation_history: "",
      original_user_input: input.content.toString(),
      routing_is_chinese: this.detectChinese(input.content.toString()),
      langchain_ready: true,
    };
  }
}