# skill 扩展

leow3bot 自动扫描以下目录中的 `<name>/SKILL.md`（后者覆盖前者同名）：

- `~/.claude/skills/` — Claude 生态标准位置（`npx skills add` 默认安装处）
- `~/.leow3bot/skills/` — leow3bot 专属目录
- `./.claude/skills/` — 项目级

## 安装社区 skill

```bash
npx skills add https://github.com/vercel-labs/skills --skill find-skills
```

## PDF skill

文字型提取 markdown / 扫描件渲染识别（依赖自动安装）。PDF skill 为本地资产，不随仓库分发——将 `skills/pdf/` 目录放入上述任一位置即可启用。

用 `/skills` 查看与开关已加载的 skill。
