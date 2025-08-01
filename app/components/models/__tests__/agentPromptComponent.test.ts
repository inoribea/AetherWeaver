import { AgentPromptComponent, Message } from "../agent-prompt-component";
import { Readable } from "stream";

describe("AgentPromptComponent", () => {
  const baseOptions = {
    vercelMode: false,
    langchainjsExport: true,
    flattenMetadata: true,
    enableRunnableInterface: true,
  };

  it("invoke should return correct Message structure", async () => {
    const component = new AgentPromptComponent(baseOptions);
    const input = { text: "Hello" };
    const result = await component.invoke(input);
    expect(result).toHaveProperty("text");
    expect(result).toHaveProperty("metadata");
    expect(result.text).toContain("User Input: Hello");
    expect(result.metadata).toHaveProperty("lcel_compatible", true);
  });

  it("ainvoke should behave the same as invoke", async () => {
    const component = new AgentPromptComponent(baseOptions);
    const input = { text: "Async Hello" };
    const result = await component.ainvoke(input);
    expect(result).toHaveProperty("text");
    expect(result.text).toContain("User Input: Async Hello");
  });

  it("stream should return a Readable stream with correct content", (done) => {
    const component = new AgentPromptComponent(baseOptions);
    const input = { text: "Stream Hello" };
    const stream = component.stream(input);
    let data = "";
    stream.on("data", (chunk) => {
      data += chunk.toString();
    });
    stream.on("end", () => {
      expect(data).toContain("Streamed prompt: Stream Hello");
      done();
    });
  });

  it("astream should yield a Message with correct content", async () => {
    const component = new AgentPromptComponent(baseOptions);
    const input = { text: "Async Stream Hello" };
    const gen = component.astream(input);
    const result = (await gen.next()).value;
    expect(result).toHaveProperty("text");
    expect(result.text).toContain("User Input: Async Stream Hello");
  });
});