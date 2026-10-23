import {
  NoSchemaIntrospectionCustomRule,
  GraphQLError,
  parse,
  specifiedRules,
  validate
} from 'graphql';

export const MAX_GRAPHQL_QUERY_LENGTH = 50000;
export const MAX_GRAPHQL_QUERY_DEPTH = 10;
export const MAX_GRAPHQL_QUERY_FIELDS = 100;
const MAX_GRAPHQL_TOKENS = 10000;

function getSelectionFieldCount(selectionSet, fragments, activeFragments) {
  if (!selectionSet) return 0;
  let fieldCount = 0;

  for (const selection of selectionSet.selections) {
    if (selection.kind === 'Field') {
      fieldCount++;
      fieldCount += getSelectionFieldCount(selection.selectionSet, fragments, activeFragments);
    } else if (selection.kind === 'InlineFragment') {
      fieldCount += getSelectionFieldCount(selection.selectionSet, fragments, activeFragments);
    } else if (selection.kind === 'FragmentSpread') {
      const name = selection.name.value;
      const fragment = fragments.get(name);
      if (fragment && !activeFragments.has(name)) {
        activeFragments.add(name);
        fieldCount += getSelectionFieldCount(fragment.selectionSet, fragments, activeFragments);
        activeFragments.delete(name);
      }
    }

    if (fieldCount > MAX_GRAPHQL_QUERY_FIELDS) return fieldCount;
  }

  return fieldCount;
}

function getSelectionDepth(selectionSet, fragments, fragmentDepths, activeFragments) {
  if (!selectionSet) return 0;
  let maxDepth = 0;

  for (const selection of selectionSet.selections) {
    if (selection.kind === 'Field') {
      const depth = 1 + getSelectionDepth(selection.selectionSet, fragments, fragmentDepths, activeFragments);
      maxDepth = Math.max(maxDepth, depth);
    } else if (selection.kind === 'InlineFragment') {
      maxDepth = Math.max(maxDepth, getSelectionDepth(selection.selectionSet, fragments, fragmentDepths, activeFragments));
    } else if (selection.kind === 'FragmentSpread') {
      const name = selection.name.value;
      if (fragmentDepths.has(name)) {
        maxDepth = Math.max(maxDepth, fragmentDepths.get(name));
      } else if (!activeFragments.has(name)) {
        const fragment = fragments.get(name);
        if (fragment) {
          activeFragments.add(name);
          const depth = getSelectionDepth(fragment.selectionSet, fragments, fragmentDepths, activeFragments);
          activeFragments.delete(name);
          fragmentDepths.set(name, depth);
          maxDepth = Math.max(maxDepth, depth);
        }
      }
    }

    if (maxDepth > MAX_GRAPHQL_QUERY_DEPTH) return maxDepth;
  }

  return maxDepth;
}

export function prepareGraphQLQuery(schema, source, { disableIntrospection = process.env.NODE_ENV === 'production' } = {}) {
  if (typeof source !== 'string' || source.length > MAX_GRAPHQL_QUERY_LENGTH) {
    return { errors: [new GraphQLError('A bounded GraphQL operation is required.')] };
  }

  let document;
  try {
    document = parse(source, { maxTokens: MAX_GRAPHQL_TOKENS });
  } catch (error) {
    if (error instanceof GraphQLError) return { errors: [error] };
    throw error;
  }
  const fragments = new Map(document.definitions
    .filter(definition => definition.kind === 'FragmentDefinition')
    .map(fragment => [fragment.name.value, fragment]));
  const fragmentDepths = new Map();
  const depthErrors = [];

  for (const operation of document.definitions.filter(definition => definition.kind === 'OperationDefinition')) {
    const depth = getSelectionDepth(operation.selectionSet, fragments, fragmentDepths, new Set());
    if (depth > MAX_GRAPHQL_QUERY_DEPTH) {
      depthErrors.push(new GraphQLError(
        `Operation exceeds the maximum query depth of ${MAX_GRAPHQL_QUERY_DEPTH}.`,
        { nodes: operation }
      ));
    }
    const fieldCount = getSelectionFieldCount(operation.selectionSet, fragments, new Set());
    if (fieldCount > MAX_GRAPHQL_QUERY_FIELDS) {
      depthErrors.push(new GraphQLError(
        `Operation exceeds the maximum field count of ${MAX_GRAPHQL_QUERY_FIELDS}.`,
        { nodes: operation }
      ));
    }
  }
  if (depthErrors.length) return { document, errors: depthErrors };

  const rules = disableIntrospection
    ? [...specifiedRules, NoSchemaIntrospectionCustomRule]
    : specifiedRules;
  const errors = validate(schema, document, rules);
  return errors.length ? { document, errors } : { document };
}
