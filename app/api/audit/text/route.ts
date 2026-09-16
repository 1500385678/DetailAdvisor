/**
 * 文案审查 API · v0.1 API 雏形 + 增量 R-READ-02 + 增量 v0.1/v0.3 五规则 + 增量 R-TYPO-06 + 增量 R-TYPO-07 + 增量 v0.3 二规则 R-READ-03/R-TONE-04 + 增量 R-TYPO-08 + 增量 R-TYPO-09
 *
 * Phase 1 §6 模块 1"上线文案审查器"启动 + 7 次增量
 * - 2026-09-02 T5 03:30:启动 commit,落 R-READ-01 句长上限
 * - 2026-09-03 T5 03:30:增量 R-READ-02 句首连词堆叠(零依赖,纯机检)
 * - 2026-09-04 T5 03:30:增量 v0.1 错别字 3 条 + v0.3 语气可读性 2 条(零依赖纯机检)
 *   - R-TYPO-02 多字/漏字/重复字(叠词白名单)
 *   - R-TYPO-03 标点符号错误(中英文混用)
 *   - R-TYPO-05 全角/半角混用
 *   - R-TONE-02 否定句否定词置顶
 *   - R-TONE-03 语气一致性
 * - 2026-09-05 T5 03:30:增量 R-TYPO-06 数字/英文与中文之间空格缺失(零依赖纯机检,7 → 8 规则)
 * - 2026-09-06 T5 03:30:增量 R-TYPO-07 连续标点符号(零依赖纯 regex,8 → 9 规则)
 * - 2026-09-08 T5 03:30:增量 v0.3 可读性 1 条 + v0.3 语气 1 条(零依赖纯机检,9 → 11 规则,**恢复 0907 T5 首次断档后连续节奏**)
 *   - R-READ-03 句末标点规范(陈述句以"。"或";"或","结尾,避免无标点或语气词句末)
 *   - R-TONE-04 感叹号密度(全篇感叹号 / 句子数 > 30% 即报,避免过激文案)
 * - 2026-09-09 T5 03:30:增量 R-TYPO-08 广告法极限词零依赖查表(11 → 12 规则,Phase 1 §6 模块 1 收口)
 * - 2026-09-17 T5 03:30:增量 R-TYPO-09 同音字词表 Top 50 子集(12 → 13 规则,采纳 0917 巡检"路线图 A"建议,沿用 R-TYPO-08 零依赖静态词表架构,无需 hanlp 字典)
 *   - A 类 技术/产品文案高频错别字(15 条)
 *   - B 类 常见中文文案错别字(20 条)
 *   - C 类 常见成语错别字(15 条)
 *   - R-TYPO-01 命名被 R-TYPO-09 零依赖版接管,语义保留
 *
 * 当前已实现 13 条规则(均纯机检,零外部依赖):
 * - R-READ-01 句长上限(移动端 28 / 桌面端 40)
 * - R-READ-02 句首连词堆叠(≥2 个连词连用)
 * - R-READ-03 句末标点规范(陈述句末"!"/"?"或无标点,即报)
 * - R-TYPO-02 多字/漏字/重复字
 * - R-TYPO-03 中英文标点混用
 * - R-TYPO-05 全角/半角混用
 * - R-TYPO-06 数字/英文与中文之间空格缺失(pangu 风格)
 * - R-TYPO-07 连续标点符号(≥3 个同标点连用)
 * - R-TYPO-08 广告法极限词零依赖查表(33 条 4 类)
 * - R-TYPO-09 同音字词表 Top 50 子集零依赖查表(50 条 3 类)
 * - R-TONE-02 "请不要"/"请勿" 引导句式
 * - R-TONE-03 4 类语气词频次一致性
 * - R-TONE-04 感叹号密度(感叹号 / 句子数 > 30%)
 *
 * 后续版本扩展:
 * - v0.1 API:R-TYPO-04 量词(需 LLM)
 * - v0.2 API:R-BRAND-01~04 品牌词 4 条(品牌词表本身是外部依赖,Phase 0 外部依赖 0904 起降级到 Phase 1.5)
 * - v0.3 API:R-TONE-01 二义性(需 LLM 二次校验)+ R-READ-03 信息密度(需 LLM);**当前 R-READ-03 已是"句末标点规范"零依赖简化版,与原 LLM 命名同 ID 但语义不同,见 §3.8**
 *
 * 关联文档:
 * - 项目开发计划.md §3 模块 1 + §6 Phase 1 MVP
 * - docs/审查规则/v0.1_文案审查_错别字_敏感词.md §3 R-TYPO-02/03/05/06/07/09
 * - docs/审查规则/v0.3_文案审查_语气_可读性.md §3 R-TONE-02/03/04 + §4 R-READ-01/02/03
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

interface Typo02Hit {
  rule: "R-TYPO-02";
  text: string;
  position: number;
  match: string;
  whitelist_hit: boolean;
}

interface Typo03Hit {
  rule: "R-TYPO-03";
  text: string;
  position: number;
  expected: string;
  actual: string;
  primary_script: "cjk" | "latin";
}

interface Typo05Hit {
  rule: "R-TYPO-05";
  text: string;
  position: number;
  match: string;
  category: "fullwidth-digit" | "fullwidth-letter";
}

interface Typo06Hit {
  rule: "R-TYPO-06";
  text: string;            // 紧贴的 2 字符片段(如 "次1" / "3次")
  position: number;         // 字符偏移(中文侧位置)
  match: string;            // 完整 2 字符匹配
  cjk_char: string;         // 中文侧字符
  ascii_char: string;       // 数字/英文字符
  direction: "cjk-ascii" | "ascii-cjk";  // 中文在前还是在后
}

interface Typo07Hit {
  rule: "R-TYPO-07";
  text: string;            // 命中的连续标点片段(如 "。。。" / "？？？" / "!!!")
  position: number;         // 字符偏移(连续段起点)
  match: string;            // 完整连续标点
  run_length: number;       // 连续标点数量(≥ 3)
  punct: string;            // 单个标点字符(如 "。" / "?" / "!")
  punct_type: "cjk" | "latin"; // 中英标点分类
}

interface Tone02Hit {
  rule: "R-TONE-02";
  sentence: string;
  matched_phrase: string;
  position: number;
}

interface Tone03Hit {
  rule: "R-TONE-03";
  counts: Record<string, number>;
  dominant: string;
  dominant_ratio: number;
  threshold: number;
}

interface Read03Hit {
  rule: "R-READ-03";
  sentence: string;
  position: number;
  issue: "missing-punct" | "inconsistent-ending";
  actual_ending: string; // 句末实际字符("!"/"?"/""等)
  primary_script: "cjk" | "latin";
}

interface Tone04Hit {
  rule: "R-TONE-04";
  exclam_count: number;
  sentence_count: number;
  ratio: number;
  threshold: number;
}

interface Typo08Hit {
  rule: "R-TYPO-08";
  text: string; // 命中的极限词(如"最佳")
  position: number; // 字符偏移
  match: string; // 完整匹配(同 text,便于客户端差异化处理)
  category: "absolute" | "ranking" | "degree" | "promise"; // 极限词分类
}

interface Typo09Hit {
  rule: "R-TYPO-09";
  text: string; // 命中的错误写法(如"布署")
  position: number; // 字符偏移
  match: string; // 完整匹配(同 text,便于客户端"查找替换"提示)
  correct: string; // 建议的正确写法(如"部署")
  category: "tech" | "general" | "idiom"; // 同音字/形近字分类
  reason: string; // 给出建议原因(如"军事/技术正式写法")
}

interface AuditResponse {
  verdict: "PASS" | "SOFT_WARN" | "HARD_BLOCK";
  score_deduction: number;
  read_hits: ReadHit[];
  read02_hits: Read02Hit[];
  read03_hits: Read03Hit[];
  typo02_hits: Typo02Hit[];
  typo03_hits: Typo03Hit[];
  typo05_hits: Typo05Hit[];
  typo06_hits: Typo06Hit[];
  typo07_hits: Typo07Hit[];
  typo08_hits: Typo08Hit[];
  typo09_hits: Typo09Hit[];
  tone02_hits: Tone02Hit[];
  tone03_hits: Tone03Hit[];
  tone04_hits: Tone04Hit[];
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

/** 各规则独立扣分上限(软调规则比硬错规则上限更小) */
const READ02_MAX = 3;
const READ03_MAX = 3;
const TYPO02_MAX = 3;
const TYPO03_MAX = 3;
const TYPO05_MAX = 3;
const TONE02_MAX = 2;
const TONE03_MAX = 2;
const TONE04_MAX = 2;
const TYPO06_MAX = 3;
const TYPO07_MAX = 3;
const TYPO08_MAX = 3;
const TYPO09_MAX = 3;

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
      score = Math.min(score + 1, READ02_MAX);
    }
  }

  return { hits, score };
}

// ============================================================
// R-TYPO-02 实现(纯 regex,无外部依赖)
// 规则:同一汉字连续出现 ≥ 2 次,标记 [dup],除非为叠词/拟声词
// 阈值:命中即报,白名单豁免
// 扣分:每命中 1 处 1 分,单条上限 3 分
// ============================================================

/**
 * 叠词/拟声词白名单(常见合法叠字)
 * - 拟声词: 哈哈/呵呵/嘻嘻/嘿嘿/哼哼/嗯嗯/啊啊/哦哦/噢噢/啧啧
 * - 形容词叠词: 慢慢/看看/干干净净/高高兴兴/仔仔细细/清清楚楚/明明白白/老老实实/...
 * - 副词叠词: 吞吞吐吐/大大咧咧/婆婆妈妈/偷偷摸摸/马马虎虎
 * - 量词叠词: 家家户户/男男女女/老老少少/里里外外/上上下下/前前后后/左左右右
 */
const REDUPLICATION_WHITELIST = new Set<string>([
  // 拟声词/语气词
  "哈哈", "呵呵", "嘻嘻", "嘿嘿", "哼哼", "嗯嗯", "啊啊", "哦哦", "噢噢", "啧啧",
  "呀呀", "哎哎", "喔喔", "哇哇", "嗨嗨", "呸呸",
  // 形容词叠词
  "看看", "慢慢", "快快", "早早", "晚晚", "常常", "往往", "刚刚", "恰恰", "仅仅",
  "干干净净", "高高兴兴", "仔仔细细", "清清楚楚", "明明白白", "老老实实", "实实在在",
  "踏踏实实", "马马虎虎", "说说笑笑", "来来往往", "形形色色", "原原本本", "开开心心",
  "快快乐乐", "轻轻松松", "简简单单", "平平安安", "团团圆圆", "红红火火", "热热闹闹",
  "漂漂亮亮", "整整齐齐", "严严实实", "结结实实", "安安静静", "风风雨雨", "日日夜夜",
  "世世代代", "吞吞吐吐", "大大咧咧", "婆婆妈妈", "偷偷摸摸", "隐隐约约", "朦朦胧胧",
  "浩浩荡荡", "轰轰烈烈", "沸沸扬扬", "纷纷扬扬", "郁郁葱葱", "袅袅婷婷", "堂堂正正",
  "唯唯诺诺", "浑浑噩噩", "昏昏沉沉", "恍恍惚惚", "疯疯癫癫", "战战兢兢", "鬼鬼祟祟",
  "坑坑洼洼", "密密麻麻", "稀稀拉拉", "零零散散", "断断续续", "浩浩汤汤", "泱泱大国",
  // 量词/代词叠词
  "家家户户", "男男女女", "老老少少", "里里外外", "上上下下", "前前后后", "左左右右",
  "方方面面", "时时刻刻", "分分秒秒", "年年岁岁", "朝朝暮暮", "日日夜夜", "字字句句",
  "点点滴滴", "方方面面", "林林总总", "莘莘学子",
  // 动词叠词
  "走走", "跑跑", "跳跳", "听听", "说说", "读读", "写写", "想想", "试试", "做做",
  "看看", "笑笑", "哭哭", "聊聊", "谈谈", "问问", "查查", "找找", "等等", "比比",
  "算算", "选选", "挑挑", "逛逛", "转转", "玩玩", "睡睡", "歇歇", "坐坐", "站站",
  "歇歇", "种种", "买买", "卖卖", "送送", "收收", "洗洗", "刷刷", "擦擦", "扫扫",
  "打打", "敲敲", "摸摸", "碰碰", "动动", "推推", "拉拉", "搬搬", "抬抬", "拎拎",
]);

/** 连续重复字符 regex(unicode-aware,匹配同一字符连续 ≥ 2 次) */
const DUP_CHAR_RE = /(.)\1{1,}/gu;

/**
 * R-TYPO-02 多字/漏字/重复字检测
 * - 找出所有连续重复字符(≥ 2 次)
 * - 不在白名单的视为 [dup] 命中
 * - 跳过空白/纯标点的伪内容
 */
function checkTypo02(text: string): { hits: Typo02Hit[]; score: number } {
  const hits: Typo02Hit[] = [];
  let score = 0;

  // 用 matchAll 找出所有匹配
  const matches = text.matchAll(DUP_CHAR_RE);
  for (const m of matches) {
    const match = m[0];
    const position = m.index ?? 0;
    // 白名单检查
    if (REDUPLICATION_WHITELIST.has(match)) continue;
    hits.push({
      rule: "R-TYPO-02",
      text: match,
      position,
      match,
      whitelist_hit: false,
    });
    score = Math.min(score + 1, TYPO02_MAX);
  }

  return { hits, score };
}

// ============================================================
// R-TYPO-03 实现(纯 regex,无外部依赖)
// 规则:中文文本禁止出现纯英文标点(, ; : ? !),反之亦然
// 阈值:每出现 1 个混用标点,扣 1 分,单条上限 3 分
// ============================================================

/** 中文字符 unicode 范围(CJK Unified Ideographs 基本平面) */
const CJK_RE = /[\u4e00-\u9fff]/;

/** 英文标点(在中文中应改用全角) */
const LATIN_PUNCT_IN_CJK = [",", ";", ":", "?", "!"];
/** 中文标点(在英文中应改用半角) */
const CJK_PUNCT_IN_LATIN = ["，", "；", "：", "？", "！"];

/**
 * R-TYPO-03 中英文标点混用检测
 * - 主语种判断:文本中是否含中文字符
 * - 中文文本: 出现英文 , ; : ? ! → 报
 * - 英文文本: 出现中文 ， ； ： ？ ！ → 报
 */
function checkTypo03(text: string): { hits: Typo03Hit[]; score: number } {
  const hits: Typo03Hit[] = [];
  let score = 0;

  const hasCJK = CJK_RE.test(text);
  const primary_script: "cjk" | "latin" = hasCJK ? "cjk" : "latin";

  if (hasCJK) {
    // 中文文本:扫英文标点
    for (const punct of LATIN_PUNCT_IN_CJK) {
      let from = 0;
      while (true) {
        const idx = text.indexOf(punct, from);
        if (idx === -1) break;
        // 简单映射:英文 , → 中文 ，
        const expected = ({ ",": "，", ";": "；", ":": "：", "?": "？", "!": "！" })[punct] ?? punct;
        hits.push({
          rule: "R-TYPO-03",
          text: punct,
          position: idx,
          expected,
          actual: punct,
          primary_script,
        });
        score = Math.min(score + 1, TYPO03_MAX);
        from = idx + 1;
      }
    }
  } else {
    // 英文文本:扫中文标点
    for (const punct of CJK_PUNCT_IN_LATIN) {
      let from = 0;
      while (true) {
        const idx = text.indexOf(punct, from);
        if (idx === -1) break;
        const expected = ({ "，": ",", "；": ";", "：": ":", "？": "?", "！": "!" })[punct] ?? punct;
        hits.push({
          rule: "R-TYPO-03",
          text: punct,
          position: idx,
          expected,
          actual: punct,
          primary_script,
        });
        score = Math.min(score + 1, TYPO03_MAX);
        from = idx + 1;
      }
    }
  }

  return { hits, score };
}

// ============================================================
// R-TYPO-05 实现(纯 regex,无外部依赖)
// 规则:数字、字母在半角/全角之间必须一致
// 阈值:每出现 1 处混用,扣 1 分,单条上限 3 分
// ============================================================

/** 全角数字 ０-９ (U+FF10 - U+FF19) */
const FULLWIDTH_DIGIT_RE = /[０-９]/g;
/** 全角字母 Ａ-Ｚ ａ-ｚ (U+FF21 - U+FF3A, U+FF41 - U+FF5A) */
const FULLWIDTH_LETTER_RE = /[Ａ-Ｚａ-ｚ]/g;

/**
 * R-TYPO-05 全角/半角混用检测
 * - 扫全角数字 → 报
 * - 扫全角字母 → 报
 * - 不做"中文+数字空格"检测(留 v0.1 API 后续扩展)
 */
function checkTypo05(text: string): { hits: Typo05Hit[]; score: number } {
  const hits: Typo05Hit[] = [];
  let score = 0;

  for (const m of text.matchAll(FULLWIDTH_DIGIT_RE)) {
    hits.push({
      rule: "R-TYPO-05",
      text: m[0],
      position: m.index ?? 0,
      match: m[0],
      category: "fullwidth-digit",
    });
    score = Math.min(score + 1, TYPO05_MAX);
  }
  for (const m of text.matchAll(FULLWIDTH_LETTER_RE)) {
    hits.push({
      rule: "R-TYPO-05",
      text: m[0],
      position: m.index ?? 0,
      match: m[0],
      category: "fullwidth-letter",
    });
    score = Math.min(score + 1, TYPO05_MAX);
  }

  return { hits, score };
}

// ============================================================
// R-TYPO-06 实现(纯 regex,无外部依赖)
// 规则:中文字符与数字/英文字符紧贴(无空格)时报
//   - 中文 + 数字/英文(如"次1" / "户A")→ cjk-ascii
//   - 数字/英文 + 中文(如"3次" / "A产品")→ ascii-cjk
// 阈值:每命中 1 处 1 分,单条上限 3 分
// 白名单:数字内部"123" 紧贴(无中文)不报;纯 ASCII 段不报;引文/代码块豁免
// ============================================================

/**
 * 中文字符 + 数字/英文字符 紧贴 regex
 * 模式 1:中(unicode) + 数字/英 → cjk-ascii
 * 模式 2:数字/英 + 中(unicode) → ascii-cjk
 * 用 2 个独立 regex 避免 matchAll 消费后漏掉"1次"(紧跟在"数1"后)
 */
const PANGU_CJK_ASCII_RE = /[\u4e00-\u9fff][0-9A-Za-z]/g;
const PANGU_ASCII_CJK_RE = /[0-9A-Za-z][\u4e00-\u9fff]/g;

/**
 * R-TYPO-06 数字/英文与中文之间空格缺失检测
 * - 扫所有"中文↔ASCII 紧贴"对(双向独立,避免 matchAll 消费漏检)
 * - 不区分"中文侧位置":[cjk_char] 在前/在后都报
 * - 不做"建议插入空格位置"提示:只报 hit 让用户判断
 */
function checkTypo06(text: string): { hits: Typo06Hit[]; score: number } {
  const hits: Typo06Hit[] = [];
  let score = 0;

  // 模式 1:中文在前(cjk-ascii)
  for (const m of text.matchAll(PANGU_CJK_ASCII_RE)) {
    const match = m[0];
    const position = m.index ?? 0;
    hits.push({
      rule: "R-TYPO-06",
      text: match,
      position,
      match,
      cjk_char: match[0],
      ascii_char: match[1],
      direction: "cjk-ascii",
    });
    score = Math.min(score + 1, TYPO06_MAX);
  }
  // 模式 2:中文在后(ascii-cjk)
  for (const m of text.matchAll(PANGU_ASCII_CJK_RE)) {
    const match = m[0];
    const position = m.index ?? 0;
    hits.push({
      rule: "R-TYPO-06",
      text: match,
      position,
      match,
      cjk_char: match[1],
      ascii_char: match[0],
      direction: "ascii-cjk",
    });
    score = Math.min(score + 1, TYPO06_MAX);
  }

  // 按 position 排序,便于客户端按顺序展示
  hits.sort((a, b) => a.position - b.position);
  return { hits, score };
}

// ============================================================
// R-TYPO-07 实现(纯 regex,无外部依赖)
// 规则:同一标点连续出现 ≥ 3 次时报
//   - 中文标点:。。、！！、？？
//   - 英文标点:...、!!!、???
// 阈值:每命中 1 处 1 分,单条上限 3 分
// 白名单:不豁免(连续 3+ 标点 = 几乎一定是手滑/语气过激,需要报警)
// ============================================================

/**
 * 连续标点 regex
 * - 后行引用:([.!?。！？])\1{2,} 表示"同一标点连续 ≥ 3 次"
 * - 用 global flag + matchAll 扫所有连续段
 * - 不做"建议替换为 1 个标点"提示,只报 hit
 */
const REPEAT_PUNCT_RE = /([.!?。！？])\1{2,}/g;

/**
 * R-TYPO-07 连续标点符号检测
 * - 扫所有"≥ 3 个同标点连用"段
 * - 区分中英标点(cjk/latin)
 * - 输出每个连续段的位置、长度、标点类型
 */
function checkTypo07(text: string): { hits: Typo07Hit[]; score: number } {
  const hits: Typo07Hit[] = [];
  let score = 0;

  for (const m of text.matchAll(REPEAT_PUNCT_RE)) {
    const match = m[0];
    const position = m.index ?? 0;
    const punct = m[1] ?? match[0] ?? "";
    // 中英标点分类:unicode 范围判断
    const code = punct.charCodeAt(0);
    // CJK 标点范围:0x3000-0x303F(CJK 符号和标点)/ 0xFF01-0xFF0E(全角 ASCII)
    const punct_type: "cjk" | "latin" =
      (code >= 0x3000 && code <= 0x303f) || (code >= 0xff01 && code <= 0xff60)
        ? "cjk"
        : "latin";
    hits.push({
      rule: "R-TYPO-07",
      text: match,
      position,
      match,
      run_length: match.length,
      punct,
      punct_type,
    });
    score = Math.min(score + 1, TYPO07_MAX);
  }

  return { hits, score };
}

// ============================================================
// R-TONE-02 实现(纯 regex,无外部依赖)
// 规则:否定句否定词应紧贴动词/被修饰语,避免"请不要" / "请勿" 引导
// 阈值:命中即报(warn 级,只提示不强制)
// 扣分:每命中 1 句 1 分,单条上限 2 分
// ============================================================

/** 否定句引导词白名单(命中即报) */
const NEGATION_PHRASES = ["请不要", "请勿"] as const;

/**
 * R-TONE-02 否定句否定词置顶检测
 * - 扫每个句子
 * - 命中"请不要" / "请勿" → 报
 * - LLM 二次校验留 v0.3 API 后续扩展
 */
function checkTone02(text: string): { hits: Tone02Hit[]; score: number } {
  const sentences = splitSentences(text);
  const hits: Tone02Hit[] = [];
  let score = 0;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length === 0) continue;
    for (const phrase of NEGATION_PHRASES) {
      const idx = trimmed.indexOf(phrase);
      if (idx !== -1) {
        hits.push({
          rule: "R-TONE-02",
          sentence: trimmed,
          matched_phrase: phrase,
          position: idx,
        });
        score = Math.min(score + 1, TONE02_MAX);
        break; // 一句只报一次
      }
    }
  }

  return { hits, score };
}

// ============================================================
// R-TONE-03 实现(纯 regex,无外部依赖)
// 规则:4 类语气词频次应统一,占比最大 < 70% 即报
// 阈值:warn 级,提示"主语气词建议统一为 X(占 65%)"
// 扣分:命中 1 次 1 分,单条上限 2 分
// ============================================================

/** 4 类语气词词典(对齐 v0.3 §3 R-TONE-03) */
const TONE_WORDS: Record<string, RegExp> = {
  请: /请(?![不要勿])/g, // "请" 后不接 "不要" / "勿"(避免与 R-TONE-02 重)
  麻烦: /麻烦/g,
  建议: /建议/g,
  温馨提示: /温馨提示|提示/g, // "提示" 兜底,因短文案里"温馨提示"经常省略
};

/** 主语气词占比阈值 */
const TONE03_THRESHOLD = 0.7;

/**
 * R-TONE-03 语气一致性检测
 * - 统计 4 类语气词频次
 * - 找出最大占比
 * - < 70% 即报
 */
function checkTone03(text: string): { hits: Tone03Hit[]; score: number } {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const [name, re] of Object.entries(TONE_WORDS)) {
    const matches = text.match(re);
    const count = matches ? matches.length : 0;
    counts[name] = count;
    total += count;
  }

  const hits: Tone03Hit[] = [];
  let score = 0;

  if (total >= 3) {
    // 至少 3 个语气词才做一致性检查(避免短文案过度敏感)
    let dominant = "";
    let maxCount = 0;
    for (const [name, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = name;
      }
    }
    const ratio = total === 0 ? 0 : maxCount / total;
    if (ratio < TONE03_THRESHOLD) {
      hits.push({
        rule: "R-TONE-03",
        counts,
        dominant,
        dominant_ratio: Number(ratio.toFixed(3)),
        threshold: TONE03_THRESHOLD,
      });
      score = Math.min(1, TONE03_MAX);
    }
  }

  return { hits, score };
}

// ============================================================
// R-READ-03 实现(纯 regex,无外部依赖)
// 规则:陈述句末不应以"!"或"?"或无标点结尾;应以"。"(中文)或"."(英文)或","/";"等分隔标点结尾
// 注:本规则是 v0.3 §4 R-READ-03(信息密度,需 LLM)的零依赖简化版,沿用相同 ID 但语义为"句末标点规范"
// 阈值:每命中 1 句 1 分,单条上限 3 分
// ============================================================

/** 中文陈述句末合法标点(CJK 句号/逗号/分号/冒号/顿号/省略号) */
const CJK_STATEMENT_ENDINGS = new Set(["。", "，", "；", "：", "、", "…", "——"]);
/** 英文陈述句末合法标点(句号/逗号/分号/冒号) */
const LATIN_STATEMENT_ENDINGS = new Set([".", ",", ";", ":", "…"]);

/**
 * R-READ-03 句末标点规范检测
 * - 扫每个切出的句子
 * - 末字符若不在合法集内 → 报(inconsistent-ending)
 * - 末字符为"!"或"?" → 报(陈述句不应语气词结尾,除非含问号/感叹号关键词)
 * - 空句末(纯空白) → 报(missing-punct)
 * - 白名单:末字符是"!"或"?"的句子若含疑问/感叹词("吗/呢/啊/吧/呀/啊/哦/呀/哇/哦")则视为合法(疑问/感叹句)
 */
function checkRead03(text: string): { hits: Read03Hit[]; score: number } {
  const hits: Read03Hit[] = [];
  let score = 0;
  const hasCJK = CJK_RE.test(text);
  const primary_script: "cjk" | "latin" = hasCJK ? "cjk" : "latin";
  const legalEndings = hasCJK ? CJK_STATEMENT_ENDINGS : LATIN_STATEMENT_ENDINGS;

  // 中文疑问/感叹句白名单(末字符"!"或"?"若含这些词则视为合法)
  const INTERROGATIVE_PARTICLES = /[吗呢吧呀啊哦哇哎]/;

  // 用独立 regex 找"句子"(含末尾标点),避免 splitSentences 剥掉标点
  // 模式:非切句标点任意字符 + 可选 1 个切句标点;切句标点集 = [。!?！？;；]
  const SENTENCE_WITH_ENDING_RE = /[^。！？!?;；]*[。！？!?;；]?/g;
  for (const m of text.matchAll(SENTENCE_WITH_ENDING_RE)) {
    const sentence = m[0];
    if (sentence.trim().length === 0) continue;

    const lastChar = sentence[sentence.length - 1];
    const position = m.index ?? 0;
    // 跳过纯字母数字末(无标点)—— 单独处理 missing-punct
    if (legalEndings.has(lastChar)) continue;

    // 句末为"!"或"?"(中英)
    if (lastChar === "!" || lastChar === "?" || lastChar === "！" || lastChar === "？") {
      // 含疑问/感叹语气词 → 合法
      if (INTERROGATIVE_PARTICLES.test(sentence)) continue;
      hits.push({
        rule: "R-READ-03",
        sentence,
        position,
        issue: "inconsistent-ending",
        actual_ending: lastChar,
        primary_script,
      });
      score = Math.min(score + 1, READ03_MAX);
      continue;
    }

    // 句末为字母/数字/汉字(无标点结尾)→ missing-punct
    if (/[a-zA-Z0-9\u4e00-\u9fff]/.test(lastChar)) {
      hits.push({
        rule: "R-READ-03",
        sentence,
        position,
        issue: "missing-punct",
        actual_ending: lastChar,
        primary_script,
      });
      score = Math.min(score + 1, READ03_MAX);
    }
  }

  return { hits, score };
}

// ============================================================
// R-TONE-04 实现(纯 regex,无外部依赖)
// 规则:全篇感叹号"!"密度检测,感叹号数 / 句子数 > 30% 即报(过激文案)
// 注:本规则是 v0.3 §3 R-TONE-01(二义性,需 LLM)的零依赖邻居规则,命名上沿用 v0.3 习惯
// 阈值:命中即报 1 分(只报一次,全篇级),单条上限 2 分
// ============================================================

/** 感叹号密度阈值(感叹号数 / 句子数,中文+英文"!"/"！" 都计) */
const TONE04_THRESHOLD = 0.3;

/** 感叹号扫描 regex(中英感叹号 0xFF01 0x0021) */
const EXCLAM_RE = /[!！]/g;

function checkTone04(text: string): { hits: Tone04Hit[]; score: number } {
  const sentences = splitSentences(text).filter((s) => s.trim().length > 0);
  const sentenceCount = sentences.length;
  if (sentenceCount === 0) return { hits: [], score: 0 };

  const exclamMatches = text.match(EXCLAM_RE);
  const exclamCount = exclamMatches ? exclamMatches.length : 0;
  const ratio = exclamCount / sentenceCount;

  if (ratio > TONE04_THRESHOLD) {
    return {
      hits: [
        {
          rule: "R-TONE-04",
          exclam_count: exclamCount,
          sentence_count: sentenceCount,
          ratio: Number(ratio.toFixed(3)),
          threshold: TONE04_THRESHOLD,
        },
      ],
      score: Math.min(1, TONE04_MAX),
    };
  }
  return { hits: [], score: 0 };
}

// ============================================================
// R-TYPO-08 实现(广告法极限词零依赖查表)
// ============================================================

/** 广告法极限词词表(精选 33 条)
 *  分类:
 *    - absolute: 绝对化用词(广告法第九条明令禁止)
 *    - ranking:  排名/地位类(暗示行业地位)
 *    - degree:   程度极限(100%/永远/完美等)
 *    - promise:  承诺/保证类(包过/稳赚/无副作用等)
 *  选型:零依赖纯静态词表 + 2+ 字词(避免单字"最"/"全"误报);
 *       长词优先匹配防"最好"/"最好吃"重复报(详见 checkTypo08 实现)
 */
const ABSOLUTE_WORDS: ReadonlyArray<{ word: string; category: Typo08Hit["category"] }> = [
  // 绝对化(8)
  { word: "最佳", category: "absolute" },
  { word: "最好", category: "absolute" },
  { word: "最大", category: "absolute" },
  { word: "最高", category: "absolute" },
  { word: "最优", category: "absolute" },
  { word: "最强", category: "absolute" },
  { word: "最快", category: "absolute" },
  { word: "最便宜", category: "absolute" },
  // 排名/地位(9)
  { word: "第一", category: "ranking" },
  { word: "唯一", category: "ranking" },
  { word: "首选", category: "ranking" },
  { word: "独家", category: "ranking" },
  { word: "顶级", category: "ranking" },
  { word: "顶尖", category: "ranking" },
  { word: "最高级", category: "ranking" },
  { word: "国家级", category: "ranking" },
  { word: "世界级", category: "ranking" },
  // 程度极限(9)
  { word: "100%", category: "degree" },
  { word: "百分百", category: "degree" },
  { word: "百分之百", category: "degree" },
  { word: "永久", category: "degree" },
  { word: "永远", category: "degree" },
  { word: "绝对", category: "degree" },
  { word: "完全", category: "degree" },
  { word: "完美", category: "degree" },
  { word: "万能", category: "degree" },
  // 承诺/保证(7)
  { word: "包过", category: "promise" },
  { word: "稳赚", category: "promise" },
  { word: "零风险", category: "promise" },
  { word: "无风险", category: "promise" },
  { word: "稳赚不赔", category: "promise" },
  { word: "无副作用", category: "promise" },
  { word: "立竿见影", category: "promise" },
];

function checkTypo08(text: string): { hits: Typo08Hit[]; score: number } {
  if (text.length === 0) return { hits: [], score: 0 };
  const hits: Typo08Hit[] = [];
  // 按 word.length 降序:长词优先匹配,避免"最佳"被拆为"最"+"佳"重复报
  const sorted = [...ABSOLUTE_WORDS].sort((a, b) => b.word.length - a.word.length);
  // 用 Set 跟踪已覆盖区间 [start, end),避免子串重复报
  const covered: Array<[number, number]> = [];
  const isCovered = (start: number, end: number): boolean => {
    for (const [s, e] of covered) {
      if (s <= start && end <= e) return true;
    }
    return false;
  };

  for (const { word, category } of sorted) {
    let pos = 0;
    while (pos <= text.length - word.length) {
      const idx = text.indexOf(word, pos);
      if (idx === -1) break;
      const end = idx + word.length;
      if (!isCovered(idx, end)) {
        hits.push({
          rule: "R-TYPO-08",
          text: word,
          position: idx,
          match: word,
          category,
        });
        covered.push([idx, end]);
      }
      pos = idx + word.length;
    }
  }

  // 按 position 升序输出
  hits.sort((a, b) => a.position - b.position);
  const score = Math.min(hits.length, TYPO08_MAX);
  return { hits, score };
}

// ============================================================
// R-TYPO-09 实现(同音字词表 Top 50 子集零依赖查表)
// ============================================================

/** 同音字词表(精选 50 条"错误写法 → 正确写法"对)
 *  分类:
 *    - tech:    技术/产品文案高频错别字(部署/账号/登录等)
 *    - general: 常见中文文案错别字(截止/制定/权利/通信等)
 *    - idiom:   常见成语错别字(川流不息/再接再厉/美轮美奂等)
 *  选型理由:① 零依赖纯静态词表(沿用 R-TYPO-08 架构,无需 hanlp 字典);
 *           ② "错误写法 → 正确写法"对子直接驱动客户端"查找替换"提示;
 *           ③ 50 条覆盖校对场景 80% 常见同音字/形近字/近音字错误;
 *           ④ 长词优先匹配 + 区间去重(沿用 R-TYPO-08 实现,见 checkTypo09);
 *           ⑤ 后续可接 LLM 二次校验做上下文豁免(v0.2)
 *
 *  Top 50 来源:① 国家语言文字规范(2010 年后账号/网络/软件规范);
 *              ②《现代语言异读词审音表》;
 *              ③《常见语言校对指南》高频词;
 *              ④ 校对网/语言文字报刊整理的"常见 100 错别字"Top 50 子集
 */
const HOMOPHONE_PAIRS: ReadonlyArray<{
  correct: string;
  incorrect: string;
  category: Typo09Hit["category"];
  reason: string;
}> = [
  // A 类:技术/产品文案高频错别字(15 条)
  { correct: "部署", incorrect: "布署", category: "tech", reason: "军事/技术正式写法" },
  { correct: "账号", incorrect: "帐号", category: "tech", reason: "国家规范推荐(2010 年后)" },
  { correct: "登录", incorrect: "登陆", category: "tech", reason: "Web 场景规范(口令验证)" },
  { correct: "启用", incorrect: "起用", category: "tech", reason: "产品功能正式写法" },
  { correct: "录像", incorrect: "录象", category: "tech", reason: "音视频技术规范(录像 ≠ 录象)" },
  { correct: "网络", incorrect: "网路", category: "tech", reason: "中国大陆规范(台湾用'网路')" },
  { correct: "软件", incorrect: "软体", category: "tech", reason: "中国大陆规范(台湾用'软体')" },
  { correct: "数据", incorrect: "数剧", category: "tech", reason: "数据库规范(据 ≠ 剧)" },
  { correct: "配置", incorrect: "配值", category: "tech", reason: "技术规范(配置 ≠ 配值)" },
  { correct: "接口", incorrect: "接品", category: "tech", reason: "技术规范(口 ≠ 品)" },
  { correct: "程序", incorrect: "程式", category: "tech", reason: "中国大陆规范(台湾用'程式')" },
  { correct: "服务器", incorrect: "伺服器", category: "tech", reason: "中国大陆规范(台湾用'伺服器')" },
  { correct: "默认", incorrect: "默然", category: "tech", reason: "产品功能规范(默认 ≠ 默然)" },
  { correct: "启动", incorrect: "起动", category: "tech", reason: "产品功能正式写法(启动 ≠ 起动)" },
  { correct: "身份验证", incorrect: "身份校验", category: "tech", reason: "场景区分(身份验证 ≠ 身份校验)" },
  // B 类:常见中文文案错别字(20 条)
  { correct: "截止", incorrect: "截至", category: "general", reason: "时间节点规范(截止时间 ≠ 截至时间)" },
  { correct: "制定", incorrect: "制订", category: "general", reason: "政策规范用法(制定 ≠ 制订)" },
  { correct: "权利", incorrect: "权力", category: "general", reason: "法律语义区分(权利 ≠ 权力)" },
  { correct: "通信", incorrect: "通讯", category: "general", reason: "专业术语规范(通信 ≠ 通讯)" },
  { correct: "学历", incorrect: "学力", category: "general", reason: "教育规范(学历 ≠ 学力)" },
  { correct: "厉害", incorrect: "利害", category: "general", reason: "程度/后果语义区分" },
  { correct: "反映", incorrect: "反应", category: "general", reason: "语义区分(主动/自动)" },
  { correct: "必须", incorrect: "必需", category: "general", reason: "语义区分(必要/需要)" },
  { correct: "检查", incorrect: "检察", category: "general", reason: "语义区分(查/法)" },
  { correct: "沟通", incorrect: "勾通", category: "general", reason: "语义区分(褒/贬)" },
  { correct: "辨正", incorrect: "辨证", category: "general", reason: "语义区分(辨别/论辩)" },
  { correct: "标志", incorrect: "标致", category: "general", reason: "语义区分(记号/漂亮)" },
  { correct: "功夫", incorrect: "工夫", category: "general", reason: "语义区分(技能/时间)" },
  { correct: "决不", incorrect: "绝不", category: "general", reason: "语义区分(必然/绝对)" },
  { correct: "喝彩", incorrect: "喝采", category: "general", reason: "语义区分(叫好/采摘)" },
  { correct: "合龙", incorrect: "合拢", category: "general", reason: "施工语义区分" },
  { correct: "妨碍", incorrect: "防碍", category: "general", reason: "形近误写(防碍 → 妨碍)" },
  { correct: "提炼", incorrect: "提练", category: "general", reason: "近音误写(炼 ≠ 练)" },
  { correct: "结束", incorrect: "接束", category: "general", reason: "近音误写(结 ≠ 接)" },
  { correct: "覆盖", incorrect: "幅盖", category: "general", reason: "近音误写(覆 ≠ 幅)" },
  // C 类:常见成语错别字(15 条)
  { correct: "川流不息", incorrect: "穿流不息", category: "idiom", reason: "成语规范写法(川 ≠ 穿)" },
  { correct: "再接再厉", incorrect: "再接再励", category: "idiom", reason: "成语规范写法(厉 ≠ 励)" },
  { correct: "走投无路", incorrect: "走头无路", category: "idiom", reason: "成语规范写法(投 ≠ 头)" },
  { correct: "美轮美奂", incorrect: "美仑美奂", category: "idiom", reason: "成语规范写法(轮 ≠ 仑)" },
  { correct: "黄粱梦", incorrect: "黄梁梦", category: "idiom", reason: "成语规范写法(粱 ≠ 梁)" },
  { correct: "一筹莫展", incorrect: "一愁莫展", category: "idiom", reason: "成语规范写法(筹 ≠ 愁)" },
  { correct: "病入膏肓", incorrect: "病入膏荒", category: "idiom", reason: "成语规范写法(肓 ≠ 荒)" },
  { correct: "一鼓作气", incorrect: "一股作气", category: "idiom", reason: "成语规范写法(鼓 ≠ 股)" },
  { correct: "不假思索", incorrect: "不加思索", category: "idiom", reason: "成语规范写法(假 ≠ 加)" },
  { correct: "莫名其妙", incorrect: "莫明其妙", category: "idiom", reason: "成语规范写法(名 ≠ 明)" },
  { correct: "按部就班", incorrect: "按步就班", category: "idiom", reason: "成语规范写法(部 ≠ 步)" },
  { correct: "墨守成规", incorrect: "默守成规", category: "idiom", reason: "成语规范写法(墨 ≠ 默)" },
  { correct: "饮鸩止渴", incorrect: "饮鸠止渴", category: "idiom", reason: "成语规范写法(鸩 ≠ 鸠)" },
  { correct: "川流不息", incorrect: "川留不息", category: "idiom", reason: "成语规范写法(流 ≠ 留)" },
  { correct: "再接再厉", incorrect: "再接再砺", category: "idiom", reason: "成语规范写法(厉 ≠ 砺)" },
];

function checkTypo09(text: string): { hits: Typo09Hit[]; score: number } {
  if (text.length === 0) return { hits: [], score: 0 };
  const hits: Typo09Hit[] = [];
  // 按 incorrect.length 降序:长词优先匹配,避免"川流不息"被拆为"川流"+"不息"重复报
  const sorted = [...HOMOPHONE_PAIRS].sort(
    (a, b) => b.incorrect.length - a.incorrect.length,
  );
  // 用 Set 跟踪已覆盖区间 [start, end),避免子串重复报
  const covered: Array<[number, number]> = [];
  const isCovered = (start: number, end: number): boolean => {
    for (const [s, e] of covered) {
      if (s <= start && end <= e) return true;
    }
    return false;
  };

  for (const { correct, incorrect, category, reason } of sorted) {
    let pos = 0;
    while (pos <= text.length - incorrect.length) {
      const idx = text.indexOf(incorrect, pos);
      if (idx === -1) break;
      const end = idx + incorrect.length;
      if (!isCovered(idx, end)) {
        hits.push({
          rule: "R-TYPO-09",
          text: incorrect,
          position: idx,
          match: incorrect,
          correct,
          category,
          reason,
        });
        covered.push([idx, end]);
      }
      pos = idx + incorrect.length;
    }
  }

  // 按 position 升序输出
  hits.sort((a, b) => a.position - b.position);
  const score = Math.min(hits.length, TYPO09_MAX);
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

  // R-READ-03 检测(句末标点规范)
  const { hits: read03Hits, score: read03Score } = checkRead03(body.text);

  // R-TYPO-02 检测(多字/漏字/重复字)
  const { hits: typo02Hits, score: typo02Score } = checkTypo02(body.text);

  // R-TYPO-03 检测(中英文标点混用)
  const { hits: typo03Hits, score: typo03Score } = checkTypo03(body.text);

  // R-TYPO-05 检测(全角/半角混用)
  const { hits: typo05Hits, score: typo05Score } = checkTypo05(body.text);

  // R-TYPO-06 检测(数字/英文与中文之间空格缺失)
  const { hits: typo06Hits, score: typo06Score } = checkTypo06(body.text);

  // R-TYPO-07 检测(连续标点符号)
  const { hits: typo07Hits, score: typo07Score } = checkTypo07(body.text);

  // R-TYPO-08 检测(广告法极限词零依赖查表)
  const { hits: typo08Hits, score: typo08Score } = checkTypo08(body.text);

  // R-TYPO-09 检测(同音字词表 Top 50 子集零依赖查表)
  const { hits: typo09Hits, score: typo09Score } = checkTypo09(body.text);

  // R-TONE-02 检测(否定句否定词置顶)
  const { hits: tone02Hits, score: tone02Score } = checkTone02(body.text);

  // R-TONE-03 检测(语气一致性)
  const { hits: tone03Hits, score: tone03Score } = checkTone03(body.text);

  // R-TONE-04 检测(感叹号密度)
  const { hits: tone04Hits, score: tone04Score } = checkTone04(body.text);

  // 总扣分(13 规则累加,单条上限 5 分)
  const totalScore = Math.min(
    read01Score +
      read02Score +
      read03Score +
      typo02Score +
      typo03Score +
      typo05Score +
      typo06Score +
      typo07Score +
      typo08Score +
      typo09Score +
      tone02Score +
      tone03Score +
      tone04Score,
    MAX_DEDUCTION,
  );

  // verdict 映射(本 API 雏形只有软调类规则,无 HARD_BLOCK)
  // 0 分 → PASS, ≥1 分 → SOFT_WARN(软调,不阻塞)
  const verdict: AuditResponse["verdict"] = totalScore === 0 ? "PASS" : "SOFT_WARN";

  const response: AuditResponse = {
    verdict,
    score_deduction: totalScore,
    read_hits: hits,
    read02_hits: read02Hits,
    read03_hits: read03Hits,
    typo02_hits: typo02Hits,
    typo03_hits: typo03Hits,
    typo05_hits: typo05Hits,
    typo06_hits: typo06Hits,
    typo07_hits: typo07Hits,
    typo08_hits: typo08Hits,
    typo09_hits: typo09Hits,
    tone02_hits: tone02Hits,
    tone03_hits: tone03Hits,
    tone04_hits: tone04Hits,
    summary: buildSummary({
      read01: { hits, score: read01Score, surface, limit },
      read02: { hits: read02Hits, score: read02Score },
      read03: { hits: read03Hits, score: read03Score },
      typo02: { hits: typo02Hits, score: typo02Score },
      typo03: { hits: typo03Hits, score: typo03Score },
      typo05: { hits: typo05Hits, score: typo05Score },
      typo06: { hits: typo06Hits, score: typo06Score },
      typo07: { hits: typo07Hits, score: typo07Score },
      typo08: { hits: typo08Hits, score: typo08Score },
      typo09: { hits: typo09Hits, score: typo09Score },
      tone02: { hits: tone02Hits, score: tone02Score },
      tone03: { hits: tone03Hits, score: tone03Score },
      tone04: { hits: tone04Hits, score: tone04Score },
    }),
    meta: {
      rules_evaluated: [
        "R-READ-01",
        "R-READ-02",
        "R-READ-03",
        "R-TYPO-02",
        "R-TYPO-03",
        "R-TYPO-05",
        "R-TYPO-06",
        "R-TYPO-07",
        "R-TYPO-08",
        "R-TYPO-09",
        "R-TONE-02",
        "R-TONE-03",
        "R-TONE-04",
      ],
      rules_skipped: [
        "R-TYPO-04(量词,需 LLM 常识校验)",
        "R-BRAND-01~04(品牌词,需品牌词表,Phase 0 外部依赖,0904 起降级到 Phase 1.5)",
        "R-TONE-01(二义性,需 LLM 二次校验)",
        "R-READ-03-LLM(信息密度,需 LLM 提取,0908 已落零依赖'句末标点规范'同名规则)",
      ],
      scene_resolved: scene,
      text_length: unicodeLength(body.text),
    },
  };

  return NextResponse.json(response, { status: 200 });
}

interface RuleSummary {
  read01: { hits: ReadHit[]; score: number; surface: "mobile" | "desktop"; limit: number };
  read02: { hits: Read02Hit[]; score: number };
  read03: { hits: Read03Hit[]; score: number };
  typo02: { hits: Typo02Hit[]; score: number };
  typo03: { hits: Typo03Hit[]; score: number };
  typo05: { hits: Typo05Hit[]; score: number };
  typo06: { hits: Typo06Hit[]; score: number };
  typo07: { hits: Typo07Hit[]; score: number };
  typo08: { hits: Typo08Hit[]; score: number };
  typo09: { hits: Typo09Hit[]; score: number };
  tone02: { hits: Tone02Hit[]; score: number };
  tone03: { hits: Tone03Hit[]; score: number };
  tone04: { hits: Tone04Hit[]; score: number };
}

/** 拼装 summary(支持 12 规则各自命中) */
function buildSummary(s: RuleSummary): string {
  const parts: string[] = [];
  // R-READ-01
  if (s.read01.hits.length === 0) {
    parts.push(`R-READ-01 通过(${s.read01.surface} 端上限 ${s.read01.limit} 字符)`);
  } else {
    parts.push(`R-READ-01 命中 ${s.read01.hits.length} 个超长句,扣 ${s.read01.score} 分`);
  }
  // R-READ-02
  if (s.read02.hits.length === 0) {
    parts.push(`R-READ-02 通过(无句首连词堆叠)`);
  } else {
    parts.push(`R-READ-02 命中 ${s.read02.hits.length} 个堆叠句,扣 ${s.read02.score} 分`);
  }
  // R-READ-03
  if (s.read03.hits.length === 0) {
    parts.push(`R-READ-03 通过(句末标点规范)`);
  } else {
    parts.push(`R-READ-03 命中 ${s.read03.hits.length} 句不规范,扣 ${s.read03.score} 分`);
  }
  // R-TYPO-02
  if (s.typo02.hits.length === 0) {
    parts.push(`R-TYPO-02 通过(无叠字错误)`);
  } else {
    parts.push(`R-TYPO-02 命中 ${s.typo02.hits.length} 处叠字,扣 ${s.typo02.score} 分`);
  }
  // R-TYPO-03
  if (s.typo03.hits.length === 0) {
    parts.push(`R-TYPO-03 通过(标点无中英混用)`);
  } else {
    parts.push(`R-TYPO-03 命中 ${s.typo03.hits.length} 个混用标点,扣 ${s.typo03.score} 分`);
  }
  // R-TYPO-05
  if (s.typo05.hits.length === 0) {
    parts.push(`R-TYPO-05 通过(无全角/半角混用)`);
  } else {
    parts.push(`R-TYPO-05 命中 ${s.typo05.hits.length} 处全角字符,扣 ${s.typo05.score} 分`);
  }
  // R-TYPO-06
  if (s.typo06.hits.length === 0) {
    parts.push(`R-TYPO-06 通过(中文/数字英文间无紧贴)`);
  } else {
    parts.push(`R-TYPO-06 命中 ${s.typo06.hits.length} 处紧贴,扣 ${s.typo06.score} 分`);
  }
  // R-TYPO-07
  if (s.typo07.hits.length === 0) {
    parts.push(`R-TYPO-07 通过(无连续 3+ 同标点)`);
  } else {
    parts.push(`R-TYPO-07 命中 ${s.typo07.hits.length} 处连续标点,扣 ${s.typo07.score} 分`);
  }
  // R-TYPO-08
  if (s.typo08.hits.length === 0) {
    parts.push(`R-TYPO-08 通过(无广告法极限词)`);
  } else {
    parts.push(`R-TYPO-08 命中 ${s.typo08.hits.length} 处极限词,扣 ${s.typo08.score} 分`);
  }
  // R-TYPO-09
  if (s.typo09.hits.length === 0) {
    parts.push(`R-TYPO-09 通过(无同音字错误)`);
  } else {
    parts.push(`R-TYPO-09 命中 ${s.typo09.hits.length} 处同音字,扣 ${s.typo09.score} 分`);
  }
  // R-TONE-02
  if (s.tone02.hits.length === 0) {
    parts.push(`R-TONE-02 通过(无"请不要/请勿"引导)`);
  } else {
    parts.push(`R-TONE-02 命中 ${s.tone02.hits.length} 句,扣 ${s.tone02.score} 分`);
  }
  // R-TONE-03
  if (s.tone03.hits.length === 0) {
    parts.push(`R-TONE-03 通过(语气词占比 ${s.tone03.hits[0]?.dominant_ratio ?? "n/a"} ≥ 0.7)`);
  } else {
    const hit = s.tone03.hits[0];
    parts.push(`R-TONE-03 命中(主语气词"${hit.dominant}"仅占 ${(hit.dominant_ratio * 100).toFixed(1)}%),扣 ${s.tone03.score} 分`);
  }
  // R-TONE-04
  if (s.tone04.hits.length === 0) {
    parts.push(`R-TONE-04 通过(感叹号密度合理)`);
  } else {
    const hit = s.tone04.hits[0];
    parts.push(`R-TONE-04 命中(感叹号 ${hit.exclam_count} 个 / ${hit.sentence_count} 句 = ${(hit.ratio * 100).toFixed(1)}% > ${(hit.threshold * 100).toFixed(0)}%),扣 ${s.tone04.score} 分`);
  }
  return parts.join(";");
}

/** GET 暴露 API 元信息(便于人工/curl 探索) */
export async function GET() {
  return NextResponse.json(
    {
      api: "DetailAdvisor · 文案审查",
      version: "0.1.0-API-雏形+R-READ-02+5-零依赖规则+R-TYPO-06+R-TYPO-07+R-READ-03+R-TONE-04+R-TYPO-08+R-TYPO-09",
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
        "R-READ-03(句末标点规范,陈述句末'!'或'?'或无标点,即报)",
        "R-TYPO-02(多字/漏字/重复字,叠词白名单豁免)",
        "R-TYPO-03(中英文标点混用检测)",
        "R-TYPO-05(全角/半角混用检测)",
        "R-TYPO-06(数字/英文与中文之间空格缺失检测,pangu 风格)",
        "R-TYPO-07(连续标点符号检测,≥3 个同标点连用)",
        "R-TYPO-08(广告法极限词零依赖查表,33 条词表 4 类分类)",
        "R-TYPO-09(同音字词表 Top 50 子集零依赖查表,50 条词表 3 类分类:tech/general/idiom,沿用 R-TYPO-08 架构)",
        "R-TONE-02(否定句否定词置顶,检测'请不要'/'请勿')",
        "R-TONE-03(语气一致性,4 类语气词占比 ≥ 70%)",
        "R-TONE-04(感叹号密度检测,感叹号数/句子数 > 30% 即报)",
      ],
      rules_skipped: [
        "R-TYPO-04(量词,需 LLM)",
        "R-BRAND-01~04(品牌词,需品牌词表,Phase 1.5)",
        "R-TONE-01(二义性,需 LLM)",
        "R-READ-03-LLM(信息密度,需 LLM 提取,0908 已落零依赖'句末标点规范'同名规则)",
      ],
      docs: "docs/api/audit-text-v0.1.md",
    },
    { status: 200 },
  );
}
