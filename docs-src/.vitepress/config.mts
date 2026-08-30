import { defineConfig } from 'vitepress'

// leow3bot 文档站（leow3bot.com/docs/）
// 风格对齐 Read the Docs 类文档站：左侧章节树 + 右侧页内大纲 + 本地搜索 + 上一页/下一页
export default defineConfig({
  lang: 'zh-CN',
  title: 'leow3bot',
  description: '运行在终端里的多模态文档分析 Agent——理解论文、扫描件与图表，直接完成翻译、解析和整理。',
  base: '/docs/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/docs/logo.svg' }],
  ],

  themeConfig: {
    // 品牌蓝（与官网 site.css 的渐变中段一致）
    nav: [
      { text: '首页', link: 'https://leow3bot.com' },
      { text: '指南', link: '/guide/install' },
      { text: '参考', link: '/reference/commands' },
      { text: 'GitHub', link: 'https://github.com/yuanhechen/leow3bot' },
    ],

    outline: { level: [2, 3], label: '本页大纲' },

    docFooter: { prev: '上一页', next: '下一页' },
    lastUpdated: { text: '最后更新' },
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到亮色模式',
    darkModeSwitchTitle: '切换到暗色模式',

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
          modal: {
            noResultsText: '没有找到结果',
            resetButtonTitle: '清除查询',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
          },
        },
      },
    },

    sidebar: [
      {
        text: '开始',
        items: [
          { text: '简介', link: '/intro' },
          { text: '安装', link: '/guide/install' },
          { text: '快速上手', link: '/guide/quickstart' },
        ],
      },
      {
        text: '使用指南',
        items: [
          { text: '首次启动与配置', link: '/guide/onboarding' },
          { text: '日常使用', link: '/guide/usage' },
          { text: '会话与恢复', link: '/guide/sessions' },
          { text: '权限管控', link: '/guide/permissions' },
        ],
      },
      {
        text: '参考',
        items: [
          { text: '命令', link: '/reference/commands' },
          { text: '快捷键', link: '/reference/keybindings' },
          { text: 'skill 扩展', link: '/reference/skills' },
        ],
      },
      {
        text: '项目',
        items: [
          { text: '贡献指南', link: '/project/contributing' },
          { text: '许可证', link: '/project/license' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/yuanhechen/leow3bot' },
    ],

    footer: {
      message: '基于 <a href="https://github.com/yuanhechen/leow3bot/blob/master/LICENSE" target="_blank">Apache License 2.0</a> 发布',
      copyright: '© 2026 yuanhechen · <a href="https://leow3bot.com" target="_blank">leow3bot.com</a>',
    },
  },
})
