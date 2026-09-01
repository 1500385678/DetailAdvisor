/**
 * 文案审查 API · v0.1 API 雏形
 *
 * Phase 1 §6 模块 1"上线文案审查器"启动 commit
 * 2026-09-02 T5 03:30 落地
 *
 * 当前实现(只 1 条规则):
 * - R-READ-01 句长上限(纯机检,移动端 28 / 桌面端 40)
 *
 * 后续版本扩展(v0.1 API / v0.2 API / v0.3 API):
 * - v0.1 错别字 5 条 + 敏感词 2 级(需 hanlp/外部字典)
 * - v0.2 品牌词 4 条(品牌词表本身是外部依赖,Phase 0 第 2 项)
 * - v0.3 语气 3 条 + 可读性其余 2 条(LLM 二次校验需 API key)
 *
 * 关联文档:
 * - 项目开发计划.md §3 模块 1 + §6 Phase 1 MVP
 * - docs/审查规则/v0.3_文案审查_语气_可读性.md §4 R-READ-01
 * - docs/api/audit-text-v0.1.md
 */
import { NextResponse } from "next/server";

// ============================================================
// 类型定义(对齐 docs/审查规则/v0.1 §5 JSON 形状)
// ============================================================

type Scene =
  | "page"
  | "landing"
  | "push"
  | "email"
  | "button"
  | "error"
  | "form"
  | "other";

interface AuditRequest {
  text: string;
  scene?: Scene;
}

interface ReadHit {
  rule: "R-READ-01";
  surface: "mobile" | "desktop";
  limit: number;
  sentence: string;
  length: number;
  excess: number;
}

interface AuditResponse {
  verdict: "PASS" | "SOFT_WARN" | "HARD_BLOCK";
  score_deduction: number;
  read_hits: ReadHit[];
  summary: string;
  meta: {
    rules_evaluated: string[];
    rules_skipped: string[];
    scene_resolved: Scene;
    text_length: number;
  };
}

// ============================================================
// R-READ-01 实现(纯机检,无外部依赖)
// ============================================================

/** 切句标点:中英文句末 + 中英文分号 */
const SENTENCE_SPLIT_RE = /[。！？!?;；]/;

/** scene → surface 映射(对齐 v0.3 §4 R-READ-01:移动端 28 / 桌面端 40) */
const SCENE_TO_SURFACE: Record<Scene, "mobile" | "desktop"> = {
  push: "mobile", // 推送通知 = 移动端
  button: "mobile", // 按钮文案 = 移动端
  page: "desktop", // 页面 = 桌面端(可手动覆盖)
  landing: "desktop", // 落地页 = 桌面端
  email: "desktop", // 邮件 = 桌面端
  error: "desktop", // 错误提示 = 桌面端
  form: "desktop", // 表单 placeholder = 桌面端
  other: "desktop", // 默认桌面
};

const SURFACE_TO_LIMIT: Record<"mobile" | "desktop", number> = {
  mobile: 28,
  desktop: 40,
};

/** 单条文案扣分上限(对齐 v0.3 §4 R-READ-01) */
const MAX_DEDUCTION = 5;

/**
 * 按标点切分文本为句子(保留原顺序,过滤空字符串)
 * 切完后剩余的尾部无标点部分也算 1 句
 */
function splitSentences(text: string): string[] {
  const parts = text.split(SENTENCE_SPLIT_RE);
  const sentences: string[] = [];
  let buffer = "";

  for (const part of parts) {
    buffer += part;
    // 切到标点处,buffer 已包含该标点前的全部内容
    if (buffer.length > 0) {
      sentences.push(buffer);
      buffer = "";
    }
  }
  // 处理尾部无标点部分
  if (buffer.trim().length > 0) {
    sentences.push(buffer);
  }
  return sentences;
}

/** 统计 Unicode 字符数(对齐 v0.3 §4 R-READ-01) */
function unicodeLength(s: string): number {
  // Array.from 正确处理 surrogate pair(如 emoji)
  return Array.from(s).length;
}

/**
 * R-READ-01 句长上限检测
 *
 * @returns hits 数组(每超 1 条句子 1 个 hit)+ 总扣分
 */
function checkRead01(
  text: string,
  scene: Scene,
): { hits: ReadHit[]; score: number; surface: "mobile" | "desktop"; limit: number } {
  const surface = SCENE_TO_SURFACE[scene];
  const limit = SURFACE_TO_LIMIT[surface];
  const sentences = splitSentences(text);

  const hits: ReadHit[] = [];
  let score = 0;

  for (const sentence of sentences) {
    // 跳过纯空白/标点的"伪句子"
    if (sentence.trim().length === 0) continue;
    const length = unicodeLength(sentence);
    const excess = length - limit;
    if (excess > 0) {
      hits.push({
        rule: "R-READ-01",
        surface,
        limit,
        sentence,
        length,
        excess,
      });
      // 超 1 字 1 分,单条上限 5 分
      score = Math.min(score + excess, MAX_DEDUCTION);
    }
  }

  return { hits, score, surface, limit };
}

// ============================================================
// POST handler
// ============================================================

export async function POST(request: Request) {
  let body: AuditRequest;
  try {
    body = (await request.json()) as AuditRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // 校验
  if (typeof body.text !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid `text` field (string required)" },
      { status: 400 },
    );
  }
  if (body.text.trim().length === 0) {
    return NextResponse.json(
      { error: "`text` is empty" },
      { status: 400 },
    );
  }

  const scene: Scene = body.scene ?? "other";

  // R-READ-01 检测
  const { hits, score, surface, limit } = checkRead01(body.text, scene);

  // verdict 映射(本 API 雏形只有 READ 类,无 HARD_BLOCK)
  // 0 分 → PASS, ≥1 分 → SOFT_WARN(软调,不阻塞)
  const verdict: AuditResponse["verdict"] = score === 0 ? "PASS" : "SOFT_WARN";

  const response: AuditResponse = {
    verdict,
    score_deduction: score,
    read_hits: hits,
    summary:
      hits.length === 0
        ? `R-READ-01 通过(共 ${hits.length} 个超长句,${surface} 端上限 ${limit} 字符)`
        : `R-READ-01 命中 ${hits.length} 个超长句(${surface} 端上限 ${limit} 字符),扣 ${score} 分`,
    meta: {
      rules_evaluated: ["R-READ-01"],
      rules_skipped: [
        "R-TYPO-01~05(留 v0.1 API,需 hanlp/外部字典)",
        "R-BRAND-01~04(留 v0.2 API,需品牌词表)",
        "R-TONE-01~03 + R-READ-02~03(留 v0.3 API,需 LLM 二次校验)",
      ],
      scene_resolved: scene,
      text_length: unicodeLength(body.text),
    },
  };

  return NextResponse.json(response, { status: 200 });
}

/** GET 暴露 API 元信息(便于人工/curl 探索) */
export async function GET() {
  return NextResponse.json(
    {
      api: "DetailAdvisor · 文案审查",
      version: "0.1.0-API-雏形",
      method: "POST",
      endpoint: "/api/audit/text",
      content_type: "application/json",
      request_shape: {
        text: "string (required)",
        scene: "page | landing | push | email | button | error | form | other (optional, default other)",
      },
      rules_implemented: ["R-READ-01(句长上限,移动端 28 / 桌面端 40)"],
      rules_planned: [
        "v0.1 API:R-TYPO-01~05 错别字 5 条 + 敏感词 2 级",
        "v0.2 API:R-BRAND-01~04 品牌词 4 条",
        "v0.3 API:增量 R-READ-02~03 + R-TONE-01~03",
      ],
      docs: "docs/api/audit-text-v0.1.md",
    },
    { status: 200 },
  );
}
