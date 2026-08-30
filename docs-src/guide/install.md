# 安装

## 环境要求

- **Node.js ≥ 20**
- **智谱 BigModel API Key**（[获取](https://open.bigmodel.cn)）

## npm 安装

```bash
npm install -g @leow3lab/leow3bot
leow3bot
```

## 从源码安装

```bash
git clone https://github.com/yuanhechen/leow3bot.git
cd leow3bot
npm install
npm install -g .        # 注册全局 leow3bot 命令
```

安装完成后，在任意目录输入 `leow3bot` 启动。开发调试也可不装全局，在仓库目录直接 `npm start`。

## 开发

```bash
npm start               # tsx 直接运行源码
npm run build           # tsup 打包 → dist/main.mjs
npm test                # 类型检查 + 渲染/状态/权限测试
```

::: tip
CI 门禁要求 `npm test` 全绿才能合并 PR，详见[贡献指南](/project/contributing)。
:::
