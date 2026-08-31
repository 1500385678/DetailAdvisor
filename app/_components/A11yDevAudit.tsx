'use client';

import { useEffect } from 'react';

/**
 * A11y Dev Audit · Phase 0 落地
 *
 * 仅在 development 模式下挂载,使用 axe-core 4.13.0
 * 对当前 document 跑 WCAG 2.1 AA 可访问性扫描,违规写入浏览器 console。
 *
 * 设计取舍:
 * - 动态 import('axe-core') 避免生产 bundle 体积膨胀(Next.js 16 会 tree-shake)
 * - useEffect 内 mount,不在 SSR 跑(axe-core 依赖 DOM)
 * - 取消标志位防止 unmount 后还 setState/console
 * - 不用 @axe-core/react:React 19 兼容性更轻量,后续 Phase 1 跑端到端再评估
 *
 * 关联文档:
 * - 项目开发计划.md §5 Phase 0 第 8 个 checkbox · §6 Phase 1 模块 4
 * - docs/a11y/axe-core_基线_v0.1.md
 */
export default function A11yDevAudit() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    let cancelled = false;

    void (async () => {
      try {
        const axe = (await import('axe-core')).default;
        if (cancelled) return;

        const results = await axe.run(document, {
          resultTypes: ['violations', 'passes'],
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
          },
        });

        if (cancelled) return;

        console.groupCollapsed(
          `[A11y Dev Audit] ${results.violations.length} violations · ${results.passes.length} passes`
        );
        for (const v of results.violations) {
          console.warn(
            `[${v.impact ?? 'unknown'}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`
          );
          for (const node of v.nodes.slice(0, 2)) {
            console.warn('  target:', node.target.join(' '));
            console.warn('  html  :', node.html.slice(0, 120));
          }
        }
        console.groupEnd();
      } catch (err) {
        console.error('[A11y Dev Audit] failed:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
