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
    expect(body.info.version).toBe('1.4.0');
    expect(Object.keys(body.paths)).toHaveLength(8);
  });

  it('exposes saving in every transaction type schema', async () => {
    const openApiSchema = await getOpenApiSchema();
    const schemas = openApiSchema.components.schemas;

    expect(schemas.QueryTransactionsInput.properties.type.enum).toContain(
      'saving',
    );
    expect(schemas.AggregateTransactionsInput.properties.type.enum).toContain(
      'saving',
    );
    expect(
      schemas.ProposeTransactionChangeInput.properties.type_income_expense.enum,
    ).toContain('saving');
    expect(
      schemas.TransactionDraft.properties.type_income_expense.enum,
    ).toContain('saving');
    expect(schemas.Transaction.properties.type.enum).toContain('saving');
  });

  it('exposes eight uniquely named operations with request schemas', async () => {
    const openApiSchema = await getOpenApiSchema();
    const operations = Object.values(
      openApiSchema.paths as Record<string, OpenApiPath>,
    ).map((path) => path.post);

    expect(operations).toHaveLength(8);
    expect(
      new Set(operations.map((operation) => operation.operationId)).size,
    ).toBe(8);
    expect(
      operations.every(
        (operation) =>
          operation.requestBody.required &&
          operation.requestBody.content['application/json'].schema.$ref,
      ),
    ).toBe(true);
  });

  it('resolves every local schema reference to an object component', async () => {
    const openApiSchema = await getOpenApiSchema();
    const schemaPrefix = '#/components/schemas/';
    const references = new Set<string>();

    const collectReferences = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;

      if (Array.isArray(value)) {
        value.forEach(collectReferences);
        return;
      }

      for (const [key, child] of Object.entries(value)) {
        if (
          key === '$ref' &&
          typeof child === 'string' &&
          child.startsWith(schemaPrefix)
        ) {
          references.add(child);
        } else {
          collectReferences(child);
        }
      }
    };

    collectReferences(openApiSchema);

    const invalidReferences = [...references].filter((reference) => {
      const componentName = reference.slice(schemaPrefix.length);
      const component = (
        openApiSchema.components.schemas as Record<string, unknown>
      )[componentName];

      return (
        !component || typeof component !== 'object' || Array.isArray(component)
      );
    });

    expect(invalidReferences).toEqual([]);
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
    expect(
      openApiSchema.paths['/propose-transaction-batch'].post.description,
    ).toContain('one explicit confirmation covering the whole batch');
    expect(
      openApiSchema.paths['/confirm-transaction-change'].post.description,
    ).toContain('this single call applies every row atomically');
    expect(
      openApiSchema.paths['/propose-snapshot-change'].post[
        'x-openai-isConsequential'
      ],
    ).toBe(false);
    expect(
      openApiSchema.paths['/confirm-snapshot-change'].post[
        'x-openai-isConsequential'
      ],
    ).toBe(true);
    expect(
      openApiSchema.paths['/propose-snapshot-change'].post.description,
    ).toContain('cannot be edited directly');
  });
});
