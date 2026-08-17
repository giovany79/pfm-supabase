import { afterEach, describe, expect, it } from "vitest";
import { assertBearer } from "@/lib/mcp/auth";

const original = process.env.MCP_ACTIONS_API_KEY;

afterEach(() => {
  if (original === undefined) delete process.env.MCP_ACTIONS_API_KEY;
  else process.env.MCP_ACTIONS_API_KEY = original;
});

describe("assertBearer", () => {
  it("accepts only the configured bearer token", () => {
    process.env.MCP_ACTIONS_API_KEY = "configured-secret";
    expect(() => assertBearer(new Request("http://test", { headers: { authorization: "Bearer configured-secret" } }))).not.toThrow();
    expect(() => assertBearer(new Request("http://test"))).toThrow(Response);
    expect(() => assertBearer(new Request("http://test", { headers: { authorization: "Bearer wrong-secret" } }))).toThrow(Response);
  });
});
