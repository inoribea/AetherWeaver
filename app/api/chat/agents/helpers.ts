import { ChatOpenAI } from '@langchain/openai';
import { ChatDeepSeek } from '@langchain/deepseek';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi';
import { SerpAPI } from '@langchain/community/tools/serpapi';
import { TavilySearch } from '@langchain/tavily';
import { Calculator } from '@langchain/community/tools/calculator';
import { Tool } from '@langchain/core/tools';
import { getBestEmbeddingProvider } from '../../../../utils/embeddings';
import { getDefaultOpenAICompatProvider } from '@/utils/openaiProvider';

function createTavilySearchWrapper(): Tool {
  return new TavilySearch({ maxResults: 5 }) as any; // 使用 any 类型断言绕过 schema 不兼容问题
}

// 添加缺失的导出函数
export function getAvailableAgentModel() {
  const compat = getDefaultOpenAICompatProvider();
  if (compat?.apiKey) {
    return {
      model: new ChatOpenAI({
        modelName: "gpt-5",
        temperature: 0,
        apiKey: compat.apiKey,
        ...(compat.baseURL ? { configuration: { baseURL: compat.baseURL } } : {}),
      }),
      modelName: "gpt-5"
    };
  } else if (process.env.DEEPSEEK_API_KEY) {
    return {
      model: new ChatDeepSeek({
        modelName: "deepseek-chat",
        temperature: 0,
        apiKey: process.env.DEEPSEEK_API_KEY
      }),
      modelName: "deepseek-chat"
    };
  } else if (process.env.GOOGLE_API_KEY) {
    return {
      model: new ChatGoogleGenerativeAI({
        model: "gemini-pro",
        temperature: 0,
        apiKey: process.env.GOOGLE_API_KEY
      }),
      modelName: "gemini-pro"
    };
  } else if (process.env.ALIBABA_API_KEY) {
    return {
      model: new ChatAlibabaTongyi({
        alibabaApiKey: process.env.ALIBABA_API_KEY,
        model: "qwen-plus",
        temperature: 0
      }),
      modelName: "qwen-plus"
    };
  }
  
  return {
    model: new ChatOpenAI({
      modelName: "gpt-5",
      temperature: 0,
      ...(process.env.OPENAI_BASE_URL && { configuration: { baseURL: process.env.OPENAI_BASE_URL } }),
    }),
    modelName: "gpt-5"
  };
}

export function createAlibabaTongyiModel() {
  return new ChatAlibabaTongyi({
    alibabaApiKey: process.env.ALIBABA_API_KEY,
    model: "qwen-plus",
    temperature: 0,
  });
}

export { getBestEmbeddingProvider } from "../../../../utils/embeddings";

export function getAgentTools(): Tool[] {
  const tools: Tool[] = [new Calculator()];

  if (process.env.SERPAPI_API_KEY) {
    tools.push(new SerpAPI());
  } else if (process.env.TAVILY_API_KEY) {
    tools.push(createTavilySearchWrapper());
  }

  return tools;
}
