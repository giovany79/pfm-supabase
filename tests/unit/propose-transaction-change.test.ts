import { describe, expect, it } from "vitest";
import { proposeTransactionChange } from "@/lib/mcp/tools";

describe("proposeTransactionChange", () => {
  it("requires every field for a create before writing a pending change", async () => {
    const client = { from: () => { throw new Error("must not write"); } } as any;
    await expect(proposeTransactionChange(client, { operation: "create", date: "2026-01-01" })).rejects.toThrow("missing description");
  });

  it("requires one target id for edit and delete", async () => {
    const client = {} as any;
    await expect(proposeTransactionChange(client, { operation: "edit" })).rejects.toThrow("missing target_transaction_id");
    await expect(proposeTransactionChange(client, { operation: "delete" })).rejects.toThrow("missing target_transaction_id");
  });
});
