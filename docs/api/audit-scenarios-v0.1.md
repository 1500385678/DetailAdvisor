# 异常场景发现器 API · v0.1 API 雏形

> DetailAdvisor 模块 3(异常场景发现器)后端 API · v0.1 雏形 · 2026-09-10
> 落地 commit: 0910 T5 03:30:启动 commit,落 5 类异常场景库(零依赖纯模板,Phase 1 §6 收口后第一个非文案模块)
> 入口: `app/api/audit/scenarios/route.ts`(Next.js 16 App Router Route Handler)
> 决策依据:0908 T5 巡检建议"12 规则已收口,0910+ 可启动异常场景发现器";无 `.plan/20260910.md` 临时决策模式第 11 天延续

---

## 1. 范围

| 项 | 说明 |
|---|------|
| 当前已实现 | **5 类异常场景库**(零依赖纯模板,28 条场景):**boundary**(边界值,8 条)+ **concurrency**(并发,5 条)+ **network**(网络,5 条)+ **permission**(权限,5 条)+ **device**(设备,5 条)。每条含 id/category/title/description/trigger/expected/severity/keywords |
| 暂未实现 | PRD 关键词深度匹配(v0.2 计划,接 LLM 或词典匹配)/ LLM 二次校验(v0.3 计划,接 Claude Sonnet 4.5)/ R-SCENE-01~99 子规则细分 |
| 优先级 | Phase 1 §6 模块 3"上线异常场景发现器"启动 commit,代码资产 0 → 0.1 起步 |
| 关联规则 | `docs/异常场景/v0.1_异常场景_5类清单.md` |
| 关联模块 | `app/api/audit/text/route.ts`(模块 1,12 规则已收口,0909 T5)|

## 2. 接口

### 2.1 端点

```
POST /api/audit/scenarios
Content-Type: application/json
```

### 2.2 请求体

```typescript
{
  "feature": string,                            // 必填,功能名(≤ 200 字符)
  "prd"?: string,                               // 可选,产品需求描述(v0.1 仅记录不解析)
  "categories"?: Array<                        // 可选,限定返回类别,默认全 5 类
    "boundary" | "concurrency" | "network" | "permission" | "device"
  >
}
```

### 2.3 响应(200)

```typescript
{
  "feature": string,                            // 回传
  "total_scenarios": number,                    // 返回场景总数
  "by_category": {
    "boundary": Scenario[],                     // 边界值场景数组
    "concurrency": Scenario[],                  // 并发场景数组
    "network": Scenario[],                      // 网络场景数组
    "permission": Scenario[],                   // 权限场景数组
    "device": Scenario[]                        // 设备场景数组
  },
  "score_complexity": 1 | 2 | 3 | 4 | 5,        // 复杂度评分
  "summary": string,                            // 拼装中文摘要
  "meta": {
    "api_version": string,                      // "0.1.0-API-雏形"
    "feature_keywords_matched": string[],       // feature 命中的关键词(用于 v0.2 扩展)
    "categories_requested": Category[],         // 请求的 categories
    "categories_returned": Category[],          // 返回的 categories
    "scenarios_per_category": Record<Category, number>,  // 每类场景数
    "filter_mode": "all" | "category" | "keyword"        // 过滤模式
  }
}
```

**Scenario 形状**:

```typescript
{
  "id": string,             // "SC-B-01" / "SC-C-01" / "SC-N-01" / "SC-P-01" / "SC-D-01"
  "category": Category,     // 类别
  "title": string,          // 短描述(10-20 字)
  "description": string,    // 详细描述(20-50 字)
  "trigger": string,        // 触发条件
  "expected": string,       // 预期行为
  "severity": "low" | "medium" | "high" | "critical",  // 严重度
  "applicable_to": string[],// 适用功能类型(空 = 全适用,v0.1 全部空)
  "keywords": string[]      // 触发该场景的关键词
}
```

**score_complexity 评分规则**:

| 评分 | 触发条件 |
|------|---------|
| 1 | 极少场景(< 5)或仅 1 类活跃 |
| 2 | 5-10 场景,2 类活跃 |
| 3 | 11-20 场景,3 类活跃 |
| 4 | 21-30 场景,4-5 类活跃 |
| 5 | > 30 场景,全 5 类活跃(典型 28 条全清单) |

**filter_mode 取值**:

- `all`:无 categories 过滤,返回全 5 类清单(28 条)
- `category`:有 categories 过滤,仅返回指定类别
- `keyword`:feature 关键词命中(目前仅记录,不剔除场景)

## 3. 5 类异常场景库详情

### 3.1 boundary 边界值(8 条,SC-B-01 ~ SC-B-08)

| ID | 标题 | 严重度 |
|----|------|--------|
| SC-B-01 | 空输入 | high |
| SC-B-02 | 极大输入 | medium |
| SC-B-03 | 极小输入 | medium |
| SC-B-04 | 特殊字符(XSS/SQL/emoji) | high |
| SC-B-05 | 纯空白内容 | low |
| SC-B-06 | 数值溢出(Number.MAX_SAFE_INTEGER) | medium |
| SC-B-07 | 日期边界(倒置/跨年/闰年/时区) | medium |
| SC-B-08 | 列表为空/超长(分页边界) | low |

### 3.2 concurrency 并发(5 条,SC-C-01 ~ SC-C-05)

| ID | 标题 | 严重度 |
|----|------|--------|
| SC-C-01 | 重复提交 | high |
| SC-C-02 | 多端登录冲突 | high |
| SC-C-03 | 并发读写冲突 | high |
| SC-C-04 | 秒杀超卖 | critical |
| SC-C-05 | 接口重复调用(React strict mode) | medium |

### 3.3 network 网络(5 条,SC-N-01 ~ SC-N-05)

| ID | 标题 | 严重度 |
|----|------|--------|
| SC-N-01 | 弱网延迟 | high |
| SC-N-02 | 断网 | high |
| SC-N-03 | 接口超时(504/502/30s+) | medium |
| SC-N-04 | DNS 解析失败 | low |
| SC-N-05 | 代理/VPN 异常 | low |

### 3.4 permission 权限(5 条,SC-P-01 ~ SC-P-05)

| ID | 标题 | 严重度 |
|----|------|--------|
| SC-P-01 | 未登录访问 | high |
| SC-P-02 | 权限不足(普通用户访问管理) | high |
| SC-P-03 | Token 过期(JWT/session) | high |
| SC-P-04 | 越权操作(改 ID 查看他人) | critical |
| SC-P-05 | 角色变更(中途提升/降级) | medium |

### 3.5 device 设备(5 条,SC-D-01 ~ SC-D-05)

| ID | 标题 | 严重度 |
|----|------|--------|
| SC-D-01 | 老旧机型 | medium |
| SC-D-02 | 低分辨率(320px/2K+/平板) | low |
| SC-D-03 | 触屏 vs 鼠标(hover 失效) | medium |
| SC-D-04 | 横竖屏切换(布局错乱) | low |
| SC-D-05 | 系统版本差异(iOS Safari/WebView) | medium |

## 4. 用例

### 4.1 T1 GET 元信息

```bash
curl -sS http://localhost:3000/api/audit/scenarios
```

预期:返回 api/version/categories_implemented(5 类 + 各自 count)/total_scenarios(28)/severity_levels/filter_modes。

### 4.2 T2 全清单(无 categories,典型 28 条)

```bash
curl -sS -X POST http://localhost:3000/api/audit/scenarios \
  -H "Content-Type: application/json" \
  -d '{"feature":"用户登录"}'
```

预期:`total_scenarios=28`,`by_category` 5 类各含场景,`score_complexity=5`,`filter_mode="all"` 或 `"keyword"`(若 feature 命中关键词)。

### 4.3 T3 仅 boundary + network(类别过滤)

```bash
curl -sS -X POST http://localhost:3000/api/audit/scenarios \
  -H "Content-Type: application/json" \
  -d '{"feature":"商品下单","categories":["boundary","network"]}'
```

预期:`total_scenarios=13`(8 boundary + 5 network),`score_complexity=3`(13 场景 + 2 类活跃),`filter_mode="category"`,`categories_returned=["boundary","network"]`。

### 4.4 T4 关键词命中(无类别过滤)

```bash
curl -sS -X POST http://localhost:3000/api/audit/scenarios \
  -H "Content-Type: application/json" \
  -d '{"feature":"秒杀活动库存"}'
```

预期:`total_scenarios=28`,`feature_keywords_matched` 含"秒杀""库存""活动"等,`filter_mode="keyword"`。

### 4.5 T5 错误用例(feature 缺失)

```bash
curl -sS -X POST http://localhost:3000/api/audit/scenarios \
  -H "Content-Type: application/json" \
  -d '{}'
```

预期:400,`error="MISSING_FEATURE"`。

### 4.6 T6 错误用例(categories 含非法值)

```bash
curl -sS -X POST http://localhost:3000/api/audit/scenarios \
  -H "Content-Type: application/json" \
  -d '{"feature":"下单","categories":["boundary","unknown"]}'
```

预期:400,`error="INVALID_CATEGORY_VALUE"`,`valid_values=[...]`。

## 5. 后续版本扩展

- **v0.2**:PRD 关键词深度匹配 — 接词典或简单 LLM,根据 prd 字段(目前 v0.1 仅记录不解析)匹配更精准的场景
- **v0.3**:LLM 二次校验 — 接 Claude Sonnet 4.5,对生成的场景做"场景是否真实存在""trigger 是否合理""expected 是否可执行"的二次校验
- **R-SCENE-01~99 子规则**:目前 28 条为顶层场景,后续可按行业细分(如电商"秒杀超卖"、教育"退课流程"、金融"反洗钱"等子规则)
- **行业模板**:对接 36 行业咨询 agent,按行业(电商/教育/金融/医疗...)推荐行业特化场景

## 6. 关联文档

- 项目开发计划.md §3 模块 3 + §6 Phase 1 MVP
- docs/异常场景/v0.1_异常场景_5类清单.md(场景库规则详情)
- docs/api/audit-text-v0.1.md(姊妹模块 1 文案审查器)
- .plan/(2026-08-25 起漂移模式,详见 README.md "无 plan,临时决策" 段)
