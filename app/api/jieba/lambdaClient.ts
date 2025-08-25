import { localSegment } from "./segment/tokenizer";

// We are now directly calling the local segmentation function.
// The fetch-based lambda invocation is no longer needed for Vercel deployment.

export async function segmentViaLambda(text: string): Promise<string[]> {
  // Directly use the imported local segmentation logic
  try {
    const tokens = localSegment(text);
    return Promise.resolve(tokens);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown segmentation error';
    console.error(`Segmentation error: ${message}`);
    return Promise.reject(new Error(message));
  }
}