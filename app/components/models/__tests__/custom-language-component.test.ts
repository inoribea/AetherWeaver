import { CustomLanguageComponent } from "../custom-language-component";

describe("CustomLanguageComponent", () => {
  let instance: CustomLanguageComponent;

  beforeEach(() => {
    instance = new CustomLanguageComponent({});
  });

  test("invoke should return LCELMessage with expected text", async () => {
    const input = { text: "test input" };
    const result = await instance.invoke(input);
    expect(result).toHaveProperty("text");
    expect(result.text).toContain("test input");
  });

  test("ainvoke should call invoke and return the same result", async () => {
    const input = { text: "async test input" };
    const result = await instance.ainvoke(input);
    expect(result).toHaveProperty("text");
    expect(result.text).toContain("async test input");
  });

  test("stream should yield one LCELMessage matching invoke output", async () => {
    const input = { text: "stream test input" };
    const stream = instance.stream(input);
    const results = [];
    for await (const msg of stream) {
      results.push(msg);
    }
    expect(results.length).toBe(1);
    expect(results[0].text).toContain("stream test input");
  });

  test("astream should yield one LCELMessage matching ainvoke output", async () => {
    const input = { text: "astream test input" };
    const stream = instance.astream(input);
    const results = [];
    for await (const msg of stream) {
      results.push(msg);
    }
    expect(results.length).toBe(1);
    expect(results[0].text).toContain("astream test input");
  });

  test("batch should return array of LCELMessages for multiple inputs", async () => {
    const inputs = [{ text: "input1" }, { text: "input2" }, { text: "input3" }];
    const results = await instance.batch(inputs);
    expect(results).toHaveLength(inputs.length);
    results.forEach((res, idx) => {
      expect(res.text).toContain(inputs[idx].text);
    });
  });

  test("abatch should return Promise resolving to array of LCELMessages for multiple inputs", async () => {
    const inputs = [{ text: "inputA" }, { text: "inputB" }, { text: "inputC" }];
    const results = await instance.abatch(inputs);
    expect(results).toHaveLength(inputs.length);
    results.forEach((res, idx) => {
      expect(res.text).toContain(inputs[idx].text);
    });
  });
});