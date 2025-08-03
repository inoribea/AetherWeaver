type ModelConfig = {
  model: string;
  apiKey?: string;
};

/**
 * 简单的 ModelManager，管理当前模型配置
 */
export class ModelManager {
  private static currentModel: ModelConfig = {
    model: process.env.DEFAULT_MODEL_NAME || "gpt-4o",
    apiKey: process.env.OPENAI_API_KEY,
  };

  static async getCurrentModel(): Promise<ModelConfig> {
    // 这里可以扩展为从数据库、配置文件或远程服务动态获取
    return this.currentModel;
  }

  static async setCurrentModel(config: ModelConfig): Promise<void> {
    this.currentModel = config;
  }
}