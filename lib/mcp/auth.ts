import { timingSafeEqual } from 'node:crypto';

export function assertBearer(request: Request) {
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''); const expected = process.env.MCP_ACTIONS_API_KEY;
  if (!supplied || !expected || supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw new Response('Unauthorized', { status: 401 });
}
