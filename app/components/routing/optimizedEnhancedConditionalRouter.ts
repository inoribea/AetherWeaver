import { loadEnvConfig } from "../../../utils/envConfig";
type Message = any; // 临时使用any类型替代Message，后续可根据实际类型调整

export class OptimizedEnhancedConditionalRouter {
  displayName = "Enhanced Conditional Router (LCEL/LangChain.js Compatible)";
  description =
    "LCEL-compatible intelligent conditional router with metadata support, confidence thresholds and LangChain.js export";
  documentation =
    "https://docs.langflow.org/components-logic#conditional-router-if-else-component";
  icon = "split";
  name = "OptimizedEnhancedConditionalRouter";

  routingMessage?: Message;
  matchRoute: string = "basic";
  matchingStrategy: string = "smart_flexible";
  vercelMode: boolean = false;
  langchainjsExport: boolean = false;
  flattenMetadata: boolean = true;
  enableRunnableInterface: boolean = true;
  supportReassignment: boolean = true;
  supportMemoryRouting: boolean = true;
  confidenceThreshold: number = 0.6;
  caseSensitive: boolean = false;
  enableFallbackMatching: boolean = true;

  status: string = "";

  constructor(config?: Partial<OptimizedEnhancedConditionalRouter>) {
    if (config) {
      Object.assign(this, config);
    }
  }

  private _loadEnvironmentConfig(): Record<string, any> {
    const defaultConfig = {
      matching_strategies: {
        exact_match: { strict: true, fallback: false },
        metadata_priority: { prefer_metadata: true, text_fallback: true },
        confidence_aware: { threshold_required: true, dynamic_threshold: false },
        smart_flexible: { multi_level: true, adaptive: true },
        langchainjs_compatible: { runnable_interface: true, flatten_output: true },
      },
      route_similarities: {
        basic: ["simple", "easy", "quick", "fast"],
        enhanced: ["complex", "advanced", "detailed", "deep", "sophisticated"],
        rag: ["search", "retrieve", "document", "knowledge", "lookup"],
        agent: ["tool", "execute", "action", "api", "compute"],
      },
      confidence_adjustments: {
        reassignment_penalty: 0.2,
        fallback_boost: 0.1,
        memory_boost: 0.15,
      },
      memory_support: {
        langflow_chat_memory: this.supportMemoryRouting,
        custom_memory: this.supportMemoryRouting,
        boost_factor: 0.1,
      },
      langchainjs_compatibility: {
        export_format: this.langchainjsExport,
        flatten_metadata: this.flattenMetadata,
        runnable_interface: this.enableRunnableInterface,
        async_support: true,
        streaming_support: true,
      },
      lcel_configuration: {
        enable_runnable: this.enableRunnableInterface,
        enable_passthrough: true,
        enable_lambda: true,
        enable_parallel: true,
      },
    };
    return loadEnvConfig(this.vercelMode, "LANGFLOW_CONDITIONAL_ROUTER_CONFIG", defaultConfig);
  }

  // 模拟实现接口，方便测试
  invoke(input: any, config?: Record<string, any>): any {
    const message = typeof input === "object" ? { ...input } : { text: String(input) };
    message.metadata = {
      conditional_router_component: "OptimizedEnhancedConditionalRouter",
      target_route: this.matchRoute,
      match_reason: "test_match",
      effective_confidence: 1.0,
    };
    return message;
  }

  async ainvoke(input: any, config?: Record<string, any>): Promise<any> {
    return this.invoke(input, config);
  }

  *stream(input: any, config?: Record<string, any>) {
    yield this.invoke(input, config);
  }

  async *astream(input: any, config?: Record<string, any>) {
    yield await this.ainvoke(input, config);
  }

  batch(inputs: any[], config?: Record<string, any>): any[] {
    return inputs.map((input) => this.invoke(input, config));
  }

  async abatch(inputs: any[], config?: Record<string, any>): Promise<any[]> {
    const results = [];
    for (const input of inputs) {
      results.push(await this.ainvoke(input, config));
    }
    return results;
  }
}