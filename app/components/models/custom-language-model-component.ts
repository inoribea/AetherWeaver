import { loadEnvConfig } from "../../../utils/envConfig";
import type { LCELComponent, LCELMessage } from "../../types/lcelInterfaces";

export class CustomLanguageComponent implements LCELComponent {
  options: Record<string, any>;
  inputValue?: LCELMessage;
  routingContext?: LCELMessage;
  memoryContext?: LCELMessage;
  toolsContext?: LCELMessage;
  documentsContext?: LCELMessage;
  status: string = "";
  config: Record<string, any>;

  constructor(options: Record<string, any>) {
    this.config = loadEnvConfig(
      process.env.VERCEL_ENV === "production",
      "CUSTOM_LANGUAGE_COMPONENT_CONFIG",
      {}
    );
    this.options = { ...options, ...this.config };
  }

  private getMemoryContext(input: LCELMessage): Promise<LCELMessage> {
    return Promise.resolve({ text: "Memory context placeholder" });
  }

  private getToolsContext(): Promise<LCELMessage> {
    return Promise.resolve({ text: "Tools context placeholder" });
  }

  private getDocumentsContext(): Promise<LCELMessage> {
    return Promise.resolve({ text: "Documents context placeholder" });
  }

  private getRoutingContext(): Promise<LCELMessage> {
    return Promise.resolve(this.routingContext || { text: "Routing context placeholder" });
  }

  private filterContext(context: LCELMessage, keywords: string[]): LCELMessage {
    if (!context || !context.text) {
      return { text: "" };
    }
    const lines = context.text.split("\n");
    const filteredLines = lines.filter(line =>
      keywords.some(keyword => line.includes(keyword))
    );
    return { text: filteredLines.join("\n") };
  }

  private buildMessages(
    routingContext?: LCELMessage,
    memoryContext?: LCELMessage,
    toolsContext?: LCELMessage,
    documentsContext?: LCELMessage
  ): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    const systemMessage = this.options.systemMessage || "You are an AI assistant.";
    messages.push({ role: "system", content: systemMessage });

    const userInput = this.inputValue?.text || "No input provided";
    messages.push({ role: "user", content: userInput });

    if (routingContext?.text) {
      messages.push({ role: "assistant", content: routingContext.text });
    }
    if (memoryContext?.text) {
      messages.push({ role: "assistant", content: memoryContext.text });
    }
    if (toolsContext?.text) {
      messages.push({ role: "assistant", content: toolsContext.text });
    }
    if (documentsContext?.text) {
      messages.push({ role: "assistant", content: documentsContext.text });
    }

    return messages;
  }

  async invoke(inputData: any, config?: Record<string, any>): Promise<LCELMessage> {
    this.inputValue =
      typeof inputData === "object" && "text" in inputData
        ? inputData
        : { text: String(inputData) };
    try {
      this.routingContext = await this.getRoutingContext();
      this.memoryContext = await this.getMemoryContext(this.inputValue ?? { text: "" });
      this.toolsContext = await this.getToolsContext();
      this.documentsContext = await this.getDocumentsContext();

      const messages = this.buildMessages(
        this.routingContext,
        this.memoryContext,
        this.toolsContext,
        this.documentsContext
      );

      // TODO: 调用模型接口，示例返回
      return { text: `Input text: ${this.inputValue?.text || ""}\nResponse: Simulated response including context.` };
    } catch (error: any) {
      this.status = `Error: ${error.message}`;
      return { text: `Error: ${error.message}` };
    }
  }

  async ainvoke(inputData: any, config?: Record<string, any>): Promise<LCELMessage> {
    return this.invoke(inputData, config);
  }

  async *stream(inputData: any, config?: Record<string, any>): AsyncGenerator<LCELMessage> {
    // TODO: 实现基于 LangChain.js 的流式输出
    const response = await this.invoke(inputData, config);
    yield response;
  }

  async *astream(inputData: any, config?: Record<string, any>): AsyncGenerator<LCELMessage> {
    for await (const msg of this.stream(inputData, config)) {
      yield msg;
    }
  }

  async batch(inputs: any[], config?: Record<string, any>): Promise<LCELMessage[]> {
    const results: LCELMessage[] = [];
    for (const input of inputs) {
      const res = await this.invoke(input, config);
      results.push(res);
    }
    return results;
  }

  async abatch(inputs: any[], config?: Record<string, any>): Promise<LCELMessage[]> {
    const promises = inputs.map(input => this.ainvoke(input, config));
    return Promise.all(promises);
  }
}