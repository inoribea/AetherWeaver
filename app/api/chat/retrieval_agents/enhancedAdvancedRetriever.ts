import { Document } from '@langchain/core/documents';
import { segmentViaLambda } from '../../jieba/lambdaClient';

async function chineseTokenize(text: string, stopwords: Set<string>): Promise<string[]> {
  const tokens: string[] = await segmentViaLambda(text);
  return tokens.filter(token => token.trim() !== '' && !stopwords.has(token));
}

class EnhancedAdvancedRetriever {
  private documents: Document[];
  private stopwords: Set<string>;

  constructor(documents: Document[], stopwords: Set<string>) {
    this.documents = documents;
    this.stopwords = stopwords;
  }

  async getRelevantDocuments(query: string): Promise<Document[]> {
    const tokens = await chineseTokenize(query, this.stopwords);
    if (tokens.length === 0) {
      return [];
    }

    // 简单基于分词匹配文档内容，计算匹配分数
    const scoredDocs = this.documents.map(doc => {
      const content = doc.pageContent;
      let score = 0;
      for (const token of tokens) {
        if (content.includes(token)) {
          score += 1;
        }
      }
      return { doc, score };
    });

    // 按分数倒序排序，过滤出分数大于 0 的文档
    const filteredSortedDocs = scoredDocs
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ doc }) => doc);

    // 限制最多返回3条
    return filteredSortedDocs.slice(0, 3);
  }
}

export { chineseTokenize as tokenize, EnhancedAdvancedRetriever };