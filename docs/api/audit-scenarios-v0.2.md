# 异常场景发现器 API · v0.2 PRD 关键词深度匹配 雏形

> DetailAdvisor 模块 3(异常场景发现器)后端 API · v0.2 雏形 · 2026-09-10(启动) / 2026-09-12(增量扩展) / 2026-09-14(再增量) / 2026-09-15(v0.2 PRD 关键词深度匹配启动)
> 落地 commit:
> - 0910 T5 03:30:启动 commit,落 5 类异常场景库(零依赖纯模板,Phase 1 §6 收口后第一个非文案模块)
> - 0912 T5 03:30:增量 7 条触发类型库扩展(28 → 35 条,5 类各扩 1-2 条;v0.1 雏形语义不变,v0.2 计划仍接 PRD 关键词深度匹配)
> - 0914 T5 03:30:增量 2 条财务/微服务场景(35 → 37 条;延续 0910-0912 触发类型库扩展路径,0913 断档后 0914 恢复连续节奏)
> - **0915 T5 03:30:启动 v0.2 PRD 关键词深度匹配 雏形(37 → 42 条,新增 5 条 v0.2 子场景 + PRD_KEYWORD_DICT 静态关键词词典 + prd 字段真正参与场景匹配;v0.1 feature 关键词命中语义不变,v0.2 仅增强"按 PRD 文本追加行业子场景",采纳 0915 巡检"特别建议路线图 B'"决策,无 plan 临时决策模式第 15 天延续)**
> 入口: `app/api/audit/scenarios/route.ts`(Next.js 16 App Router Route Handler)
> 历史文档: `docs/api/audit-scenarios-v0.1.md`(v0.1 37 条版本)
> 决策依据:0908 T5 巡检建议"12 规则已收口,0910+ 可启动异常场景发现器";0912 巡检"特别建议路线图 B(audit-scenarios 触发类型库扩展)";0914 巡检"最高优:兑现 1 项轻量交付 + 2 项主计划修改合并同次 commit";0915 巡检"特别建议路线图 B'(audit-scenarios v0.2 PRD 关键词深度匹配)";无 plan 临时决策模式第 11/13/14/15 天延续

---

## 1. 范围

| 项 | 说明 |
|----|------|
| 当前已实现 | **5 类异常场景库 + v0.2 PRD 关键词深度匹配**(零依赖纯模板,**42 条场景(0910 启动 28 + 0912 +7 + 0914 +2 + 0915 +5 v0.2 子场景)**,2026-09-15 T5 启动 v0.2 PRD 关键词深度匹配 雏形):**boundary**(边界值,13 条:11 主库 + 2 v0.2)+ **concurrency**(并发,8 条:7 主库 + 1 v0.2)+ **network**(网络,8 条:7 主库 + 1 v0.2)+ **permission**(权限,7 条:6 主库 + 1 v0.2)+ **device**(设备,6 条主库,v0.2 未扩);v0.2 子场景由 PRD_KEYWORD_DICT 静态关键词词典触发,prd 字段从 v0.1"仅记录不解析"升级为 v0.2"扫描关键词命中追加子场景",filter_mode 增加 3 档(prd / keyword+prd / category+prd) |
| 暂未实现 | PRD 关键词上下文豁免(v0.2.1 计划,如"支付宝"作为支付品牌不算支付场景)/ PRD 多关键词权重排序(v0.2.1 计划,目前仅命中即追加)/ LLM 二次校验(v0.3 计划,接 Claude Sonnet 4.5 做"场景是否真实存在"校验)/ R-SCENE-01~99 子规则细分(0912 T5 已扩 7 条,0914 T5 再扩 2 条,0915 T5 再扩 5 条 v0.2 PRD 子场景) |
| 关联规则 | `docs/异常场景/v0.2_异常场景_5类清单.md` |

---

## 2. 接口

### 2.1 端点

- `POST /api/audit/scenarios`
- `GET  /api/audit/scenarios`(元信息)

### 2.2 请求体

```typescript
{
  "feature": string,                               // 必填,功能名,≤ 200 字符
  "prd"?: string,                                  // 可选,产品需求描述,v0.2 扫描关键词命中 v0.2 子场景库 5 条
  "categories"?: Category[]                        // 可选,限定返回类别,默认全 5 类
}
```

### 2.3 响应(200)

```typescript
{
  "feature": string,                            // 回传
  "total_scenarios": number,                    // 37 主库 + N v0.2 子场景
  "by_category": {
    "boundary": Scenario[],                     // 边界值场景数组(含 v0.2)
    "concurrency": Scenario[],                  // 并发场景数组(含 v0.2)
    "network": Scenario[],                      // 网络场景数组(含 v0.2)
    "permission": Scenario[],                   // 权限场景数组(含 v0.2)
    "device": Scenario[]                        // 设备场景数组(v0.2 未扩)
  },
  "score_complexity": 1 | 2 | 3 | 4 | 5,        // 复杂度评分
  "summary": string,                            // 拼装中文摘要(含 PRD 命中子场景数)
  "meta": {
    "api_version": string,                      // "0.2.0-API-雏形+7-触发类型库扩展+2-财务微服务+PRD关键词深度匹配"
    "feature_keywords_matched": string[],       // feature 命中的关键词
    "prd_keywords_matched": string[],           // v0.2 新增:PRD 命中的关键词(每条 v0.2 子场景的 1 个代表词)
    "prd_matched_scenarios": string[],          // v0.2 新增:命中的 v0.2 子场景 ID 列表
    "categories_requested": Category[],         // 请求的 categories
    "categories_returned": Category[],          // 返回的 categories
    "scenarios_per_category": Record<Category, number>,  // 每类场景数(含 v0.2 子场景)
    "filter_mode": "all" | "category" | "keyword" | "prd" | "keyword+prd" | "category+prd"
  }
}
```

**Scenario 形状**:同 v0.1,字段 `id / category / title / description / trigger / expected / severity / applicable_to / keywords`,v0.2 子场景的 `applicable_to` 字段填充适用功能类型(payment/login/async 等)。

**score_complexity 评分规则**:同 v0.1,基于返回场景数和命中类别数,v0.2 子场景也参与计数。

**filter_mode 取值(v0.2 扩展 3 档)**:

- `all`:无 categories 过滤,无 PRD 命中,返回全 5 类清单(37 条)
- `category`:有 categories 过滤,仅返回指定类别(可能含 v0.2 子场景)
- `keyword`:feature 关键词命中(目前仅记录,不剔除场景)
- `prd`:**v0.2 新增**,PRD 文本命中 v0.2 子场景(feature 关键词未命中)
- `keyword+prd`:**v0.2 新增**,feature + PRD 双命中
- `category+prd`:**v0.2 新增**,类别过滤 + PRD 命中(PRD 命中的 v0.2 子场景按 categories 限定)

---

## 3. 5 类异常场景库详情(含 v0.2 子场景)

### 3.1 boundary 边界值(13 条,SC-B-01 ~ SC-B-13)

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
| SC-B-09 | 重复 ID/数据唯一性冲突 | high |
| SC-B-10 | 多选字段超选边界 | medium |
| SC-B-11 | 浮点精度/财务舍入(0914 T5 增量) | high |
| **SC-B-12** | **支付金额边界(0915 T5 v0.2 PRD)** | **high** |
| **SC-B-13** | **账号锁定/失败重试(0915 T5 v0.2 PRD)** | **medium** |

### 3.2 concurrency 并发(8 条,SC-C-01 ~ SC-C-08)

| ID | 标题 | 严重度 |
|----|------|--------|
| SC-C-01 | 重复提交 | high |
| SC-C-02 | 多端登录冲突 | high |
| SC-C-03 | 并发读写冲突 | high |
| SC-C-04 | 秒杀超卖 | critical |
| SC-C-05 | 接口重复调用(React strict mode) | medium |
| SC-C-06 | 缓存击穿/雪崩 | critical |
| SC-C-07 | 分布式锁/资源竞争(0914 T5 增量) | high |
| **SC-C-08** | **消息队列堆积/消费者滞后(0915 T5 v0.2 PRD)** | **high** |

### 3.3 network 网络(8 条,SC-N-01 ~ SC-N-08)

| ID | 标题 | 严重度 |
|----|------|--------|
| SC-N-01 | 弱网延迟 | high |
| SC-N-02 | 断网 | high |
| SC-N-03 | 接口超时(504/502/30s+) | medium |
| SC-N-04 | DNS 解析失败 | low |
| SC-N-05 | 代理/VPN 异常 | low |
| SC-N-06 | HTTPS 证书错误 | high |
| SC-N-07 | 跨域 CORS 失败 | medium |
| **SC-N-08** | **支付网关超时/3D-Secure 回调失败(0915 T5 v0.2 PRD)** | **high** |

### 3.4 permission 权限(7 条,SC-P-01 ~ SC-P-07)

| ID | 标题 | 严重度 |
|----|------|--------|
| SC-P-01 | 未登录访问 | high |
| SC-P-02 | 权限不足(普通用户访问管理) | high |
| SC-P-03 | Token 过期(JWT/session) | high |
| SC-P-04 | 越权操作(改 ID 查看他人) | critical |
| SC-P-05 | 角色变更(中途提升/降级) | medium |
| SC-P-06 | 操作审计/合规留痕 | high |
| **SC-P-07** | **密码强度/账号安全策略(0915 T5 v0.2 PRD)** | **medium** |

### 3.5 device 设备(6 条,SC-D-01 ~ SC-D-06,v0.2 未扩)

| ID | 标题 | 严重度 |
|----|------|--------|
| SC-D-01 | 老旧机型 | medium |
| SC-D-02 | 低分辨率(320px/2K+/平板) | low |
| SC-D-03 | 触屏 vs 鼠标(hover 失效) | medium |
| SC-D-04 | 横竖屏切换(布局错乱) | low |
| SC-D-05 | 系统版本差异(iOS Safari/WebView) | medium |
| SC-D-06 | 暗黑模式/主题切换 | low |

---

## 4. PRD 关键词词典(v0.2 核心)

PRD_KEYWORD_DICT 是零依赖静态关键词词典,5 条 v0.2 子场景的 keywords 字段即"触发关键词":

| v0.2 子场景 | 类别 | 严重度 | 触发关键词 | 适用功能 |
|-------------|------|--------|-----------|----------|
| SC-B-12 支付金额边界 | boundary | high | 支付 / 订单 / 退款 / 金额 / 费率 / 结算 / 充值 | payment / order |
| SC-B-13 账号锁定/失败重试 | boundary | medium | 登录 / 注册 / 密码 / 账号 / 锁定 / 重试 / 验证码 / 找回 | login / register |
| SC-C-08 消息队列堆积/消费者滞后 | concurrency | high | 消息 / 队列 / 异步 / 推送 / kafka / mq / rabbitmq / rocketmq / 事件 | async / message |
| SC-N-08 支付网关超时/3D-Secure 回调失败 | network | high | 支付 / 网关 / 3d-secure / 回调 / webhook / 对账 / 异步通知 | payment |
| SC-P-07 密码强度/账号安全策略 | permission | medium | 登录 / 注册 / 密码 / 账号 / 策略 / 强度 / 弱密码 / 安全 | login / register |

**扫描逻辑**:

- PRD 文本 `lowerCase + trim` 后,对每条 v0.2 子场景的 keywords 做 `includes` 扫描
- 任一关键词命中即追加该子场景到 `prdMatchedScenarios`(按 ID 去重,一条场景命中一次即可)
- 命中关键词的第一个代表性词收集到 `prd_keywords_matched`(每条子场景 1 个,避免元信息过长)
- 类别过滤时,PRD 命中的 v0.2 子场景也按 `categories` 限定(若 PRD 命中 SC-C-08 但 categories=["boundary"]则不返回)
- filter_mode 综合判定:`prd` / `keyword+prd` / `category+prd`

**典型 PRD → 命中场景映射示例**:

- PRD: "用户下单后跳转支付网关,3D-Secure 验证,webhook 回调更新订单状态,支持退款" → SC-B-12 + SC-N-08(2 条)
- PRD: "支持手机号+密码登录,验证码 5 分钟有效,连续失败 5 次锁定账号" → SC-B-13 + SC-P-07(2 条)
- PRD: "使用 Kafka 异步处理用户推送,死信队列兜底" → SC-C-08(1 条)
- PRD: "支持登录注册、密码策略、下单支付、Kafka 异步消息推送、操作审计合规日志" → 5 条 v0.2 子场景全命中(42 条)

---

## 5. 用例

### 5.1 T1 GET 元信息(v0.2 版本)

```bash
curl -sS http://localhost:3000/api/audit/scenarios
```

预期:返回 api/version/v0.2.0+PRD关键词深度匹配 + categories_implemented(5 类 + 各自 count:11/7/7/6/6 = 37)+ total_scenarios(37 主库)+ v02_prd_scenarios(5)+ total_scenarios_with_prd(42)+ prd_keyword_dict(5 条)+ severity_levels(4 档)+ filter_modes(6 档 含 prd / keyword+prd / category+prd)。

### 5.2 T2 全清单 + PRD 支付场景(无 categories)

```bash
curl -sS -X POST http://localhost:3000/api/audit/scenarios \
  -H "Content-Type: application/json" \
  -d '{"feature":"下单支付","prd":"支持支付宝/微信支付,3D-Secure 验证,webhook 回调,退款流程"}'
```

预期:`total_scenarios=39`(37 主库 + 2 v0.2 子场景),`mode="keyword+prd"`,`prd_matched_scenarios=["SC-B-12", "SC-N-08"]`,`by_category.boundary=12` / `by_category.network=8`,summary 含 "PRD 命中 v0.2 子场景:2 条"。

### 5.3 T3 PRD 不命中(回归 v0.1 兼容)

```bash
curl -sS -X POST http://localhost:3000/api/audit/scenarios \
  -H "Content-Type: application/json" \
  -d '{"feature":"天气预报","prd":"用户输入城市名,查询 7 天天气数据"}'
```

预期:`total_scenarios=37`,`mode="all"`,`prd_matched_scenarios=[]`,summary 不含 PRD 命中段(完全回归 v0.1)。

### 5.4 T4 categories + PRD 双过滤

```bash
curl -sS -X POST http://localhost:3000/api/audit/scenarios \
  -H "Content-Type: application/json" \
  -d '{"feature":"下单支付","prd":"支付宝支付,Kafka 异步消息推送","categories":["boundary"]}'
```

预期:`total_scenarios=12`(11 主库 boundary + 1 v0.2 SC-B-12),`mode="category+prd"`,`prd_matched_scenarios=["SC-B-12"]`(SC-C-08 命中但 concurrency 类被过滤)。

### 5.5 T5 PRD 4 类关键词全命中(极端用例)

```bash
curl -sS -X POST http://localhost:3000/api/audit/scenarios \
  -H "Content-Type: application/json" \
  -d '{"feature":"综合","prd":"支持用户登录注册密码策略,下单支付 3D-Secure 回调,Kafka 异步消息推送,操作审计合规日志"}'
```

预期:`total_scenarios=42`(37 + 5 v0.2 子场景全命中),`mode="prd"`,`prd_matched_scenarios=["SC-B-12","SC-B-13","SC-C-08","SC-N-08","SC-P-07"]`。

### 5.6 T6 错误用例(feature 缺失,v0.1 兼容)

```bash
curl -sS -X POST http://localhost:3000/api/audit/scenarios \
  -H "Content-Type: application/json" \
  -d '{"prd":"支付相关"}'
```

预期:400,`error="MISSING_FEATURE"`(v0.2 不放宽 feature 必填约束)。

### 5.7 T7 错误用例(categories 含非法值,v0.1 兼容)

```bash
curl -sS -X POST http://localhost:3000/api/audit/scenarios \
  -H "Content-Type: application/json" \
  -d '{"feature":"下单","categories":["boundary","unknown"]}'
```

预期:400,`error="INVALID_CATEGORY_VALUE"`,`valid_values=[...]`。

---

## 6. 严重度分布与代码资产

**严重度分布**(0915 T5 v0.2 增量后 42 条):

| 严重度 | 0910 启动 28 条 | 0912 增量后 35 条 | 0914 增量后 37 条 | **0915 v0.2 后 42 条** |
|--------|----------------|-------------------|-------------------|------------------------|
| critical | 3 | 3 | 3 | 3 |
| high | 10 | 12 | 14 | **16** |
| medium | 11 | 14 | 14 | **15** |
| low | 4 | 6 | 6 | 6 |
| **合计** | 28 | 35 | 37 | **42** |
| **high+critical** | 13(46.4%) | 15(42.9%) | 17(45.9%) | **19(45.2%)** |

**代码资产**:

- `app/api/audit/scenarios/route.ts`:679 行(0910 启动)→ 765 行(0912 +7 增量)→ 80X 行(0914 +2 增量)→ 917 行(0915 +5 v0.2 子场景 + PRD 匹配逻辑)
- `docs/api/audit-scenarios-v0.1.md`:238 行(历史)
- `docs/api/audit-scenarios-v0.2.md`:本文件,新版

---

## 7. 后续版本扩展

- **v0.2.1**:PRD 关键词上下文豁免(用 LLM 或品牌白名单,如"支付宝"作为支付品牌不算支付场景)+ PRD 多关键词权重排序(目前仅命中即追加,可按关键词权重排序)
- **v0.3**:LLM 二次校验 — 接 Claude Sonnet 4.5,对生成的场景做"场景是否真实存在""trigger 是否合理""expected 是否可执行"的二次校验
- **R-SCENE-01~99 子规则**:目前 42 条为顶层场景,后续可按行业细分(如电商"秒杀超卖"、教育"退课流程"、金融"反洗钱"等子规则);0912 T5 已扩 7 条 + 0914 T5 再扩 2 条 + 0915 T5 再扩 5 条 v0.2 PRD 子场景
- **行业模板**:对接 36 行业咨询 agent,按行业(电商/教育/金融/医疗...)推荐行业特化场景
- **PRD 深度解析**:v1 计划,接 LLM 做 PRD 句子级解析(而非 v0.2 关键词级扫描),输出"PRD 第 N 句可能涉及的异常场景"

---

## 8. 关联文档

- 项目开发计划.md §3 模块 3 + §6 Phase 1 MVP
- docs/异常场景/v0.2_异常场景_5类清单.md(场景库规则详情,v0.2 版本)
- docs/api/audit-scenarios-v0.1.md(v0.1 历史版本,37 条)
- docs/api/audit-text-v0.1.md(姊妹模块 1 文案审查器)
- .plan/(2026-08-25 起漂移模式,详见 README.md "无 plan,临时决策" 段)