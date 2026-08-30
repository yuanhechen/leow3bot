# leow3bot

[![CI](https://github.com/yuanhechen/leow3bot/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/yuanhechen/leow3bot/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

[![leow3bot.com — 官网首屏](docs/assets/site-hero.png)](https://leow3bot.com)

> **[官网与场景演示 → leow3bot.com](https://leow3bot.com)**

终端里的 AI 编程助手——TypeScript + ink 构建，连接智谱 BigModel（glm-5.x）。自然语言下达任务，它自主调用工具完成：读写文件、执行命令、查看图片、联网搜索，全程流式输出。

## 快速上手

```bash
npm install -g @leow3lab/leow3bot
leow3bot        # 首次启动进入四步引导，答完即用
```

需要 Node.js ≥ 20 与智谱 BigModel API Key（[获取](https://open.bigmodel.cn)）。

## 文档

- 📖 **[用户指南](docs/guide.md)**——从源码安装、开发调试、首次启动、命令与快捷键、会话恢复、skill 扩展
- 🌐 **[官网与场景演示](https://leow3bot.com)**
- 🤝 **[AGENTS.md](AGENTS.md)**——贡献规范：架构分层地图与硬性约定

## 贡献

改动一律走 PR。合并门禁：CI（`typecheck + test + build`，Node 20/22 矩阵）必须全绿；Gemini Code Assist 会按 [`.gemini/styleguide.md`](.gemini/styleguide.md) 自动初审——机器评论只做初筛，架构与产品决策仍由人把关。

## 许可证

[Apache License 2.0](LICENSE) © 2026 yuanhechen——可自由使用、修改与分发（含商业用途），需保留版权与许可证声明；同时附带明确的**专利授权**条款。
