/**
 * 文案审查 API · v0.1 API 雏形 + 增量 R-READ-02 + 增量 v0.1/v0.3 五规则 + 增量 R-TYPO-06
 *
 * Phase 1 §6 模块 1"上线文案审查器"启动 + 4 次增量
 * - 2026-09-02 T5 03:30:启动 commit,落 R-READ-01 句长上限
 * - 2026-09-03 T5 03:30:增量 R-READ-02 句首连词堆叠(零依赖,纯机检)
 * - 2026-09-04 T5 03:30:增量 v0.1 错别字 3 条 + v0.3 语气可读性 2 条(零依赖纯机检)
 *   - R-TYPO-02 多字/漏字/重复字(叠词白名单)
 *   - R-TYPO-03 标点符号错误(中英文混用)
 *   - R-TYPO-05 全角/半角混用
 *   - R-TONE-02 否定句否定词置顶
 *   - R-TONE-03 语气一致性
 * - 2026-09-05 T5 03:30:增量 R-TYPO-06 数字/英文与中文之间空格缺失(零依赖纯机检,7 → 8 规则)
 *
 * 当前已实现 8 条规则(均纯机检,零外部依赖):
 * - R-READ-01 句长上限(移动端 28 / 桌面端 40)
 * - R-READ-02 句首连词堆叠(≥2 个连词连用)
 * - R-TYPO-02 多字/漏字/重复字
 * - R-TYPO-03 中英文标点混用
 * - R-TYPO-05 全角/半角混用
 * - R-TYPO-06 数字/英文与中文之间空格缺失(pangu 风格)
 * - R-TONE-02 "请不要"/"请勿" 引导句式
 * - R-TONE-03 4 类语气词频次一致性
 *
 * 后续版本扩展:
 * - v0.1 API:R-TYPO-01 同音字(需 hanlp 字典)+ R-TYPO-04 量词(需 LLM)
 * - v0.2 API:R-BRAND-01~04 品牌词 4 条(品牌词表本身是外部依赖,Phase 0 外部依赖 0904 起降级到 Phase 1.5)
 * - v0.3 API:R-TONE-01 二义性(需 LLM 二次校验)+ R-READ-03 信息密度(需 LLM)
 *
 * 关联文档:
 * - 项目开发计划.md §3 模块 1 + §6 Phase 1 MVP
 * - docs/审查规则/v0.1_文案审查_错别字_敏感词.md §3 R-TYPO-02/03/05/06
 * - docs/审查规则/v0.3_文案审查_语气_可读性.md §3 R-TONE-02/03
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

interface AuditResponse {
  verdict: "PASS" | "SOFT_WARN" | "HARD_BLOCK";
  score_deduction: number;
  read_hits: ReadHit[];
  read02_hits: Read02Hit[];
  typo02_hits: Typo02Hit[];
  typo03_hits: Typo03Hit[];
  typo05_hits: Typo05Hit[];
  typo06_hits: Typo06Hit[];
  tone02_hits: Tone02Hit[];
  tone03_hits: Tone03Hit[];
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
const TYPO02_MAX = 3;
const TYPO03_MAX = 3;
const TYPO05_MAX = 3;
const TONE02_MAX = 2;
const TONE03_MAX = 2;
const TYPO06_MAX = 3;

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

  // R-TYPO-02 检测(多字/漏字/重复字)
  const { hits: typo02Hits, score: typo02Score } = checkTypo02(body.text);

  // R-TYPO-03 检测(中英文标点混用)
  const { hits: typo03Hits, score: typo03Score } = checkTypo03(body.text);

  // R-TYPO-05 检测(全角/半角混用)
  const { hits: typo05Hits, score: typo05Score } = checkTypo05(body.text);

  // R-TYPO-06 检测(数字/英文与中文之间空格缺失)
  const { hits: typo06Hits, score: typo06Score } = checkTypo06(body.text);

  // R-TONE-02 检测(否定句否定词置顶)
  const { hits: tone02Hits, score: tone02Score } = checkTone02(body.text);

  // R-TONE-03 检测(语气一致性)
  const { hits: tone03Hits, score: tone03Score } = checkTone03(body.text);

  // 总扣分(8 规则累加,单条上限 5 分)
  const totalScore = Math.min(
    read01Score +
      read02Score +
      typo02Score +
      typo03Score +
      typo05Score +
      typo06Score +
      tone02Score +
      tone03Score,
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
    typo02_hits: typo02Hits,
    typo03_hits: typo03Hits,
    typo05_hits: typo05Hits,
    typo06_hits: typo06Hits,
    tone02_hits: tone02Hits,
    tone03_hits: tone03Hits,
    summary: buildSummary({
      read01: { hits, score: read01Score, surface, limit },
      read02: { hits: read02Hits, score: read02Score },
      typo02: { hits: typo02Hits, score: typo02Score },
      typo03: { hits: typo03Hits, score: typo03Score },
      typo05: { hits: typo05Hits, score: typo05Score },
      typo06: { hits: typo06Hits, score: typo06Score },
      tone02: { hits: tone02Hits, score: tone02Score },
      tone03: { hits: tone03Hits, score: tone03Score },
    }),
    meta: {
      rules_evaluated: [
        "R-READ-01",
        "R-READ-02",
        "R-TYPO-02",
        "R-TYPO-03",
        "R-TYPO-05",
        "R-TYPO-06",
        "R-TONE-02",
        "R-TONE-03",
      ],
      rules_skipped: [
        "R-TYPO-01(同音字,需 hanlp 字典)",
        "R-TYPO-04(量词,需 LLM 常识校验)",
        "R-BRAND-01~04(品牌词,需品牌词表,Phase 0 外部依赖,0904 起降级到 Phase 1.5)",
        "R-TONE-01(二义性,需 LLM 二次校验)",
        "R-READ-03(信息密度,需 LLM 提取)",
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
  typo02: { hits: Typo02Hit[]; score: number };
  typo03: { hits: Typo03Hit[]; score: number };
  typo05: { hits: Typo05Hit[]; score: number };
  typo06: { hits: Typo06Hit[]; score: number };
  tone02: { hits: Tone02Hit[]; score: number };
  tone03: { hits: Tone03Hit[]; score: number };
}

/** 拼装 summary(支持 7 规则各自命中) */
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
  return parts.join(";");
}

/** GET 暴露 API 元信息(便于人工/curl 探索) */
export async function GET() {
  return NextResponse.json(
    {
      api: "DetailAdvisor · 文案审查",
      version: "0.1.0-API-雏形+R-READ-02+5-零依赖规则+R-TYPO-06",
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
        "R-TYPO-02(多字/漏字/重复字,叠词白名单豁免)",
        "R-TYPO-03(中英文标点混用检测)",
        "R-TYPO-05(全角/半角混用检测)",
        "R-TYPO-06(数字/英文与中文之间空格缺失检测,pangu 风格)",
        "R-TONE-02(否定句否定词置顶,检测'请不要'/'请勿')",
        "R-TONE-03(语气一致性,4 类语气词占比 ≥ 70%)",
      ],
      rules_skipped: [
        "R-TYPO-01(同音字,需 hanlp 字典)",
        "R-TYPO-04(量词,需 LLM)",
        "R-BRAND-01~04(品牌词,需品牌词表,Phase 1.5)",
        "R-TONE-01(二义性,需 LLM)",
        "R-READ-03(信息密度,需 LLM)",
      ],
      docs: "docs/api/audit-text-v0.1.md",
    },
    { status: 200 },
  );
}
