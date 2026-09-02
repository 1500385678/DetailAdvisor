/**
 * 文案审查 API · v0.1 API 雏形 + 增量 R-READ-02
 *
 * Phase 1 §6 模块 1"上线文案审查器"启动 + 首次增量
 * - 2026-09-02 T5 03:30:启动 commit,落 R-READ-01 句长上限
 * - 2026-09-03 T5 03:30:增量 R-READ-02 句首连词堆叠(零依赖,纯机检)
 *
 * 当前已实现 2 条规则(均纯机检,零外部依赖):
 * - R-READ-01 句长上限(移动端 28 / 桌面端 40)
 * - R-READ-02 句首连词堆叠(≥2 个连词连用)
 *
 * 后续版本扩展(v0.1 API / v0.2 API / v0.3 API):
 * - v0.1 API:R-TYPO-01~05 错别字 5 条 + 敏感词 2 级(需 hanlp/外部字典)
 * - v0.2 API:R-BRAND-01~04 品牌词 4 条(品牌词表本身是外部依赖,Phase 0 第 2 项)
 * - v0.3 API:R-TONE-01~03 语气 3 条(LLM 二次校验需 API key)+ R-READ-03 信息密度
 *
 * 关联文档:
 * - 项目开发计划.md §3 模块 1 + §6 Phase 1 MVP
 * - docs/审查规则/v0.3_文案审查_语气_可读性.md §4 R-READ-01/02
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

interface Read02Hit {
  rule: "R-READ-02";
  sentence: string;
  matched_conjunctions: string[];
  match_start: number;
  match_text: string;
}

interface AuditResponse {
  verdict: "PASS" | "SOFT_WARN" | "HARD_BLOCK";
  score_deduction: number;
  read_hits: ReadHit[];
  read02_hits: Read02Hit[];
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
// R-READ-02 实现(纯机检,无外部依赖)
// 规则:句子开头禁止堆叠连词(≥2 个连词连用)
// 阈值:命中即报,白名单豁免(引文/代码块)
// 扣分:每命中 1 句扣 1 分,READ-02 单条上限 3 分(软调,比 READ-01 上限 5 分更宽松)
// ============================================================

/** 连词词典(对齐 v0.3 §4 R-READ-02 + 常见中文连词) */
const CONJUNCTIONS = [
  "而且", "并且", "所以", "因此", "但是", "然后", "接着", "于是",
  "不过", "可是", "虽然", "尽管", "因为", "由于", "如果", "那么",
  "虽然说", "不但", "不仅", "甚至", "更何况", "何况", "不然", "要不",
] as const;

/**
 * 句首连词堆叠检测
 * - 跳过纯空白/标点的"伪句子"
 * - 跳过以代码块(`) / 引号(「"')开头的句子(白名单豁免)
 * - 在句首 8 字窗口内扫描,统计连词出现次数,≥2 即命中
 */
function checkRead02(text: string): { hits: Read02Hit[]; score: number } {
  const sentences = splitSentences(text);
  const hits: Read02Hit[] = [];
  let score = 0;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length === 0) continue;
    // 白名单:引文/代码块开头跳过
    const firstChar = trimmed[0];
    if (firstChar === "`" || firstChar === '"' || firstChar === "'" ||
        firstChar === "「" || firstChar === "『" || firstChar === "<") continue;

    // 句首 8 字窗口扫连词
    const window = trimmed.slice(0, 8);
    const matched: string[] = [];
    let consumed = 0;
    while (consumed < window.length) {
      const tail = window.slice(consumed);
      let hit: string | null = null;
      for (const conj of CONJUNCTIONS) {
        if (tail.startsWith(conj)) {
          hit = conj;
          break;
        }
      }
      if (hit) {
        matched.push(hit);
        consumed += hit.length;
      } else {
        consumed += 1;
      }
    }

    if (matched.length >= 2) {
      // 拼接 match_text
      const match_text = matched.join("");
      const match_start = 0;
      hits.push({
        rule: "R-READ-02",
        sentence: trimmed,
        matched_conjunctions: matched,
        match_start,
        match_text,
      });
      score = Math.min(score + 1, 3);
    }
  }

  return { hits, score };
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

  // R-READ-01 检测(句长上限)
  const { hits, score: read01Score, surface, limit } = checkRead01(body.text, scene);

  // R-READ-02 检测(句首连词堆叠)
  const { hits: read02Hits, score: read02Score } = checkRead02(body.text);

  // 总扣分(READ-01 + READ-02 累加,各规则独立上限)
  const totalScore = Math.min(read01Score + read02Score, MAX_DEDUCTION);

  // verdict 映射(本 API 雏形只有 READ 类,无 HARD_BLOCK)
  // 0 分 → PASS, ≥1 分 → SOFT_WARN(软调,不阻塞)
  const verdict: AuditResponse["verdict"] = totalScore === 0 ? "PASS" : "SOFT_WARN";

  const response: AuditResponse = {
    verdict,
    score_deduction: totalScore,
    read_hits: hits,
    read02_hits: read02Hits,
    summary: buildSummary(hits, read02Hits, surface, limit, read01Score, read02Score),
    meta: {
      rules_evaluated: ["R-READ-01", "R-READ-02"],
      rules_skipped: [
        "R-TYPO-01~05(留 v0.1 API,需 hanlp/外部字典)",
        "R-BRAND-01~04(留 v0.2 API,需品牌词表)",
        "R-TONE-01~03(留 v0.3 API,需 LLM 二次校验)",
        "R-READ-03(留 v0.3 API,需 LLM 信息密度提取)",
      ],
      scene_resolved: scene,
      text_length: unicodeLength(body.text),
    },
  };

  return NextResponse.json(response, { status: 200 });
}

/** 拼装 summary(支持 R-READ-01 / R-READ-02 各自命中) */
function buildSummary(
  hits: ReadHit[],
  read02Hits: Read02Hit[],
  surface: "mobile" | "desktop",
  limit: number,
  read01Score: number,
  read02Score: number,
): string {
  const parts: string[] = [];
  if (hits.length === 0) {
    parts.push(`R-READ-01 通过(${surface} 端上限 ${limit} 字符)`);
  } else {
    parts.push(`R-READ-01 命中 ${hits.length} 个超长句,扣 ${read01Score} 分`);
  }
  if (read02Hits.length === 0) {
    parts.push(`R-READ-02 通过(无句首连词堆叠)`);
  } else {
    parts.push(`R-READ-02 命中 ${read02Hits.length} 个堆叠句,扣 ${read02Score} 分`);
  }
  return parts.join(";");
}

/** GET 暴露 API 元信息(便于人工/curl 探索) */
export async function GET() {
  return NextResponse.json(
    {
      api: "DetailAdvisor · 文案审查",
      version: "0.1.0-API-雏形+R-READ-02",
      method: "POST",
      endpoint: "/api/audit/text",
      content_type: "application/json",
      request_shape: {
        text: "string (required)",
        scene: "page | landing | push | email | button | error | form | other (optional, default other)",
      },
      rules_implemented: [
        "R-READ-01(句长上限,移动端 28 / 桌面端 40)",
        "R-READ-02(句首连词堆叠,≥2 个连词连用)",
      ],
      rules_planned: [
        "v0.1 API:R-TYPO-01~05 错别字 5 条 + 敏感词 2 级",
        "v0.2 API:R-BRAND-01~04 品牌词 4 条",
        "v0.3 API:R-TONE-01~03 语气 3 条 + R-READ-03 信息密度",
      ],
      docs: "docs/api/audit-text-v0.1.md",
    },
    { status: 200 },
  );
}
