# AGENTS.md — 给 AI 编码 Agent 的仓库指南

给任何工具（Claude Code / Codex / Cursor / Gemini CLI 等）的 Agent 贡献者：动手前先读完本文件。
人类贡献者同样适用。

## 常用命令

```bash
npm install        # 安装依赖（Node ≥ 20）
npm test           # 全量门禁 = tsc --noEmit + 四组测试（见下）
npm run typecheck  # 仅类型检查
npm run build      # tsup 构建（发布前置）
npm start          # 本地跑 TUI
```

测试不是 vitest/jest，是自定义脚本，分组入口在 package.json：

| 脚本 | 覆盖 |
|---|---|
| `test:md` | markdown → ink 渲染（`src/lib/markdown.tsx`） |
| `test:store` | 状态流转（`src/store.ts`） |
| `test:perm` | 权限系统（`src/permissions.ts`） |
| `test:app` | App 集成渲染 + 流式增量回归 |

**改了哪层就补哪层的测试，`npm test` 必须全绿再提交 PR。**

## 架构地图（依赖只能自上而下）

```
main.tsx ─ App(components/) ─ store.ts（状态唯一来源）
                │                    │
                └── lib/（纯函数）    ├── agent.ts（会话循环）
                                     ├── llm.ts（Anthropic 兼容 SDK，GLM 端点）
                                     ├── tools.ts / executor.ts（工具执行）
                                     ├── permissions.ts（执行前权限门，禁止旁路）
                                     └── session.ts / compaction.ts / skills.ts …
```

- components 只渲染 + 订阅 store，不直接调 SDK / executor。
- 领域模块不 import 组件。

## 硬性约定

- 纯 ESM：相对导入必须带 `.js` 后缀（源码是 `.ts/.tsx` 也一样）。
- 用户可见文案与注释用简体中文；标识符用英文。
- 禁 `any` / `@ts-ignore`（用 `unknown` + `@ts-expect-error` 带原因）。
- 新增运行时依赖前先想能不能用 Node 内置或既有依赖替代；PR 里说明理由。
- 配置字段改动需同步 `config.example.json` 与 README；不得提交个人 `config.json`、`dist/`。

## CI 与自动评审

- PR 会跑 `ci.yml`（typecheck + 全量测试 + 构建，Node 20/22 矩阵），红了先修再请求 review。
- Gemini Code Assist 会按 `.gemini/styleguide.md` 自动初审；机器评论只是初筛，
  架构与产品决策仍由人把关。

## 提交纪律

- Conventional Commits（`feat:` / `fix:` / `chore:` / `docs:` …），一行说清一件事。
- 一个 PR 一个主题；无关文件不混入。
