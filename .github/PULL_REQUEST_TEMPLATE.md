## 变更说明

<!-- 做了什么、为什么；关联 issue 请写 Fixes #N -->

## 变更类型

- [ ] feat 新功能
- [ ] fix 缺陷修复
- [ ] refactor 重构（无行为变化）
- [ ] docs 文档
- [ ] chore 工程 / 构建 / CI
- [ ] breaking 破坏性变更

## 自查清单

- [ ] `npm test` 全绿（typecheck + md/store/perm/app 四组测试）
- [ ] 改动了渲染 / store / 权限 / App 的，已同步更新对应 `src/scripts/test-*` 测试
- [ ] 新增运行时依赖的，已在变更说明中给出理由
- [ ] 改动配置字段的，已同步 `config.example.json` 与 README
- [ ] 未混入无关文件（dist、个人 config、站点产物等）
