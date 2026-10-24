import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, validate } from 'graphql';
import { schema } from './index.js';

test('CreateStoreInput accepts the business contact fields used by the create-store form', () => {
  const document = parse(`
    mutation CreateStore($input: CreateStoreInput!) {
      createUserStore(input: $input) {
        id
      }
    }
  `);
  const errors = validate(schema, document);
  assert.deepEqual(errors, []);

  const inputFields = schema.getType('CreateStoreInput').getFields();
  for (const field of ['email', 'phone', 'description']) {
    assert.ok(inputFields[field], `CreateStoreInput should include ${field}`);
  }
});
