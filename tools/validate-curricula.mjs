#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const schemaPath = resolve(root, 'curriculum', 'schema.json');
const curriculumSchema = JSON.parse(await readFile(schemaPath, 'utf8'));
const genericDescriptions = new Set([
  'The requested result was printed.',
  'The requested value was included.',
  'The excluded value was absent.',
  'The command printed a value.',
]);

function fail(messages, message) {
  messages.push(message);
}

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number' && Number.isInteger(value)) return 'integer';
  return typeof value;
}

function valueMatchesType(value, expected) {
  switch (expected) {
    case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'array': return Array.isArray(value);
    case 'string': return typeof value === 'string';
    case 'integer': return typeof value === 'number' && Number.isInteger(value);
    case 'boolean': return typeof value === 'boolean';
    default: throw new Error(`Unsupported JSON Schema type in ${schemaPath}: ${expected}`);
  }
}

function equalJson(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => equalJson(value, right[index]));
  }
  if (
    left !== null && right !== null
    && typeof left === 'object' && typeof right === 'object'
    && !Array.isArray(left) && !Array.isArray(right)
  ) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length
      && leftKeys.every(key => Object.hasOwn(right, key) && equalJson(left[key], right[key]));
  }
  return false;
}

function instancePath(parent, property) {
  if (typeof property === 'number') return `${parent}[${property}]`;
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(property)
    ? `${parent}.${property}`
    : `${parent}[${JSON.stringify(property)}]`;
}

function resolveLocalReference(schema, reference) {
  if (reference === '#') return schema;
  if (!reference.startsWith('#/')) {
    throw new Error(`Only local JSON Schema references are supported; found ${reference}`);
  }

  let current = schema;
  const pointer = decodeURIComponent(reference.slice(2));
  for (const rawPart of pointer.split('/')) {
    const part = rawPart.replaceAll('~1', '/').replaceAll('~0', '~');
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, part)) {
      throw new Error(`Unresolvable JSON Schema reference in ${schemaPath}: ${reference}`);
    }
    current = current[part];
  }
  return current;
}

function validateSchemaValue(value, rule, path, schema, errors) {
  if (rule === true || rule === undefined) return;
  if (rule === false) {
    fail(errors, `${path}: value is forbidden by the curriculum schema`);
    return;
  }
  if (rule === null || typeof rule !== 'object' || Array.isArray(rule)) {
    throw new Error(`Invalid JSON Schema rule encountered while validating ${path}`);
  }

  if (rule.$ref !== undefined) {
    validateSchemaValue(value, resolveLocalReference(schema, rule.$ref), path, schema, errors);
    const siblingRules = Object.fromEntries(Object.entries(rule).filter(([key]) => key !== '$ref'));
    if (Object.keys(siblingRules).length) validateSchemaValue(value, siblingRules, path, schema, errors);
    return;
  }

  if (rule.type !== undefined) {
    const expectedTypes = Array.isArray(rule.type) ? rule.type : [rule.type];
    if (!expectedTypes.some(expected => valueMatchesType(value, expected))) {
      fail(errors, `${path}: expected ${expectedTypes.join(' or ')}, got ${valueType(value)}`);
      return;
    }
  }

  if (rule.const !== undefined && !equalJson(value, rule.const)) {
    fail(errors, `${path}: must equal ${JSON.stringify(rule.const)}`);
  }
  if (rule.enum !== undefined && !rule.enum.some(option => equalJson(value, option))) {
    fail(errors, `${path}: must be one of ${rule.enum.map(option => JSON.stringify(option)).join(', ')}`);
  }

  if (typeof value === 'string') {
    const length = [...value].length;
    if (rule.minLength !== undefined && length < rule.minLength) {
      fail(errors, `${path}: must contain at least ${rule.minLength} characters`);
    }
    if (rule.maxLength !== undefined && length > rule.maxLength) {
      fail(errors, `${path}: must contain at most ${rule.maxLength} characters`);
    }
    if (rule.pattern !== undefined && !new RegExp(rule.pattern, 'u').test(value)) {
      fail(errors, `${path}: must match /${rule.pattern}/`);
    }
  }

  if (typeof value === 'number') {
    if (rule.minimum !== undefined && value < rule.minimum) {
      fail(errors, `${path}: must be at least ${rule.minimum}`);
    }
    if (rule.maximum !== undefined && value > rule.maximum) {
      fail(errors, `${path}: must be at most ${rule.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (rule.minItems !== undefined && value.length < rule.minItems) {
      fail(errors, `${path}: must contain at least ${rule.minItems} items`);
    }
    if (rule.maxItems !== undefined && value.length > rule.maxItems) {
      fail(errors, `${path}: must contain at most ${rule.maxItems} items`);
    }
    if (rule.items !== undefined) {
      value.forEach((item, index) => validateSchemaValue(item, rule.items, instancePath(path, index), schema, errors));
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const required of rule.required ?? []) {
      if (!Object.hasOwn(value, required)) fail(errors, `${instancePath(path, required)}: required property is missing`);
    }
    for (const [property, propertyRule] of Object.entries(rule.properties ?? {})) {
      if (Object.hasOwn(value, property)) {
        validateSchemaValue(value[property], propertyRule, instancePath(path, property), schema, errors);
      }
    }
    if (rule.additionalProperties === false) {
      const declared = new Set(Object.keys(rule.properties ?? {}));
      for (const property of Object.keys(value)) {
        if (!declared.has(property)) fail(errors, `${instancePath(path, property)}: additional property is not allowed`);
      }
    } else if (rule.additionalProperties && typeof rule.additionalProperties === 'object') {
      const declared = new Set(Object.keys(rule.properties ?? {}));
      for (const [property, propertyValue] of Object.entries(value)) {
        if (!declared.has(property)) {
          validateSchemaValue(propertyValue, rule.additionalProperties, instancePath(path, property), schema, errors);
        }
      }
    }
  }
}

const checkTypeRule = resolveLocalReference(curriculumSchema, '#/$defs/check/properties/type');
if (!Array.isArray(checkTypeRule.enum) || checkTypeRule.enum.some(type => typeof type !== 'string')) {
  throw new Error(`${schemaPath}: $defs.check.properties.type.enum must be an array of strings`);
}
const allowedChecks = new Set(checkTypeRule.enum);

async function validate(track) {
  const path = resolve(root, 'curriculum', `${track}.json`);
  const catalog = JSON.parse(await readFile(path, 'utf8'));
  const schemaErrors = [];
  validateSchemaValue(catalog, curriculumSchema, '$', curriculumSchema, schemaErrors);
  if (schemaErrors.length) {
    throw new Error(`${track} curriculum failed schema validation:\n- ${schemaErrors.join('\n- ')}`);
  }

  const errors = [];
  if (catalog.catalog_version !== 2) fail(errors, 'catalog_version must be 2');
  if (catalog.track !== track) fail(errors, `track must be ${track}`);
  if (catalog.command_count !== 100 || catalog.stages_per_command !== 5 || catalog.exercise_count !== 500) {
    fail(errors, 'catalog dimensions must be 100 commands × 5 stages = 500 exercises');
  }
  if (!Array.isArray(catalog.sections) || catalog.sections.length !== 10) fail(errors, 'exactly 10 sections are required');
  if (!Array.isArray(catalog.lessons) || catalog.lessons.length !== 500) fail(errors, 'exactly 500 lessons are required');

  const ids = new Set();
  const orders = new Set();
  const tasks = new Set();
  const commands = new Map();
  for (const lesson of catalog.lessons ?? []) {
    if (ids.has(lesson.id)) fail(errors, `${lesson.id}: duplicate id`);
    if (orders.has(lesson.order)) fail(errors, `${lesson.id}: duplicate order ${lesson.order}`);
    if (tasks.has(lesson.task)) fail(errors, `${lesson.id}: duplicate task`);
    ids.add(lesson.id);
    orders.add(lesson.order);
    tasks.add(lesson.task);
    commands.set(lesson.command, (commands.get(lesson.command) ?? 0) + 1);

    for (const field of ['id', 'command', 'title', 'focus', 'task', 'solution', 'completion', 'stage_kind', 'mode']) {
      if (typeof lesson[field] !== 'string' || lesson[field].length === 0) fail(errors, `${lesson.id}: missing ${field}`);
    }
    if (!Array.isArray(lesson.hints) || lesson.hints.length < 3) fail(errors, `${lesson.id}: needs three hints before the reference`);
    if (!Array.isArray(lesson.breakdown) || lesson.breakdown.length < 2) fail(errors, `${lesson.id}: needs an annotated example breakdown`);
    if (!Array.isArray(lesson.concepts) || !lesson.concepts.includes(lesson.command)) fail(errors, `${lesson.id}: concepts must include the featured command`);
    if (!Array.isArray(lesson.prerequisites) || !Array.isArray(lesson.introduced_inline) || !Array.isArray(lesson.legacy_ids)) fail(errors, `${lesson.id}: dependency or migration metadata is missing`);
    if (!['guided', 'capstone'].includes(lesson.mode)) fail(errors, `${lesson.id}: invalid mode`);
    if (lesson.mode === 'capstone' && lesson.stage !== 5) fail(errors, `${lesson.id}: capstones must be stage 5`);
    if (typeof lesson.requires_success !== 'boolean') fail(errors, `${lesson.id}: requires_success must be boolean`);
    if (!Array.isArray(lesson.checks) || lesson.checks.length === 0) fail(errors, `${lesson.id}: no checks`);
    for (const check of lesson.checks ?? []) {
      if (!allowedChecks.has(check.type)) fail(errors, `${lesson.id}: unsupported check ${check.type}`);
      if (!check.description || genericDescriptions.has(check.description)) fail(errors, `${lesson.id}: generic or missing check description`);
    }
    if (/\bonly\b/i.test(lesson.task) && lesson.checks.every(check => ['stdout-contains', 'stdout-nonempty', 'output-contains'].includes(check.type))) {
      fail(errors, `${lesson.id}: “only” mission needs an exact, line-count, or exclusion assertion`);
    }
  }
  if (commands.size !== 100 || [...commands.values()].some(count => count !== 5)) fail(errors, 'every one of the 100 commands must have exactly five lessons');
  for (let order = 1; order <= 500; order++) if (!orders.has(order)) fail(errors, `missing order ${order}`);

  if (errors.length) throw new Error(`${track} curriculum failed validation:\n- ${errors.join('\n- ')}`);
  const permissive = catalog.lessons.filter(lesson => lesson.check_strength === 'permissive').length;
  const capstones = catalog.lessons.filter(lesson => lesson.mode === 'capstone').length;
  const inline = catalog.lessons.filter(lesson => lesson.introduced_inline.length).length;
  console.log(`${track}: 500 valid lessons, ${capstones} blind capstones, ${permissive} permissive outcome checks, ${inline} lessons with inline dependency notes`);
}

await validate('linux');
await validate('powershell');
