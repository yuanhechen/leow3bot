// Skill 加载器（移植 skills.py）。扫描 SKILL.md，frontmatter 解析 name/description。

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { LEOW3BOT_HOME } from './config.js';

export interface SkillInfo {
  name: string;
  description: string;
  content: string;
  path: string;
}

export const SKILLS_REGISTRY = new Map<string, SkillInfo>();

// skill 开关：黑名单（~/.leow3bot/skills.json 存 disabled 列表），默认全启用
const SKILLS_STATE_FILE = path.join(LEOW3BOT_HOME, 'skills.json');
let disabledSkills = new Set<string>();

function loadDisabled(): void {
  disabledSkills = new Set<string>();
  try {
    const data = JSON.parse(readFileSync(SKILLS_STATE_FILE, 'utf-8'));
    if (Array.isArray(data.disabled)) for (const n of data.disabled) disabledSkills.add(String(n));
  } catch { /* 首次运行/文件不存在 → 空（全启用） */ }
}

function saveDisabled(): void {
  try {
    writeFileSync(SKILLS_STATE_FILE, JSON.stringify({ disabled: [...disabledSkills] }, null, 2) + '\n', 'utf-8');
  } catch { /* noop */ }
}

export function loadSkills(dirs: string[]): void {
  SKILLS_REGISTRY.clear();
  loadDisabled();
  // 按顺序扫描，后扫的覆盖先扫的（项目级 > 用户级）
  for (const dir of dirs) loadSkillsFromDir(dir);
}

function loadSkillsFromDir(dir: string): void {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return;

  // 格式 2：dir/SKILL.md 单文件
  const directMd = path.join(dir, 'SKILL.md');
  if (existsSync(directMd) && statSync(directMd).isFile()) {
    loadSkillFile(directMd, path.basename(path.resolve(dir)));
  }

  // 格式 1：dir/<sub>/SKILL.md（社区标准：skills/<name>/SKILL.md）
  for (const entry of readdirSync(dir).sort()) {
    if (entry === 'SKILL.md') continue;
    const md = path.join(dir, entry, 'SKILL.md');
    if (existsSync(md) && statSync(md).isFile()) loadSkillFile(md, entry);
  }
}

function loadSkillFile(md: string, fallback: string): void {
  let raw: string;
  try { raw = readFileSync(md, 'utf-8'); } catch { return; }
  let parsed: ReturnType<typeof matter>;
  try {
    parsed = matter(raw); // gray-matter 解析 frontmatter（兼容社区 SKILL.md 全字段）
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    process.stderr.write(`⚠️ 跳过无效 skill ${md}: ${reason}\n`);
    return;
  }
  const { data, content } = parsed;
  const n = (data.name as string) || fallback;
  SKILLS_REGISTRY.set(n, {
    name: n,
    description: (data.description as string) || `Skill: ${n}`,
    content: content.trim(),
    path: md,
  });
}

export function getSkillListing(): string {
  const enabled = [...SKILLS_REGISTRY.values()].filter(s => !disabledSkills.has(s.name));
  if (!enabled.length) return '';
  const lines = ['可用 skills:'];
  for (const s of enabled) lines.push(`  - ${s.name}: ${s.description}`);
  return lines.join('\n');
}

export function getSkillPrompt(name: string, args = ''): string | null {
  if (disabledSkills.has(name)) return null; // 已禁用
  const s = SKILLS_REGISTRY.get(name);
  if (!s) return null;
  let p = s.content;
  if (args) p = p.replace(/\$ARGUMENTS/g, args);
  // skill 自身目录占位符 → 正文里的相对脚本路径可由此定位。
  // 两个名字都支持：${CLAUDE_SKILL_DIR} 兼容社区 skill（~/.claude/skills 生态），
  // ${LEOW3BOT_SKILL_DIR} 是本项目的命名。
  p = p.replace(/\$\{(CLAUDE_SKILL_DIR|LEOW3BOT_SKILL_DIR)\}/g, path.dirname(s.path));
  return p;
}

// —— skill 开关（enable/disable + 状态查询，/skills 命令用）——
export function enableSkill(name: string): boolean {
  if (!disabledSkills.has(name)) return false;
  disabledSkills.delete(name);
  saveDisabled();
  return true;
}

export function disableSkill(name: string): boolean {
  if (!SKILLS_REGISTRY.has(name) || disabledSkills.has(name)) return false;
  disabledSkills.add(name);
  saveDisabled();
  return true;
}

export interface SkillWithStatus { name: string; description: string; disabled: boolean }
export function listSkillsWithStatus(): SkillWithStatus[] {
  return [...SKILLS_REGISTRY.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(s => ({ name: s.name, description: s.description, disabled: disabledSkills.has(s.name) }));
}
