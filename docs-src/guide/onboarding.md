# 首次启动与配置

首次运行 `leow3bot` 会进入四步引导，答完即用，全程无需编辑任何配置文件：

| 步骤 | 说明 |
|---|---|
| ① API 端点 | 回车使用默认智谱端点，或输入自定义端点（自动补全 `https://`，非法输入会被拦截） |
| ② API Key | 粘贴你的智谱 BigModel key（联网搜索默认复用同一 key） |
| ③ 选择模型 | 从端点实时拉取的模型列表中 ↑↓ + Enter 选择（新→旧排列） |
| ④ 上下文窗口 | 输入模型的上下文长度，回车使用默认 `192000` |

配置自动写入 `~/.leow3bot/config.json`。

::: tip 输出上限无需填写
请求超限时 leow3bot 会自动学习端点限制并按模型记忆，同一模型不会重复撞限。
:::

## 高级配置（可选）

需要时可手工向 `~/.leow3bot/config.json` 追加：

| 字段 | 作用 |
|---|---|
| `contextWindow` | 覆盖引导时填写的上下文长度 |
| `permissions` | 命令 deny / confirm 规则（示例见 [`config.example.json`](https://github.com/yuanhechen/leow3bot/blob/master/config.example.json)），详见[权限管控](/guide/permissions) |
| `systemPrompt` | 追加系统提示词 |
| `thinkingBudget` | 思考 token 预算 |
| `webApiKey` | 联网搜索使用独立 key（默认复用 API Key） |

## 切换模型

```
❯ /model

  模型切换
  ↑↓ 选择 · Enter 确认 · Esc/q 取消 · 共 10 个（新→旧）
    ▶ ● glm-5.3      — 输出上限 192,000 · 当前
      glm-5.3-flash  — 输出上限 192,000
      ...
```

`/model` 打开交互选择器（模型列表来自端点，切换即时生效并持久化）；`/model glm-5.3` 带模型名直接切换，拼错会先校验并列出可用清单。
