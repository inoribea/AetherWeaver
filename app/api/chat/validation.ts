import { z } from "zod";

export const messageSchema = z.union([
  z.string().min(1, "Message string cannot be empty"),
  z.object({
    content: z.string().min(1, "Message content cannot be empty"),
  }),
]);

export const validateMessage = (data: unknown) => {
  const result = messageSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid message format: ${result.error.issues.map(i => i.message).join(", ")}`);
  }
  return result.data;
};