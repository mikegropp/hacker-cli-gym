export const out = (expected, description = 'The requested result was printed.', normalize = 'trim') => [
  { type: 'stdout', description, expected, normalize },
];

export const contains = (expected, description = 'The requested value was included.') => ({
  type: 'stdout-contains', description, expected,
});

export const notContains = (expected, description = 'The excluded value was absent.') => ({
  type: 'stdout-not-contains', description, expected,
});

export const matches = (expected, description = 'The output matched the requested pattern.') => ({
  type: 'stdout-regex', description, expected,
});

export const nonempty = (description = 'The command printed a value.') => ({ type: 'stdout-nonempty', description });

export const exists = (path, kind = 'file') => ({
  type: 'path-exists', description: `${path} exists as a ${kind}.`, path, kind,
});

export const missing = path => ({ type: 'path-not-exists', description: `${path} is absent.`, path });

export const content = (path, expected) => ({
  type: 'file-content', description: `${path} has the expected content.`, path, expected,
});

export const contentContains = (path, expected) => ({
  type: 'file-content-contains', description: `${path} contains the expected text.`, path, expected,
});

export const ok = (description = 'The command completed successfully.') => ({ type: 'exit-code', description, expected: 0 });

export const lesson = ({ title, focus, example, example_output = '', task, solution, checks, ...fixtures }) => ({
  title,
  focus,
  example,
  example_output,
  task,
  solution,
  checks,
  ...fixtures,
});
