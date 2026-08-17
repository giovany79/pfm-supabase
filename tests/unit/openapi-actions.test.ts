import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/actions/openapi.json/route';

async function getOpenApiSchema() {
  return GET().json();
}

type OpenApiPath = {
  post: {
    operationId: string;
    requestBody: {
      required: boolean;
      content: { 'application/json': { schema: { $ref: string } } };
    };
  };
};

describe('GPT Actions OpenAPI schema', () => {
  it('declares the production server and bearer authentication', async () => {
    const openApiSchema = await getOpenApiSchema();

    expect(openApiSchema.servers).toEqual([
      { url: 'https://pfm-supabase.vercel.app/api/actions' },
    ]);
    expect(openApiSchema.components.securitySchemes.ApiKeyAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });

  it('serves the complete schema as JSON', async () => {
    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.servers[0].url).toBe(
      'https://pfm-supabase.vercel.app/api/actions',
    );
    expect(body.info.version).toBe('1.2.0');
    expect(Object.keys(body.paths)).toHaveLength(6);
  });

  it('exposes six uniquely named operations with request schemas', async () => {
    const openApiSchema = await getOpenApiSchema();
    const operations = Object.values(
      openApiSchema.paths as Record<string, OpenApiPath>,
    ).map(
      (path) => path.post,
    );

    expect(operations).toHaveLength(6);
    expect(new Set(operations.map((operation) => operation.operationId)).size).toBe(6);
    expect(
      operations.every(
        (operation) =>
          operation.requestBody.required &&
          operation.requestBody.content['application/json'].schema.$ref,
      ),
    ).toBe(true);
  });

  it('requires confirmation for the applying mutation only', async () => {
    const openApiSchema = await getOpenApiSchema();

    expect(
      openApiSchema.paths['/query-transactions'].post[
        'x-openai-isConsequential'
      ],
    ).toBe(false);
    expect(
      openApiSchema.paths['/confirm-transaction-change'].post[
        'x-openai-isConsequential'
      ],
    ).toBe(true);
    expect(
      openApiSchema.paths['/propose-transaction-batch'].post[
        'x-openai-isConsequential'
      ],
    ).toBe(false);
  });
});
