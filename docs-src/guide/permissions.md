# 权限管控

## 内置黑名单

高危命令（`rm -rf /`、格式化磁盘、fork 炸弹等）命中内置黑名单，**直接拒绝不询问**。

## 自定义执行前确认

`rm -rf`、`git reset --hard` 这类命令的执行前确认需要自行配置——在 `~/.leow3bot/config.json` 的 `permissions.confirm` 中添加规则（示例见 [`config.example.json`](https://github.com/yuanhechen/leow3bot/blob/master/config.example.json)）。

命中确认规则时，leow3bot 会停下来等你选择：

| 选项 | 含义 |
|---|---|
| `y` | 本次允许 |
| `a` | 允许并记住（写入 `~/.leow3bot/permissions.json`，删对应行即可撤销） |
| `n` | 拒绝 |

## deny 规则

`permissions.deny` 中命中的命令直接拒绝，与内置黑名单叠加生效。
