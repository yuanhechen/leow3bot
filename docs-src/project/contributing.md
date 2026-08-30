# 贡献指南

## 合并门禁

改动一律走 PR：

1. **CI 必须全绿**——`typecheck + test + build`，Node 20/22 矩阵
2. **Gemini Code Assist 自动初审**——按 [`.gemini/styleguide.md`](https://github.com/yuanhechen/leow3bot/blob/master/.gemini/styleguide.md) 评审；机器评论只做初筛，架构与产品决策仍由人把关
3. 分支必须与 master 同步后才能合并

## 动代码前

先读 [AGENTS.md](https://github.com/yuanhechen/leow3bot/blob/master/AGENTS.md)：

- 架构分层地图（components → store → 领域模块，依赖单向）
- 硬性约定（ESM 导入带 `.js` 后缀、禁 `any`、权限系统禁止旁路、改哪层补哪层测试）
- 提交纪律（Conventional Commits，一个 PR 一个主题）

## 本地验证

```bash
npm install
npm test         # 全量门禁
npm run docs:build   # 文档站构建（docs-src → docs/docs）
```

## 文档同步

改动涉及使用方式（命令、配置、skill）时，同步更新 `docs-src/` 下对应页面并重新构建。
