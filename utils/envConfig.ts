/**
 * 统一环境变量加载工具，兼容Vercel部署环境
 * @param vercelMode 是否为Vercel环境模式
 * @param configKey 环境变量中配置的JSON字符串键名
 * @param defaultConfig 默认配置对象
 * @returns 合并后的配置对象
 */
export function loadEnvConfig(
  vercelMode: boolean,
  configKey: string,
  defaultConfig: Record<string, any>
): Record<string, any> {
  try {
    if (vercelMode) {
      const configStr = process.env[configKey] || "{}";
      const vercelConfig = JSON.parse(configStr);
      Object.assign(defaultConfig, vercelConfig);
      Object.assign(defaultConfig.deployment, {
        env: "vercel",
        edgeCompatible: true,
        region: process.env.VERCEL_REGION || "unknown",
        functionTimeout: parseInt(process.env.VERCEL_FUNCTION_TIMEOUT || "30"),
      });
    } else {
      const configStr = process.env[configKey] || "{}";
      const envConfig = JSON.parse(configStr);
      Object.assign(defaultConfig, envConfig);
    }
  } catch {
    // 忽略JSON解析错误
  }
  return defaultConfig;
}