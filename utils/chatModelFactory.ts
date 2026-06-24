import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatCohere } from '@langchain/cohere';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export function createChatModelInstance(type: string, apiKey: string, model: string, baseURL?: string, temperature: number = 0.7): BaseChatModel {
  switch (type) {
    case 'anthropic':
      return new ChatAnthropic({ apiKey, modelName: model, temperature, ...(baseURL ? { clientOptions: { baseURL } } : {}) });
    case 'cohere':
      return new ChatCohere({ apiKey, model, temperature });
    case 'openai_compatible': case 'o3_provider': case 'deepseek': case 'google_gemini': case 'alibaba_tongyi': case 'tencent_hunyuan':
    default:
      return new ChatOpenAI({ modelName: model, apiKey, temperature, ...(baseURL ? { configuration: { baseURL } } : {}) });
  }
}
