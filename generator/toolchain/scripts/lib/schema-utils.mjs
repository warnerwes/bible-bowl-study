import { readFileSync } from "node:fs";

const TYPE_CHECKERS = {
  string: (value) => typeof value === "string",
  integer: (value) => Number.isInteger(value),
  number: (value) => typeof value === "number" && Number.isFinite(value),
  boolean: (value) => typeof value === "boolean",
  array: Array.isArray,
  object: (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  null: (value) => value === null,
};

function resolveRef(ref, root) {
  if (ref === "#" || ref === "") {
    return root;
  }
  if (!ref.startsWith("#/")) {
    return null;
  }
  const parts = ref.slice(2).split("/");
  let current = root;
  for (const part of parts) {
    if (current === null || typeof current !== "object") {
      return null;
    }
    current = current[part];
  }
  return current;
}

function validateNode(schema, data, path, root, errors) {
  if (schema === true) {
    return true;
  }
  if (schema === false) {
    errors.push(`${path}: value not allowed`);
    return false;
  }

  if (schema && typeof schema === "object" && schema.$ref) {
    const target = resolveRef(schema.$ref, root);
    if (target === null || target === undefined) {
      errors.push(`${path}: unresolved $ref ${schema.$ref}`);
      return false;
    }
    return validateNode(target, data, path, root, errors);
  }

  let ok = true;

  if (schema.const !== undefined) {
    if (JSON.stringify(schema.const) !== JSON.stringify(data)) {
      errors.push(
        `${path}: expected ${JSON.stringify(schema.const)}, got ${JSON.stringify(data)}`
      );
      ok = false;
    }
  }

  if (schema.enum !== undefined) {
    const match = schema.enum.some(
      (item) => JSON.stringify(item) === JSON.stringify(data)
    );
    if (!match) {
      errors.push(
        `${path}: expected one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(data)}`
      );
      ok = false;
    }
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const matches = types.some((t) => (TYPE_CHECKERS[t] || (() => false))(data));
    if (!matches) {
      const got =
        data === null
          ? "null"
          : Array.isArray(data)
            ? "array"
            : typeof data;
      errors.push(`${path}: expected type ${types.join("|")}, got ${got}`);
      ok = false;
    }
  }

  if (typeof data === "string") {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(`${path}: string shorter than ${schema.minLength}`);
      ok = false;
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push(`${path}: string longer than ${schema.maxLength}`);
      ok = false;
    }
    if (schema.pattern !== undefined) {
      const re = new RegExp(schema.pattern);
      if (!re.test(data)) {
        errors.push(`${path}: does not match pattern ${schema.pattern}`);
        ok = false;
      }
    }
  }

  if (typeof data === "number" && Number.isFinite(data)) {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push(`${path}: value ${data} < minimum ${schema.minimum}`);
      ok = false;
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push(`${path}: value ${data} > maximum ${schema.maximum}`);
      ok = false;
    }
  }

  if (Array.isArray(data) && schema.items !== undefined) {
    for (let i = 0; i < data.length; i += 1) {
      if (!validateNode(schema.items, data[i], `${path}[${i}]`, root, errors)) {
        ok = false;
      }
    }
  }

  if (
    schema.properties !== undefined &&
    data !== null &&
    typeof data === "object" &&
    !Array.isArray(data)
  ) {
    const props = schema.properties;
    const required = new Set(
      Array.isArray(schema.required) ? schema.required : []
    );
    for (const key of required) {
      if (!Object.hasOwn(data, key)) {
        errors.push(`${path}: missing required property "${key}"`);
        ok = false;
      }
    }
    for (const [key, value] of Object.entries(data)) {
      if (Object.hasOwn(props, key)) {
        if (
          !validateNode(props[key], value, `${path}.${key}`, root, errors)
        ) {
          ok = false;
        }
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}: additional property "${key}" not allowed`);
        ok = false;
      } else if (
        schema.additionalProperties &&
        typeof schema.additionalProperties === "object"
      ) {
        if (
          !validateNode(
            schema.additionalProperties,
            value,
            `${path}.${key}`,
            root,
            errors
          )
        ) {
          ok = false;
        }
      }
    }
  }

  return ok;
}

export function validate(schema, data) {
  const errors = [];
  const valid = validateNode(schema, data, "$", schema, errors);
  return { valid, errors };
}

export function validateFile(schemaPath, dataPath) {
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const data = JSON.parse(readFileSync(dataPath, "utf8"));
  return validate(schema, data);
}
