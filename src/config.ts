// 配置常量。用户可改的字段（apiBaseUrl/apiKey/model/maxTokens/contextWindow/temperature）
// 从同目录的 config.json 读取，其余为本项目内部常量。
// 配置方法：复制 config.example.json → config.json，改里面的值即可。

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

// 权限规则：pattern 默认按前缀匹配，mode:'regex' 时按正则；reason 为命中时给模型的解释
export interface PermissionRule {
  pattern: string;
  mode?: 'prefix' | 'regex';
  reason?: string;
}
export interface PermissionsConfig {
  deny?: PermissionRule[];
  confirm?: PermissionRule[];
}

interface UserConfig {
  apiBaseUrl?: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  contextWindow?: number;
  temperature?: number;
  // 权限管控：deny 命中直接拒绝；confirm 命中弹交互确认（~/.leow3bot/permissions.json 存记住的允许）
  permissions?: PermissionsConfig;
  // 自定义系统提示词（可选，覆盖内置默认——身份/语言/工具约定）
  systemPrompt?: string;
  // web 工具（智谱原生 web_search / reader）
  webSearchEngine?: string;
  webSearchContentSize?: string;
  webSearchCount?: number;
  webResultMaxChars?: number;
  webApiKey?: string;
  // thinking（深度思考）
  thinkingBudget?: number;
}

function loadConfig(): UserConfig {
  // 1. 用户级 ~/.leow3bot/config.json（标准位置，开发/安装都改这）
  //    注意：直接用 homedir() 拼，不能用 LEOW3BOT_HOME 常量（它在后面才定义，此处处于 TDZ）
  try {
    return JSON.parse(readFileSync(path.join(homedir(), '.leow3bot', 'config.json'), 'utf-8'));
  } catch {}
  // 2. 项目 config.json（fallback：兼容旧开发态/未迁移场景）
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return JSON.parse(readFileSync(path.join(here, '..', 'config.json'), 'utf-8'));
  } catch {}
  return {}; // 都不存在时用下面的默认值
}

const cfg = loadConfig();

// —— 用户可配置项（config.json 覆盖）——
export const API_BASE_URL = cfg.apiBaseUrl ?? 'https://open.bigmodel.cn/api/anthropic';
export const API_KEY = cfg.apiKey ?? '';
export const MODEL = cfg.model ?? 'glm-5.1';
export const MAX_TOKENS = cfg.maxTokens ?? 131072; // 智谱 Anthropic 端点 max_tokens 上限 131072,超出返回 400 [1210]
export const CONTEXT_WINDOW = cfg.contextWindow ?? 192000;
export const TEMPERATURE = cfg.temperature ?? 0.7;

// thinking（深度思考，默认常开）—— glm-5.x 经 Anthropic 兼容端点需显式传 thinking 参数才会发思考流
export const THINKING_BUDGET = cfg.thinkingBudget ?? 5000;

// 权限管控自定义规则（内置 deny 规则见 permissions.ts，不依赖此配置）
export const USER_PERMISSIONS: PermissionsConfig = cfg.permissions ?? {};

// —— web 工具配置（智谱原生 web_search / reader 端点，与 apiKey 同平台）——
export const WEB_SEARCH_ENGINE = cfg.webSearchEngine ?? 'search_std';
export const WEB_SEARCH_CONTENT_SIZE = cfg.webSearchContentSize ?? 'medium';
export const WEB_SEARCH_COUNT = cfg.webSearchCount ?? 10;
export const WEB_RESULT_MAX_CHARS = cfg.webResultMaxChars ?? 30000;
// 智谱 web 工具固定端点（与 API_BASE_URL 的 /api/anthropic 不耦合）
export const WEB_SEARCH_URL = 'https://open.bigmodel.cn/api/paas/v4/web_search';

export function getApiKey(): string {
  return API_KEY;
}
// 按 API_BASE_URL 推断平台显示名（banner 用），未知端点回退 hostname
export function getProviderLabel(): string {
  const host = new URL(API_BASE_URL).hostname;
  if (host.includes('bigmodel')) return '智谱 BigModel';
  if (host.includes('deepseek')) return 'DeepSeek';
  if (host.includes('anthropic')) return 'Anthropic';
  if (host.includes('moonshot')) return 'Moonshot';
  if (host.includes('qwen') || host.includes('aliyun')) return '通义千问';
  return host;
}
// web 工具 key：默认复用 apiKey（智谱同 key 零配置），可在 config.json 用 webApiKey 覆盖
export function getWebApiKey(): string {
  return cfg.webApiKey || API_KEY;
}

// —— 内部常量（一般不需改）——
export const TOP_P: number | null = null;
export const TOP_K: number | null = null;
export const MAX_CONCURRENT_TOOLS = 10;
export const MAX_TOOL_RESULT_CHARS = 16000;      // read/write/skill 等工具结果上限（截断保留首尾）

// bash 输出上限（对齐 Claude Code）：默认 30000 字符，可用环境变量
// BASH_MAX_OUTPUT_LENGTH 调整（上限 150000，与 CC 的 outputLimits 一致）。
// 超限输出只保留头部 + 行数提示，完整内容落盘供 read 工具取回。
function boundedIntFromEnv(name: string, def: number, upper: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(1, n), upper);
}
export const MAX_BASH_OUTPUT_CHARS = boundedIntFromEnv('BASH_MAX_OUTPUT_LENGTH', 30000, 150000);
export const MAX_TOOL_ROUNDS = 100;
export const API_TIMEOUT = 600; // 秒

export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
// 图片护栏（即看即释设计下分辨率/质量不再是长期成本，上限仅防病理巨图与过大请求体）
export const IMAGE_MAX_WIDTH = 4096;
export const IMAGE_MAX_HEIGHT = 4096;
export const IMAGE_TARGET_RAW_SIZE = 5_000_000; // payload 字节护栏（对齐 Anthropic 单图 5MB 上限；超限才温和降质，字节不占 token）
// 单轮 view 硬预算：即看即释的工作集以"批次有界"为前提（schema 软引导之外的执行侧约束）
export const MAX_VIEWS_PER_ROUND = 6;
// 批次像素预算：单请求所有图片的总像素上限（Qwen 28px patch → ≈15K 视觉 token，
// 实测该服务器安全线；3 张原图 ≈33K token 会挂起）。
// 批内按张数摊薄——单张独享全预算（原图直传），N 张各分 1/N（自动降采样）。
export const IMAGE_BATCH_PIXEL_BUDGET = 11_800_000;

// leow3bot 用户级 home：config / sessions / skills 都在这下面
export const LEOW3BOT_HOME = path.join(homedir(), '.leow3bot');

// skill 扫描目录（数组顺序=优先级，后者覆盖前者同名 skill）：
//   1) ~/.claude/skills      —— Claude 用户级标准（`npx skills add` 默认装这）
//   2) ~/.leow3bot/skills  —— leow3bot 自己的 home
//   3) ./.claude/skills      —— 项目级（覆盖用户级）
// 动态函数：--resume 恢复会话 chdir 后重算项目级目录（main.tsx / SessionPicker 调用）。
export function getSkillDirs(): string[] {
  return [
    path.join(homedir(), '.claude', 'skills'),
    path.join(LEOW3BOT_HOME, 'skills'),
    path.join(process.cwd(), '.claude', 'skills'),
  ];
}
// 基础系统提示词：身份 + 语言（中文思考）+ 风格，三句话。
// 工具行为约定不写在这——工具 schema 描述和运行时报错提示（截断恢复路径、
// 行号提示、守卫引导）在需要的瞬间送达，比开场白更有效。config.json 可覆盖。
const DEFAULT_SYSTEM_PROMPT =
  '你是 leow3bot，运行在用户本地终端的中文 AI 助手。' +
  '始终使用中文思考和回复（专有名词、命令、代码保留原文）。' +
  '回答简洁直接、结论先行。';

export const SYSTEM_PROMPT: string = cfg.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

// CC 风格符号 + 主色
export const SYM_USER = '❯';
export const SYM_TOOL = '⏺';
export const SYM_RESULT = '⎿';
export const SYM_THINK = '✻';
export const ACCENT = '#06B6D4';
