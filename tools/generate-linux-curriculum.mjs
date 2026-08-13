#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import navigation from './linux-progressions/01-navigation.mjs';
import files from './linux-progressions/02-files.mjs';
import reading from './linux-progressions/03-reading.mjs';
import text from './linux-progressions/04-text.mjs';
import composition from './linux-progressions/05-composition.mjs';
import identity from './linux-progressions/06-identity.mjs';
import processes from './linux-progressions/07-processes.mjs';
import system from './linux-progressions/08-system.mjs';
import archives from './linux-progressions/09-archives.mjs';
import networking from './linux-progressions/10-networking.mjs';
import {
  buildBreakdown,
  buildHints,
  enrichLesson,
  validateLessonMetadata,
} from './curriculum-metadata.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const sourcePath = resolve(root, 'curriculum/linux.base.json');
const outputPath = resolve(root, 'curriculum/linux.json');
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const orderedCommands = source.lessons.map(lesson => lesson.command);
const progressions = Object.assign(
  {}, navigation, files, reading, text, composition,
  identity, processes, system, archives, networking,
);

const stageNames = ['Basics', 'Useful options', 'Focused results', 'Composition', 'Workflow'];
const difficulties = ['foundation', 'foundation', 'intermediate', 'intermediate', 'advanced'];
const sectionTitles = [
  'Navigation and help',
  'Files and directories',
  'Reading content',
  'Text processing',
  'Composition and comparison',
  'Identity and permissions',
  'Processes and execution',
  'System and storage',
  'Archives, data, and automation',
  'Networking and services',
];
const sections = sectionTitles.map((title, index) => ({
  id: String(index + 1).padStart(2, '0'),
  title,
  start: index * 50 + 1,
  end: index * 50 + 50,
}));

function slugSection(commandIndex) {
  const index = Math.floor((commandIndex - 1) / 10);
  return `${String(index + 1).padStart(2, '0')}-${sectionTitles[index].toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`;
}

function expandedLesson(base, commandIndex, stage, spec) {
  let lesson = stage === 1 ? structuredClone(base) : {
    id: `${base.id}-${stage}`,
    section: base.section,
    command: base.command,
    title: spec.title,
    about: `${base.about} ${spec.focus}`,
    example: spec.example,
    example_output: spec.example_output ?? '',
    breakdown: spec.breakdown ?? [],
    task: spec.task,
    solution: spec.solution,
    hints: spec.hints ?? [],
    directories: spec.directories,
    files: spec.files ?? {},
    symlinks: spec.symlinks,
    setup: spec.setup,
    checks: spec.checks,
    adversarial_commands: spec.adversarial_commands,
    completion: spec.completion ?? `${spec.focus} You can now use this behavior as part of a larger command-line workflow.`,
  };

  lesson.order = (commandIndex - 1) * 5 + stage;
  lesson.command_order = commandIndex;
  lesson.stage = stage;
  lesson.stage_name = stageNames[stage - 1];
  lesson.difficulty = difficulties[stage - 1];
  lesson.section = slugSection(commandIndex);
  lesson.focus = lesson.focus ?? lesson.about;
  lesson.breakdown = buildBreakdown(lesson, lesson.command);
  lesson.hints = buildHints(lesson, lesson.command, 'bash');
  lesson = enrichLesson(lesson, orderedCommands, 'bash');
  if (lesson.mode === 'capstone') lesson.stage_name = 'Blind section capstone';
  else if (lesson.stage === 4 && lesson.stage_kind === 'applied') lesson.stage_name = 'Applied use';
  else if (lesson.stage === 5 && lesson.stage_kind === 'transfer') lesson.stage_name = 'Transfer challenge';
  if (!lesson.directories?.length) delete lesson.directories;
  if (!lesson.symlinks || Object.keys(lesson.symlinks).length === 0) delete lesson.symlinks;
  if (!lesson.setup?.length) delete lesson.setup;
  return lesson;
}

const lessons = [];
for (const base of source.lessons) {
  const definition = progressions[base.command];
  if (!definition || definition.length !== 4) {
    throw new Error(`${base.command} needs exactly four progression exercises`);
  }
  lessons.push(expandedLesson(base, base.order, 1, null));
  definition.forEach((spec, index) => {
    const stage = index + 2;
    for (const required of ['title', 'focus', 'example', 'task', 'solution', 'checks']) {
      if (!spec[required]) throw new Error(`${base.command} stage ${stage} is missing ${required}`);
    }
    lessons.push(expandedLesson(base, base.order, stage, spec));
  });
}

validateLessonMetadata(lessons, 500);

const catalog = {
  catalog_version: 2,
  track: 'linux',
  platform: 'linux',
  shell: 'bash',
  command_count: 100,
  stages_per_command: 5,
  exercise_count: 500,
  sections,
  lessons,
};

await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Generated ${lessons.length} Linux exercises in ${outputPath}`);
