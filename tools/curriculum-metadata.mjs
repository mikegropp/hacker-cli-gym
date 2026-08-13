const shellOperators = /(?:\|(?!=)|&&|;|>>?|<|\$\()/;

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function hasWord(source, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9_-])${escaped}(?=$|[^A-Za-z0-9_-])`, 'i').test(source);
}

export function inferConcepts(solution, shell) {
  const concepts = [];
  if (/\|(?!=)/.test(solution)) concepts.push('pipelines');
  if (/(^|[^>])>{1,2}|(^|[^<])</.test(solution)) concepts.push('redirection');
  if (/&&|;/.test(solution)) concepts.push('command chaining');
  if (/\$\(/.test(solution)) concepts.push('command substitution');
  if (/\$[A-Za-z_][A-Za-z0-9_:]*/.test(solution)) concepts.push('variables');
  if (/['"]/.test(solution)) concepts.push('quoting');
  if (/\b(for|while|until|foreach|ForEach-Object)\b/i.test(solution)) concepts.push('iteration');
  if (/\b(if|case|switch|Where-Object|select\()\b/i.test(solution)) concepts.push('filtering and conditions');
  if (/\b(sort|Sort-Object|uniq|Get-Unique|Group-Object)\b/i.test(solution)) concepts.push('ordering and grouping');
  if (shell === 'powershell' && /\{[^}]*\}/.test(solution)) concepts.push('script blocks');
  return unique(concepts);
}

export function inferDependencies(solution, command, orderedCommands) {
  const current = orderedCommands.findIndex(item => item.toLowerCase() === command.toLowerCase());
  const referenced = orderedCommands.filter(item => item.toLowerCase() !== command.toLowerCase() && hasWord(solution, item));
  return {
    prerequisites: referenced.filter(item => orderedCommands.indexOf(item) < current),
    introduced_inline: referenced.filter(item => orderedCommands.indexOf(item) > current),
  };
}

function resultExpectation(checks) {
  const descriptions = unique((checks ?? []).map(check => check.description));
  if (!descriptions.length) return 'Verify the exact output or workspace state requested by the mission.';
  return `Use the checker as a specification: ${descriptions.slice(0, 2).join(' ')}`;
}

function maskShellValue(token) {
  if (!token) return token;
  if (/^(?:\||&&|;|>>?|<|\(|\)|\{|\})$/.test(token)) return token;
  if (/^-{1,2}[A-Za-z0-9?=:-]+$/.test(token)) return token;
  if (/^[A-Za-z][A-Za-z0-9-]*(?:-[A-Za-z][A-Za-z0-9-]*)+$/.test(token)) return token;
  if (/^\$[A-Za-z_][A-Za-z0-9_:]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(token)) return token;
  if (/^[A-Za-z_][A-Za-z0-9_]*=$/.test(token)) return token;
  return '<value>';
}

export function commandShape(solution) {
  const tokens = solution
    .replace(/([|;<>])/g, ' $1 ')
    .replace(/&&/g, ' && ')
    .trim()
    .split(/\s+/);
  let expectsCommand = true;
  const shaped = tokens.map(token => {
    if (expectsCommand && /^[A-Za-z][A-Za-z0-9-]*$/.test(token)) {
      expectsCommand = false;
      return token;
    }
    if (/^(?:\||&&|;)$/.test(token)) expectsCommand = true;
    return maskShellValue(token);
  });
  return shaped.join(' ').replace(/(?:<value>\s*){2,}/g, '<values> ').trim();
}

export function buildHints(source, command, shell) {
  const authored = Array.isArray(source.hints) ? source.hints.filter(Boolean) : [];
  const helpHint = shell === 'powershell'
    ? `Use Get-Help ${command} -Examples to inspect another safe pattern without revealing this fixture's answer.`
    : `Use man ${command} or ${command} --help to inspect the relevant option without revealing this fixture's answer.`;
  const candidates = [
    ...authored,
    resultExpectation(source.checks),
    `Try this command shape, replacing placeholders with fixture values: ${commandShape(source.solution)}`,
    helpHint,
  ];
  return unique(candidates).slice(0, 3);
}

export function buildBreakdown(source, command) {
  if (Array.isArray(source.breakdown) && source.breakdown.length >= 2) return source.breakdown;
  return unique([
    `${command} is the featured command in the worked pattern.`,
    source.focus ?? source.about,
    `The example uses different values; adapt its structure to the mission fixture.`,
  ]);
}

export function enrichLesson(lesson, orderedCommands, shell) {
  const composed = shellOperators.test(lesson.solution);
  const stageKind = lesson.stage === 1 ? 'orientation'
    : lesson.stage === 2 ? 'options'
      : lesson.stage === 3 ? 'precision'
        : lesson.stage === 4 ? (composed ? 'composition' : 'applied')
          : (composed ? 'workflow' : 'transfer');
  const mode = lesson.stage === 5 && lesson.command_order % 10 === 0 ? 'capstone' : 'guided';
  const replacedLessonPrefixes = {
    'linux-source': 'linux-gunzip',
    'linux-find': 'linux-bunzip2',
    'linux-jq': 'linux-unxz',
    'powershell-start-job': 'powershell-start-service',
    'powershell-get-job': 'powershell-stop-service',
    'powershell-receive-job': 'powershell-restart-service',
  };
  const replacementPrefix = Object.keys(replacedLessonPrefixes).find(prefix => lesson.id === prefix || lesson.id.startsWith(`${prefix}-`));
  const legacyIds = replacementPrefix ? [lesson.id.replace(replacementPrefix, replacedLessonPrefixes[replacementPrefix])] : [];
  const lineCountContracts = {
    'linux-man-2': 1,
    'linux-cat-4': 3,
    'linux-grep-4': 1,
    'linux-top-5': 3,
    'linux-uname-2': 1,
    'linux-ping-5': 2,
    'linux-wget': 1,
    'linux-systemctl': 1,
    'linux-systemctl-5': 1,
    'linux-journalctl': 1,
    'powershell-set-variable-4': 1,
    'powershell-get-acl': 1,
    'powershell-get-process': 1,
    'powershell-get-culture': 1,
    'powershell-get-ciminstance': 1,
    'powershell-get-computerinfo': 1,
    'powershell-resolve-dnsname-3': 1,
    'powershell-get-timezone': 1,
  };
  const genericDescriptions = new Set([
    'The requested result was printed.',
    'The requested value was included.',
    'The excluded value was absent.',
    'The command printed a value.',
  ]);
  const checks = lesson.checks.map(check => {
    if (!genericDescriptions.has(check.description)) return check;
    if (check.type === 'stdout-contains' || check.type === 'output-contains') {
      return { ...check, description: `The output included ${JSON.stringify(String(check.expected))} for “${lesson.title}”.` };
    }
    if (check.type === 'stdout-not-contains') {
      return { ...check, description: `The output excluded ${JSON.stringify(String(check.expected))} as required.` };
    }
    if (check.type === 'stdout-nonempty') {
      return { ...check, description: `A non-empty result was printed for “${lesson.title}”.` };
    }
    return { ...check, description: `The output exactly matched the mission for “${lesson.title}”.` };
  });
  if (lineCountContracts[lesson.id] && !checks.some(check => check.type === 'stdout-line-count')) {
    checks.push({
      type: 'stdout-line-count',
      description: `Exactly ${lineCountContracts[lesson.id]} nonblank output line${lineCountContracts[lesson.id] === 1 ? ' was' : 's were'} printed.`,
      expected: lineCountContracts[lesson.id],
    });
  }
  if (lesson.id === 'linux-ip-3') {
    checks.push({
      type: 'stdout-not-contains',
      description: 'No non-loopback interface was included.',
      expected: 'eth0',
    });
  }
  let files = lesson.files ?? {};
  let task = lesson.task;
  let solution = lesson.solution;
  if (mode === 'capstone' && !files['.gym-challenge']) {
    files = { ...files, '.gym-challenge': 'token={{nonce}}\n' };
    task = `${task} Then copy the one-time token from the workspace-root .gym-challenge into workspace-root .gym-proof.`;
    solution = shell === 'powershell'
      ? `${solution}; Copy-Item -LiteralPath '{{workspace}}/.gym-challenge' -Destination '{{workspace}}/.gym-proof'`
      : `${solution} && cp /work/.gym-challenge /work/.gym-proof`;
    checks.push({
      type: 'file-content',
      description: 'The changing one-time challenge token was copied rather than hard-coded.',
      path: '.gym-proof',
      expected: 'token={{nonce}}\n',
      normalize: 'exact',
    });
  }
  // Capstones append an integrity-proof command, so dependency and concept
  // metadata must describe the final solution learners actually see.
  const concepts = unique([lesson.command, ...inferConcepts(solution, shell)]);
  const dependencies = inferDependencies(solution, lesson.command, orderedCommands);
  const permissiveChecks = new Set(['stdout-contains', 'stdout-nonempty', 'output-contains', 'exit-code']);
  const checkStrength = checks.every(check => permissiveChecks.has(check.type)) ? 'permissive'
    : checks.some(check => permissiveChecks.has(check.type)) ? 'mixed'
      : 'strict';
  return {
    ...lesson,
    files,
    task,
    solution,
    checks,
    stage_kind: stageKind,
    mode,
    concepts,
    prerequisites: dependencies.prerequisites,
    introduced_inline: dependencies.introduced_inline,
    legacy_ids: legacyIds,
    requires_success: !checks.some(check => check.type === 'exit-code' && Number(check.expected) !== 0),
    check_strength: checkStrength,
  };
}

export function validateLessonMetadata(lessons, expectedCount) {
  if (lessons.length !== expectedCount) throw new Error(`expected ${expectedCount} lessons, found ${lessons.length}`);
  const ids = new Set();
  const tasks = new Set();
  const weakOnlyChecks = [];
  for (const lesson of lessons) {
    if (ids.has(lesson.id)) throw new Error(`duplicate lesson id: ${lesson.id}`);
    if (tasks.has(lesson.task)) throw new Error(`duplicate lesson task: ${lesson.id}`);
    ids.add(lesson.id);
    tasks.add(lesson.task);
    if (!Array.isArray(lesson.hints) || lesson.hints.length < 3) throw new Error(`${lesson.id} needs three progressive hints`);
    if (!Array.isArray(lesson.breakdown) || lesson.breakdown.length < 2) throw new Error(`${lesson.id} needs an annotated breakdown`);
    if (!Array.isArray(lesson.checks) || lesson.checks.length === 0) throw new Error(`${lesson.id} needs outcome checks`);
    if (lesson.mode === 'capstone' && lesson.stage !== 5) throw new Error(`${lesson.id} marks a non-workflow stage as capstone`);
    if (lesson.task.includes('only') && lesson.checks.every(check => ['stdout-contains', 'stdout-nonempty', 'output-contains'].includes(check.type))) {
      weakOnlyChecks.push(lesson.id);
    }
  }
  if (weakOnlyChecks.length) {
    console.warn(`Quality warning: ${weakOnlyChecks.length} "only" missions use permissive checks (${weakOnlyChecks.slice(0, 5).join(', ')}${weakOnlyChecks.length > 5 ? ', …' : ''}).`);
  }
}
