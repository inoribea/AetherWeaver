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
});