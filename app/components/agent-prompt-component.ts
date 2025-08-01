import { Readable } from "stream";
import { loadEnvConfig } from "../../utils/envConfig";

export interface Message {
  text: string;
  metadata?: Record<string, any>;
}

export interface Config {
  [key: string]: any;
}

export interface AgentPromptComponentOptions {
  vercelMode: boolean;
  langchainExport: boolean;
  flattenMetadata: boolean;
  enableRunnableInterface: boolean;
  inputValue?: Message;
  memory?: Message;
  toolsResults?: Message;
  contextDocuments?: Message;
}

export class AgentPromptComponent {
  options: AgentPromptComponentOptions;
  status: string = "";

  constructor(options: AgentPromptComponentOptions) {
    this.options = options;
  }

  private loadEnvironmentConfig(): Record<string, any> {
    const defaultConfig: any = {
      deployment: {
        env: "standard",
        edgeCompatible: false,
        region: "local",
        functionTimeout: 30,
      },
      langchainCompatibility: {
        exportFormat: this.options.langchainExport,
        flattenMetadata: this.options.flattenMetadata,
        runnableInterface: this.options.enableRunnableInterface,
      },
    };
    return loadEnvConfig(this.options.vercelMode, "LANGFLOW_AGENT_CONFIG", defaultConfig);
  }

  private buildPrompt(): Message {
    const inputText = this.options.inputValue?.text || "";
    const memoryText = this.options.memory?.text || "";
    const toolsText = this.options.toolsResults?.text || "";
    const contextText = this.options.contextDocuments?.text || "";

    let promptText = `User Input: ${inputText}\n`;
    if (memoryText) {
      promptText += `Memory: ${memoryText}\n`;
    }
    if (toolsText) {
      promptText += `Tools Results: ${toolsText}\n`;
    }
    if (contextText) {
      promptText += `Context Documents: ${contextText}\n`;
    }

    return {
      text: promptText,
      metadata: {
        lcelCompatible: true,
        langchainExport: this.options.langchainExport,
        runnableInterface: this.options.enableRunnableInterface,
        vercelMode: this.options.vercelMode,
        flattenMetadata: this.options.flattenMetadata,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async invoke(inputData: any, config?: Config): Promise<Message> {
    try {
      if (inputData) {
        this.options.inputValue =
          typeof inputData === "object" && "text" in inputData
            ? inputData
            : { text: String(inputData) };
      }
      const envConfig = this.loadEnvironmentConfig();
      const prompt = this.buildPrompt();
      this.status = "Success";
      return prompt;
    } catch (error: any) {
      this.status = `Error: ${error.message}`;
      return { text: `Error: ${error.message}` };
    }
  }

  async ainvoke(inputData: any, config?: Config): Promise<Message> {
    return this.invoke(inputData, config);
  }

  stream(inputData: any, config?: Config): Readable {
    const readable = new Readable({
      read() {
        this.push(
          `Streamed prompt: ${
            typeof inputData === "object" && "text" in inputData
              ? inputData.text
              : String(inputData)
          }`
        );
        this.push(null);
      },
    });
    return readable;
  }

  async *astream(inputData: any, config?: Config): AsyncGenerator<Message> {
    const result = await this.ainvoke(inputData, config);
    yield result;
  }
}