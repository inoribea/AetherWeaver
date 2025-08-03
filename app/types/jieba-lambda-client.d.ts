export interface JiebaLambdaRequest {
  text: string;
}

export interface JiebaLambdaResponse {
  result?: string[];
  error?: string;
}

export declare function segmentViaLambda(text: string): Promise<string[]>;