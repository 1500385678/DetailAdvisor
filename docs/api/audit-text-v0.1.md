# 文案审查 API · v0.1 API 雏形

> DetailAdvisor 模块 1(文案审查器)后端 API · v0.1 雏形 · 2026-09-02
> 落地 commit: 0902 T5 03:30 cron
> 入口: `app/api/audit/text/route.ts`(Next.js 16 App Router Route Handler)

---

## 1. 范围

| 项 | 说明 |
|---|------|
| 当前已实现 | **R-READ-01**(句长上限,纯机检,移动端 28 / 桌面端 40) |
| 暂未实现 | v0.1 错别字 5 条 + 敏感词 2 级 / v0.2 品牌词 4 条 / v0.3 语气 + 可读性其余 2 条 |
| 优先级 | Phase 1 §6 模块 1"上线文案审查器"启动 commit,**0 → 0.1 雏形** |
| 关联规则 | `docs/审查规则/v0.3_文案审查_语气_可读性.md` §4 R-READ-01 |

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
  "score_deduction": number,          // 0 ~ 5(单条文案上限 5 分)
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
  "summary": string,                  // 一句话总结
  "meta": {
    "rules_evaluated": ["R-READ-01"],
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
| v0.3 (P2) | 语气 + 可读性 | 软调 | 报告提示 | **R-READ-01 已落地** |

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

## 5. 不做什么(明确边界)

- ❌ **不做 v0.1 错别字 + 敏感词** —— 需 hanlp/外部字典,留 v0.1 API
- ❌ **不做 v0.2 品牌词** —— 品牌词表本身是外部依赖(Phase 0 第 2 项),词库到位后接 v0.2 API
- ❌ **不做 v0.3 语气 + R-READ-02/03** —— 需 LLM 二次校验(API key),留 v0.3 API
- ❌ **不做鉴权 / 限流 / middleware** —— Phase 1 MVP 后期考虑
- ❌ **不做错误页 / loading 态 / UI 集成** —— 本变更只到 API 雏形,UI 集成留后续 T5
- ❌ **不做批量审查 / 历史对比** —— 留 v2.0

## 6. 验证清单(0902 T5)

- [x] `npx tsc --noEmit` 通过(0 errors)
- [x] `npx eslint .` 通过(0 errors / 0 warnings)
- [x] `npx next build` 通过(`/api/audit/text` POST/GET 路由已注册)
- [x] curl 端到端验证:启动 `npm run dev` → POST 桌面端长句 → 验证 `verdict=SOFT_WARN` / `score_deduction=5` → POST 移动端合规文案 → 验证 `verdict=PASS` → 关闭 dev server

## 7. 关联文档

- `项目开发计划.md` §3 模块 1 + §6 Phase 1 MVP(新增"启动"checkbox)
- `docs/审查规则/v0.1_文案审查_错别字_敏感词.md` v0.1 规则种子
- `docs/审查规则/v0.2_文案审查_品牌词.md` v0.2 规则种子
- `docs/审查规则/v0.3_文案审查_语气_可读性.md` v0.3 规则种子(本 API 当前实现的 R-READ-01 来源)
- `docs/a11y/axe-core_基线_v0.1.md` 0901 T5 落地

## 8. 变更记录

| 日期 | 变更 | 触发 |
|------|------|------|
| 2026-09-02 | v0.1 API 雏形落地:`app/api/audit/text/route.ts` + R-READ-01(纯机检,零外部依赖) + API 文档 + T5 决策依据(plan 缺失,按 0902 巡检高优建议 2 行动) | 03:30 T5 cron |
