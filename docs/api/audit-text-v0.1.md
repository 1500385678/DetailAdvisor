# 文案审查 API · v0.1 API 雏形 + 增量 R-READ-02 + 增量 5 零依赖规则 + 增量 R-TYPO-06

> DetailAdvisor 模块 1(文案审查器)后端 API · v0.1 雏形 + 三次增量 · 2026-09-05
> 落地 commit: 0902 T5 启动 / 0903 T5 增量 R-READ-02 / 0904 T5 增量 v0.1 错别字 3 条 + v0.3 语气 2 条 / 0905 T5 增量 R-TYPO-06
> 入口: `app/api/audit/text/route.ts`(Next.js 16 App Router Route Handler)

---

## 1. 范围

| 项 | 说明 |
|---|------|
| 当前已实现 | **8 条规则**(均纯机检,零外部依赖):**R-READ-01**(句长上限,0902)+ **R-READ-02**(句首连词堆叠,0903)+ **R-TYPO-02**(多字/漏字/重复字,0904)+ **R-TYPO-03**(中英文标点混用,0904)+ **R-TYPO-05**(全角/半角混用,0904)+ **R-TYPO-06**(数字/英文与中文之间空格缺失,0905)+ **R-TONE-02**(否定句否定词置顶,0904)+ **R-TONE-03**(语气一致性,0904) |
| 暂未实现 | R-TYPO-01(同音字,需 hanlp)/ R-TYPO-04(量词,需 LLM)/ R-BRAND-01~04(品牌词,需词表,Phase 1.5)/ R-TONE-01(二义性,需 LLM)/ R-READ-03(信息密度,需 LLM) |
| 优先级 | Phase 1 §6 模块 1"上线文案审查器"启动 + 三次增量 commit,2 规则 → 8 规则扩展 |
| 关联规则 | `docs/审查规则/v0.1_文案审查_错别字_敏感词.md` §3 R-TYPO-02/03/05/06 + `docs/审查规则/v0.3_文案审查_语气_可读性.md` §3/§4 R-TONE-02/03 + R-READ-01/02 |

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
  "score_deduction": number,          // 0 ~ 5(单条文案上限 5 分,7 规则累加)
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
  "summary": string,                  // 一句话总结(8 规则分号分隔)
  "meta": {
    "rules_evaluated": [
      "R-READ-01", "R-READ-02",
      "R-TYPO-02", "R-TYPO-03", "R-TYPO-05", "R-TYPO-06",
      "R-TONE-02", "R-TONE-03"
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
- ❌ **不做 v0.3 R-TONE-01 二义性 + R-READ-03 信息密度** —— 需 LLM 二次校验(API key),留 v0.3 API
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

## 7. 关联文档

- `项目开发计划.md` §3 模块 1 + §6 Phase 1 MVP(累计勾选:启动 v0.1 + R-READ-02 增量 + 5 零依赖规则增量 + R-TYPO-06 增量,共 4 个子项)
- `docs/审查规则/v0.1_文案审查_错别字_敏感词.md` v0.1 规则种子(0904 T5 落地 R-TYPO-02/03/05;0905 T5 落地 R-TYPO-06)
- `docs/审查规则/v0.2_文案审查_品牌词.md` v0.2 规则种子(Phase 1.5)
- `docs/审查规则/v0.3_文案审查_语气_可读性.md` v0.3 规则种子(0904 T5 落地 R-TONE-02/03;0902-0903 已落地 R-READ-01/02)
- `docs/a11y/axe-core_基线_v0.1.md` 0901 T5 落地
- `README.md` 增补"无 plan,临时决策"约定(0904 T5 兑现 0904 巡检"高优"项 D)

## 8. 变更记录

| 日期 | 变更 | 触发 |
|------|------|------|
| 2026-09-02 | v0.1 API 雏形落地:`app/api/audit/text/route.ts` + R-READ-01(纯机检,零外部依赖) + API 文档 + T5 决策依据(plan 缺失,按 0902 巡检高优建议 2 行动) | 03:30 T5 cron |
| 2026-09-03 | v0.1 API 首次增量 R-READ-02:`app/api/audit/text/route.ts` 新增 R-READ-02 检测函数(句首连词堆叠,24 词连词词典 + 8 字窗口扫描 + 白名单豁免)+ `Read02Hit` 接口 + POST handler 双规则累加 + 文档 §1/§2.3/§3.5/§4.4/§4.5/§5/§6.2/§7/§8 全部对齐;**无 plan,临时决策**(0902 起 `.plan/` 漂移模式延续,0903 巡检建议显式记录);0903 巡检"高优"项(audit-text API 雏形增量扩展)100% 兑现 | 03:30 T5 cron |
| 2026-09-04 | v0.1 API 二次增量 5 零依赖规则(2 规则 → 7 规则):`app/api/audit/text/route.ts` 新增 R-TYPO-02(多字/漏字/重复字,叠词白名单豁免)+ R-TYPO-03(中英文标点混用)+ R-TYPO-05(全角/半角混用)+ R-TONE-02(否定句否定词置顶,检测"请不要"/"请勿")+ R-TONE-03(语气一致性,4 类语气词占比 ≥ 70%)+ 5 个新 Hit 接口 + RuleSummary 接口 + POST handler 7 规则累加(score 上限 5 分)+ GET 元信息 7 规则全部注册 + 文档 §1/§2.3/§5/§6.3/§7/§8 全部对齐;**无 plan,临时决策**(0902-0903 漂移模式第 3 天延续,0904 巡检 2 条"最高优"项兑现);**Phase 1 §6 模块 1 从 2 规则扩到 7 规则,代码资产 0.2 → 0.3 起步**;同步兑现 0904 巡检"高优"项 D — `README.md` 增补"无 plan,临时决策"约定 | 03:30 T5 cron |
| 2026-09-05 | v0.1 API 三次增量 R-TYPO-06 数字/英文与中文之间空格缺失(pangu 风格,7 → 8 规则):`app/api/audit/text/route.ts` 新增 `Typo06Hit` 接口 + `checkTypo06` 函数(**2 个独立 regex** PANGU_CJK_ASCII_RE / PANGU_ASCII_CJK_RE 双向独立扫描 + 合并后 position 升序;**初版用单 regex matchAll 漏掉"1次"已修复**)+ POST handler 8 规则累加(score 上限 5 分)+ GET 元信息 8 规则全部注册 + `version` 升级 `0.1.0-API-雏形+R-READ-02+5-零依赖规则+R-TYPO-06` + 文档 §1/§2.3/§3.6/§6.4/§7/§8 全部对齐 + `.plan/20260905.md` 临时决策依据留痕;**无 plan,临时决策**(0902-0903-0904 漂移模式第 4 天延续,0829 起 `.plan/` 漂移模式已稳定 7 天;**0825-0905 共 12 个 T4/T5 周期**);**Phase 1 §6 模块 1 从 7 规则扩到 8 规则,代码资产 0.3 → 0.4 起步** | 03:30 T5 cron |
