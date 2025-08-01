import { loadEnvConfig } from "../../../utils/envConfig";
type Message = any;

export class OptimizedEnhancedRouter {
  displayName = "Enhanced Router (LCEL Compatible)";
  description = "智能路由组件，支持多策略匹配，元数据增强，异步和流式调用";
  icon = "route";
  name = "OptimizedEnhancedRouter";

  routingMessage?: Message;
  matchRoute: string = "basic";
  matchingStrategy: string = "smart_flexible";
  vercelMode: boolean = false;
  langchainjsExport: boolean = false;
  flattenMetadata: boolean = true;
  enableRunnableInterface: boolean = true;
  supportReassignment: boolean = true;
  supportMemory: boolean = true;
  confidenceThreshold: number = 0.6;
  caseSensitive: boolean = false;
  enableFallback: boolean = true;
  status: string = "";

  constructor(config?: Partial<OptimizedEnhancedRouter>) {
    if (config) {
      Object.assign(this, config);
    }
  }

  private _loadEnvironmentConfig(): Record<string, any> {
    const defaultConfig = {
      matchingStrategies: {
        exact_match: { strict: true, fallback: false },
        metadata_priority: { preferMetadata: true, textFallback: true },
        confidence_aware: { thresholdRequired: true, dynamicThreshold: false },
        smart_flexible: { multiLevel: true, adaptive: true },
        langchainjs_compatible: { runnableInterface: true, flattenOutput: true },
      },
      routeSimilarities: {
        basic: ["simple", "easy", "quick", "fast"],
        enhanced: ["complex", "advanced", "detailed", "deep", "sophisticated"],
        rag: ["search", "retrieve", "document", "knowledge", "lookup"],
        agent: ["tool", "execute", "action", "api"],
      },
      confidenceAdjustments: {
        reassignmentPenalty: 0.2,
        fallbackBoost: 0.1,
        memoryBoost: 0.15,
      },
      memorySupport: {
        langflowChatMemory: this.supportMemory,
        customMemory: this.supportMemory,
        boostFactor: 0.1,
      },
      langchainjsCompatibility: {
        exportFormat: this.langchainjsExport,
        flattenOutput: this.flattenMetadata,
        runnableInterface: this.enableRunnableInterface,
        asyncSupport: true,
        streamingSupport: true,
      },
      lcelConfiguration: {
        enableRunnable: this.enableRunnableInterface,
        enablePassthrough: true,
        enableLambda: true,
        enableParallel: true,
      },
    };

    function parseJSONEnvVar(envVarName: string): any | null {
      try {
        const val = process.env[envVarName];
        if (!val) return null;
        return JSON.parse(val);
      } catch {
        return null;
      }
    }

    // 逐个读取拆分的环境变量配置，合并覆盖默认配置
    const matchingStrategies = parseJSONEnvVar("LANGFLOW_ROUTER_MATCHING_STRATEGIES");
    if (matchingStrategies) Object.assign(defaultConfig.matchingStrategies, matchingStrategies);

    const routeSimilarities = parseJSONEnvVar("LANGFLOW_ROUTER_ROUTE_SIMILARITIES");
    if (routeSimilarities) Object.assign(defaultConfig.routeSimilarities, routeSimilarities);

    const confidenceAdjustments = parseJSONEnvVar("LANGFLOW_ROUTER_CONFIDENCE_ADJUSTMENTS");
    if (confidenceAdjustments) Object.assign(defaultConfig.confidenceAdjustments, confidenceAdjustments);

    const memorySupport = parseJSONEnvVar("LANGFLOW_ROUTER_MEMORY_SUPPORT");
    if (memorySupport) Object.assign(defaultConfig.memorySupport, memorySupport);

    const langchainjsCompatibility = parseJSONEnvVar("LANGFLOW_ROUTER_LANGCHAINJS_COMPATIBILITY");
    if (langchainjsCompatibility) Object.assign(defaultConfig.langchainjsCompatibility, langchainjsCompatibility);

    const lcelConfiguration = parseJSONEnvVar("LANGFLOW_ROUTER_LCEL_CONFIGURATION");
    if (lcelConfiguration) Object.assign(defaultConfig.lcelConfiguration, lcelConfiguration);

    // 兼容旧环境变量，优先级最低
    const legacyConfig = parseJSONEnvVar("LANGFLOW_CONDITIONAL_ROUTER_CONFIG");
    if (legacyConfig) Object.assign(defaultConfig, legacyConfig);

    return defaultConfig;
  }

  private extractRoutingInfo(message: Message): Record<string, any> {
    const routingInfo: Record<string, any> = {
      route: "basic",
      confidence: 0.5,
      metadataAvailable: false,
      textRoute: null,
      lcelCompatible: false,
      reassignmentInfo: {},
      memoryInfo: {},
      langchainjsFormat: false,
      memoryFormat: "none",
    };
    if (!message) return routingInfo;
    try {
      if (message.text) {
        const text = message.text.trim().toLowerCase();
        if (["basic", "enhanced", "rag", "agent"].includes(text)) {
          routingInfo.textRoute = text;
        }
      }
      if (message.metadata) {
        routingInfo.metadataAvailable = true;
        const md = message.metadata;
        routingInfo.langchainjsFormat = md.langchainjsReady || md.runnableInterface || false;
        routingInfo.lcelCompatible = md.lcelCompatible || false;
        routingInfo.memoryFormat = md.memoryFormat || "none";
        routingInfo.route = md.routingDecision || md.route || md.routingHint || "basic";
        routingInfo.confidence = parseFloat(md.confidence) || 0.5;
        if (this.supportReassignment) {
          routingInfo.reassignmentInfo = this.flattenMetadata
            ? {
                required: md.reassignmentRequired || false,
                reason: md.reassignmentReason || [],
                attemptCount: md.reassignmentAttemptCount || 0,
                originalRoute: md.reassignmentOriginalRoute || null,
              }
            : md.reassignment || {};
        }
        if (this.supportMemory) {
          routingInfo.memoryInfo = this.flattenMetadata
            ? {
                hasMemory: md.hasMemory || false,
                conversationHistory: md.conversationHistory || "",
                memoryLength: md.memoryLength || 0,
                conversationRounds: md.conversationRounds || 0,
                memoryFormat: md.memoryFormat || "none",
              }
            : md.memory || {};
        }
        routingInfo.analysisMethod = md.analysisMethod || "unknown";
        routingInfo.componentSource = md.componentSource || "unknown";
      }
    } catch (e) {
      this.status = `⚠️ Info extraction error: ${String(e).slice(0, 25)}...`;
    }
    return routingInfo;
  }

  private evaluateRouteMatch(
    routingInfo: Record<string, any>,
    targetRoute: string,
    envConfig: Record<string, any>
  ): [boolean, string, number] {
    let detectedRoute = routingInfo.route;
    let confidence = routingInfo.confidence;
    let textRoute = routingInfo.textRoute;
    const reassignmentInfo = routingInfo.reassignmentInfo || {};
    const memoryInfo = routingInfo.memoryInfo || {};
    const threshold = this.confidenceThreshold;
    let matchResult = false;
    let matchReason = "no_match";
    let effectiveConfidence = confidence;

    if (!this.caseSensitive) {
      detectedRoute = detectedRoute.toLowerCase();
      targetRoute = targetRoute.toLowerCase();
      if (textRoute) textRoute = textRoute.toLowerCase();
    }

    const confAdj = envConfig.confidenceAdjustments || {};
    const memSupport = envConfig.memorySupport || {};

    if (reassignmentInfo.required) {
      effectiveConfidence = Math.max(0.1, confidence - (confAdj.reassignmentPenalty || 0.2));
    }
    if (memoryInfo.hasMemory && this.supportMemory) {
      effectiveConfidence = Math.min(1.0, effectiveConfidence + (memSupport.boostFactor || 0.1));
    }

    switch (this.matchingStrategy) {
      case "exact_match":
        matchResult = detectedRoute === targetRoute;
        matchReason = matchResult ? "exact_match" : "exact_no_match";
        break;
      case "metadata_priority":
        if (routingInfo.metadataAvailable) {
          matchResult = detectedRoute === targetRoute;
          matchReason = matchResult ? "metadata_match" : "metadata_no_match";
        } else if (textRoute) {
          matchResult = textRoute === targetRoute;
          matchReason = matchResult ? "text_fallback" : "text_no_fallback";
        }
        break;
      case "confidence_aware":
        if (effectiveConfidence >= threshold) {
          matchResult = detectedRoute === targetRoute;
          matchReason = matchResult ? "confidence_sufficient" : "confidence_insufficient";
        } else {
          matchResult = false;
          matchReason = "confidence_below_threshold";
        }
        break;
      case "langchainjs_compatible":
        if (routingInfo.langchainjsFormat) {
          matchResult = detectedRoute === targetRoute;
          matchReason = matchResult ? "langchainjs_match" : "langchainjs_no_match";
        } else {
          [matchResult, matchReason, effectiveConfidence] = this.smartFlexibleMatch(
            detectedRoute,
            targetRoute,
            textRoute,
            effectiveConfidence,
            threshold,
            envConfig
          );
        }
        break;
      default:
        [matchResult, matchReason, effectiveConfidence] = this.smartFlexibleMatch(
          detectedRoute,
          targetRoute,
          textRoute,
          effectiveConfidence,
          threshold,
          envConfig
        );
    }
    return [matchResult, matchReason, effectiveConfidence];
  }

  private smartFlexibleMatch(
    detectedRoute: string,
    targetRoute: string,
    textRoute: string | null,
    effectiveConfidence: number,
    threshold: number,
    envConfig: Record<string, any>
  ): [boolean, string, number] {
    if (detectedRoute === targetRoute) return [true, "smart_exact_match", effectiveConfidence];
    if (textRoute && textRoute === targetRoute) return [true, "smart_text_match", Math.min(1.0, effectiveConfidence + 0.1)];
    if (this.enableFallback && this.checkFallbackMatch(detectedRoute, targetRoute, envConfig)) {
      return [true, "smart_fallback_match", Math.max(0.4, effectiveConfidence - 0.1)];
    }
    if (effectiveConfidence < threshold - 0.1) return [false, "smart_low_confidence", effectiveConfidence];
    return [false, "smart_no_match", effectiveConfidence];
  }

  private checkFallbackMatch(detectedRoute: string, targetRoute: string, envConfig: Record<string, any>): boolean {
    const similarities = envConfig.routeSimilarities || {
      basic: ["simple", "easy", "quick", "fast"],
      enhanced: ["complex", "advanced", "detailed", "deep", "sophisticated"],
      rag: ["search", "retrieve", "document", "knowledge", "lookup"],
      agent: ["tool", "execute", "action", "api"],
    };
    return similarities[targetRoute]?.includes(detectedRoute) || false;
  }

  invoke(input: Message | any, config?: Record<string, any>): Message {
    const originalInput = this.routingMessage;
    this.routingMessage = input instanceof Object ? input : { text: String(input) };
    try {
      const envConfig = this._loadEnvironmentConfig();
      const routingInfo = this.extractRoutingInfo(this.routingMessage);
      const [match, reason, confidence] = this.evaluateRouteMatch(routingInfo, this.matchRoute, envConfig);
      if (match) {
        return this._enhanceMessageMetadata(this.routingMessage, reason, confidence, routingInfo, envConfig);
      } else {
        const blockedMsg = this._enhanceMessageMetadata(this.routingMessage, `blocked_${reason}`, confidence, routingInfo, envConfig);
        blockedMsg.metadata = blockedMsg.metadata || {};
        blockedMsg.metadata.blocked = true;
        return blockedMsg;
      }
    } finally {
      this.routingMessage = originalInput;
    }
  }

  async ainvoke(input: Message | any, config?: Record<string, any>): Promise<Message> {
    return this.invoke(input, config);
  }

  *stream(input: Message | any, config?: Record<string, any>): Generator<Message> {
    const result = this.invoke(input, config);
    yield result;
  }

  async *astream(input: Message | any, config?: Record<string, any>): AsyncGenerator<Message> {
    const result = await this.ainvoke(input, config);
    yield result;
  }

  batch(inputs: Array<Message | any>, config?: Record<string, any>): Message[] {
    return inputs.map((input) => this.invoke(input, config));
  }

  async abatch(inputs: Array<Message | any>, config?: Record<string, any>): Promise<Message[]> {
    const results: Message[] = [];
    for (const input of inputs) {
      results.push(await this.ainvoke(input, config));
    }
    return results;
  }

  private _enhanceMessageMetadata(
    message: Message,
    reason: string,
    confidence: number,
    routingInfo: Record<string, any>,
    envConfig: Record<string, any>
  ): Message {
    if (!message.metadata) message.metadata = {};
    if (this.langchainjsExport) {
      Object.assign(message.metadata, {
        conditionalRouter: "OptimizedEnhancedRouter",
        targetRoute: this.matchRoute,
        matchReason: reason,
        confidence,
        matchingStrategy: this.matchingStrategy,
        passed: true,
        routeStep: `conditional_${this.matchRoute}`,
        lcelCompatible: true,
        langchainjsReady: true,
        runnableInterface: this.enableRunnableInterface,
        timestamp: new Date().toISOString(),
        vercelMode: this.vercelMode,
        flattenMetadata: this.flattenMetadata,
        supportMemory: this.supportMemory,
      });
    } else if (this.flattenMetadata) {
      Object.assign(message.metadata, {
        conditionalTargetRoute: this.matchRoute,
        conditionalMatchReason: reason,
        conditionalConfidence: confidence,
        conditionalMatchingStrategy: this.matchingStrategy,
        passed: true,
        routeStep: `conditional_${this.matchRoute}`,
        lcelCompatible: routingInfo.lcelCompatible,
        runnableInterface: this.enableRunnableInterface,
      });
    } else {
      message.metadata.conditionalRouting = {
        component: "OptimizedEnhancedRouter",
        targetRoute: this.matchRoute,
        matchReason: reason,
        confidence,
        matchingStrategy: this.matchingStrategy,
        passed: true,
        envConfig: envConfig.matchingStrategies[this.matchingStrategy],
        lcelCompatible: this.enableRunnableInterface,
        supportMemory: this.supportMemory,
      };
      message.metadata.routeStep = `conditional_${this.matchRoute}`;
      message.metadata.lcelCompatible = routingInfo.lcelCompatible;
    }
    return message;
  }
}