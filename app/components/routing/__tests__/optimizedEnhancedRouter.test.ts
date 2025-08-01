import { OptimizedEnhancedRouter } from "../optimizedEnhancedRouter";

describe("OptimizedEnhancedRouter", () => {
  const baseConfig = {
    vercelMode: false,
    langchainjsExport: true,
    flattenMetadata: true,
    enableRunnableInterface: true,
    matchRoute: "basic",
    matchingStrategy: "smart_flexible",
    supportReassignment: true,
    supportMemory: true,
    confidenceThreshold: 0.6,
    enableFallback: true,
  };

  let router: OptimizedEnhancedRouter;

  beforeEach(() => {
    router = new OptimizedEnhancedRouter(baseConfig);
  });

  it("invoke should return enhanced message with correct metadata", () => {
    const input = { text: "basic" };
    const result = router.invoke(input);
    expect(result).toHaveProperty("metadata");
    expect(result.metadata).toHaveProperty("conditionalRouter", "OptimizedEnhancedRouter");
    expect(result.metadata).toHaveProperty("targetRoute", baseConfig.matchRoute);
    expect(result.metadata).toHaveProperty("matchReason");
    expect(result.metadata).toHaveProperty("confidence");
  });

  it("ainvoke should behave the same as invoke", async () => {
    const input = { text: "basic" };
    const result = await router.ainvoke(input);
    expect(result).toHaveProperty("metadata");
    expect(result.metadata).toHaveProperty("conditionalRouter", "OptimizedEnhancedRouter");
  });

  it("stream should yield one message with correct metadata", () => {
    const input = { text: "basic" };
    const gen = router.stream(input);
    const { value, done } = gen.next();
    expect(done).toBe(false);
    expect(value).toHaveProperty("metadata");
    expect(value.metadata).toHaveProperty("conditionalRouter", "OptimizedEnhancedRouter");
  });

  it("astream should yield one async message with correct metadata", async () => {
    const input = { text: "basic" };
    const gen = router.astream(input);
    const { value, done } = await gen.next();
    expect(done).toBe(false);
    expect(value).toHaveProperty("metadata");
    expect(value.metadata).toHaveProperty("conditionalRouter", "OptimizedEnhancedRouter");
  });

  it("batch should return array of messages", () => {
    const inputs = [{ text: "basic" }, { text: "enhanced" }];
    const results = router.batch(inputs);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(inputs.length);
    results.forEach((res) => {
      expect(res).toHaveProperty("metadata");
    });
  });

  it("abatch should return array of messages asynchronously", async () => {
    const inputs = [{ text: "basic" }, { text: "enhanced" }];
    const results = await router.abatch(inputs);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(inputs.length);
    results.forEach((res) => {
      expect(res).toHaveProperty("metadata");
    });
  });

  // New tests for environment config and matching strategies

  it("should load environment config and reflect in evaluateRouteMatch", () => {
    const envConfig = router["_loadEnvironmentConfig"]();
    expect(envConfig).toHaveProperty("matchingStrategies");
    expect(envConfig).toHaveProperty("routeSimilarities");
    expect(envConfig).toHaveProperty("confidenceAdjustments");
  });

  it("should correctly evaluate exact_match strategy", () => {
    router.matchingStrategy = "exact_match";
    const routingInfo = {
      route: "basic",
      confidence: 0.7,
      textRoute: null,
      reassignmentInfo: {},
      memoryInfo: {},
    };
    const [match, reason, confidence] = router["evaluateRouteMatch"](routingInfo, "basic", router["_loadEnvironmentConfig"]());
    expect(match).toBe(true);
    expect(reason).toBe("exact_match");
  });

  it("should correctly evaluate metadata_priority strategy with metadata", () => {
    router.matchingStrategy = "metadata_priority";
    const routingInfo = {
      route: "enhanced",
      confidence: 0.7,
      textRoute: null,
      metadataAvailable: true,
      reassignmentInfo: {},
      memoryInfo: {},
    };
    const [match, reason] = router["evaluateRouteMatch"](routingInfo, "enhanced", router["_loadEnvironmentConfig"]());
    expect(match).toBe(true);
    expect(reason).toBe("metadata_match");
  });

  it("should fallback to textRoute in metadata_priority strategy", () => {
    router.matchingStrategy = "metadata_priority";
    const routingInfo = {
      route: "unknown",
      confidence: 0.7,
      textRoute: "rag",
      metadataAvailable: false,
      reassignmentInfo: {},
      memoryInfo: {},
    };
    const [match, reason] = router["evaluateRouteMatch"](routingInfo, "rag", router["_loadEnvironmentConfig"]());
    expect(match).toBe(true);
    expect(reason).toBe("text_fallback");
  });

  it("should correctly evaluate confidence_aware strategy with sufficient confidence", () => {
    router.matchingStrategy = "confidence_aware";
    router.matchRoute = "enhanced";
    const routingInfo = {
      route: "agent",
      confidence: 0.7,
      textRoute: null,
      reassignmentInfo: {},
      memoryInfo: {},
    };
    const [match, reason] = router["evaluateRouteMatch"](routingInfo, "agent", router["_loadEnvironmentConfig"]());
    expect(match).toBe(true);
    expect(reason).toBe("confidence_sufficient");
  });

  it("should reject confidence_aware strategy with low confidence", () => {
    router.matchingStrategy = "confidence_aware";
    router.matchRoute = "enhanced";
    const routingInfo = {
      route: "agent",
      confidence: 0.5,
      textRoute: null,
      reassignmentInfo: {},
      memoryInfo: {},
    };
    const [match, reason] = router["evaluateRouteMatch"](routingInfo, "agent", router["_loadEnvironmentConfig"]());
    expect(match).toBe(false);
    expect(reason).toBe("confidence_below_threshold");
  });

  it("should correctly evaluate langchainjs_compatible strategy with langchainjsFormat true", () => {
    router.matchingStrategy = "langchainjs_compatible";
    const routingInfo = {
      route: "basic",
      confidence: 0.7,
      langchainjsFormat: true,
      reassignmentInfo: {},
      memoryInfo: {},
    };
    const [match, reason] = router["evaluateRouteMatch"](routingInfo, "basic", router["_loadEnvironmentConfig"]());
    expect(match).toBe(true);
    expect(reason).toBe("langchainjs_match");
  });

  it("should fallback to smartFlexibleMatch in langchainjs_compatible strategy when langchainjsFormat false", () => {
    router.matchingStrategy = "langchainjs_compatible";
    const routingInfo = {
      route: "basic",
      confidence: 0.7,
      langchainjsFormat: false,
      textRoute: "basic",
      reassignmentInfo: {},
      memoryInfo: {},
    };
    const spy = jest.spyOn(router as any, "smartFlexibleMatch");
    router["evaluateRouteMatch"](routingInfo, "basic", router["_loadEnvironmentConfig"]());
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should dynamically adjust confidence with reassignmentPenalty and memory boost", () => {
    router.matchingStrategy = "confidence_aware";
    router.matchRoute = "enhanced";
    const envConfig = router["_loadEnvironmentConfig"]();
    const routingInfo = {
      route: "basic",
      confidence: 0.7,
      reassignmentInfo: { required: true },
      memoryInfo: { hasMemory: true },
    };
    const [match, reason, effectiveConfidence] = router["evaluateRouteMatch"](routingInfo, "basic", envConfig);
    expect(effectiveConfidence).toBeGreaterThan(0.5);
  });

  it("invoke should reflect dynamic changes in environment config", () => {
    // Override _loadEnvironmentConfig to simulate dynamic config change
    const dynamicConfig = {
      matchingStrategies: {
        exact_match: { strict: true, fallback: false },
      },
      routeSimilarities: {},
      confidenceAdjustments: {},
      memorySupport: {},
    };
    router["_loadEnvironmentConfig"] = () => dynamicConfig;
    router.matchingStrategy = "exact_match";
    const input = { text: "basic" };
    const result = router.invoke(input);
    expect(result.metadata.matchingStrategy).toBe("exact_match");
  });
  it("should correctly route based on dynamic model mapping for four path options", () => {
    const routes = ["basic", "enhanced", "rag", "agent"];
    routes.forEach((route) => {
      router.matchRoute = route;
      const input = { text: route };
      const result = router.invoke(input);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.targetRoute || result.metadata.conditionalTargetRoute).toBe(route);
      expect(result.metadata.matchReason).toBeDefined();
      expect(result.metadata.confidence || result.metadata.conditionalConfidence).toBeGreaterThanOrEqual(0);
      expect(result.metadata.matchingStrategy || result.metadata.conditionalMatchingStrategy).toBe(router.matchingStrategy);
    });
  });

  it("invoke and ainvoke should respond correctly to dynamic environment config changes", async () => {
    const dynamicConfig = {
      matchingStrategies: {
        exact_match: { strict: true, fallback: false },
        metadata_priority: { preferMetadata: true, textFallback: true },
        confidence_aware: { thresholdRequired: true, dynamicThreshold: false },
        smart_flexible: { multiLevel: true, adaptive: true },
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
        langflowChatMemory: true,
        customMemory: true,
        boostFactor: 0.1,
      },
      langchainjsCompatibility: {
        exportFormat: true,
        flattenOutput: true,
        runnableInterface: true,
        asyncSupport: true,
        streamingSupport: true,
      },
      lcelConfiguration: {
        enableRunnable: true,
        enablePassthrough: true,
        enableLambda: true,
        enableParallel: true,
      },
    };
    router["_loadEnvironmentConfig"] = () => dynamicConfig;
    router.matchingStrategy = "confidence_aware";
    router.matchRoute = "enhanced";
    const input = { text: "enhanced" };
    const result = router.invoke(input);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.matchingStrategy).toBe("confidence_aware");
    expect(result.metadata.targetRoute || result.metadata.conditionalTargetRoute).toBe("enhanced");

    const asyncResult = await router.ainvoke(input);
    expect(asyncResult.metadata).toBeDefined();
    expect(asyncResult.metadata.matchingStrategy).toBe("confidence_aware");
    expect(asyncResult.metadata.targetRoute || asyncResult.metadata.conditionalTargetRoute).toBe("enhanced");
  });
});