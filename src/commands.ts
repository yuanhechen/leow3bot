// 斜杠命令系统（移植 commands.py）+ welcome 横幅/logo。

import { homedir } from 'node:os';
import { MODEL, getProviderLabel, applyRuntimeConfig } from './config.js';
import { TOOLS_SCHEMAS } from './tools.js';
import { getSystem } from './agent.js';
import { getState, setPhase, setMeta } from './store.js';
import { countTokens, getClient } from './llm.js';
import { saveSession, loadSession, listSessions, PROJECT_ROOT } from './session.js';
import { compactMediaMessages, compactOldToolResults } from './compaction.js';
import type { CommittedItem, ContentBlock, MessageParam } from './types.js';

// logo：「眼睛」图案（AI 凝视/观察），实心眼眶 + 中心 ◉ 瞳孔
export const LOGO = [
  '█████',
  '█ ◉ █',
  '█████',
];

export const COMMANDS = [
  'help', 'clear', 'compact', 'tools', 'skills', 'model', 'subagent', 'history',
  'perf', 'verbose', 'context', 'status', 'save', 'load', 'sessions', 'q',
] as const;

export type CommandName = typeof COMMANDS[number];

export const COMMAND_DESCRIPTIONS: Record<CommandName, string> = {
  help: '显示这份帮助',
  clear: '清空当前对话',
  compact: '压缩历史内容，释放上下文',
  tools: '查看模型可以调用的工具',
  skills: '启用或禁用 skills',
  model: '选择或切换模型',
  subagent: '选择子代理模型',
  history: '查看当前对话的历史摘要',
  perf: '开关性能状态栏',
  verbose: '展开或折叠模型思考过程',
  context: '开关上下文状态栏并统计 token',
  status: '查看状态栏使用提示',
  save: '保存当前会话快照',
  load: '加载已保存的会话',
  sessions: '列出已保存的会话',
  q: '退出 leow3bot',
};

const HELP_TEXT = [
  '可用命令',
  '',
  '对话与上下文',
  '  /clear                 清空当前对话',
  '  /history               查看当前对话的历史摘要',
  '  /compact               压缩图片和旧工具结果，释放上下文',
  '',
  '模型与能力',
  '  /model [模型名]        选择模型；带名称可直接切换',
  '  /subagent              选择子代理模型；首项「跟随主模型」恢复继承',
  '  /tools                 查看模型可以调用的工具',
  '  /skills                启用或禁用 skills',
  '',
  '会话管理',
  '  /save [名称]           保存当前会话快照',
  '  /load [文件名或序号]   加载已保存的会话',
  '  /sessions              列出已保存的会话',
  '',
  '显示与诊断',
  '  /context               开关上下文状态栏，并显示 token 明细',
  '  /perf                  开关性能状态栏',
  '  /verbose               展开或折叠模型思考过程',
  '  /status                查看状态栏使用提示',
  '',
  '其他',
  '  /help                  显示这份帮助',
  '  /q                     退出 leow3bot',
].join('\n');

export function parseCommand(text: string): { cmd: string; args: string[] } | null {
  const t = text.trim();
  if (!t.startsWith('/')) return null;
  const parts = t.slice(1).split(/\s+/);
  if (!parts[0]) return null;
  return { cmd: parts[0].toLowerCase(), args: parts.slice(1) };
}

export interface CmdCtx {
  showCtx: boolean;
  showPerf: boolean;
  showThinking: boolean;
  toggleCtx: () => void;
  togglePerf: () => void;
  toggleThinking: () => void;
  clearMessages: () => void;
  getMessages: () => MessageParam[];
  setMessages: (m: MessageParam[]) => void;
}

export interface CmdResult {
  output?: string;
  tone?: 'ok' | 'err' | 'warn' | 'muted';
  exit?: boolean;
}

function textOf(content: unknown): string {
  if (Array.isArray(content)) {
    return (content as ContentBlock[]).filter(b => b.type === 'text').map(b => (b as { text: string }).text).join(' ');
  }
  return String(content ?? '');
}

export async function handleCommand(cmd: string, args: string[], ctx: CmdCtx): Promise<CmdResult | undefined> {
  switch (cmd) {
    case 'q':
    case 'quit':
    case 'exit':
      return { exit: true };
    case 'help':
      return { output: HELP_TEXT, tone: 'muted' };
    case 'context': {
      ctx.toggleCtx();
      const sys = getSystem();
      const msgs = ctx.getMessages();
      // countTokens 精确分项（模型 tokenizer）：base=system, +tools, +messages 三次差值
      const base = await countTokens(sys, [], []);
      const withTools = await countTokens(sys, [], TOOLS_SCHEMAS);
      const total = await countTokens(sys, msgs, TOOLS_SCHEMAS);
      if (base == null || withTools == null || total == null) {
        return { output: 'countTokens 不可用（当前端点可能不支持 /v1/messages/count_tokens beta）', tone: 'err' };
      }
      const lines = [
        `context 状态栏: ${!ctx.showCtx ? '开启' : '关闭'}`,
        '',
        '上下文占用明细（countTokens 精确）:',
        `  system prompt  ${base}`,
        `  tools schema   ${withTools - base}  (${TOOLS_SCHEMAS.length} tools)`,
        `  对话历史        ${total - withTools}  (${msgs.length} 条)`,
        `  合计            ${total}`,
      ];
      const api = getState().usage?.input_tokens;
      if (api != null) lines.push(`  API 上报        ${api}`);
      return { output: lines.join('\n'), tone: 'muted' };
    }
    case 'perf':
      ctx.togglePerf();
      return { output: 'perf 状态栏: ' + (!ctx.showPerf ? '开启' : '关闭'), tone: 'ok' };
    case 'verbose':
      ctx.toggleThinking();
      return { output: '思考过程: ' + (!ctx.showThinking ? '展开' : '折叠'), tone: 'ok' };
    case 'clear':
      ctx.clearMessages();
      ctx.setMessages([]);
      return { output: '✓ 已清空对话', tone: 'ok' };
    case 'model': {
      const m = args[0];
      if (!m) {
        setPhase('model_picker'); // 交互式选择：↑↓ + Enter（列表/切换/校验都在 picker 内完成）
        return;
      }
      // 带参快捷路径：切换前查端点校验（code-review F13——手滑拼错的模型名一旦
      // 持久化，后续每轮请求都失败且重启后仍带病）；网络失败宽松放行不挡切换
      const ids = await (async (): Promise<string[] | null> => {
        try {
          const page = await getClient().models.list();
          const raw = (Array.isArray(page) ? page : ((page as { data?: unknown[] }).data ?? [])) as Array<{ id?: unknown }>;
          const list = raw.map(x => String(x?.id ?? '')).filter(Boolean);
          return list.length ? list : null;
        } catch { return null; }
      })();
      if (ids && !ids.includes(m)) {
        return { output: `✗ 未知模型 ${m}。可用: ${ids.join(' / ')}（或直接 /model 进入选择器）`, tone: 'warn' };
      }
      const persisted = applyRuntimeConfig({ model: m }); // 运行时即时生效（live binding）+ 写回 config.json
      const prev = getState().meta; // 状态栏立即更新（其余 meta 不变）
      setMeta({ model: m, nTools: prev?.nTools ?? 0, nSkills: prev?.nSkills ?? 0, cwd: prev?.cwd ?? process.cwd() });
      return persisted
        ? { output: `✓ 模型已切换: ${m}${ids ? '' : '（⚠️ 无法校验模型名：端点查询失败）'}（已写入 ~/.leow3bot/config.json，下次启动保持）`, tone: 'ok' }
        : { output: `✓ 模型已切换: ${m}（⚠️ 写入配置失败，仅本次会话生效）`, tone: 'ok' };
    }
    case 'subagent':
      // 子代理模型选择器（默认继承主模型；agent 定义自带 model 的仍优先）
      setPhase('subagent_picker');
      return;
    case 'tools':
      return { output: '可用工具: ' + TOOLS_SCHEMAS.map(s => s.name).join(' '), tone: 'muted' };
    case 'skills':
      // 进入交互式 skill picker（↑↓ 选择 · Tab 切换 · Enter 完成）
      setPhase('skills_picker');
      return;
    case 'history': {
      const ms = ctx.getMessages();
      if (!ms.length) return { output: '对话历史为空', tone: 'muted' };
      const lines = [`对话历史 (${ms.length} 条):`];
      ms.forEach((m, i) => {
        let text = textOf(m.content).replace(/\n/g, ' ');
        if (text.length > 60) text = text.slice(0, 57) + '...';
        lines.push(`  [${i + 1}] ${m.role}: ${text}`);
      });
      return { output: lines.join('\n'), tone: 'muted' };
    }
    case 'compact': {
      const ms = ctx.getMessages();
      const before = ms.length;
      const c1 = compactMediaMessages(ms);
      const c2 = compactOldToolResults(ms);
      return { output: `✓ 压缩完成: ${c1} 条媒体 + ${c2} 条旧工具结果（${before} → ${ms.length} 条）`, tone: 'ok' };
    }
    case 'save': {
      const fp = saveSession(ctx.getMessages(), args.join(' ') || undefined);
      return fp ? { output: '✓ 会话已保存: ' + fp, tone: 'ok' } : { output: '✗ 保存失败（无对话？）', tone: 'err' };
    }
    case 'sessions': {
      const list = listSessions(20);
      if (!list.length) return { output: '没有已保存的会话', tone: 'muted' };
      const shortPr = (p: string) => (p && homedir() && p.startsWith(homedir()) ? '~' + p.slice(homedir().length) : p || '?');
      const lines = list.map((s, i) => {
        const tag = s.is_current ? ' (当前自动保存)' : '';
        const proj = s.is_current_project ? '' : ` [${shortPr(s.projectRoot)}]`;
        return `  ${i + 1}. ${s.filename}${tag}${proj} — ${s.name} (${s.message_count} 条)`;
      });
      return { output: `已保存会话（当前项目 ${shortPr(PROJECT_ROOT)}）:\n` + lines.join('\n'), tone: 'muted' };
    }
    case 'load': {
      if (!args.length) {
        const list = listSessions(10);
        if (!list.length) return { output: '没有已保存的会话', tone: 'muted' };
        const lines = list.map((s, i) => `  ${i + 1}. ${s.filename} — ${s.name}`);
        return { output: '最近会话:\n' + lines.join('\n') + '\n用 /load <文件名或序号> 加载', tone: 'muted' };
      }
      let target = args[0];
      if (/^\d+$/.test(target)) {
        const list = listSessions(10);
        const idx = parseInt(target, 10) - 1;
        if (!list[idx]) return { output: '✗ 无效序号', tone: 'err' };
        target = list[idx].filename;
      }
      const loaded = loadSession(target);
      if (loaded) { ctx.setMessages(loaded); return { output: `✓ 已加载会话，共 ${loaded.length} 条消息`, tone: 'ok' }; }
      return { output: '✗ 找不到会话: ' + target, tone: 'err' };
    }
    case 'status':
      return { output: '用 /context 和 /perf 开关状态栏', tone: 'muted' };
    default:
      return { output: `未知命令: /${cmd}（输入 /help 查看）`, tone: 'err' };
  }
}

// welcome：logo + 右侧 3 行信息（名称版本 / 模型·平台 / 目录），复刻 CC 风格。
// 版本号单源：读 package.json（resolveJsonModule），发布改版本不再忘改横幅。
import pkg from '../package.json' with { type: 'json' };
export function getWelcomeItems(): CommittedItem[] {
  const home = homedir();
  const cwd = process.cwd();
  const cwdShort = home && cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd;
  return [{
    kind: 'logo',
    logo: LOGO,
    name: 'Leow3Bot',
    info: [
      `Leow3Bot v${(pkg as { version: string }).version}`,
      `${MODEL} · ${getProviderLabel()}`,
      cwdShort,
    ],
  }];
}
