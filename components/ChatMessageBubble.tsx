import { cn } from "@/utils/cn";
import type { Message } from "ai/react";

export function ChatMessageBubble(props: {
  message: Message;
  aiEmoji?: string;
  sources: any[];
  modelInfo?: any;
}) {
  return (
    <div
      className={cn(
        `rounded-[24px] max-w-[80%] mb-8 flex`,
        props.message.role === "user"
          ? "bg-secondary text-secondary-foreground px-4 py-2"
          : null,
        props.message.role === "user" ? "ml-auto" : "mr-auto",
      )}
    >
      {props.message.role !== "user" && (
        <div className="mr-4 border bg-secondary -mt-2 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center">
          {props.aiEmoji}
        </div>
      )}

      <div className="whitespace-pre-wrap flex flex-col">
        {/* Model info display - only for AI messages */}
        {props.message.role === "assistant" && props.modelInfo && (
          <div className="mb-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 bg-muted px-2 py-1 rounded">
              🤖 {props.modelInfo.modelUsed}
              {props.modelInfo.feature && (
                <span className="text-[10px] opacity-70">
                  • {props.modelInfo.feature}
                </span>
              )}
            </span>
          </div>
        )}

        {(() => {
          try {
            const parsedContent = JSON.parse(props.message.content);
            if (parsedContent && parsedContent.response) {
              return (
                <>
                  <span>{parsedContent.response}</span>
                  {parsedContent.routing && (
                    <div className="mt-2 text-xs text-muted-foreground p-2 bg-muted rounded-lg">
                      <p><strong>路由:</strong> {parsedContent.routing.route}</p>
                      <p><strong>置信度:</strong> {parsedContent.routing.confidence}</p>
                      <p><strong>模型:</strong> {parsedContent.routing.model}</p>
                    </div>
                  )}
                </>
              );
            }
          } catch (e) {
            // Not a JSON object, render as plain text
          }
          return <span>{props.message.content}</span>;
        })()}

        {/* Model details and token info - only for AI messages */}
        {props.message.role === "assistant" && props.modelInfo && (
          <div className="mt-2 text-[10px] text-muted-foreground opacity-60">
            {props.modelInfo.modelProvider && (
              <span>Provider: {props.modelInfo.modelProvider}</span>
            )}
            {props.modelInfo.retrievalMethod && (
              <span> • Method: {props.modelInfo.retrievalMethod}</span>
            )}
            {props.modelInfo.documentsFound && (
              <span> • Docs: {props.modelInfo.documentsFound}</span>
            )}
          </div>
        )}

        {props.sources && props.sources.length ? (
          <>
            <code className="mt-4 mr-auto bg-primary px-2 py-1 rounded">
              <h2>🔍 Sources:</h2>
            </code>
            <code className="mt-1 mr-2 bg-primary px-2 py-1 rounded text-xs">
              {props.sources?.map((source, i) => (
                <div className="mt-2" key={"source:" + i}>
                  {i + 1}. &quot;{source.pageContent}&quot;
                  {source.metadata?.loc?.lines !== undefined ? (
                    <div>
                      <br />
                      Lines {source.metadata?.loc?.lines?.from} to{" "}
                      {source.metadata?.loc?.lines?.to}
                    </div>
                  ) : (
                    ""
                  )}
                </div>
              ))}
            </code>
          </>
        ) : null}
      </div>
    </div>
  );
}
