import { NextResponse } from "next/server";

export interface ErrorHandlerOptions<T> {
  fallback?: () => Promise<T> | T;
  interfaceName: string;
}

/**
 * 通用错误捕获和日志记录工具函数
 * @param interfaceName 接口名，用于日志记录
 * @param fn 异步函数，接口的业务逻辑
 * @param options 可选参数，支持回退逻辑fallback
 * @returns 执行结果或回退结果
 */
export async function wrapWithErrorHandling<T>(
  interfaceName: string,
  fn: () => Promise<T>,
  options?: ErrorHandlerOptions<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const timestamp = new Date().toISOString();
    const errorMessage = error?.message || String(error);
    const stack = error?.stack || "No stack trace available";

    // 详细日志记录
    console.error(`[${timestamp}] [${interfaceName}] Error: ${errorMessage}`);
    console.error(`[${timestamp}] [${interfaceName}] Stack trace: ${stack}`);

    // 调用回退逻辑
    if (options?.fallback) {
      try {
        const fallbackResult = await options.fallback();
        console.info(`[${timestamp}] [${interfaceName}] Fallback logic executed successfully.`);
        return fallbackResult;
      } catch (fallbackError) {
        console.error(`[${timestamp}] [${interfaceName}] Fallback logic failed: ${fallbackError}`);
      }
    }

    // 默认返回错误响应，适用于Next.js API路由
    if (typeof error.status === "number") {
      return NextResponse.json(
        { error: errorMessage },
        { status: error.status }
      ) as unknown as T;
    } else {
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      ) as unknown as T;
    }
  }
}