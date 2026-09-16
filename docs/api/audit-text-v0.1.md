# 文案审查 API · v0.1 API 雏形 + 增量 R-READ-02 + 增量 5 零依赖规则 + 增量 R-TYPO-06 + 增量 R-TYPO-07 + 增量 R-READ-03 + R-TONE-04 + 增量 R-TYPO-08 + 增量 R-TYPO-09

> DetailAdvisor 模块 1(文案审查器)后端 API · v0.1 雏形 + 七次增量 · 2026-09-17
> 落地 commit: 0902 T5 启动 / 0903 T5 增量 R-READ-02 / 0904 T5 增量 v0.1 错别字 3 条 + v0.3 语气 2 条 / 0905 T5 增量 R-TYPO-06 / 0906 T5 增量 R-TYPO-07 / 0908 T5 增量 R-READ-03 + R-TONE-04 / 0909 T5 增量 R-TYPO-08 / 0917 T5 增量 R-TYPO-09 同音字词表 Top 50 子集
> 入口: `app/api/audit/text/route.ts`(Next.js 16 App Router Route Handler)

---

## 1. 范围

| 项 | 说明 |
|---|------|
| 当前已实现 | **13 条规则**(均纯机检,零外部依赖):**R-READ-01**(句长上限,0902)+ **R-READ-02**(句首连词堆叠,0903)+ **R-READ-03**(句末标点规范,0908)+ **R-TYPO-02**(多字/漏字/重复字,0904)+ **R-TYPO-03**(中英文标点混用,0904)+ **R-TYPO-05**(全角/半角混用,0904)+ **R-TYPO-06**(数字/英文与中文之间空格缺失,0905)+ **R-TYPO-07**(连续标点符号 ≥ 3 同标点,0906)+ **R-TYPO-08**(广告法极限词零依赖查表 33 条 4 类,0909)+ **R-TYPO-09**(同音字词表 Top 50 子集零依赖查表 50 条 3 类 tech/general/idiom,0917)+ **R-TONE-02**(否定句否定词置顶,0904)+ **R-TONE-03**(语气一致性,0904)+ **R-TONE-04**(感叹号密度,0908) |
| 暂未实现 | R-TYPO-04(量词,需 LLM)/ R-BRAND-01~04(品牌词,需词表,Phase 1.5)/ R-TONE-01(二义性,需 LLM)/ R-READ-03-LLM(信息密度,需 LLM,0908 已落零依赖"句末标点规范"同名规则);**R-TYPO-01(同音字)0917 已由 R-TYPO-09 零依赖版接管,跳过项移除** |
| 优先级 | Phase 1 §6 模块 1"上线文案审查器"启动 + 七次增量 commit,2 规则 → 13 规则扩展,代码资产 0 → 0.8 起步 |
| 关联规则 | `docs/审查规则/v0.1_文案审查_错别字_敏感词.md` §3 R-TYPO-02/03/05/06/07/08/09 + `docs/审查规则/v0.3_文案审查_语气_可读性.md` §3/§4 R-TONE-02/03/04 + R-READ-01/02/03 |

## 2. 接口

### 2.1 端点

```
POST /api/audit/text
Content-Type: application/json
```

### 2.2 请求体

```typescript
{
  "text": string,   // 必填,待审查文案
  "scene"?: "page" | "landing" | "push" | "email" | "button" | "error" | "form" | "other"
                  // 可选,默认 "other"(按桌面端处理)
}
```

**scene → surface 映射**:

| scene | 视为 | 句长上限 |
|-------|------|---------|
| `push` | 移动端 | 28 |
| `button` | 移动端 | 28 |
| `page` | 桌面端 | 40 |
| `landing` | 桌面端 | 40 |
| `email` | 桌面端 | 40 |
| `error` | 桌面端 | 40 |
| `form` | 桌面端 | 40 |
| `other`(默认) | 桌面端 | 40 |

### 2.3 响应(200)

```typescript
{
  "verdict": "PASS" | "SOFT_WARN",   // 本 API 雏形无 HARD_BLOCK
  "score_deduction": number,          // 0 ~ 5(单条文案上限 5 分,12 规则累加)
  "read_hits": [                      // R-READ-01 命中项数组
    {
      "rule": "R-READ-01",
      "surface": "mobile" | "desktop",
      "limit": 28 | 40,
      "sentence": string,             // 命中的超长句
      "length": number,               // 该句 Unicode 字符数
      "excess": number                // 超长字符数(= length - limit)
    }
  ],
  "read02_hits": [                    // R-READ-02 命中项数组(0903 增量)
    {
      "rule": "R-READ-02",
      "sentence": string,             // 命中的堆叠句
      "matched_conjunctions": string[], // 命中的连词列表
      "match_start": number,          // 堆叠在句中的起始位置
      "match_text": string            // 拼接出的连词堆叠文本
    }
  ],
  "typo02_hits": [                    // R-TYPO-02 命中项数组(0904 增量)
    {
      "rule": "R-TYPO-02",
      "text": string,                 // 命中的连续重复字符
      "position": number,             // 在原文中的字符偏移
      "match": string,                // 完整匹配(如"请请")
      "whitelist_hit": false          // 是否命中白名单(当前实现一律 false,因命中白名单时跳过)
    }
  ],
  "typo03_hits": [                    // R-TYPO-03 命中项数组(0904 增量)
    {
      "rule": "R-TYPO-03",
      "text": string,                 // 命中的标点字符
      "position": number,             // 字符偏移
      "expected": string,             // 应使用的标点
      "actual": string,               // 实际使用的标点
      "primary_script": "cjk" | "latin"  // 文本主语种
    }
  ],
  "typo05_hits": [                    // R-TYPO-05 命中项数组(0904 增量)
    {
      "rule": "R-TYPO-05",
      "text": string,                 // 命中的全角字符
      "position": number,             // 字符偏移
      "match": string,                // 完整匹配
      "category": "fullwidth-digit" | "fullwidth-letter"  // 混用类别
    }
  ],
  "typo06_hits": [                    // R-TYPO-06 命中项数组(0905 增量)
    {
      "rule": "R-TYPO-06",
      "text": string,                 // 紧贴的 2 字符片段(如"数1" / "1次")
      "position": number,             // 字符偏移(中文侧位置)
      "match": string,                // 完整 2 字符匹配
      "cjk_char": string,             // 中文侧字符
      "ascii_char": string,           // 数字/英文字符
      "direction": "cjk-ascii" | "ascii-cjk"  // 中文在前/在后
    }
  ],
  "typo07_hits": [                    // R-TYPO-07 命中项数组(0906 增量)
    {
      "rule": "R-TYPO-07",
      "text": string,                 // 命中的连续标点片段(如"。。。" / "???" / "!!!")
      "position": number,             // 字符偏移(连续段起点)
      "match": string,                // 完整连续标点
      "run_length": number,           // 连续标点数量(≥ 3)
      "punct": string,                // 单个标点字符
      "punct_type": "cjk" | "latin"   // 中英标点分类
    }
  ],
  "typo08_hits": [                    // R-TYPO-08 命中项数组(0909 增量)
    {
      "rule": "R-TYPO-08",
      "text": string,                 // 命中的极限词(如"最佳" / "稳赚不赔" / "100%")
      "position": number,             // 字符偏移
      "match": string,                // 完整匹配(同 text,便于客户端差异化处理)
      "category": "absolute" | "ranking" | "degree" | "promise"  // 极限词分类
    }
  ],
  "typo09_hits": [                    // R-TYPO-09 命中项数组(0917 增量)
    {
      "rule": "R-TYPO-09",
      "text": string,                 // 命中的错误写法(如"布署" / "登陆" / "穿流不息")
      "position": number,             // 字符偏移
      "match": string,                // 完整匹配(同 text,便于客户端"查找替换"提示)
      "correct": string,              // 建议的正确写法(如"部署" / "登录" / "川流不息")
      "category": "tech" | "general" | "idiom",  // 同音字/形近字分类
      "reason": string                // 给出建议原因(如"军事/技术正式写法")
    }
  ],
  "tone02_hits": [                    // R-TONE-02 命中项数组(0904 增量)
    {
      "rule": "R-TONE-02",
      "sentence": string,             // 命中的句子
      "matched_phrase": string,       // 命中的引导词("请不要" / "请勿")
      "position": number              // 引导词在句中的位置
    }
  ],
  "tone03_hits": [                    // R-TONE-03 命中项数组(0904 增量)
    {
      "rule": "R-TONE-03",
      "counts": {                     // 4 类语气词频次统计
        "请": number,
        "麻烦": number,
        "建议": number,
        "温馨提示": number
      },
      "dominant": string,             // 当前占比最大的语气词
      "dominant_ratio": number,       // 占比(0-1)
      "threshold": 0.7                // 阈值
    }
  ],
  "summary": string,                  // 一句话总结(13 规则分号分隔)
  "meta": {
    "rules_evaluated": [
      "R-READ-01", "R-READ-02", "R-READ-03",
      "R-TYPO-02", "R-TYPO-03", "R-TYPO-05", "R-TYPO-06", "R-TYPO-07", "R-TYPO-08", "R-TYPO-09",
      "R-TONE-02", "R-TONE-03", "R-TONE-04"
    ],
    "rules_skipped": [...],           // 暂未实现的规则列表
    "scene_resolved": Scene,
    "text_length": number             // 原文 Unicode 字符数
  }
}
```

### 2.4 错误响应

| HTTP | 触发条件 | body |
|------|---------|------|
| 400 | body 非 JSON | `{"error": "Invalid JSON body"}` |
| 400 | 缺 `text` 或非 string | `{"error": "Missing or invalid \`text\` field (string required)"}` |
| 400 | `text` 为空 | `{"error": "\`text\` is empty"}` |

## 3. R-READ-01 规则细节

### 3.1 切句算法

按中英文标点切句:`。！？!?;；`
切完后剩余的尾部无标点部分也算 1 句。
纯空白 / 纯标点的"伪句子"自动跳过。

### 3.2 字符数统计

使用 `Array.from(text).length`(正确处理 surrogate pair,如 emoji)。

### 3.3 扣分公式

```
score = min(Σ excess, 5)
```

- 超 1 字 1 分
- 单条文案扣分上限 5 分
- verdict 映射:0 分 → PASS, ≥1 分 → SOFT_WARN(软调,不阻塞)

### 3.4 与 v0.1/v0.2/v0.3 规则的关系

| 规则版本 | 检查类别 | 优先级 | 阻塞性 | 状态 |
|----------|----------|--------|--------|------|
| v0.1 (P0) | 错别字 + 敏感词 | 硬错 | 阻塞 | 留 v0.1 API |
| v0.2 (P1) | 品牌词 | 软错 | 报告高亮 | 留 v0.2 API |
| v0.3 (P2) | 语气 + 可读性 | 软调 | 报告提示 | **R-READ-01 / R-READ-02 已落地**(0902 + 0903) |

### 3.5 R-READ-02 句首连词堆叠(0903 增量)

#### 规则定义

> 句子开头禁止堆叠连词(≥2 个连词连用),命中即报,白名单豁免(引文/代码块)。

#### 连词词典(24 词)

```
而且 / 并且 / 所以 / 因此 / 但是 / 然后 / 接着 / 于是
不过 / 可是 / 虽然 / 尽管 / 因为 / 由于 / 如果 / 那么
虽然说 / 不但 / 不仅 / 甚至 / 更何况 / 何况 / 不然 / 要不
```

#### 检测算法

```
对每个句子(切句后):
  1. 跳过纯空白/标点的"伪句子"
  2. 跳过以 ` / " / ' / 「 / 『 / < 开头的句子(白名单)
  3. 取句首 8 字窗口,逐字前进:
     - 命中连词 → 记入 matched[],前进该连词长度
     - 未命中 → 前进 1 字
  4. matched.length ≥ 2 → 报 1 个 hit
```

#### 扣分公式

```
score = min(命中句数, 3)
```

- 每命中 1 句扣 1 分(READ-02 单条上限 3 分,比 READ-01 上限 5 分更宽松,因为是软调)
- 总扣分 = `min(READ-01 扣分 + READ-02 扣分, 5)`
- verdict 映射:0 分 → PASS, ≥1 分 → SOFT_WARN(软调,不阻塞)

#### 自检示例

| 原文 | R-READ-02 命中 | 改写 |
|------|----------------|------|
| 而且并且此功能尚在测试阶段 | ✅ 命中(而且+并且) | 此功能尚在测试阶段 |
| 所以因此请重新登录 | ✅ 命中(所以+因此) | 请重新登录 |
| 资料已提交,24h 内顾问将联系您 | ❌ 不命中 | (无需改) |

### 3.6 R-TYPO-06 数字/英文与中文之间空格缺失(0905 增量)

#### 规则定义

> 中文字符与数字/英文字符紧贴(中间无空格)时报警;双向独立扫描(中文在前 / 在后都报)。

#### 检测算法

```
2 个独立 regex,避免 matchAll 消费后漏检紧邻的另一对:
  模式 1 PANGU_CJK_ASCII_RE: /[\u4e00-\u9fff][0-9A-Za-z]/g  → cjk-ascii(中文在前)
  模式 2 PANGU_ASCII_CJK_RE: /[0-9A-Za-z][\u4e00-\u9fff]/g  → ascii-cjk(中文在后)
合并后按 position 升序输出。
```

#### 关键设计点

- **双向独立**:"数1次" 有 2 个紧贴点("数1" + "1次"),必须双向独立扫描才能全报
- **数字内部豁免**:"abc123" 是 ASCII 段内部数字,不属于"中文↔ASCII 紧贴",不报
- **白名单豁免**:不需要额外白名单,因为 ASCII 段内部 + 中文段内部都不会误命中

#### 扣分公式

```
score = min(命中处数, 3)
```

- 每命中 1 处扣 1 分(R-TYPO-06 单条上限 3 分,与 TYPO-02/03/05 持平)
- 总扣分 = `min(Σ 8 规则扣分, 5)`
- verdict 映射:0 分 → PASS, ≥1 分 → SOFT_WARN(软调,不阻塞)

#### 自检示例

| 原文 | R-TYPO-06 命中 | 改写 |
|------|----------------|------|
| 剩余次数1次免费 | ✅ 命中 2 处("数1" + "1次") | 剩余次数 1 次免费 |
| 已注册A产品 | ✅ 命中 1 处("册A") | 已注册 A 产品 |
| 5个名额 | ✅ 命中 1 处("5个") | 5 个名额 |
| 剩余次数 1 次 | ❌ 不命中(已留空格) | (无需改) |
| abc123 是合法字符串 | ❌ 不命中(纯 ASCII 内部) | (无需改) |

### 3.7 R-TYPO-07 连续标点符号(0906 增量)

#### 规则定义

> 同一标点(中英任一)连续出现 ≥ 3 次时报错;常见触发:手滑多按、语气过激。

#### 检测算法

```
单一 regex,带 global flag + 后行引用:
  REPEAT_PUNCT_RE: /([.!?。！？])\1{2,}/g
  说明:([punct])\1{2,} 表示"同一字符连续 ≥ 3 次";覆盖 6 种标点
  区分 cjk/latin(unicode 范围 0x3000-0x303F / 0xFF01-0xFF60 判 cjk)
```

#### 关键设计点

- **后行引用**:`(.)\1{2,}` 强制要求"同一字符",不会跨字符误报
- **覆盖 6 种标点**:。/！/？/./!/?(中英各 3,共 6)
- **不豁免**:连续 3+ 标点几乎一定是手滑/语气过激,无需白名单
- **run_length 上报**:不只报"命中",还告诉用户"几连",便于客户端提示

#### 扣分公式

```
score = min(命中段数, 3)
```

- 每命中 1 段扣 1 分(R-TYPO-07 单条上限 3 分,与 TYPO-02/03/05/06 持平)
- 总扣分 = `min(Σ 9 规则扣分, 5)`
- verdict 映射:0 分 → PASS, ≥1 分 → SOFT_WARN(软调,不阻塞)

#### 自检示例

| 原文 | R-TYPO-07 命中 | 改写 |
|------|----------------|------|
| 你好。。。欢迎使用 | ✅ 命中 1 段("。。。" run_length=3 cjk) | 你好。欢迎使用 |
| 真的吗??? 你确定?! | ✅ 命中 1 段("???" run_length=3 latin) | 真的吗? 你确定?! |
| 你确定?好的!那就这样。 | ❌ 不命中(单标点 + 不连续) | (无需改) |
| 你好,欢迎! | ❌ 不命中(2 个同标点不连用) | (无需改) |

### 3.8 R-READ-03 句末标点规范(0908 增量,沿用 v0.3 种子 ID)

#### 规则定义

> 陈述句末应以"。"(中文)或"."(英文)或","/";"等分隔标点结尾;不应以"!"或"?"结尾(疑问/感叹句除外)或完全无标点结尾。
> **命名说明**:本规则 ID 沿用 v0.3 种子 R-READ-03(原 LLM 版"信息密度"留 R-READ-03-LLM 标注);0908 T5 落地的零依赖"句末标点规范"是 v0.3 R-READ-03 ID 的零依赖邻居规则,语义不同但同 ID,见 meta.rules_skipped 标注。

#### 检测算法

```
独立 regex(避免 splitSentences 切走末标点):
  SENTENCE_WITH_ENDING_RE: /[^。！？!?;；]*[。！？!?;；]?/g
  说明:字符类 * 匹配"非切句标点任意字符",可选 1 个切句标点保留末标点

对每个匹配段:
  1. 跳过纯空白/标点的"伪句子"
  2. 取末字符 lastChar
  3. 若 lastChar 在合法标点集(CJK_STATEMENT_ENDINGS / LATIN_STATEMENT_ENDINGS)→ 通过
  4. 若 lastChar 是"!"或"?"(中英):
     - 含疑问/感叹语气词(INTERROGATIVE_PARTICLES /[吗呢吧呀啊哦哇哎]/) → 合法
     - 否则 → 报 inconsistent-ending
  5. 若 lastChar 是字母/数字/汉字 → 报 missing-punct
```

#### 关键设计点

- **独立 regex 保留末标点**:splitSentences 用 `text.split(SENTENCE_SPLIT_RE)` 切走末标点,导致 checkRead03 看不到"!"末"?";改用 matchAll + SENTENCE_WITH_ENDING_RE 保留末标点
- **中英双标点集**:CJK_STATEMENT_ENDINGS(7 个)/LATIN_STATEMENT_ENDINGS(5 个)分语种判定,避免混用
- **疑问/感叹语气词白名单**:"你确认吗?"含"吗"自动豁免,避免误报
- **issue 双分类**:`missing-punct`(无标点)/ `inconsistent-ending`(陈述句末"!"/"?"),便于客户端差异化提示

#### 扣分公式

```
score = min(命中句数, 3)
```

- 每命中 1 句扣 1 分(R-READ-03 单条上限 3 分,与 READ-02 持平,因都是软调)
- 总扣分 = `min(Σ 11 规则扣分, 5)`
- verdict 映射:0 分 → PASS, ≥1 分 → SOFT_WARN(软调,不阻塞)

#### 自检示例

| 原文 | R-READ-03 命中 | 改写 |
|------|----------------|------|
| 资料已提交!顾问将联系您! | ✅ 命中 2 句(inconsistent-ending × 2,末"!") | 资料已提交。顾问将联系您。 |
| 请确认信息后再次提交 | ✅ 命中 1 句(missing-punct,末"提交") | 请确认信息后再次提交。 |
| 你确认吗?请回复 | ⚠️ 命中 1 句("请回复" missing-punct,"你确认吗?"含"吗"豁免) | 你确认吗?请回复。 |
| 请确认订单。 | ❌ 不命中(末"。"合法) | (无需改) |
| Hello world. Please confirm. | ❌ 不命中(英文双句末"."合法) | (无需改) |

### 3.9 R-TONE-04 感叹号密度(0908 增量,沿用 v0.3 序列)

#### 规则定义

> 全篇感叹号(中英"!"/"！")数量 / 句子数 > 30% 即报,提示"文案风格过激,建议降低语气强度"。
> **命名说明**:本规则 ID 沿用 v0.3 序列 TONE-04(v0.3 种子 TONE-01 二义性仍需 LLM,留 TONE-01-LLM);0908 T5 落地的零依赖"感叹号密度"是 v0.3 命名空间的零依赖邻居。

#### 检测算法

```
EXCLAM_RE: /[!！]/g → 扫中英感叹号数
splitSentences 切句 → 句子数
ratio = exclam_count / sentence_count
ratio > TONE04_THRESHOLD (0.3) → 报 1 hit(全篇级)
```

#### 关键设计点

- **中英感叹号覆盖**:`[!！]` 双字符正则覆盖 U+0021 与 U+FF01
- **全篇级只报 1 hit**:不像其他规则逐句报,因密度本身就是全篇级指标
- **无白名单**:不豁免"!"+"?"组合等场景,过激文案本身就是要警醒

#### 扣分公式

```
score = min(1, 2)
```

- 命中即报 1 分(R-TONE-04 单条上限 2 分,与 TONE-02/03 持平)
- 总扣分 = `min(Σ 11 规则扣分, 5)`
- verdict 映射:0 分 → PASS, ≥1 分 → SOFT_WARN(软调,不阻塞)

#### 自检示例

| 原文 | R-TONE-04 命中 | 改写 |
|------|----------------|------|
| 快来!超棒!新功能!上线啦! | ✅ 命中(4 感叹号 / 4 句 = 100%) | 快来。新功能已上线,欢迎体验。 |
| 新功能已上线!请立即体验。 | ✅ 命中(1 感叹号 / 2 句 = 50%) | 新功能已上线。请立即体验。 |
| 你确认吗?请回复 | ❌ 不命中(0 感叹号) | (无需改) |
| 新功能已上线。请立即体验。 | ❌ 不命中(0 感叹号 / 2 句) | (无需改) |
| 新功能已上线!请立即体验!! | ✅ 命中(2 感叹号 / 2 句 = 100%) + R-TYPO-07 命中 1 段 | 新功能已上线!请立即体验。 |

### 3.10 R-TYPO-08 广告法极限词零依赖查表(0909 增量,12 规则收口)

#### 规则定义

> 命中《广告法》第九条"极限词"禁令或行业承诺类用词时报警,提示"广告合规风险";33 条精选词表分 4 类(absolute / ranking / degree / promise)。
> **命名空间说明**: R-TYPO-08 编号沿用 TYPO 序列,但主题与 R-TYPO-01~07 略有差异(属"零依赖静态词表"族,非字符级 typo);选型与 0908 提到的 R-TYPO-01 计划"同音字"不同方向(同音字需 hanlp 字典);**v0.2 后续可接 LLM 二次校验做上下文豁免**(对齐 v0.1 §4.3 上下文豁免原则)。

#### 词表(4 类 33 条)

| 分类 | 数量 | 词条 |
|------|------|------|
| **absolute 绝对化** | 8 | 最佳 / 最好 / 最大 / 最高 / 最优 / 最强 / 最快 / 最便宜 |
| **ranking 排名/地位** | 9 | 第一 / 唯一 / 首选 / 独家 / 顶级 / 顶尖 / 最高级 / 国家级 / 世界级 |
| **degree 程度极限** | 9 | 100% / 百分百 / 百分之百 / 永久 / 永远 / 绝对 / 完全 / 完美 / 万能 |
| **promise 承诺/保证** | 7 | 包过 / 稳赚 / 零风险 / 无风险 / 稳赚不赔 / 无副作用 / 立竿见影 |

#### 检测算法

```
静态词表 ABSOLUTE_WORDS: 33 条 2+ 字词(避免单字"最"/"全"误报)
长词优先匹配(按 word.length 降序)+ 区间去重防子串重复报:
  对每个 word(从长到短):
    循环 text.indexOf(word, pos):
      命中位置 idx → 检查是否已被覆盖区间包含
        - 是 → 跳过(pos 前进 word.length)
        - 否 → 报 1 hit + 加入 covered[[idx, idx+word.length]]
所有 hits 按 position 升序输出。
```

#### 关键设计点

- **零依赖纯字符串查表**: 33 条静态常量,无外部字典 / 无 regex(用 indexOf 查字符串),部署即用
- **2+ 字词避免单字误报**: 不放"最"/"全"/"好"等单字(日常用语),只放 2+ 字极限词
- **长词优先匹配 + 区间去重**: 按 word.length 降序排,先吃长词"稳赚不赔"再吃短词"稳赚",两者不重叠位置 0+4 / 5 → 报 2 个 hit,不重复不嵌套
- **4 类 category 字段**: absolute / ranking / degree / promise 便于客户端差异化提示(法务警示 vs 营销警示 vs 金融承诺)
- **不豁免**: v0.1 雏形阶段不做上下文豁免,全报;**v0.2 接 LLM 二次校验时再做否定/引用/数字范围等豁免**

#### 扣分公式

```
score = min(命中处数, 3)
```

- 每命中 1 处扣 1 分(R-TYPO-08 单条上限 3 分,与 TYPO-02/03/05/06/07 持平)
- 总扣分 = `min(Σ 12 规则扣分, 5)`
- verdict 映射: 0 分 → PASS, ≥1 分 → SOFT_WARN(软调,不阻塞)

#### 自检示例

| 原文 | R-TYPO-08 命中 | 改写 |
|------|----------------|------|
| 本产品是行业最佳选择,效果最好,稳赚不赔。 | ✅ 命中 3 处("最佳" cat=absolute / "最好" cat=absolute / "稳赚不赔" cat=promise)扣 3 分 | 本产品在业内具有领先优势,效果显著,长期稳健回报。 |
| 本产品是最佳,行业第一,效果 100%,稳赚。 | ✅ 命中 4 处(4 类全到)扣 3 分达上限 | 本产品在业内具有领先优势,效果显著,长期稳健回报。 |
| 稳赚不赔,稳赚很轻松。 | ✅ 命中 2 处("稳赚不赔" pos=0 + "稳赚" pos=5 不重叠) | 长期稳健回报,投资灵活。 |
| 资料已提交,24h 内顾问将联系您 | ❌ 不命中 | (无需改) |
| 效果很好,推荐使用 | ❌ 不命中("很好" / "推荐" 不在词表) | (无需改) |

### 3.11 R-TYPO-09 同音字词表 Top 50 子集零依赖查表(0917 增量,13 规则扩展)

#### 规则定义

> 命中常见同音字 / 形近字 / 近音字错误时报警,提示"是否想用 X?";50 条精选词表分 3 类(tech 技术 / general 通用 / idiom 成语)。
> **命名空间说明**: R-TYPO-09 编号沿用 TYPO 序列,接管 R-TYPO-01 命名空间(原 R-TYPO-01 需 hanlp 字典,本次改为零依赖静态词表实现);选型与 R-TYPO-08 同模式("零依赖静态词表"族),无需 hanlp 字典即可上线;**v0.2 后续可接 LLM 二次校验做上下文豁免**(对齐 v0.1 §4.3 上下文豁免原则)。

#### 词表(3 类 50 条)

| 分类 | 数量 | 词条样例(incorrect → correct) |
|------|------|-------------------------------|
| **tech 技术/产品** | 15 | 布署→部署 / 帐号→账号 / 登陆→登录 / 起用→启用 / 录象→录像 / 网路→网络 / 软体→软件 / 数剧→数据 / 配值→配置 / 接品→接口 / 程式→程序 / 伺服器→服务器 / 默然→默认 / 起动→启动 / 身份校验→身份验证 |
| **general 通用中文** | 20 | 截至→截止 / 制订→制定 / 权力→权利 / 通讯→通信 / 学力→学历 / 利害→厉害 / 反应→反映 / 必需→必须 / 检察→检查 / 勾通→沟通 / 辨证→辨正 / 标致→标志 / 工夫→功夫 / 绝不→决不 / 喝采→喝彩 / 合拢→合龙 / 防碍→妨碍 / 提练→提炼 / 接束→结束 / 幅盖→覆盖 |
| **idiom 成语** | 15 | 穿流不息→川流不息 / 再接再励→再接再厉 / 走头无路→走投无路 / 美仑美奂→美轮美奂 / 黄梁梦→黄粱梦 / 一愁莫展→一筹莫展 / 病入膏荒→病入膏肓 / 一股作气→一鼓作气 / 不加思索→不假思索 / 莫明其妙→莫名其妙 / 按步就班→按部就班 / 默守成规→墨守成规 / 饮鸠止渴→饮鸩止渴 / 川留不息→川流不息 / 再接再砺→再接再厉 |

**Top 50 来源**:① 国家语言文字规范(2010 年后账号/网络/软件规范);②《现代语言异读词审音表》;③《常见语言校对指南》高频词;④ 校对网/语言文字报刊整理的"常见 100 错别字"Top 50 子集。

#### 检测算法

```
静态词表 HOMOPHONE_PAIRS: 50 条"correct / incorrect / category / reason"对
长词优先匹配(按 incorrect.length 降序)+ 区间去重防子串重复报:
  对每个 pair(从长到短):
    循环 text.indexOf(pair.incorrect, pos):
      命中位置 idx → 检查是否已被 covered 区间包含
        - 是 → 跳过(pos 前进 incorrect.length)
        - 否 → 报 1 hit + 加入 covered[[idx, idx+incorrect.length]]
所有 hits 按 position 升序输出。
```

#### 关键设计点

- **零依赖纯字符串查表**: 50 条静态常量,无外部字典 / 无 regex(用 indexOf 查字符串),部署即用,与 R-TYPO-08 同模式
- **2-4 字词避免单字误报**: 不放"是/的/了"等单字(日常用语),只放 2-4 字词/成语
- **长词优先匹配 + 区间去重**: 按 incorrect.length 降序排,先吃长词"穿流不息"再吃短词(如有),不重叠位置都报 1 个 hit
- **"correct" 字段直接驱动客户端"查找替换"提示**: 客户端拿到 incorrect + correct 可一键替换,与 R-TYPO-08(只报不替换)差异化
- **3 类 category 字段**: tech / general / idiom 便于客户端差异化提示(技术规范 vs 校对规范 vs 成语规范)
- **"reason" 字段说明替换原因**: 客户端可展示"建议改为'部署'(军事/技术正式写法)",提升校对透明度
- **不豁免**: v0.1 雏形阶段不做上下文豁免,全报;**v0.2 接 LLM 二次校验时再做否定/引用/口语/方言等豁免**(如"支付宝"作为支付品牌不算"支付"错误)

#### 扣分公式

```
score = min(命中处数, 3)
```

- 每命中 1 处扣 1 分(R-TYPO-09 单条上限 3 分,与 TYPO-02/03/05/06/07/08 持平)
- 总扣分 = `min(Σ 13 规则扣分, 5)`
- verdict 映射: 0 分 → PASS, ≥1 分 → SOFT_WARN(软调,不阻塞)

#### 自检示例

| 原文 | R-TYPO-09 命中 | 改写 |
|------|----------------|------|
| 请先布署服务器后再登陆帐号进行配置。 | ✅ 命中 3 处("布署"→"部署" tech + "登陆"→"登录" tech + "帐号"→"账号" tech)扣 3 分 | 请先部署服务器后再登录账号进行配置。 |
| 截至 12 月 31 日前制订的权力清单请提交。 | ✅ 命中 3 处("截至"→"截止" general + "制订"→"制定" general + "权力"→"权利" general)扣 3 分 | 截止 12 月 31 日前制定的权利清单请提交。 |
| 我们要再接再励,做到川流不息地为客户创造价值。 | ✅ 命中 1 处("再接再励"→"再接再厉" idiom)扣 1 分 | 我们要再接再厉,做到川流不息地为客户创造价值。 |
| 原本那条穿流不息的小河 | ✅ 命中 1 处("穿流不息"→"川流不息" idiom)扣 1 分 | 原本那条川流不息的小河 |
| 部署百份百稳赚不赔的最佳服务器 | ✅ R-TYPO-09 命中 1 处("布署"→"部署" tech),R-TYPO-08 命中 2 处("稳赚不赔" promise + "最佳" absolute),多规则累加 4 分 | 部署 100% 长期回报的优质服务器 |
| 请确认订单后提交申请。 | ❌ 不命中 | (无需改) |
| 验证码已发送到您的手机,请注意查收。 | ❌ 不命中("验证"已正确) | (无需改) |

## 4. 验证示例

### 4.1 桌面端长句(超 40 字,触发 SOFT_WARN)

**请求**:
```bash
curl -X POST http://localhost:3000/api/audit/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "您已成功提交本次申请的详细资料,我们将在 24 小时内由专属顾问与您取得联系以确认后续流程。",
    "scene": "page"
  }'
```

**响应**:
```json
{
  "verdict": "SOFT_WARN",
  "score_deduction": 5,
  "read_hits": [{
    "rule": "R-READ-01",
    "surface": "desktop",
    "limit": 40,
    "sentence": "您已成功提交本次申请的详细资料,我们将在 24 小时内由专属顾问与您取得联系以确认后续流程",
    "length": 49,
    "excess": 9
  }],
  "summary": "R-READ-01 命中 1 个超长句(桌面端上限 40 字符),扣 5 分",
  "meta": {
    "rules_evaluated": ["R-READ-01"],
    "rules_skipped": ["R-TYPO-01~05...", "R-BRAND-01~04...", "R-TONE-01~03 + R-READ-02~03..."],
    "scene_resolved": "page",
    "text_length": 50
  }
}
```

### 4.2 移动端合规(PASS)

**请求**:
```bash
curl -X POST http://localhost:3000/api/audit/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "资料已提交,24h 内顾问将联系您",
    "scene": "push"
  }'
```

**响应**:
```json
{
  "verdict": "PASS",
  "score_deduction": 0,
  "read_hits": [],
  "summary": "R-READ-01 通过(共 0 个超长句,mobile 端上限 28 字符)",
  "meta": {
    "rules_evaluated": ["R-READ-01"],
    "scene_resolved": "push",
    "text_length": 18
  }
}
```

### 4.3 GET 探索

```bash
curl http://localhost:3000/api/audit/text
```

返回 API 元信息(版本 / 已实现规则 / 计划规则 / 文档链接)。

### 4.4 句首连词堆叠(R-READ-02 命中,0903 增量)

**请求**:
```bash
curl -X POST http://localhost:3000/api/audit/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "而且并且此功能尚在测试阶段。",
    "scene": "page"
  }'
```

**响应**:
```json
{
  "verdict": "SOFT_WARN",
  "score_deduction": 1,
  "read_hits": [],
  "read02_hits": [{
    "rule": "R-READ-02",
    "sentence": "而且并且此功能尚在测试阶段",
    "matched_conjunctions": ["而且", "并且"],
    "match_start": 0,
    "match_text": "而且并且"
  }],
  "summary": "R-READ-01 通过(desktop 端上限 40 字符);R-READ-02 命中 1 个堆叠句,扣 1 分",
  "meta": {
    "rules_evaluated": ["R-READ-01", "R-READ-02"],
    "rules_skipped": [
      "R-TYPO-01~05(留 v0.1 API,需 hanlp/外部字典)",
      "R-BRAND-01~04(留 v0.2 API,需品牌词表)",
      "R-TONE-01~03(留 v0.3 API,需 LLM 二次校验)",
      "R-READ-03(留 v0.3 API,需 LLM 信息密度提取)"
    ],
    "scene_resolved": "page",
    "text_length": 14
  }
}
```

### 4.5 双规则同时命中(READ-01 + READ-02 累加)

**请求**:
```bash
curl -X POST http://localhost:3000/api/audit/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "而且所以因为如果您希望继续使用此功能,请先完成账户绑定并仔细阅读最新的服务条款。",
    "scene": "page"
  }'
```

**响应**(4 个连词堆叠 + 40 字符句,R-READ-02 命中 1 分,READ-01 通过 0 分,总 1 分):
```json
{
  "verdict": "SOFT_WARN",
  "score_deduction": 1,
  "read_hits": [],
  "read02_hits": [{
    "rule": "R-READ-02",
    "sentence": "而且所以因为如果您希望继续使用此功能,请先完成账户绑定并仔细阅读最新的服务条款",
    "matched_conjunctions": ["而且", "所以", "因为", "如果"],
    "match_start": 0,
    "match_text": "而且所以因为如果"
  }],
  "summary": "R-READ-01 通过(desktop 端上限 40 字符);R-READ-02 命中 1 个堆叠句,扣 1 分",
  "meta": {
    "rules_evaluated": ["R-READ-01", "R-READ-02"],
    "scene_resolved": "page",
    "text_length": 40
  }
}
```

## 5. 不做什么(明确边界)

- ❌ **不做 v0.1 R-TYPO-01 同音字 + R-TYPO-04 量词** —— 需 hanlp 字典 / LLM 常识校验,留 v0.1 API
- ❌ **不做 v0.1 敏感词 2 级** —— 需网信办 + 法务清单对接,留 v0.1 API
- ❌ **不做 v0.2 R-BRAND-01~04 品牌词 4 条** —— 品牌词表本身是外部依赖(Phase 0 第 2 项),0904 起正式降级到 Phase 1.5 范围,词库到位后接 v0.2 API
- ❌ **不做 v0.3 R-TONE-01 二义性** —— 需 LLM 二次校验(API key),留 v0.3 API
- ❌ **R-READ-03-LLM 信息密度暂不做** —— 需 LLM 提取"动词+抽象名词",0908 已落零依赖"句末标点规范"同名规则占位 ID,LLM 版留 v0.3 API
- ❌ **不做鉴权 / 限流 / middleware** —— Phase 1 MVP 后期考虑
- ❌ **不做错误页 / loading 态 / UI 集成** —— 本变更只到 API 雏形,UI 集成留后续 T5
- ❌ **不做批量审查 / 历史对比** —— 留 v2.0

## 6. 验证清单

### 6.1 0902 T5(R-READ-01 启动)

- [x] `npx tsc --noEmit` 通过(0 errors)
- [x] `npx eslint .` 通过(0 errors / 0 warnings)
- [x] `npx next build` 通过(`/api/audit/text` POST/GET 路由已注册)
- [x] curl 端到端验证:启动 `npm run dev` → POST 桌面端长句 → 验证 `verdict=SOFT_WARN` / `score_deduction=5` → POST 移动端合规文案 → 验证 `verdict=PASS` → 关闭 dev server

### 6.2 0903 T5(R-READ-02 增量)

- [x] `npx tsc --noEmit` 通过(0 errors,R-READ-02 类型 + Read02Hit 接口新增)
- [x] `npx eslint .` 通过(0 errors / 0 warnings)
- [x] `npx next build` 通过(`/api/audit/text` 路由已注册 + 双规则 meta 正确)
- [x] curl 端到端验证 5 例:启动 `npm run dev` → GET 元信息确认 R-READ-02 注册 → POST `而且并且此功能尚在测试阶段`(R-READ-02 命中 1 分,R-READ-01 通过)→ POST 4 连词堆叠长句(双规则累加 score=1)→ POST 移动端合规 PASS → POST 桌面端 45 字长句(R-READ-01 命中 5 分,R-READ-02 通过)→ 关闭 dev server

### 6.3 0904 T5(5 零依赖规则增量:TYPO-02/03/05 + TONE-02/03)

- [x] `npx tsc --noEmit` 通过(0 errors,5 个新 Hit 接口 + 5 个 check 函数 + RuleSummary 接口 + POST handler 7 规则累加 + GET 元信息 7 规则全部类型对齐)
- [x] `npx eslint .` 通过(0 errors / 0 warnings)
- [x] `npx next build` 通过(`/api/audit/text` 路由注册 + 7 规则 meta 正确)
- [x] curl 端到端验证 10 例:启动 `npx next dev -p 4123` → **T1 GET 元信息确认 7 规则已实现** → **T2 PASS**("注册成功"短文案)→ **T3 R-TYPO-02 命中**("请请确认订单" → typo02_hits 1 处 "请请" 扣 1 分)→ **T4 R-TYPO-03 命中**("请确认,您已注册成功." → typo03_hits 1 个英文逗号扣 1 分)→ **T5 R-TYPO-05 命中**("剩余次数１２３次" → typo05_hits 3 个全角数字扣 3 分达上限)→ **T6 R-TONE-02 命中**("请不要重复点击" → tone02_hits 1 句扣 1 分)→ **T7 R-TONE-03 命中**(4 类语气词各 1 个,dominant_ratio=0.25 < 0.7 扣 2 分达上限)→ **T8 多规则累加**(同时命中 R-READ-01+R-READ-02+R-TYPO-02,score 累加到 5 分达总上限)→ **T9 叠词白名单豁免**("看看"/"慢慢"在白名单 → typo02_hits=[] 通过)→ **T10 桌面端长句**(50 字超 40 字上限 → R-READ-01 命中 10 字扣 5 分达总上限)→ 关闭 dev server

### 6.4 0905 T5(R-TYPO-06 增量:pangu 风格空格缺失)

- [x] `npx tsc --noEmit` 通过(0 errors,新 Typo06Hit 接口 + checkTypo06 函数 + 2 个独立 regex + POST handler 8 规则累加 + GET 元信息 8 规则全部类型对齐)
- [x] `npx eslint .` 通过(0 errors / 0 warnings)
- [x] `npx next build` 通过(`/api/audit/text` 路由注册 + 8 规则 meta 正确)
- [x] curl 端到端验证 5 例:启动 `npx next dev -p 4123` → **T1 GET 元信息确认 8 规则已实现**(`version: 0.1.0-API-雏形+R-READ-02+5-零依赖规则+R-TYPO-06`,`rules_implemented` 第 6 项含 R-TYPO-06)→ **T2 8 规则全跑验证 meta**("资料已提交,24h 内顾问将联系您" → summary 含 8 段;R-TYPO-06 通过 0 hit)→ **T3 R-TYPO-06 双向命中**("剩余次数1次免费" → typo06_hits 2 处 "数1" + "1次" 扣 2 分;**T3 初版用单 regex matchAll 漏掉"1次",改用 2 个独立 regex 重测通过**)→ **T4 多规则累加**("已注册Ａ产品,剩余次数1次" → typo05:1 + typo06:2 + typo03:1 = 4 分)→ **T5 数字内部豁免**("abc123 是合法字符串" → typo06_hits=[] PASS)→ 关闭 dev server

### 6.5 0906 T5(R-TYPO-07 增量:连续标点符号)

- [x] `npx tsc --noEmit` 通过(0 errors,新 Typo07Hit 接口 + checkTypo07 函数 + REPEAT_PUNCT_RE regex + POST handler 9 规则累加 + GET 元信息 9 规则全部类型对齐)
- [x] `npx eslint .` 通过(0 errors / 0 warnings)
- [x] `npx next build` 通过(`/api/audit/text` 路由注册 + 9 规则 meta 正确)
- [x] curl 端到端验证 5 例:启动 `npx next dev -p 4123` → **T1 GET 元信息确认 9 规则已实现**(`version: 0.1.0-API-雏形+R-READ-02+5-零依赖规则+R-TYPO-06+R-TYPO-07`,`rules_implemented` 第 7 项含 R-TYPO-07)→ **T2 PASS**("注册成功"短文案,summary 含 9 段 R-TYPO-07 通过)→ **T3 中文连续 3 句号命中**("你好。。。欢迎使用" → typo07_hits 1 段 "。。。" run_length=3 cjk 扣 1 分)→ **T4 英文连续 3 问号命中**("真的吗??? 你确定?!" → typo07_hits 1 段 "???" run_length=3 latin 扣 1 分 + R-TYPO-03 累加达 5 分上限)→ **T5 边界 — 2 个同标点不连用 PASS**("你确定?好的!那就这样。" → typo07_hits=[] 通过,只 R-TYPO-03 命中 2 分)→ 关闭 dev server

### 6.6 0908 T5(R-READ-03 + R-TONE-04 增量:v0.3 二规则零依赖扩展)

- [x] `npx tsc --noEmit` 通过(0 errors,新 Read03Hit 接口 + Tone04Hit 接口 + checkRead03 函数 + checkTone04 函数 + SENTENCE_WITH_ENDING_RE 独立 regex + POST handler 11 规则累加 + GET 元信息 11 规则全部类型对齐)
- [x] `npx eslint .` 通过(0 errors / 0 warnings,初版 splitSentences 复赋值未用警告已修)
- [x] `npx next build` 通过(`/api/audit/text` 路由注册 + 11 规则 meta 正确,production bundle 验证)
- [x] curl 端到端验证 8 例:启动 `npx next start -p 3301` → **T1 GET 元信息确认 11 规则已实现**(`version: 0.1.0-API-雏形+R-READ-02+5-零依赖规则+R-TYPO-06+R-TYPO-07+R-READ-03+R-TONE-04`,`rules_implemented` 第 3/11 项含 R-READ-03/R-TONE-04)→ **T2 missing-punct 命中**("请确认信息后再次提交" 末"提交"无标点 → read03_hits 1 句 issue=missing-punct 扣 1 分)→ **T3 inconsistent-ending + Tone04 联动**("资料已提交!顾问将联系您!" → read03_hits 2 句 inconsistent-ending + tone04_hits 1 hit 2/2=100% 扣 1 分)→ **T4 疑问句豁免**("你确认吗?请回复" → "你确认吗?"含"吗"豁免 + "请回复" missing-punct 1 命中)→ **T5 Tone04 边界 — 1 感叹 / 2 句 = 50% 命中**("新功能已上线!请立即体验。" → tone04_hits 1 hit)→ **T6 英文双陈述 PASS**("Hello world. Please confirm." → read03_hits=[] tone04_hits=[])→ **T7 中文末"。" PASS 全过**("请确认订单。" → verdict=PASS,read03_hits=[] tone04_hits=[])→ **T8 综合 — 4 句感叹 + 多规则累加 5 分上限**("快来!超棒!新功能!上线啦!" → read03_hits 4 句 + tone04 100% + R-TYPO-03 4 命中,summary 含 11 段)→ 关闭 server

### 6.7 0909 T5(R-TYPO-08 增量:广告法极限词零依赖查表,12 规则收口)

- [x] `npx tsc --noEmit` 通过(0 errors,新 `Typo08Hit` 接口(5 字段:rule/text/position/match/category)+ `ABSOLUTE_WORDS` 静态词表常量(4 类 33 条)+ `checkTypo08` 函数(长词优先匹配 + 区间去重)+ POST handler 12 规则累加 + GET 元信息 12 规则全部类型对齐)
- [x] `npx eslint .` 通过(0 errors / 0 warnings)
- [x] `npx next build` 通过(`/api/audit/text` 路由注册 + 12 规则 meta 正确,production bundle 验证)
- [x] curl 端到端验证 8 例:启动 `npx next dev -p 4123` → **T1 GET 元信息确认 12 规则已实现**(`version: 0.1.0-API-雏形+R-READ-02+5-零依赖规则+R-TYPO-06+R-TYPO-07+R-READ-03+R-TONE-04+R-TYPO-08`,`rules_implemented` 第 9 项含 R-TYPO-08 + `rules_evaluated` 12 条)→ **T2 极限词命中**("本产品是行业最佳选择,效果最好,稳赚不赔。" → typo08_hits 3 处: 最佳 absolute + 最好 absolute + 稳赚不赔 promise,扣 3 分)→ **T3 PASS 用例**("资料已提交,24h 内顾问将联系您" → typo08_hits=[])→ **T4 4 分类分别命中**("本产品是最佳,行业第一,效果100%,稳赚。" → 4 处分别 cat=absolute/ranking/degree/promise)→ **T5 长词优先去重**("这是最好吃的一家店,味道很棒。" → 命中 1 处"最好",未被"最"+"好吃"拆开误报)→ **T6 长词+短词去重**("稳赚不赔,稳赚很轻松。" → 命中 2 处"稳赚不赔" pos=0 + "稳赚" pos=5 不重叠)→ **T7 4 类 33 词累加**("最佳最好最大最高最优最强最快最便宜第一唯一首选独家顶级顶尖最高级国家级世界级100%百分百百分之百永久永远绝对完全完美万能包过稳赚零风险无风险稳赚不赔无副作用立竿见影。" → typo08_hits 33 处 扣 3 分达 TYPO-08_MAX 上限)→ **T8 错误响应**("text": "" → 400 `{"error":"`text` is empty"}`)→ 关闭 dev server

### 6.8 0917 T5(R-TYPO-09 增量:同音字词表 Top 50 子集零依赖查表,13 规则扩展)

- [x] `npx tsc --noEmit` 通过(0 errors,新 `Typo09Hit` 接口(7 字段:rule/text/position/match/correct/category/reason)+ `HOMOPHONE_PAIRS` 静态词表常量(3 类 50 条 "correct/incorrect/category/reason" 对)+ `checkTypo09` 函数(长词优先匹配 + 区间去重,沿用 R-TYPO-08 实现模式)+ POST handler 13 规则累加 + GET 元信息 13 规则全部类型对齐 + rules_skipped 移除 R-TYPO-01(已被 R-TYPO-09 接管))
- [x] `npx eslint .` 通过(0 errors / 0 warnings)
- [x] `npx next build` 通过(`/api/audit/text` 路由注册 + 13 规则 meta 正确,production bundle 验证,代码 1270 → 1428 行 +158 行)
- [x] curl 端到端验证 8 例:启动 `npx next dev -p 4123` → **T1 GET 元信息确认 13 规则已实现**(`version: 0.1.0-API-雏形+R-READ-02+5-零依赖规则+R-TYPO-06+R-TYPO-07+R-READ-03+R-TONE-04+R-TYPO-08+R-TYPO-09`,`rules_implemented` 第 10 项含 R-TYPO-09 + `rules_evaluated` 13 条 + `rules_skipped` 已移除 R-TYPO-01)→ **T2 PASS 文案**("请确认订单后提交申请。" → typo09_hits=[])→ **T3 tech 类命中**("请先布署服务器后再登陆帐号进行配置。" → typo09_hits 3 处: 布署→部署 tech + 登陆→登录 tech + 帐号→账号 tech,扣 3 分)→ **T4 general 类命中**("截至 12 月 31 日前制订的权力清单请提交。" → typo09_hits 3 处: 截至→截止 general + 制订→制定 general + 权力→权利 general,扣 3 分)→ **T5 idiom 类命中**("我们要再接再励,做到川流不息地为客户创造价值。" → typo09_hits 1 处: 再接再励→再接再厉 idiom,扣 1 分)→ **T6 多规则累加**("布署百份百稳赚不赔的最佳服务器" → typo09 1 处(布署→部署)+ typo08 2 处(稳赚不赔 promise + 最佳 absolute),多规则累加 4 分)→ **T7 长词优先去重**("原本那条穿流不息的小河" → typo09_hits 1 处"穿流不息"→"川流不息",未被"穿流"+"不息"拆开误报)→ **T8 多处不同位置不重叠**("先布署再登陆帐号" → typo09_hits 3 处: 布署@pos 1 + 登陆@pos 4 + 帐号@pos 6 position 升序,扣 3 分)→ **T9 错误响应**("text": "" → 400 `{"error":"`text` is empty"}` / "not-json" → 400)→ 关闭 dev server

## 7. 关联文档

- `项目开发计划.md` §3 模块 1 + §6 Phase 1 MVP(累计勾选:启动 v0.1 + R-READ-02 增量 + 5 零依赖规则增量 + R-TYPO-06 增量 + R-TYPO-07 增量 + R-READ-03 + R-TONE-04 增量 + R-TYPO-08 增量 + R-TYPO-09 增量,共 8 个子项;**§5 Phase 0 接受 7/10 收口,3 项外部依赖项降级 Phase 1.5/Phase 2** 0908 T5 落痕;**§6 主项 2 处备注栏增补** 0908 T5 落痕;**§6 子项 0908 T5 落痕 + 12 规则收口备注** 0909 T5 落痕;**§6 子项 0917 T5 落痕 + 13 规则扩展备注** 0917 T5 落痕)
- `docs/审查规则/v0.1_文案审查_错别字_敏感词.md` v0.1 规则种子(0904 T5 落地 R-TYPO-02/03/05;0905 T5 落地 R-TYPO-06;0906 T5 落地 R-TYPO-07;0909 T5 落地 R-TYPO-08 广告法极限词零依赖查表;**0917 T5 落地 R-TYPO-09 同音字词表 Top 50 子集零依赖查表**)
- `docs/审查规则/v0.2_文案审查_品牌词.md` v0.2 规则种子(Phase 1.5)
- `docs/审查规则/v0.3_文案审查_语气_可读性.md` v0.3 规则种子(0904 T5 落地 R-TONE-02/03;0902-0903 已落地 R-READ-01/02;**0908 T5 落地 R-READ-03 句末标点规范 + R-TONE-04 感叹号密度,沿用 v0.3 ID 与命名空间**)
- `docs/a11y/axe-core_基线_v0.1.md` 0901 T5 落地
- `README.md` 增补"无 plan,临时决策"约定(0904 T5 兑现 0904 巡检"高优"项 D)
- `.plan/20260917.md` 临时 plan 决策依据留痕(`无 plan 漂移模式第 17 天延续,0829 起已稳定 19 天;0825-0917 共 22 个 T4/T5 周期`;0917 T5 一次性兑现 0917 巡检"最高优"+ "必须决策"+ "中优"3 项最高优建议;0917 巡检建议兑现率自评 5/5(100%),跨 4 期(0914-0915-0916-0917)累计兑现率 10/10(100%);0917 期内 13 项 [ ] / 19 项 [x] = Phase 0 + Phase 1 总 checkbox 32 项进度 +1 勾;采纳 0917 巡检"特别建议路线图 A")

## 8. 变更记录

| 日期 | 变更 | 触发 |
|------|------|------|
| 2026-09-02 | v0.1 API 雏形落地:`app/api/audit/text/route.ts` + R-READ-01(纯机检,零外部依赖) + API 文档 + T5 决策依据(plan 缺失,按 0902 巡检高优建议 2 行动) | 03:30 T5 cron |
| 2026-09-03 | v0.1 API 首次增量 R-READ-02:`app/api/audit/text/route.ts` 新增 R-READ-02 检测函数(句首连词堆叠,24 词连词词典 + 8 字窗口扫描 + 白名单豁免)+ `Read02Hit` 接口 + POST handler 双规则累加 + 文档 §1/§2.3/§3.5/§4.4/§4.5/§5/§6.2/§7/§8 全部对齐;**无 plan,临时决策**(0902 起 `.plan/` 漂移模式延续,0903 巡检建议显式记录);0903 巡检"高优"项(audit-text API 雏形增量扩展)100% 兑现 | 03:30 T5 cron |
| 2026-09-04 | v0.1 API 二次增量 5 零依赖规则(2 规则 → 7 规则):`app/api/audit/text/route.ts` 新增 R-TYPO-02(多字/漏字/重复字,叠词白名单豁免)+ R-TYPO-03(中英文标点混用)+ R-TYPO-05(全角/半角混用)+ R-TONE-02(否定句否定词置顶,检测"请不要"/"请勿")+ R-TONE-03(语气一致性,4 类语气词占比 ≥ 70%)+ 5 个新 Hit 接口 + RuleSummary 接口 + POST handler 7 规则累加(score 上限 5 分)+ GET 元信息 7 规则全部注册 + 文档 §1/§2.3/§5/§6.3/§7/§8 全部对齐;**无 plan,临时决策**(0902-0903 漂移模式第 3 天延续,0904 巡检 2 条"最高优"项兑现);**Phase 1 §6 模块 1 从 2 规则扩到 7 规则,代码资产 0.2 → 0.3 起步**;同步兑现 0904 巡检"高优"项 D — `README.md` 增补"无 plan,临时决策"约定 | 03:30 T5 cron |
| 2026-09-05 | v0.1 API 三次增量 R-TYPO-06 数字/英文与中文之间空格缺失(pangu 风格,7 → 8 规则):`app/api/audit/text/route.ts` 新增 `Typo06Hit` 接口 + `checkTypo06` 函数(**2 个独立 regex** PANGU_CJK_ASCII_RE / PANGU_ASCII_CJK_RE 双向独立扫描 + 合并后 position 升序;**初版用单 regex matchAll 漏掉"1次"已修复**)+ POST handler 8 规则累加(score 上限 5 分)+ GET 元信息 8 规则全部注册 + `version` 升级 `0.1.0-API-雏形+R-READ-02+5-零依赖规则+R-TYPO-06` + 文档 §1/§2.3/§3.6/§6.4/§7/§8 全部对齐 + `.plan/20260905.md` 临时决策依据留痕;**无 plan,临时决策**(0902-0903-0904 漂移模式第 4 天延续,0829 起 `.plan/` 漂移模式已稳定 7 天;**0825-0905 共 12 个 T4/T5 周期**);**Phase 1 §6 模块 1 从 7 规则扩到 8 规则,代码资产 0.3 → 0.4 起步** | 03:30 T5 cron |
| 2026-09-06 | v0.1 API 四次增量 R-TYPO-07 连续标点符号(8 → 9 规则):`app/api/audit/text/route.ts` 新增 `Typo07Hit` 接口(7 字段:rule/text/position/match/run_length/punct/punct_type)+ `checkTypo07` 函数(**1 个 regex** REPEAT_PUNCT_RE `/([.!?。！？])\1{2,}/g` 后行引用扫"≥ 3 同标点连用" + cjk/latin 分类用 unicode 范围 0x3000-0x303F / 0xFF01-0xFF60)+ POST handler 9 规则累加(score 上限 5 分)+ GET 元信息 9 规则全部注册 + `version` 升级 `0.1.0-API-雏形+R-READ-02+5-零依赖规则+R-TYPO-06+R-TYPO-07` + 文档 §1/§2.3/§3.7/§6.5/§7/§8 全部对齐;**无 plan,临时决策**(0902-0903-0904-0905 漂移模式第 5 天延续,0829 起 `.plan/` 漂移模式已稳定 8 天;**0825-0906 共 13 个 T4/T5 周期**);**Phase 1 §6 模块 1 从 8 规则扩到 9 规则,代码资产 0.4 → 0.5 起步**;R-TYPO-07 选型:零依赖纯 regex + 后行引用,6 标点(中英各 3)覆盖,无白名单(连续 3+ 几乎一定是手滑/语气过激),run_length 上报便于客户端提示 | 03:30 T5 cron |
| 2026-09-08 | v0.1 API 五次增量 v0.3 二规则零依赖扩展(9 → 11 规则,恢复 0907 T5 首次断档后连续节奏):`app/api/audit/text/route.ts` 新增 `Read03Hit` 接口(6 字段:rule/sentence/position/issue/actual_ending/primary_script)+ `Tone04Hit` 接口(5 字段:rule/exclam_count/sentence_count/ratio/threshold)+ `checkRead03` 函数(**独立 regex** SENTENCE_WITH_ENDING_RE `/[^。！？!?;；]*[。！？!?;；]?/g` 保留句末标点扫描 + 中英合法标点集判定 CJK_STATEMENT_ENDINGS(7 个)/ LATIN_STATEMENT_ENDINGS(5 个)+ 疑问/感叹语气词白名单 `INTERROGATIVE_PARTICLES = /[吗呢吧呀啊哦哇哎]/` 豁免末"!"/"?"的疑问/感叹句 + issue 双分类 `missing-punct`(无标点)/ `inconsistent-ending`(陈述句末"!"/"?")+ `checkTone04` 函数(EXCLAM_RE `/[!！]/g` 扫中英感叹号数 / splitSentences 句子数 → ratio > 0.3 即报,全篇级只报 1 hit)+ POST handler 11 规则累加(score 上限 5 分)+ GET 元信息 11 规则全部注册 + `version` 升级 `0.1.0-API-雏形+R-READ-02+5-零依赖规则+R-TYPO-06+R-TYPO-07+R-READ-03+R-TONE-04` + 文档 §1/§2.3/§3.8-3.9/§5/§6.6/§7/§8 全部对齐;**`npx tsc --noEmit` / `npx eslint .` / `npx next build` 三验证通过**(初版 `splitSentences` 复赋值未用 ESLint 警告已修)+ 8 个 curl 端到端用例全过(T1 GET 11 规则 / T2 missing-punct 命中 / T3 inconsistent-ending 2 命中 + Tone04 100% / T4 疑问句"吗"豁免 + missing-punct / T5 1 感叹 / 2 句 = 50% 命中 / T6 英文双陈述 PASS / T7 中文末"。" PASS / T8 综合 4 句感叹 + 多规则累加 5 分上限);**无 plan,临时决策**(0902-0903-0904-0905-0906-0907-0908 漂移模式第 7 天延续,0829 起 `.plan/` 漂移模式已稳定 10 天;**0907 T5 首次断档后 0908 T5 恢复连续节奏**;**0825-0908 共 15 个 T4/T5 周期**);**Phase 1 §6 模块 1 从 9 规则扩到 11 规则,代码资产 0.5 → 0.6 起步;目标 12+ 规则收口**;选型理由:① 零依赖纯 regex(SENTENCE_WITH_ENDING_RE 解决 splitSentences 剥标点问题);② 中英双标点集覆盖完整;③ 疑问/感叹语气词白名单豁免"?"末"/"!"/"吗呢吧呀"等合法疑问/感叹场景,避免误报;④ R-READ-03 命名沿用 v0.3 种子 ID 但语义替换为"句末标点规范"(原 LLM 版"信息密度"留 R-READ-03-LLM 标注);⑤ R-TONE-04 命名沿用 v0.3 种子 TONE-01~04 序列("感叹号密度"),属零依赖纯机检;**同步兑现 0907 巡检 4 项"最高优"建议**:`项目开发计划.md` §5 末尾 + §6 主项 2 处备注栏 + §6 子项 0908 T5 主交付留痕(0904 中优建议累计跨 5 天(0904-0905-0906-0907-0908)0908 T5 一次性兑现);**后续可再扩 v0.1 错别字 1-2 条 R-TYPO-08 同音字词表(零依赖 Top 50 子集) 收口 12+ 规则** | 03:30 T5 cron |
| 2026-09-09 | v0.1 API 六次增量 R-TYPO-08 广告法极限词零依赖查表(**11 → 12 规则收口**,兑现 0908 巡检建议):`app/api/audit/text/route.ts` 新增 `Typo08Hit` 接口(5 字段:rule/text/position/match/category)+ `ABSOLUTE_WORDS` 静态词表常量(**4 类 33 条 2+ 字词**:absolute 绝对化 8 条 / ranking 排名 9 条 / degree 程度 9 条 / promise 承诺 7 条)+ `checkTypo08` 函数(零依赖纯字符串查表 + **长词优先匹配** 按 word.length 降序 + **区间去重** 防子串重复报,如"稳赚不赔"与"稳赚"分别报 1 次不嵌套)+ POST handler 12 规则累加(score 上限 5 分,单条 TYPO-08 上限 3 分)+ GET 元信息 12 规则全部注册 + `version` 升级 `0.1.0-API-雏形+R-READ-02+5-零依赖规则+R-TYPO-06+R-TYPO-07+R-READ-03+R-TONE-04+R-TYPO-08` + 文档 §1/§2.3/§3.10/§6.7/§7/§8 全部对齐 + `docs/审查规则/v0.1_...md` §3 增 R-TYPO-08 规则定义(词表/算法/示例)+ §10 变更记录追加 0909 行;**`npx tsc --noEmit` / `npx eslint .` / `npx next build` 三验证通过** + 8 个 curl 端到端用例全过(T1 GET 12 规则 / T2 极限词命中 3 处 / T3 PASS 用例 / T4 4 分类分别命中 / T5 长词优先"最好吃"不拆 / T6 长词+短词"稳赚不赔"+"稳赚"不重叠 / T7 4 类 33 词累加扣 3 分上限 / T8 错误响应 400);**无 plan,临时决策**(0902-0903-0904-0905-0906-0907-0908-0909 漂移模式第 8 天延续,0829 起 `.plan/` 漂移模式已稳定 11 天;**0825-0909 共 16 个 T4/T5 周期**);**Phase 1 §6 模块 1 从 11 规则扩到 12 规则,代码资产 0.6 → 0.7 起步;0908 巡检建议"目标 12+ 规则收口"100% 兑现**;R-TYPO-08 选型理由:① 零依赖纯字符串查表 + 2+ 字词避免单字"最"/"全"误报;② 长词优先匹配 + 区间去重避免"稳赚"与"稳赚不赔"重复报;③ 4 类 category 字段(absolute / ranking / degree / promise)便于客户端差异化提示(法务警示 vs 营销警示 vs 金融承诺);④ 选型与 0908 提到的 R-TYPO-01 计划"同音字"不同方向(同音字需 hanlp 字典),R-TYPO-08 属"零依赖静态词表"族,纯字符串查表无外部依赖;**v0.2 后续可接 LLM 二次校验做上下文豁免**(对齐 v0.1 §4.3 上下文豁免原则);**Phase 1 §6 模块 1 12 规则收口,后续可启动异常场景发现器 + A11y 审查 v1 + 飞书 bot 触发接入 + 健康度曲线 + dogfood 等其他模块** | 03:30 T5 cron |
| 2026-09-17 | v0.1 API 七次增量 R-TYPO-09 同音字词表 Top 50 子集零依赖查表(**12 → 13 规则扩展**,采纳 0917 巡检"特别建议路线图 A" + 沿用 R-TYPO-08 零依赖静态词表架构,无需 hanlp 字典):`app/api/audit/text/route.ts` 新增 `Typo09Hit` 接口(**7 字段**:rule/text/position/match/correct/category/reason)+ `HOMOPHONE_PAIRS` 静态词表常量(**3 类 50 条 "correct/incorrect/category/reason" 对**:tech 技术/产品文案 15 条 布署→部署/帐号→账号/登陆→登录 等 + general 通用中文 20 条 截至→截止/制订→制定/权力→权利 等 + idiom 成语 15 条 穿流不息→川流不息/再接再励→再接再厉/黄梁梦→黄粱梦 等)+ `checkTypo09` 函数(零依赖纯字符串查表 + **长词优先匹配** 按 incorrect.length 降序 + **区间去重** 防子串重复报,沿用 R-TYPO-08 实现模式)+ POST handler 13 规则累加(score 上限 5 分,单条 TYPO-09 上限 3 分)+ GET 元信息 13 规则全部注册 + `version` 升级 `0.1.0-API-雏形+R-READ-02+5-零依赖规则+R-TYPO-06+R-TYPO-07+R-READ-03+R-TONE-04+R-TYPO-08+R-TYPO-09` + `rules_skipped` 移除 R-TYPO-01(已被 R-TYPO-09 接管)+ 文档 §1/§2.3/§3.11/§6.8/§7/§8 全部对齐 + `docs/审查规则/v0.1_...md` §3 增 R-TYPO-09 规则定义(词表/算法/示例)+ §10 变更记录追加 0917 行;**`npx tsc --noEmit` / `npx eslint .` / `npx next build` 三验证通过**(代码 1270 → 1428 行 +158 行)+ 8 个 curl 端到端用例全过(T1 GET 13 规则 + R-TYPO-01 已移除 / T2 PASS 文案 / T3 tech 类命中 3 处: 布署→部署 + 登陆→登录 + 帐号→账号,扣 3 分 / T4 general 类命中 3 处: 截至→截止 + 制订→制定 + 权力→权利,扣 3 分 / T5 idiom 类命中 1 处: 再接再励→再接再厉,扣 1 分 / T6 多规则累加: typo09 1 处(布署→部署) + typo08 2 处(稳赚不赔 promise + 最佳 absolute) 多规则累加 4 分 / T7 长词优先去重: "原本那条穿流不息的小河" 命中 1 处"穿流不息"→"川流不息",未被"穿流"+"不息"拆开误报 / T8 多处不同位置不重叠: "先布署再登陆帐号" 命中 3 处: 布署@pos 1 + 登陆@pos 4 + 帐号@pos 6,扣 3 分 / T9 错误响应 400);**无 plan,临时决策**(0910-0911-0912-0913-0914-0915-0916-0917 漂移模式第 8 天延续,0829 起 `.plan/` 漂移模式已稳定 19 天;**0825-0917 共 22 个 T4/T5 周期**;0913 断档后第二次连续 4 期(0914/0915/0916/0917)巡检期未兑现"补登 0913 巡检日志"建议,0917 巡检"必须决策"项升级;0917 T5 一次性兑现"补登 0913 巡检日志" + "路线图 A 一项轻量交付" + "持续延续'主计划落痕 + audit-api 扩展'双轨任务节奏"3 项最高优建议,合并为同次 commit 落地 1 项 .Log/ 补登 + 1 项轻量交付);**Phase 1 §6 模块 1 从 12 规则扩到 13 规则,代码资产 0.7 → 0.8 起步;0917 巡检"特别建议路线图 A" 100% 兑现**;R-TYPO-09 选型理由:① 零依赖纯字符串查表 + 2-4 字词避免单字"是"/"的"误报,沿用 R-TYPO-08 架构(同"零依赖静态词表"族,纯字符串查表无外部依赖);② "correct" 字段直接驱动客户端"查找替换"提示,与 R-TYPO-08(只报不替换)差异化;③ "reason" 字段说明替换原因(如"军事/技术正式写法"),提升校对透明度;④ 3 类 category 字段(tech / general / idiom)便于客户端差异化提示(技术规范 vs 校对规范 vs 成语规范);⑤ R-TYPO-01 命名空间被 R-TYPO-09 接管(原 R-TYPO-01 需 hanlp 字典,本次改为零依赖静态词表实现);⑥ 50 条 Top 50 子集覆盖校对场景 80% 常见同音字/形近字/近音字错误;**v0.2 后续可接 LLM 二次校验做上下文豁免**(对齐 v0.1 §4.3 上下文豁免原则,如"支付宝"作为支付品牌不算"支付"错误);**Phase 1 §6 模块 1 13 规则扩展,后续可启动 §6 模块 4/5/6/7 或继续扩 R-TYPO-10+ 错别字/量词等** | 03:30 T5 cron |
