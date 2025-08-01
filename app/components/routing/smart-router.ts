import { Runnable } from "@langchain/core/runnables";
import { BaseMessage } from "@langchain/core/messages";

interface SmartRoutingResult {
  route: 'basic' | 'enhanced' | 'rag' | 'agent';
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
    // 兼容 Vercel 环境变量
    if (typeof process !== "undefined" && process.env && process.env.VERCEL) {
      this.config.vercel_mode = true;
    }
    return await this.invokeWithRetry(input);
  }

  private detectChinese(text: string): boolean {
    const chineseChars = text.match(/[\u4e00-\u9fff]/g);
    return chineseChars ? chineseChars.length > text.length * 0.3 : false;
  }

  private analyzeByRules(text: string, isChinese: boolean): Partial<SmartRoutingResult> {
    // 规则分析实现，结合关键词和上下文
    const lower = text.toLowerCase();

    const keywords = {
      agent: ["计算", "执行", "调用", "运行", "查询", "上传", "下载", "api", "工具", "action"],
      rag: ["查找", "搜索", "资料", "文档", "数据库", "知识库", "记录", "历史"],
      enhanced: ["写", "创作", "生成", "分析", "解释", "详细", "专业", "复杂", "方案", "设计", "优化"],
    };

    const counts = {
      agent: keywords.agent.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0),
      rag: keywords.rag.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0),
      enhanced: keywords.enhanced.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0),
    };

    if (counts.agent >= 2) {
      return { route: "agent", confidence: 0.9, analysis_method: "rule_based" };
    } else if (counts.rag >= 2) {
      return { route: "rag", confidence: 0.85, analysis_method: "rule_based" };
    } else if (counts.enhanced >= 2) {
      return { route: "enhanced", confidence: 0.8, analysis_method: "rule_based" };
    } else {
      return { route: "basic", confidence: 0.6, analysis_method: "rule_based" };
    }
  }

  private async enhanceWithLLM(ruleResult: Partial<SmartRoutingResult>, text: string): Promise<Partial<SmartRoutingResult>> {
    if (!this.llm) {
      return ruleResult;
    }
    const prompt = `
请基于以下用户输入和规则分析结果，判断最合适的路由模式（basic, enhanced, rag, agent），并给出置信度（0-1）：
用户输入：${text}
规则分析结果：${JSON.stringify(ruleResult)}

请仅返回JSON格式：
{
  "route": "路由名称",
  "confidence": 置信度,
  "analysis_method": "llm_enhanced"
}
`;
    try {
      const response = await this.llm.invoke({ content: prompt });
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

  private async invokeWithRetry(input: BaseMessage, maxRetries = 3): Promise<SmartRoutingResult> {
    let attempt = 0;
    let lastResult: Partial<SmartRoutingResult> | null = null;
    const threshold = 0.6;

    while (attempt < maxRetries) {
      const ruleRes = this.analyzeByRules(input.content.toString(), this.detectChinese(input.content.toString()));
      const enhancedRes = this.config.analysis_mode === "llm_enhanced" ? await this.enhanceWithLLM(ruleRes, input.content.toString()) : ruleRes;

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
      } else {
        // 置信度低，升级路由
        if (enhancedRes.route === "basic") {
          enhancedRes.route = "enhanced";
          enhancedRes.confidence = (enhancedRes.confidence || 0.5) + 0.1;
        } else if (enhancedRes.route === "enhanced") {
          enhancedRes.route = "rag";
          enhancedRes.confidence = (enhancedRes.confidence || 0.5) + 0.1;
        } else if (enhancedRes.route === "rag") {
          enhancedRes.route = "agent";
          enhancedRes.confidence = (enhancedRes.confidence || 0.5) + 0.1;
        }
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