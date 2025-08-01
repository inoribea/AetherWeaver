import { OptimizedEnhancedChatInput } from "../OptimizedEnhancedChatInput";

describe("OptimizedEnhancedChatInput", () => {
  let instance: OptimizedEnhancedChatInput;

  beforeEach(() => {
    instance = new OptimizedEnhancedChatInput();
  });

  test("invoke should return data with expected structure", () => {
    const input = "test input";
    const result = instance.invoke(input);
    expect(result).toHaveProperty("data");
    expect(result.data).toHaveProperty("message");
    expect(result.data.message.text).toBe(input);
  });

  test("ainvoke should call invoke and return the same result", async () => {
    const input = "async test input";
    const result = await instance.ainvoke(input);
    expect(result).toHaveProperty("data");
    expect(result.data).toHaveProperty("message");
    expect(result.data.message.text).toBe(input);
  });

  test("stream should yield one data matching invoke output", async () => {
    const input = "stream test input";
    const stream = instance.stream(input);
    const results = [];
    for await (const data of stream) {
      results.push(data);
    }
    expect(results.length).toBe(1);
    expect(results[0].data.message.text).toBe(input);
  });

  test("astream should yield one data matching ainvoke output", async () => {
    const input = "astream test input";
    const stream = instance.astream(input);
    const results = [];
    for await (const data of stream) {
      results.push(data);
    }
    expect(results.length).toBe(1);
    expect(results[0].data.message.text).toBe(input);
  });

  test("batch should return array of results for multiple inputs", () => {
    const inputs = ["input1", "input2", "input3"];
    const results = instance.batch(inputs);
    expect(results).toHaveLength(inputs.length);
    results.forEach((res, idx) => {
      expect(res.data.message.text).toBe(inputs[idx]);
    });
  });

  test("abatch should return Promise resolving to array of results for multiple inputs", async () => {
    const inputs = ["inputA", "inputB", "inputC"];
    const results = await instance.abatch(inputs);
    expect(results).toHaveLength(inputs.length);
    results.forEach((res, idx) => {
      expect(res.data.message.text).toBe(inputs[idx]);
    });
  });
});