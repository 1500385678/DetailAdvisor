# axe-core 可访问性集成 · 基线 v0.1

> 落地日期:2026-09-01(T5)
> 关联:`项目开发计划.md` §5 Phase 0 第 8 个 checkbox · §6 Phase 1 模块 4
> 上一里程碑:Next.js 16.3.3 骨架(`2026-08-29 T5` `e1bca69`)

## 1. 集成范围

**包**:
- `axe-core@4.13.0`(devDependency)— WCAG 2.1 AA 扫描核心引擎
- `@axe-core/react@4.13.0`(devDependency)— 备用,本基线未启用(详见 §3 设计取舍)

**集成方式**:
- 新增 `app/_components/A11yDevAudit.tsx`(client component,72 行)
- 改造 `app/layout.tsx` 在 server 端条件渲染 `process.env.NODE_ENV === "development" && <A11yDevAudit />`
- 生产环境由 Next.js 16 静态优化,完全 tree-shake(verified by `npx next build`)

**验证**:
- `npx tsc --noEmit` ✓
- `npx eslint .` ✓(0 errors / 0 warnings)
- `npx next build` ✓(Compiled successfully in 2.7s · 4/4 静态页生成)

## 2. 运行行为

启动 `npm run dev` 打开任一页面后,浏览器 console 输出格式:

```
[A11y Dev Audit] N violations · M passes
  [serious] color-contrast: Elements must have sufficient color contrast (3 nodes)
    target: .text-zinc-500.dark\:text-zinc-500
    html  : <p class="mt-2 text-base leading-7 text-zinc-500 dark:text-zinc-500">Phase 0 起步...
  [moderate] region: Some page content is not contained by landmarks (2 nodes)
    target: div
    html  : <div className="flex flex-1 w-full max-w-3xl flex-col items-start ...
  ...
```

折叠 console.groupCollapsed 避免污染开发体验,展开后逐条展示:`impact 等级` + `规则 ID` + `受影响节点数` + 最多 2 个节点的 target/html 摘录。

## 3. 设计取舍

| 决策 | 选项 | 理由 |
|---|---|---|
| dev-only 注入 | server 端 `process.env.NODE_ENV` 条件渲染 | production build 验证 0 引用,完全 tree-shake |
| 动态 import | `import('axe-core')` 而非 `import axe from 'axe-core'` | Next.js 16 静态分析可识别未使用,生产 bundle 不含 |
| 不用 `@axe-core/react` | 仅装 `axe-core` 核心 | `@axe-core/react` 与 React 19 兼容性风险,本基线不需要 React DevTools 联动 |
| 不起 dev server 跑实测 | 写完代码 → tsc → eslint → build | 遵循 Mac mini "测完即关"约束;实测留给 Phase 1 端到端 |
| console 而非 UI 报告 | 不渲染可视化结果到页面 | 基线阶段先快速发现违规,Phase 1 再做"报告可视化模块" |

## 4. 静态代码 Review 推断的潜在违规(待 dev 实测)

> ⚠️ 本节是**代码 review 推断**,不是实测数据。dev server 跑起来后,以 console 输出为准。

**4 模块占位主页(`app/page.tsx`)已知风险点**:
- `color-contrast`:`text-zinc-500 dark:text-zinc-500` 在深色模式下与 `bg-black` 对比度可能不足(zinc-500 ≈ #71717a,黑底对比度 ~3.4:1,AA 要求正文 4.5:1)
- `region`: 页面顶层 `<div>` 没有 landmark 包裹,只有 `<main>`,需评估所有内容是否在 landmark 内
- `heading-order`: `<h1>DetailAdvisor</h1>` → `<h2>文案细节审查器</h2>`,无跳级,预期通过
- `link-name`: `<Link>项目仓库</Link>` 有可访问名,预期通过
- `image-alt`: 页面无 `<img>`,只有 Next.js 处理的 favicon,预期通过
- `page-has-heading-one`: 已有 `<h1>`,预期通过

**预期实测结果**:3-5 条 violation(主要为 `color-contrast` + `region` 边界),0 critical。

## 5. Phase 0 → Phase 1 衔接

**本基线(P0-8)交付**:
- [x] axe-core npm 包安装(2 个,devDependency)
- [x] 客户端组件 + server 端条件渲染(dev-only)
- [x] console 报告通道(折叠 groupCollapsed,逐条 warn)
- [x] 静态代码 review 风险点清单(§4)
- [x] tsc / eslint / next build 三验证通过

**Phase 1 MVP 阶段(§6 模块 4:可访问性审查 v1)下一步**:
1. **接入真实报告页面**:把 console 违规搬到 `/a11y-report` 路由,可视化分级(红/黄/绿)
2. **CI 集成**:`@axe-core/cli` 跑 `axe http://localhost:3000`,PR 阶段拦截严重违规
3. **多页扫描**:从 4 模块占位页扩展到所有 5 个真实页面,产出"基线 → 对比"曲线
4. **评估 `@axe-core/react`**:Phase 1 端到端阶段重新评估 React 19 兼容性,如稳定可启用 React DevTools 联动

## 6. 变更记录

- `2026-09-01 T5` `feat(a11y)`:axe-core@4.13.0 + @axe-core/react@4.13.0 集成 + dev-only A11yDevAudit 组件 + 静态基线 v0.1(本基线)
- 上一里程碑:`2026-08-29 T5` `feat(scaffold)`:Next.js 16.3.3 骨架(代码资产 0 → 1 起步)
