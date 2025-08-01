import { OptimizedEnhancedConditionalRouter } from "../optimizedEnhancedConditionalRouter";

describe("OptimizedEnhancedConditionalRouter", () => {
  const baseConfig = {
    vercelMode: false,
    langchainjsExport: true,
    flattenMetadata: true,
    enableRunnableInterface: true,
    matchRoute: "basic",
    matchingStrategy: "smart_flexible",
    supportReassignment: true,
    supportMemoryRouting: true,
    confidenceThreshold: 0.6,
    enableFallbackMatching: true,
  };

  let router: OptimizedEnhancedConditionalRouter;

  beforeEach(() => {
    router = new OptimizedEnhancedConditionalRouter(baseConfig);
  });

  it("invoke should return enhanced message with correct metadata", () => {
    const input = { text: "basic" };
    const result = router.invoke(input);
    expect(result).toHaveProperty("metadata");
    expect(result.metadata).toHaveProperty("conditional_router_component", "OptimizedEnhancedConditionalRouter");
    expect(result.metadata).toHaveProperty("target_route", baseConfig.matchRoute);
    expect(result.metadata).toHaveProperty("match_reason");
    expect(result.metadata).toHaveProperty("effective_confidence");
  });

  it("ainvoke should behave the same as invoke", async () => {
    const input = { text: "basic" };
    const result = await router.ainvoke(input);
    expect(result).toHaveProperty("metadata");
    expect(result.metadata).toHaveProperty("conditional_router_component", "OptimizedEnhancedConditionalRouter");
  });

  it("stream should yield one message with correct metadata", () => {
    const input = { text: "basic" };
    const gen = router.stream(input);
    const { value, done } = gen.next();
    expect(done).toBe(false);
    expect(value).toHaveProperty("metadata");
    expect(value.metadata).toHaveProperty("conditional_router_component", "OptimizedEnhancedConditionalRouter");
  });

  it("astream should yield one async message with correct metadata", async () => {
    const input = { text: "basic" };
    const gen = router.astream(input);
    const { value, done } = await gen.next();
    expect(done).toBe(false);
    expect(value).toHaveProperty("metadata");
    expect(value.metadata).toHaveProperty("conditional_router_component", "OptimizedEnhancedConditionalRouter");
  });

  it("batch should return array of messages with correct metadata", () => {
    const inputs = [{ text: "basic" }, { text: "enhanced" }];
    const results = router.batch(inputs);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(inputs.length);
    results.forEach((res) => {
      expect(res).toHaveProperty("metadata");
      expect(res.metadata).toHaveProperty("conditional_router_component", "OptimizedEnhancedConditionalRouter");
    });
  });

  it("abatch should return array of messages asynchronously with correct metadata", async () => {
    const inputs = [{ text: "basic" }, { text: "enhanced" }];
    const results = await router.abatch(inputs);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(inputs.length);
    results.forEach((res) => {
      expect(res).toHaveProperty("metadata");
      expect(res.metadata).toHaveProperty("conditional_router_component", "OptimizedEnhancedConditionalRouter");
    });
  });
});