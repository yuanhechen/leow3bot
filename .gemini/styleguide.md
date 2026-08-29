# Leow3Bot 代码评审规范（Gemini Code Assist styleguide）

本文件是 Gemini Code Assist 在本仓库评审 PR 时的附加标准。违反下列规则的评论请正常提出；
符合下列规则的写法**不是**问题，不要建议改成其他风格。

## 语言与沟通

- 面向用户的文案（UI 文本、日志、错误提示）与代码注释一律使用**简体中文**。
- 标识符（变量/函数/类型名）用英文，不拼音混排。

## 架构分层（重点审查）

依赖方向必须单向，不允许反向或跨层直连：

- `src/components/`：ink/React 组件，只做渲染与交互，订阅 store；**不得**直接 import
  LLM SDK、executor、session 等领域模块。
- `src/store.ts`：会话状态唯一来源，组件通过 commit 事件驱动。
- `src/lib/`：纯函数（markdown、格式化、持久化），不得有副作用或 UI 依赖。
- 领域模块（`agent.ts` / `llm.ts` / `session.ts` / `executor.ts` / `tools.ts` /
  `permissions.ts` 等）：业务逻辑放这里，不渲染 UI。
- 出现"组件里直接调 Anthropic SDK / 组件里拼 SQL 式业务逻辑"这类跨层调用，视为高严重度问题。

## TypeScript 与模块约定

- 纯 ESM 工程：相对导入**必须带 `.js` 后缀**（如 `import { commit } from '../store.js'`），
  即使源文件是 `.ts/.tsx`。
- 不使用 `any`；必要时用 `unknown` + 收窄。禁用 `@ts-ignore`，用 `@ts-expect-error` 并写明原因。
- 可空值显式处理，优先 `??` / `?.`，不写裸 `!` 非空断言（测试脚本除外）。
- Node ≥ 20 内置 API 可直接用，不引入 polyfill。

## 安全（最高严重度）

- 任何工具执行、文件读写、shell 命令**必须**经过 `src/permissions.ts` 的权限检查，
  新增旁路视为 CRITICAL。
- 不引入 `eval`、动态拼 shell 字符串给子进程（用 execFile / 数组参数）。
- 密钥/token 只从配置或环境变量读取，不得硬编码、不得写进日志。

## 测试约定

- 本仓库不用 vitest/jest，测试是 `src/scripts/test-*.ts(x)` 自定义脚本，
  入口统一在 package.json 的 `test` / `test:*`。
- 修改以下模块时必须同步更新对应测试，否则视为不完整：
  - markdown 渲染 → `test-markdown.tsx`
  - store / 状态流转 → `test-store.ts`
  - 权限系统 → `test-permissions.ts`
  - App / 组件渲染 → `test-app.tsx`
- `npm test` 必须全绿；修复行为但未更新断言（或反之）应指出。

## 依赖与产物

- 新增运行时依赖需在 PR 描述中说明理由；CLI 对安装体积敏感，能用 Node 内置或
  既有依赖解决的不要引新包（本仓有 sharp/ink 等，评审时注意是否有轻量替代）。
- `dist/`、个人 `config.json`、`docs/` 站点产物不得混入功能 PR。
- 改 `src/config.ts` 的配置字段时，必须同步 `config.example.json` 与 README。
