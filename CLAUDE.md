# CLAUDE.md

This file provides guidance when working with code in this repository.

## Project Overview

leow3bot：CLI AI agent，**TypeScript + ink**（对标 Claude Code 的终端渲染）。连接智谱 BigModel 的 Anthropic 兼容端点（glm-5.x），支持工具调用、流式输出、skill、会话存储、剪贴板图片粘贴、联网搜索/阅读。中文 UI / 中文 prompt。

**为什么 ink**：为同时实现「流式逐字 + 底部状态栏常驻 + 鼠标滚轮翻原生 scrollback 历史」三者兼得 —— 这正是 Claude Code 用 ink 渲染做到的。靠 ink 的 `<Static>`（已完成消息进原生 scrollback）+ 动态区每帧 diff（当前流式 + 状态栏 + 输入）。

## 安装与运行

### 全局安装（用户）
```bash
npm install -g @yuanhechen/leow3bot
leow3bot            # 任意目录启动
```
配置：复制 `config.example.json` → `~/.leow3bot/config.json`，填 `apiKey`（智谱 BigModel key）。

### 开发态
```bash
npm install
npm start             # = tsx src/main.tsx（直接跑源码，免 build）
npm run build         # tsup 打包 → dist/main.mjs
npm install -g .      # 本地全局安装测试
```
`q` 退出，或 Ctrl-C。其它：`npm run probe`（验证端点流式兼容）、`npm run typecheck`（tsc --noEmit）。

硬依赖：`ink` / `react` / `@anthropic-ai/sdk` / `sharp`（图片压缩）/ `ink-text-input` / `ink-spinner` / `gray-matter`（skill frontmatter）/ `turndown`（web_fetch HTML→markdown）/ `tsup`（打包）。运行时开发用 `tsx`，web 工具用 Node 内置 fetch（零依赖）。见 `package.json`。

## 配置（config.json）

开发态读项目根 `config.json`；全局安装态读 `~/.leow3bot/config.json`（`config.ts` 的 `loadConfig` 按此顺序 fallback）。字段见 `config.example.json`：

- `apiBaseUrl`（默认 `https://open.bigmodel.cn/api/anthropic`）
- `apiKey`（智谱 BigModel key，必须）
- `model`（默认 `glm-5.1`）
- `maxTokens` / `contextWindow` / `temperature`（数值以 `config.example.json` 为准；注意智谱端点 max_tokens 上限 131072，超出返回 400 [1210]）
- web 工具：`webSearchEngine`（默认 `search_std`）/ `webSearchContentSize`（`medium`）/ `webSearchCount`（10）/ `webResultMaxChars`（30000）/ `webApiKey`（可选，默认复用 `apiKey`）
- 权限管控：`permissions` = `{ deny: [{pattern, mode?, reason?}], confirm: [...] }`（`mode` 默认前缀匹配，`'regex'` 为正则）。**内置 deny 黑名单**（`rm -rf /`、`mkfs`、dd 写块设备、fork bomb、关机重启等）见 `src/permissions.ts`，命中直接拒绝不弹框；`confirm` 命中弹交互确认（`y`=本次允许 / `a`=允许并记住 / `n`=拒绝）。「记住的允许」持久化在 `~/.leow3bot/permissions.json`（想撤销某条直接删对应行）；判定顺序：内置 deny → 自定义 deny → 记住的允许 → 自定义 confirm → allow

## Architecture（src/）

### 核心模块
- **config.ts** — 配置常量 + `loadConfig`（项目 config.json → `~/.leow3bot/config.json`）+ `getApiKey()`/`getWebApiKey()` + `LEOW3BOT_HOME` + `SKILL_DIRS` + 符号/主色 `#D97757`。
- **types.ts** — Anthropic messages 类型 + `StreamEvent`（5 事件）+ `CommittedItem`（进 `<Static>` 的视图模型）。
- **store.ts** — `createStore`（CC 风格）+ `useSyncExternalStore`。**核心契约**：`committed` 只增（喂 `<Static>`）；`streamingText`/`phase` 等动态区字段每帧整体替换（ink 行级 diff）。
- **llm.ts** — `callLLMStream` async generator。`@anthropic-ai/sdk` 配 Anthropic 兼容端点（`baseURL` + `authToken` + `signal`）。自己累积 `content_blocks`；yield 5 事件 + timing。
- **tools.ts** — 9 工具（bash/read/view/write/edit/skill/ask/web_search/web_fetch）+ `compressImage`（sharp）+ `TOOLS_SCHEMAS`。`read` 纯文本（offset/limit 分页）、`view` 纯图片（压缩后视觉输入，职责分离对齐 Codex view_image；图片生命周期管理锚定本工具）；`ask` 异步化（store `askResolver`）。
- **websearch.ts** — `searchWeb`（智谱 `/paas/v4/web_search`，复用 apiKey）+ `readUrl`（纯客户端 fetch + turndown HTML→MD + 重定向护栏，零平台依赖）。
- **executor.ts** — `partitionToolCalls`（连续 safe 合并发批，unsafe 串行）+ `executeBatch` + `buildToolResultBlock`（按 type 分发：bash/image/error/text/web_search/web_fetch）。
- **agent.ts** — `handleSubmit`（命令/图片/对话分发）+ `runTurn`（多轮工具循环，`MAX_TOOL_ROUNDS`，ESC 中断保留 partial）+ 轮入口上下文流水线（见 Key 设计）+ 空响应三件套（检测/退避重试/降级重试）。
- **commands.ts** — 15 斜杠命令 + `parseCommand`/`handleCommand` + welcome logo。
- **skills.ts** — `loadSkills`（扫 `SKILL_DIRS`，gray-matter 解析 frontmatter）+ `getSkillPrompt`（`$ARGUMENTS` 替换）+ `getSkillListing`（注入 system）。
- **session.ts** — `~/.leow3bot/sessions/`；autosave/save/load/list + compressContent（持久化去 base64）；resume 三件套（`resumeSession`/`rebuildCommitted`/`activateResume`，恢复时自动 chdir 到会话项目）。
- **title.ts** — 会话主题后台生成（轻量 LLM 调用 + 节流，写回会话 name）。
- **lib/persist.ts** — 大体积工具输出落盘（`/tmp/leow3bot-{uid}/`，bash/web_fetch 共用，24h 清理）。
- **compaction.ts** — `compactMediaMessages`（粘贴图摘要）/ `compactOldToolResults`（旧工具结果截断）/ `evictPreviousTurnImages`（轮入口图片驱逐）/ `evictOldImages`（故障降级驱逐，保最近 3 条含图消息）。
- **clipboard.ts** — `getClipboardImage`（WSL2 powershell / xclip / wl-paste / macOS osascript / Windows powershell）。

### UI 组件（components/）
- **App.tsx** — `<Static items={committed}>`（已完成进 scrollback）+ 动态区（Spinner/流式/状态栏/Input）+ `useInput` 全局 ESC 中断。
- **Input.tsx** — `ink-text-input` + Tab 命令补全 + Ctrl-V 粘贴剪贴板图片 + ask resolve。
- **MessageList.tsx** — `CommittedItem` 渲染（user `❯` / assistant text / tool `⏺`+`⎿` / system / logo）。
- **StatusBar.tsx** — 底部常驻 context/perf 状态栏。
- **lib/markdown.tsx** — 行内 + 整行 markdown → ink 渲染。
- **lib/format.ts** — fmtSize/fmtDur/gradientHex。

## Key 设计

- **上下文管理——载体决定去留**：每类信息按其载体成本与可再生性决定生命周期（实测依据：thinking 占非图片内容 77%、图片 3.6K token/张且每轮重发、原图在磁盘可重 view）。
  - **轮入口流水线**（每条新消息时，顺序敏感）：`stripHistoricalThinking`（文本轮 thinking 剥离；**图片轮保留**——判定用"结构证据"：相邻 user 消息含 image 块或驱逐标记，覆盖 view/read 两种工具名且跨轮持久）→ `repairInterruptedToolCalls`（孤儿 tool_use 修复合成 result）→ `evictPreviousTurnImages`（历史图片→路径占位）。
  - **图片即看即释**：轮循环每轮 `evictOldImages(messages, 1)`——图片被消费后至下一条图片消息或回合出口即换占位（观察进 thinking）。任意请求时刻含图消息 ≤1 条，这是**高保真看图**的前提：护栏 4096px/5MB（对齐 Anthropic 单图上限），普通图按真实格式原样直传零重编码（不安全格式如 tiff 强制归一为 jpeg；bmp 本构建 sharp 不支持解码、view 直接报错），透明图优先 PNG，降质阶梯仅 q90→q80 温和档 + 循环减半（病理巨图）；单轮 view 硬预算 `MAX_VIEWS_PER_ROUND=6`（超出延迟到下轮）；view 描述中性（Codex 原文"View a local image file when visual inspection is needed"）。
  - **批次像素预算摊薄**：`applyBatchImageBudget`——轮结果组装前，本批 N 张图共享 `IMAGE_BATCH_PIXEL_BUDGET`（11.8M 像素 ≈15K 视觉 token，实测该 vLLM 服务器安全线；3 张原图 ≈33K token 必挂起）。单张独享全预算（原图直传），N 张各分 1/N（Lanczos + q90 降采样，size 标注"批次摊薄 W×H → w×h"）。图片 tool_result 用**文件名双侧夹注**（`<img name="x.jpg">` 像素 `</img name="x.jpg">`）强化像素↔文件名绑定，防批量看图的"内容真、归属错"。
  - **空响应三件套 + 挂起看门狗**：流结束但零内容块 → retryable → 退避重试 ×2（1.5s/3s）→ 仍失败降级（`evictOldImages(messages, 0)` 连当前批也释放换会话存活）；**服务器挂起**（零事件不返回，会话尸检确认的真实卡死原因）→ `streamWithWatchdog` 60s 无流事件即抛 retryable（`LEOW3BOT_HANG_TIMEOUT_MS` 可调，按事件活跃度判活不误杀慢生成）汇入同一条重试链。
  - **工具入口约束**：bash 30K 头部截断+落盘可读回（`BASH_MAX_OUTPUT_LENGTH` 可调）；read 分页（offset/limit，行号+14K 页预算）。核心原则：**工具结果带"再生配方"**（路径/命令/行号），截断只是展示窗口。
- **流式 → 状态链路**：SDK `content_block_delta` → `appendText(delta)`（动态区 `streamingText` 累加）→ `done`/`tool_call` 时快照 `commit` 进 `<Static>` + `resetStream()`。
- **`<Static>` 只增**：已 commit 的项永不修改（流式文本 done 时才 commit 定型）。
- **skill progressive disclosure**：`getSkillListing` 注入 system（name+description 摘要），模型按需调 `skill(name,args)` 拉完整 body。
- **web 工具分工**：`web_search` 依赖智谱搜索 API（合理——搜索本质是搜索引擎能力）；`web_fetch` 纯客户端抓取（不绑平台，返回原始 markdown 全文，加工交给模型）。
- **ESM + bundle**：`"type":"module"`，import 带 `.js` 后缀；开发用 `tsx` 直接跑 `.tsx`，发布用 `tsup` bundle 成 `dist/main.mjs`（external 化 sharp 等 native 依赖）。

## Tests / 验证脚本
- `src/scripts/probe.ts` — 验证端点流式兼容（配好 config.json 后 `npm run probe`，看 text 事件流 + done usage/timing）。
- `src/scripts/test-markdown.tsx` — markdown 渲染单测（`npm run test:md`）。
- `src/scripts/test-app.tsx` — App 集成渲染测试（`npm run test:app`）。
- `src/scripts/test-store.ts` — store 单测（`npm run test:store`）。
