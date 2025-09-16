export interface OpenAICompatProvider {
  prefix: string;
  apiKey?: string;
  baseURL?: string;
}

function readEnv(name?: string): string | undefined {
  if (!name) return undefined;
  return process.env[name as keyof NodeJS.ProcessEnv] as string | undefined;
}

function toPrefix(key: string): string {
  return key.replace(/_API_KEY$/i, "");
}

function getProviderByPrefix(rawPrefix: string): OpenAICompatProvider | undefined {
  const prefix = rawPrefix.toUpperCase();
  const apiKey = readEnv(`${prefix}_API_KEY`);
  const baseURL = readEnv(`${prefix}_BASE_URL`);

  // OPENAI 官方允许无 BASE_URL（走默认官方域名）
  if (prefix === "OPENAI" && apiKey) {
    return { prefix, apiKey, baseURL };
  }

  if (apiKey && baseURL) {
    return { prefix, apiKey, baseURL };
  }
  return undefined;
}

function scanDynamicProviders(): OpenAICompatProvider[] {
  const results: OpenAICompatProvider[] = [];
  const keys = Object.keys(process.env);
  for (const k of keys) {
    if (!k.endsWith("_API_KEY")) continue;
    const prefix = toPrefix(k);
    // 排除非 OpenAI 兼容或访问控制类前缀
    if ([
      "LANGCHAIN", // 访问控制
      "SERPAPI",
      "TAVILY",
      "GOOGLE",
      "DASHSCOPE",
      "TENCENT_HUNYUAN",
      "PINECONE",
      "UPSTASH",
      "REDIS",
      "CLOUDFLARE",
      "LANGFUSE",
      "DATABASE",
    ].includes(prefix)) {
      continue;
    }
    const p = getProviderByPrefix(prefix);
    if (p) results.push(p);
  }
  return results;
}

/**
 * 从 models-config.json 的模型配置中解析 OpenAI 兼容提供商
 * 约定：config.apiKey/config.baseURL 存放的是环境变量名称（如 NEKO_API_KEY / NEKO_BASE_URL）
 */
export function resolveProviderFromModelConfig(modelDetails: any): OpenAICompatProvider | undefined {
  if (!modelDetails?.config) return undefined;
  const apiKeyEnv = modelDetails.config.apiKey as string | undefined;
  const baseEnv = modelDetails.config.baseURL as string | undefined;
  const apiKey = readEnv(apiKeyEnv);
  const baseURL = readEnv(baseEnv);

  if (apiKeyEnv) {
    const prefix = toPrefix(apiKeyEnv).toUpperCase();
    if (prefix === "OPENAI") {
      // 官方 OPENAI 可不需要 baseURL
      if (apiKey) return { prefix, apiKey, baseURL };
    } else {
      if (apiKey && baseURL) return { prefix, apiKey, baseURL };
    }
  }
  return undefined;
}

/**
 * 默认 OpenAI 兼容提供商解析：
 * 1) 指定 OPENAI_COMPAT_PROVIDER 时优先
 * 2) 依次尝试 OPENAI / NEKO / O3 / OPENROUTER
 * 3) 动态扫描所有 *_API_KEY / *_BASE_URL 成对的提供商
 */
export function getDefaultOpenAICompatProvider(): OpenAICompatProvider | undefined {
  const specified = process.env.OPENAI_COMPAT_PROVIDER;
  if (specified) {
    const p = getProviderByPrefix(specified);
    if (p) return p;
  }

  const common = ["OPENAI", "NEKO", "O3", "OPENROUTER"];
  for (const name of common) {
    const p = getProviderByPrefix(name);
    if (p) return p;
  }

  const dynamic = scanDynamicProviders();
  if (dynamic.length > 0) return dynamic[0];

  return undefined;
}

export function createChatOpenAIConfig(params?: { model?: string; fallbackBaseURL?: string }): {
  model?: string;
  apiKey?: string;
  configuration?: { baseURL?: string };
} {
  const provider = getDefaultOpenAICompatProvider();
  const baseURL = provider?.baseURL || params?.fallbackBaseURL;
  return {
    model: params?.model,
    apiKey: provider?.apiKey,
    configuration: baseURL ? { baseURL } : undefined,
  };
}

