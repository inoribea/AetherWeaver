type ModelConfig = {
  model: string;
  apiKey?: string;
};

/**
 * 简单的 ModelManager，管理当前模型配置
 * 变更说明：
 * - 延迟解析 API Key（在 getCurrentModel 时解析），避免模块加载时固定空 key。
 * - 支持多个常见环境变量回退（OPENAI_API_KEY, NEKO_API_KEY, LANGCHAIN_API_KEY,
 *   LANGCHAIN_API_KEYS, LANGCHAIN_API_KEY_1..10, DEFAULT_API_KEY 等）。
 */
function getEffectiveApiKey(): string | undefined {
  const candidates: string[] = [];

  // 常见单一 key
  if (process.env.OPENAI_API_KEY) candidates.push(process.env.OPENAI_API_KEY);
  if (process.env.NEKO_API_KEY) candidates.push(process.env.NEKO_API_KEY);
  if (process.env.LANGCHAIN_API_KEY) candidates.push(process.env.LANGCHAIN_API_KEY);
  if (process.env.DEFAULT_API_KEY) candidates.push(process.env.DEFAULT_API_KEY);

  // 支持多 key 逗号分隔
  const multi = process.env.LANGCHAIN_API_KEYS;
  if (multi) {
    candidates.push(...multi.split(',').map(s => s.trim()).filter(Boolean));
  }

  // 支持编号变量 LANGCHAIN_API_KEY_1 .. LANGCHAIN_API_KEY_10
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`LANGCHAIN_API_KEY_${i}`];
    if (k) candidates.push(k);
  }

  // 返回第一个非空候选或 undefined
  return candidates.length > 0 ? candidates[0] : undefined;
}

/**
 * ModelManager
 * - currentModel: 可通过 setCurrentModel 动态设置（优先级高于 env）
 * - getCurrentModel: 返回当前模型配置并在运行时解析有效的 apiKey
 */
export class ModelManager {
  private static currentModel: ModelConfig = {
    model: process.env.DEFAULT_MODEL_NAME || "gpt-4o",
    apiKey: undefined,
  };

  static async getCurrentModel(): Promise<ModelConfig> {
    // 优先使用通过 setCurrentModel 显式设置的 key；否则回退到环境变量
    const apiKey = this.currentModel.apiKey ?? getEffectiveApiKey();
    return {
      model: this.currentModel.model,
      apiKey,
    };
  }

  static async setCurrentModel(config: ModelConfig): Promise<void> {
    this.currentModel = config;
  }
}