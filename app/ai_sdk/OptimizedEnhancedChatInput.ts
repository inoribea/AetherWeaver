import { v4 as uuidv4 } from "uuid";
import { loadEnvConfig } from "../../utils/envConfig";

type Message = {
  text: string;
  sender?: string;
  sender_name?: string;
  session_id?: string;
  files?: any[];
  metadata?: Record<string, any>;
};

type Data = {
  data: any;
  text?: string;
};

export class OptimizedEnhancedChatInput {
  input_value: string;
  routing_mode: "auto" | "explicit" | "hybrid";
  output_format: "lcel_compatible" | "langflow_standard" | "openai_format" | "langchainjs_export";
  enable_pre_routing: boolean;
  vercel_mode: boolean;
  langchainjs_export: boolean;
  flatten_metadata: boolean;
  explicit_route_hint: string;
  should_store_message: boolean;
  sender: string;
  sender_name: string;
  session_id?: string;
  files?: any[];
  model_preference: string;
  status: string;

  constructor(params: Partial<OptimizedEnhancedChatInput> = {}) {
    this.input_value = params.input_value || "";
    this.routing_mode = params.routing_mode || "auto";
    this.output_format = params.output_format || "lcel_compatible";
    this.enable_pre_routing = params.enable_pre_routing ?? true;
    this.vercel_mode = params.vercel_mode ?? false;
    this.langchainjs_export = params.langchainjs_export ?? false;
    this.flatten_metadata = params.flatten_metadata ?? true;
    this.explicit_route_hint = params.explicit_route_hint || "";
    this.should_store_message = params.should_store_message ?? true;
    this.sender = params.sender || "user";
    this.sender_name = params.sender_name || "User";
    this.session_id = params.session_id;
    this.files = params.files || [];
    this.model_preference = params.model_preference || "gpt-4o-mini";
    this.status = "";
  }

  private loadEnvironmentConfig() {
    const defaultConfig = {
      session_id: `session_${uuidv4().slice(0, 8)}`,
      user_id: "anonymous",
      model_configs: {
        basic: { model: "gpt-4.1", temperature: 0.1 },
        enhanced: { model: "gpt-4o-mini", temperature: 0.3 },
        rag: { model: "gpt-4o-mini", temperature: 0.2 },
        agent: { model: "gpt-4o", temperature: 0.5 },
      },
      routing_thresholds: {
        confidence_threshold: 0.8,
        requires_llm_threshold: 0.7,
      },
      export_settings: {
        langchainjs_compatible: true,
        flatten_metadata: this.flatten_metadata,
        include_timestamps: true,
      },
    };
    return loadEnvConfig(this.vercel_mode, "CHAT_INPUT_CONFIG", defaultConfig);
  }

  private _normalizeInput(inputText: any): string {
    if (inputText === null || inputText === undefined) {
      return "";
    }
    if (typeof inputText !== "string") {
      inputText = String(inputText);
    }
    const normalized = inputText.trim();
    if (!normalized) {
      return "空消息";
    }
    return normalized;
  }

  private _analyzeMessageBasics(message: string): Record<string, any> {
    const textLower = message.toLowerCase();
    const words = message.split(/\s+/);

    const hasCodePatterns = ["```", "def ", "class ", "import ", "function(", "代码", "函数"];
    const questionPatterns = ["什么", "怎么", "为什么", "如何", "哪里", "when", "what", "how", "why", "where", "是否", "能否"];
    const contextKeywords = ["历史", "之前", "文档", "资料", "记录", "上次", "前面", "以前", "查找", "搜索", "记住", "回忆"];
    const toolKeywords = ["计算", "搜索", "查询", "分析", "执行", "调用", "运行", "处理", "生成", "翻译"];

    const analysis: Record<string, any> = {
      length: message.length,
      word_count: words.length,
      is_question: message.includes("?"),
      has_code: hasCodePatterns.some((pattern) => textLower.includes(pattern)),
      complexity: 1,
      needs_context: contextKeywords.some((kw) => textLower.includes(kw)),
      needs_tools: toolKeywords.some((kw) => textLower.includes(kw)),
      language: [...message].some((c) => c >= "\u4e00" && c <= "\u9fff") ? "chinese" : "english",
    };

    analysis.is_question = analysis.is_question || questionPatterns.some((q) => textLower.includes(q));

    if (message.length > 500) {
      analysis.complexity = 3;
    } else if (message.length > 200) {
      analysis.complexity = 2;
    }

    return analysis;
  }

  private _validateExplicitRoute(hint: string): string {
    const validRoutes = ["basic", "enhanced", "rag", "agent", "complex"];
    const hintLower = hint.toLowerCase().trim();

    if (validRoutes.includes(hintLower)) {
      return hintLower;
    }

    const routeMapping: Record<string, string> = {
      简单: "basic",
      基础: "basic",
      快速: "basic",
      增强: "enhanced",
      复杂: "enhanced",
      高级: "enhanced",
      检索: "rag",
      搜索: "rag",
      文档: "rag",
      代理: "agent",
      工具: "agent",
      执行: "agent",
    };

    return routeMapping[hintLower] || "basic";
  }

  private _determinePriority(route: string, confidence: number): string {
    const priorityMap: Record<string, string> = {
      basic: "low",
      enhanced: "high",
      rag: "medium",
      agent: "high",
      complex: "critical",
    };

    const basePriority = priorityMap[route] || "normal";

    if (confidence < 0.7) {
      return "normal";
    }

    return basePriority;
  }

  private _estimateTokens(length: number): number {
    return Math.max(1, Math.floor(length / 4));
  }

  private _smartRouteAnalysis(message: string, baseAnalysis: Record<string, any>, envConfig: any): [string, number] {
    const textLower = message.toLowerCase();

    const routeConditions: Record<string, { keywords: string[]; base_confidence: number }> = envConfig.route_conditions || {
      basic: {
        keywords: ["简单", "快速", "直接", "什么是", "怎么样", "hello", "hi", "你好"],
        base_confidence: 0.85,
      },
      enhanced: {
        keywords: ["分析", "详细", "深入", "全面", "比较", "评估", "策略", "复杂", "专业", "高级"],
        base_confidence: 0.8,
      },
      rag: {
        keywords: ["查找", "搜索", "文档", "资料", "数据库", "知识库", "历史", "之前", "记录", "档案"],
        base_confidence: 0.9,
      },
      agent: {
        keywords: ["执行", "调用", "工具", "计算", "运行", "处理", "操作", "自动"],
        base_confidence: 0.85,
      },
    };

    let bestRoute = "basic";
    let maxConfidence = 0.6;

    for (const [routeName, routeConfig] of Object.entries(routeConditions)) {
      let confidence = routeConfig.base_confidence;

      const keywordMatches = routeConfig.keywords.reduce((count: number, keyword: string) => {
        return count + (textLower.includes(keyword) ? 1 : 0);
      }, 0);

      try {
        if (this._checkRouteConditions(routeName, baseAnalysis)) {
          confidence += 0.1;
        }
      } catch {
        // ignore
      }

      if (confidence > maxConfidence) {
        maxConfidence = confidence;
        bestRoute = routeName;
      }
    }

    return [bestRoute, Math.min(0.95, maxConfidence)];
  }

  private _checkRouteConditions(routeName: string, analysis: Record<string, any>): boolean {
    if (routeName === "basic") {
      return analysis.complexity === 1 && !analysis.needs_tools && !analysis.needs_context;
    } else if (routeName === "enhanced") {
      return analysis.complexity >= 2 || analysis.has_code;
    } else if (routeName === "rag") {
      return analysis.needs_context;
    } else if (routeName === "agent") {
      return analysis.needs_tools;
    }
    return false;
  }

  invoke(input?: any, config?: Record<string, any>): Data {
    if (input !== undefined) {
      this.input_value = input;
    }
    const envConfig = this.loadEnvironmentConfig();
    const normalizedInput = this._normalizeInput(this.input_value);
    if (!normalizedInput) {
      return this._createErrorOutput("Empty or invalid input", envConfig);
    }
    try {
      const routingAnalysis = this._performRoutingAnalysis(normalizedInput, envConfig);
      const baseMessage = this._createBaseMessage(normalizedInput, envConfig);

      if (this.langchainjs_export || this.output_format === "langchainjs_export") {
        return this._createLangchainjsOutput(baseMessage, routingAnalysis, envConfig);
      } else if (this.output_format === "lcel_compatible") {
        return this._createLcelOutputFormat(baseMessage, routingAnalysis, envConfig);
      } else if (this.output_format === "openai_format") {
        return this._createOpenaiOutput(baseMessage, routingAnalysis, envConfig);
      } else {
        return this._createStandardOutput(baseMessage, routingAnalysis, envConfig);
      }
    } catch (e) {
      this.status = `❌ Error: ${(e as Error).message.slice(0, 50)}`;
      return this._createErrorOutput((e as Error).message, envConfig);
    }
  }

  async ainvoke(input?: any, config?: Record<string, any>): Promise<Data> {
    if (input !== undefined) {
      this.input_value = input;
    }
    return this.invoke(this.input_value, config);
  }

  async *stream(input?: any, config?: Record<string, any>): AsyncGenerator<Data, void, unknown> {
    if (input !== undefined) {
      this.input_value = input;
    }
    yield this.invoke(this.input_value, config);
  }

  async *astream(input?: any, config?: Record<string, any>): AsyncGenerator<Data, void, unknown> {
    for await (const msg of this.stream(input, config)) {
      yield msg;
    }
  }

  batch(inputs: any[], config?: Record<string, any>): Data[] {
    const results: Data[] = [];
    for (const input of inputs) {
      results.push(this.invoke(input, config));
    }
    return results;
  }

  async abatch(inputs: any[], config?: Record<string, any>): Promise<Data[]> {
    const promises = inputs.map((input) => this.ainvoke(input, config));
    return Promise.all(promises);
  }

  private _createErrorOutput(errorMsg: string, envConfig: any): Data {
    const errorMessage: Message = {
      text: `输入处理错误: ${errorMsg}`,
      sender: "system",
    };
    const basicAnalysis = {
      routing_decision: "basic",
      confidence: 0.5,
      requires_llm_routing: false,
      error: true,
      error_message: errorMsg,
    };
    return {
      data: {
        type: "error",
        message: errorMessage,
        routing_analysis: basicAnalysis,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private _performRoutingAnalysis(message: string, envConfig: any): any {
    const baseAnalysis = this._analyzeMessageBasics(message);
    const thresholds = envConfig.routing_thresholds || { confidence_threshold: 0.8, requires_llm_threshold: 0.7 };
    const confidenceThreshold = thresholds.confidence_threshold;

    let routeDecision: string;
    let confidence: number;

    if (this.routing_mode === "explicit" && this.explicit_route_hint) {
      routeDecision = this._validateExplicitRoute(this.explicit_route_hint);
      confidence = 0.95;
    } else if (this.routing_mode === "auto") {
      [routeDecision, confidence] = this._smartRouteAnalysis(message, baseAnalysis, envConfig);
    } else {
      const [autoRoute, autoConf] = this._smartRouteAnalysis(message, baseAnalysis, envConfig);
      if (this.explicit_route_hint) {
        const explicitRoute = this._validateExplicitRoute(this.explicit_route_hint);
        routeDecision = autoConf < confidenceThreshold ? explicitRoute : autoRoute;
        confidence = Math.max(autoConf, 0.85);
      } else {
        routeDecision = autoRoute;
        confidence = autoConf;
      }
    }

    return {
      routing_decision: routeDecision,
      confidence,
      routing_mode: this.routing_mode,
      requires_llm_routing: confidence < (envConfig.routing_thresholds?.requires_llm_threshold ?? 0.7),
      analysis_timestamp: new Date().toISOString(),
      message_length: baseAnalysis.length,
      word_count: baseAnalysis.word_count,
      is_question: baseAnalysis.is_question,
      has_code: baseAnalysis.has_code,
      complexity: baseAnalysis.complexity,
      needs_context: baseAnalysis.needs_context,
      needs_tools: baseAnalysis.needs_tools,
      language: baseAnalysis.language,
      priority: this._determinePriority(routeDecision, confidence),
      estimated_tokens: this._estimateTokens(baseAnalysis.length),
      model_config: envConfig.model_configs?.[routeDecision] || {},
      component_source: "OptimizedEnhancedChatInput",
      lcel_compatible: true,
      langchainjs_ready: this.langchainjs_export,
    };
  }

  private _createBaseMessage(message: string, envConfig: any): Message {
    const sessionId = this.session_id || envConfig.session_id || `session_${uuidv4().slice(0, 8)}`;
    const baseMessage: Message = {
      text: message,
      sender: this.sender,
      sender_name: this.sender_name,
      session_id: sessionId,
      files: [],
    };
    if (this.files && this.files.length > 0) {
      const validatedFiles = this.files.filter((file) => file && file.name);
      baseMessage.files = validatedFiles;
    }
    return baseMessage;
  }

  private _createLangchainjsOutput(message: Message, analysis: any, envConfig: any): Data {
    const langchainjsData = {
      input: message.text,
      metadata: analysis,
      type: "chat_input",
      source: "langflow",
      version: "1.0",
      timestamp: new Date().toISOString(),
      routing: {
        decision: analysis.routing_decision,
        confidence: analysis.confidence,
        mode: analysis.routing_mode,
      },
      message: {
        content: message.text,
        role: "user",
        session_id: message.session_id,
        sender: message.sender,
      },
      config: {
        model: envConfig.model_configs?.[analysis.routing_decision]?.model || this.model_preference,
        temperature: envConfig.model_configs?.[analysis.routing_decision]?.temperature || 0.3,
      },
    };
    this.status = `🔗 LangChain.js Ready: ${analysis.routing_decision.toUpperCase()} (conf: ${analysis.confidence.toFixed(2)})`;
    return {
      data: langchainjsData,
      text: message.text,
    };
  }

  private _createLcelOutputFormat(message: Message, analysis: any, envConfig: any): Data {
    const lcelData = {
      input: message.text,
      message,
      ...analysis,
      conditions: {
        is_basic: analysis.routing_decision === "basic",
        is_enhanced: analysis.routing_decision === "enhanced",
        is_rag: analysis.routing_decision === "rag",
        is_agent: analysis.routing_decision === "agent",
        needs_llm_analysis: analysis.requires_llm_routing,
      },
      env_mode: this.vercel_mode ? "vercel" : "standard",
    };
    this.status = `✅ LCEL Ready: ${analysis.routing_decision.toUpperCase()} (conf: ${analysis.confidence.toFixed(2)})`;
    return {
      data: lcelData,
      text: message.text,
    };
  }

  private _createOpenaiOutput(message: Message, analysis: any, envConfig: any): Data {
    const modelConfig = envConfig.model_configs?.[analysis.routing_decision] || {};
    const openaiData = {
      messages: [
        {
          role: "user",
          content: message.text,
          metadata: this.flatten_metadata ? analysis : { routing_hint: analysis.routing_decision },
        },
      ],
      model: modelConfig.model || this.model_preference,
      temperature: modelConfig.temperature || 0.3,
      routing_context: analysis,
      stream: false,
    };
    this.status = `🔄 OpenAI Format: ${analysis.routing_decision} ready`;
    return { data: openaiData };
  }

  private _createStandardOutput(message: Message, analysis: any, envConfig: any): Data {
    return {
      data: {
        type: "enhanced_chat_input",
        message,
        routing_analysis: analysis,
        timestamp: new Date().toISOString(),
        env_config: envConfig.exclude_env_from_output ? {} : envConfig,
      },
    };
  }
}