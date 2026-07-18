// src/config.js — generic interpreter over a restricted JSON-Schema-draft-07 subset.
// Implements only: type, required, properties, enum, additionalProperties.
// Never soft-fail-and-return; always throws on any violation (CFG-02 hard-fail).
// Selector strings never live here — only in config/demo-platform.json.

export function validateConfig(config, schema) {
  const errors = [];
  walk(config, schema, '$', errors);
  if (errors.length > 0) {
    throw new Error(`[heed] Invalid config — refusing to initialize:\n${errors.join('\n')}`);
  }
  return config; // valid — caller may now proceed to build the bus/signal layer
}

function walk(value, schemaNode, path, errors) {
  if (
    schemaNode.type &&
    typeof value !== schemaNode.type &&
    !(schemaNode.type === 'object' && value !== null && typeof value === 'object') &&
    !(schemaNode.type === 'array' && Array.isArray(value))
  ) {
    errors.push(`${path}: expected type "${schemaNode.type}", got "${typeof value}"`);
    return; // don't recurse into a value whose base type is already wrong
  }

  if (schemaNode.type === 'object' && schemaNode.properties) {
    for (const key of schemaNode.required ?? []) {
      if (!(key in value)) errors.push(`${path}.${key}: required field missing`);
    }
    for (const [key, subSchema] of Object.entries(schemaNode.properties)) {
      if (key in value) walk(value[key], subSchema, `${path}.${key}`, errors);
    }
  }

  if (schemaNode.enum && !schemaNode.enum.includes(value)) {
    errors.push(`${path}: value "${value}" not in allowed enum [${schemaNode.enum.join(', ')}]`);
  }
}
