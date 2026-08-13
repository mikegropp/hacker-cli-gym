import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import discovery from './powershell-progressions/01-discovery.mjs';
import files from './powershell-progressions/02-files.mjs';
import pipeline from './powershell-progressions/03-pipeline.mjs';
import data from './powershell-progressions/04-data.mjs';
import output from './powershell-progressions/05-output.mjs';
import security from './powershell-progressions/06-security.mjs';
import runtime from './powershell-progressions/07-runtime.mjs';
import system from './powershell-progressions/08-system.mjs';
import network from './powershell-progressions/09-network.mjs';
import administration from './powershell-progressions/10-administration.mjs';
import {
  buildBreakdown,
  buildHints,
  enrichLesson,
  validateLessonMetadata,
} from './curriculum-metadata.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const basePath = path.join(root, 'curriculum', 'powershell.base.json');
const outputPath = path.join(root, 'curriculum', 'powershell.json');
const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
const progressions = Object.assign({}, discovery, files, pipeline, data, output, security, runtime, system, network, administration);
const stageNames = ['Orientation', 'Useful options', 'Focused results', 'Pipeline composition', 'Practical workflow'];
const progressionFiles = [
  '01-discovery.mjs',
  '02-files.mjs',
  '03-pipeline.mjs',
  '04-data.mjs',
  '05-output.mjs',
  '06-security.mjs',
  '07-runtime.mjs',
  '08-system.mjs',
  '09-network.mjs',
  '10-administration.mjs',
];

function findSuspiciousStringEscape(source) {
  let quote = null;
  let line = 1;
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === '\n') {
      line++;
      continue;
    }
    if (quote === null) {
      if (character === "'" || character === '"' || character === '`') quote = character;
      continue;
    }
    if (character === quote) {
      quote = null;
      continue;
    }
    if (character === '\\') {
      const escaped = source[++index];
      if (!"bfnrtv0xu'\"\\`\n\r".includes(escaped)) return { line, escaped };
    }
  }
  return null;
}

for (const filename of progressionFiles) {
  const source = fs.readFileSync(path.join(here, 'powershell-progressions', filename), 'utf8');
  const suspicious = findSuspiciousStringEscape(source);
  if (suspicious) {
    throw new Error(`${filename}:${suspicious.line} contains a suspicious \\${suspicious.escaped} string escape; double the backslash or use a forward slash.`);
  }
}

if (base.lessons.length !== 100) throw new Error(`Expected 100 PowerShell seed lessons; found ${base.lessons.length}.`);

const commands = base.lessons.map(lesson => lesson.command);
const orderedCommands = commands;
if (new Set(commands).size !== 100) throw new Error('PowerShell seed commands must be unique.');

const unknown = Object.keys(progressions).filter(command => !commands.includes(command));
if (unknown.length) throw new Error(`Progressions contain unknown commands: ${unknown.join(', ')}`);

const sections = Array.from({ length: 10 }, (_, index) => ({
  id: String(index + 1).padStart(2, '0'),
  title: [
    'Discovery and navigation',
    'Files and content',
    'Pipeline and text',
    'Structured data',
    'Variables and output',
    'Paths, archives, and security',
    'Processes, jobs, and modules',
    'Time and system inventory',
    'Networking and policy',
    'Windows administration',
  ][index],
  start: index * 50 + 1,
  end: index * 50 + 50,
}));

const lessons = [];
for (const [commandIndex, seed] of base.lessons.entries()) {
  const extras = progressions[seed.command];
  if (!Array.isArray(extras) || extras.length !== 4) {
    throw new Error(`${seed.command} must define exactly four progression lessons; found ${extras?.length ?? 0}.`);
  }

  const stages = [
    {
      ...seed,
      focus: seed.about,
      directories: seed.directories ?? [],
      setup: seed.setup ?? [],
    },
    ...extras,
  ];

  for (const [stageIndex, source] of stages.entries()) {
    const stage = stageIndex + 1;
    const order = commandIndex * 5 + stage;
    const id = stage === 1 ? seed.id : `${seed.id}-${stage}`;
    let lesson = {
      id,
      order,
      command_order: commandIndex + 1,
      stage,
      stage_name: stageNames[stageIndex],
      difficulty: stage <= 2 ? 'foundation' : stage <= 4 ? 'intermediate' : 'advanced',
      section: `${String(Math.floor(commandIndex / 10) + 1).padStart(2, '0')}-${sections[Math.floor(commandIndex / 10)].title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`,
      command: seed.command,
      title: source.title,
      focus: source.focus ?? source.about,
      example: source.example,
      example_output: source.example_output ?? '',
      breakdown: buildBreakdown(source, seed.command),
      task: source.task,
      solution: source.solution,
      hints: buildHints(source, seed.command, 'powershell'),
      directories: source.directories ?? [],
      files: source.files ?? {},
      setup: source.setup ?? [],
      checks: source.checks,
      completion: source.completion ?? `You used ${seed.command} to complete “${source.title}” and verified the requested outcome.`,
    };
    lesson = enrichLesson(lesson, orderedCommands, 'powershell');
    if (lesson.mode === 'capstone') lesson.stage_name = 'Blind section capstone';
    else if (lesson.stage === 4 && lesson.stage_kind === 'applied') lesson.stage_name = 'Applied use';
    else if (lesson.stage === 5 && lesson.stage_kind === 'transfer') lesson.stage_name = 'Transfer challenge';
    lessons.push(lesson);
  }
}

const catalog = {
  catalog_version: 2,
  title: 'Hacker CLI Gym — PowerShell',
  track: 'powershell',
  platform: 'windows',
  shell: 'powershell',
  command_count: 100,
  stages_per_command: 5,
  exercise_count: 500,
  sections,
  lessons,
};

validateLessonMetadata(lessons, 500);
for (const item of lessons) {
  for (const field of ['title', 'focus', 'example', 'task', 'solution']) {
    if (/[\x00-\x1f]/.test(item[field] ?? '')) {
      throw new Error(`${item.id} has a control character in ${field}; check for an unescaped Windows path.`);
    }
  }
}

fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Generated ${lessons.length} PowerShell exercises in ${outputPath}`);
