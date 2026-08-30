import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadSkills, SKILLS_REGISTRY } from '../skills.js';

const root = mkdtempSync(path.join(tmpdir(), 'leow3bot-skills-'));

try {
  const goodDir = path.join(root, 'good-skill');
  const badDir = path.join(root, 'bad-skill');
  mkdirSync(goodDir);
  mkdirSync(badDir);

  writeFileSync(path.join(goodDir, 'SKILL.md'), [
    '---',
    'name: good-skill',
    'description: A valid skill',
    '---',
    '',
    'Follow the valid instructions.',
  ].join('\n'));

  writeFileSync(path.join(badDir, 'SKILL.md'), [
    '---',
    'name: bad-skill',
    'description: This breaks YAML: nested mapping',
    '---',
    '',
    'This skill must be skipped.',
  ].join('\n'));

  assert.doesNotThrow(
    () => loadSkills([root]),
    'one malformed SKILL.md must not abort loading all skills',
  );
  assert.equal(SKILLS_REGISTRY.has('good-skill'), true, 'valid skills should still load');
  assert.equal(SKILLS_REGISTRY.has('bad-skill'), false, 'malformed skills should be skipped');

  console.log('✓ skill loader isolates malformed SKILL.md files');
} finally {
  rmSync(root, { recursive: true, force: true });
}
