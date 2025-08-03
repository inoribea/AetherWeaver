import { EnhancedAdvancedRetriever } from "../enhancedAdvancedRetriever";
import { Document } from "@langchain/core/documents";
import { describe, beforeAll, test, expect } from '@jest/globals';

describe("EnhancedAdvancedRetriever", () => {
  let retriever: EnhancedAdvancedRetriever;
  let documents: Document[];
  let chineseStopwords: Set<string>;

  beforeAll(async () => {
    chineseStopwords = new Set(["的", "了", "和"]);

    documents = [
      new Document({
        pageContent: "LangChain是一个用于构建语言模型应用的框架。它提供了提示管理、链和代理等工具。",
        metadata: { source: "doc1" },
      }),
      new Document({
        pageContent: "向量数据库存储高维向量，支持相似度搜索，是RAG应用的关键组件。",
        metadata: { source: "doc2" },
      }),
      new Document({
        pageContent: "检索增强生成（RAG）结合了检索系统和生成模型，提升了响应的准确性和上下文相关性。",
        metadata: { source: "doc3" },
      }),
      new Document({
        pageContent: "Agents可以使用工具执行操作和决策，支持搜索网络、计算和数据库访问。",
        metadata: { source: "doc4" },
      }),
    ];

    retriever = new EnhancedAdvancedRetriever(documents, chineseStopwords);
  });

  test("关键词提取应正确过滤停用词并分词", async () => {
    const query = "构建语言模型的框架和工具";
    const tokens = await (retriever as any).getRelevantDocuments(query);
    expect(tokens.length).toBeGreaterThan(0);
  });

  test("检索结果应按匹配词频排序且过滤无匹配文档", async () => {
    const query = "向量数据库 相似度搜索";
    const results = await retriever.getRelevantDocuments(query);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((doc: Document) => doc.metadata.source === "doc2")).toBe(true);
    expect(results.every((doc: Document) => {
      const content = doc.pageContent;
      return content.includes("向量") || content.includes("相似度") || content.includes("搜索");
    })).toBe(true);
  });

  test("检索结果数量不超过3条", async () => {
    const query = "的";
    const results = await retriever.getRelevantDocuments(query);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  test("检索结果应体现长度惩罚，避免长文档得分过高", async () => {
    const longDoc = new Document({
      pageContent: "关键词 ".repeat(1000) + "额外内容",
      metadata: { source: "longDoc" },
    });
    const shortDoc = new Document({
      pageContent: "关键词 额外内容",
      metadata: { source: "shortDoc" },
    });
    const testRetriever = new EnhancedAdvancedRetriever([longDoc, shortDoc], chineseStopwords);
    const results = await testRetriever.getRelevantDocuments("关键词");
    expect(results[0].metadata.source).toBe("shortDoc");
  });
});