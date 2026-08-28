import Link from "next/link";

/**
 * DetailAdvisor 主页(骨架占位)
 *
 * Phase 0 · 代码资产 0 → 1 起步
 * 2026-08-29 落地 Next.js 14+ App Router 骨架,本页面为最简占位
 * Phase 1 MVP 上线后将替换为 4 模块入口(文案审查 / 旅程分析 / 异常发现 / A11y)
 *
 * 关联文档:
 * - 项目开发计划.md §5 Phase 0 · §6 Phase 1
 * - 细部顾问开发架构与计划.md §3 核心功能
 * - docs/审查规则/v0.1~v0.3 文案审查规则种子
 */
export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-start justify-center py-32 px-16 bg-white dark:bg-black">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50">
          DetailAdvisor
        </h1>
        <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          细节决定成败,工程化细节审查 Web App。
        </p>
        <p className="mt-2 text-base leading-7 text-zinc-500 dark:text-zinc-500">
          Phase 0 起步 · 2026-08-29
        </p>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 w-full">
          <ModuleCard
            title="文案细节审查器"
            status="Phase 0"
            note="v0.1 错字+敏感词 / v0.2 品牌词 / v0.3 语气+可读性(已闭环)"
          />
          <ModuleCard
            title="用户旅程微观分析"
            status="Phase 2"
            note="3 类典型用户 + 断点识别(待启动)"
          />
          <ModuleCard
            title="异常场景发现器"
            status="Phase 1"
            note="5 类异常:边界 / 并发 / 网络 / 权限 / 设备(待启动)"
          />
          <ModuleCard
            title="可访问性审查 (A11y)"
            status="Phase 1"
            note="WCAG 2.1 AA · axe-core 集成(待启动)"
          />
        </div>

        <div className="mt-12 text-sm text-zinc-400 dark:text-zinc-600">
          <p>
            详见{" "}
            <Link
              href="https://github.com/architectzy/DetailAdvisor"
              className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              项目仓库
            </Link>{" "}
            与 docs/审查规则/ 下的 3 份规则种子。
          </p>
        </div>
      </main>
    </div>
  );
}

function ModuleCard({
  title,
  status,
  note,
}: {
  title: string;
  status: string;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-black dark:text-zinc-50">
          {title}
        </h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-500">
          {status}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{note}</p>
    </div>
  );
}
