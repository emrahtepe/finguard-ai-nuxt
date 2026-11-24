import { UpdateStatusInputSchema } from "../utils/schemas";
import { updateTransactionStatus } from "../utils/store";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const parsed = UpdateStatusInputSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Invalid status payload.",
    });
  }

  const updated = updateTransactionStatus(
    parsed.data.transactionId,
    parsed.data.nextStatus,
    parsed.data.reason
  );

  if (!updated) {
    throw createError({
      statusCode: 404,
      statusMessage: `Transaction ${parsed.data.transactionId} not found.`,
    });
  }

  return updated;
});
