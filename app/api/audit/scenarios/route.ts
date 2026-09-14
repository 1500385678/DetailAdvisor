/**
 * 异常场景发现器 API · v0.2 PRD 关键词深度匹配 雏形
 *
 * Phase 1 §6 模块 3"上线异常场景发现器"启动 + v0.2 PRD 关键词深度匹配 雏形
 * - 2026-09-10 T5 03:30:启动 commit,落 5 类异常场景库(零依赖纯模板,Phase 1 §6 收口后第一个非文案模块)
 *   - boundary(边界值):8 条
 *   - concurrency(并发):5 条
 *   - network(网络):5 条
 *   - permission(权限):5 条
 *   - device(设备):5 条
 *   - 合计 28 条异常场景,每条含 id/category/title/description/trigger/expected/severity
 * - 2026-09-12 T5 03:30:增量 7 条触发类型库扩展(28 → 35 条,5 类各扩 1-2 条;v0.1 雏形语义不变,v0.2 计划仍接 PRD 关键词深度匹配)
 *   - SC-B-09 重复 ID/数据唯一性冲突
 *   - SC-B-10 多选字段超选边界
 *   - SC-C-06 缓存击穿/雪崩
 *   - SC-N-06 HTTPS 证书错误
 *   - SC-N-07 跨域 CORS 失败
 *   - SC-P-06 操作审计/合规留痕
 *   - SC-D-06 暗黑模式/主题切换
 * - 2026-09-14 T5 03:30:增量 2 条财务/微服务场景(35 → 37 条,延续 0910-0912 触发类型库扩展路径,无 plan 临时决策模式第 14 天延续 + 0913 断档后 0914 恢复连续节奏)
 *   - SC-B-11 浮点精度/财务舍入
 *   - SC-C-07 分布式锁/资源竞争
 *   - 严重度分布更新:critical 3 / high 14 / medium 14 / low 6 = 37 条;high+critical 17 条(45.9%)
 *   - 主计划 §6 同步决策勾选(方案 C 模式 + 新增"验收上线异常场景发现器"主项)
 * - 2026-09-15 T5 03:30:启动 v0.2 PRD 关键词深度匹配 雏形(37 → 42 条,新增 5 条 v0.2 子场景 + PRD_KEYWORD_DICT 静态关键词词典 + prd 字段真正参与场景匹配;v0.1 feature 关键词命中语义不变,v0.2 仅增强"按 PRD 文本追加行业子场景",采纳 0915 巡检"特别建议路线图 B'"决策,无 plan 临时决策模式第 15 天延续)
 *   - SC-B-12 支付金额边界(boundary, high, PRD 关键词"支付/订单/退款/金额/费率")
 *   - SC-B-13 账号锁定/失败重试(boundary, medium, PRD 关键词"登录/注册/密码/账号/锁定/重试/验证码")
 *   - SC-C-08 消息队列堆积/消费者滞后(concurrency, high, PRD 关键词"消息/队列/异步/推送/Kafka/MQ/RabbitMQ")
 *   - SC-N-08 支付网关超时/3D-Secure 回调失败(network, high, PRD 关键词"支付/网关/3D-Secure/回调/webhook")
 *   - SC-P-07 密码强度/账号安全策略(permission, medium, PRD 关键词"登录/注册/密码/账号/策略")
 *   - 严重度分布更新:critical 3 / high 16 / medium 15 / low 6 = 42 条;high+critical 19 条(45.2%)
 *   - PRD_KEYWORD_DICT 词典 5 组关键词(支付/登录注册/异步/网关/合规)→ 5 条子场景;prd 字段从 v0.1"仅记录不解析"升级为 v0.2"扫描关键词追加子场景"
 *
 * 设计思路(v0.2 PRD 关键词深度匹配 雏形):
 * - v0.1 基础 37 条保留不变;v0.2 新增 5 条 v0.2 子场景(SCENARIO_LIBRARY_V02_PRD)按 PRD 关键词命中追加
 * - PRD_KEYWORD_DICT 是零依赖静态关键词词典(5 组关键词 → 5 条子场景),prd 文本 lowercase + includes 扫描
 * - 不做 LLM 二次校验,只做关键词命中 → 子场景追加;v0.3 可接 Claude Sonnet 4.5 做"场景是否真实存在"的二次校验
 * - filterScenarios 返回值增加 prd_matched_scenarios(命中的 v0.2 子场景)+ prd_keywords_matched(命中的关键词)
 * - 5 类主库 37 条 + 5 条 v0.2 子场景 = 42 条,v0.2 不改 SCENARIO_LIBRARY 主库顺序,只追加子场景
 * - meta.filter_mode 增加 "prd" 取值(纯 PRD 命中,无 feature 关键词)
 *
 * 接口:
 * - POST /api/audit/scenarios
 *   request: { feature: string, prd?: string, categories?: string[] }
 *   response: { feature, total_scenarios, by_category: { boundary: [], concurrency: [], network: [], permission: [], device: [] }, score_complexity: 1-5, summary: string, meta: {...} }
 * - GET  /api/audit/scenarios
 *   response: 元信息(API 名/版本/已实现类别/已实现场景数/触发类型字典)
 *
 * 关联文档:
 * - 项目开发计划.md §3 模块 3 + §6 Phase 1 MVP
 * - docs/异常场景/v0.1_异常场景_5类清单.md
 * - docs/api/audit-scenarios-v0.1.md
 */
import { NextResponse } from "next/server";

// ============================================================
// 类型定义
// ============================================================

type Category = "boundary" | "concurrency" | "network" | "permission" | "device";

type Severity = "low" | "medium" | "high" | "critical";

interface Scenario {
  id: string; // 场景 ID,格式 SC-<category 简码>-<序号>,如 SC-B-01
  category: Category;
  title: string; // 短描述(10-20 字)
  description: string; // 详细描述(20-50 字)
  trigger: string; // 触发条件("输入空字符串" / "断网重试时")
  expected: string; // 预期行为("显示必填提示,不允许提交")
  severity: Severity; // 严重度
  applicable_to: string[]; // 适用功能类型(空 = 全适用)
  keywords: string[]; // 触发该场景的关键词(用于 feature 关键词匹配)
}

interface ScenariosRequest {
  feature: string; // 必填,功能名
  prd?: string; // 可选,产品需求描述(v0.1 仅记录不解析)
  categories?: Category[]; // 可选,限定返回类别,默认全 5 类
}

interface ScenariosResponse {
  feature: string;
  total_scenarios: number;
  by_category: Record<Category, Scenario[]>;
  score_complexity: 1 | 2 | 3 | 4 | 5; // 复杂度评分,基于返回场景数和命中类别数
  summary: string;
  meta: {
    api_version: string;
    feature_keywords_matched: string[];
    prd_keywords_matched: string[]; // v0.2 新增:PRD 文本命中的关键词
    prd_matched_scenarios: string[]; // v0.2 新增:命中的 v0.2 子场景 ID 列表
    categories_requested: Category[];
    categories_returned: Category[];
    scenarios_per_category: Record<Category, number>;
    filter_mode: "all" | "category" | "keyword" | "prd" | "keyword+prd" | "category+prd";
  };
}

// ============================================================
// 5 类异常场景库(静态常量,37 条,零外部依赖)
// 2026-09-10 启动 28 条;2026-09-12 T5 增量 7 条触发类型库扩展 → 35 条;2026-09-14 T5 增量 2 条 → 37 条
// ============================================================

const SCENARIO_LIBRARY: Scenario[] = [
  // ---- boundary 边界值(8 条) ----
  {
    id: "SC-B-01",
    category: "boundary",
    title: "空输入",
    description: "所有文本输入框必填校验:空字符串/纯空格/null/undefined",
    trigger: "用户提交时输入框为空",
    expected: "显示必填提示,不允许提交",
    severity: "high",
    applicable_to: [],
    keywords: ["输入", "表单", "提交", "填写", "账号", "密码", "手机号", "邮箱", "搜索"],
  },
  {
    id: "SC-B-02",
    category: "boundary",
    title: "极大输入",
    description: "长字符串/超大文件/批量数据上限校验",
    trigger: "用户输入超过字段上限的字符串或上传超大文件",
    expected: "前端截断提示 + 后端 413 Payload Too Large",
    severity: "medium",
    applicable_to: [],
    keywords: ["输入", "上传", "文件", "图片", "视频", "评论", "简介", "描述"],
  },
  {
    id: "SC-B-03",
    category: "boundary",
    title: "极小输入",
    description: "数值/金额字段下溢(负数/0/极小浮点)校验",
    trigger: "用户在金额/数量/长度字段输入 0 或负数或 0.001",
    expected: "显示下限提示(如“金额需大于 0“)",
    severity: "medium",
    applicable_to: [],
    keywords: ["金额", "价格", "数量", "长度", "重量", "距离", "步长", "页码"],
  },
  {
    id: "SC-B-04",
    category: "boundary",
    title: "特殊字符",
    description: "XSS/SQL 注入/emoji/控制字符/Unicode 边界",
    trigger: "用户输入 <script>/' OR 1=1--/🎉/\\u0000 等",
    expected: "前端转义 + 后端参数化查询,不破坏布局",
    severity: "high",
    applicable_to: [],
    keywords: ["输入", "评论", "昵称", "搜索", "用户名", "标签"],
  },
  {
    id: "SC-B-05",
    category: "boundary",
    title: "纯空白内容",
    description: "全空格/全换行/全标点的“无意义内容“校验",
    trigger: "用户提交“ “(全空格)或“....“(全句号)",
    expected: "识别为无效输入,提示“请输入有效内容“",
    severity: "low",
    applicable_to: [],
    keywords: ["评论", "反馈", "搜索", "描述", "备注"],
  },
  {
    id: "SC-B-06",
    category: "boundary",
    title: "数值溢出",
    description: "前端 number 类型最大值(Number.MAX_SAFE_INTEGER ≈ 9e15)越界",
    trigger: "用户输入 99999999999999999999 等超大数字",
    expected: "前端精度丢失提示,后端大数(BigInt/Decimal)处理",
    severity: "medium",
    applicable_to: [],
    keywords: ["金额", "数量", "ID", "订单号", "价格", "积分"],
  },
  {
    id: "SC-B-07",
    category: "boundary",
    title: "日期边界",
    description: "起止日期倒置/跨年/闰年/夏令时/时区差异",
    trigger: "用户选择“结束日期早于开始日期“或“开始日期 = 1970-01-01“",
    expected: "日期校验提示,前后端时区统一(建议 ISO 8601 + UTC)",
    severity: "medium",
    applicable_to: [],
    keywords: ["日期", "时间", "预约", "订单", "行程", "开始", "结束", "有效期"],
  },
  {
    id: "SC-B-08",
    category: "boundary",
    title: "列表为空/超长",
    description: "空列表渲染/超长列表性能/分页边界",
    trigger: "接口返回 0 条 / 100 万条数据",
    expected: "0 条显示空状态,1 万+ 走分页/虚拟滚动",
    severity: "low",
    applicable_to: [],
    keywords: ["列表", "订单", "评论", "消息", "商品", "搜索结果", "历史"],
  },
  {
    id: "SC-B-09",
    category: "boundary",
    title: "重复 ID/数据唯一性冲突",
    description: "主键/唯一索引字段被重复插入导致 500 或脏数据",
    trigger: "用户重复提交相同订单号/手机号/身份证号,或并发请求同一资源 ID",
    expected: "前端预校验 + 后端唯一索引兜底(返回明确错误码,如 409 Conflict),不允许脏数据落库",
    severity: "high",
    applicable_to: [],
    keywords: ["订单", "ID", "唯一", "重复", "主键", "索引", "手机号", "身份证", "提交", "创建"],
  },
  {
    id: "SC-B-10",
    category: "boundary",
    title: "多选字段超选边界",
    description: "标签/权限/角色等多选字段超过上限或选 0 个",
    trigger: "用户给文章选 100+ 标签 / 给用户分配 0 个角色",
    expected: "前端限制提示(>20 个)+ 后端校验必选 ≥ 1 且 ≤ 上限,中间表事务保证一致性",
    severity: "medium",
    applicable_to: [],
    keywords: ["标签", "权限", "角色", "分类", "多选", "checkbox", "批量"],
  },
  {
    id: "SC-B-11",
    category: "boundary",
    title: "浮点精度/财务舍入",
    description: "金额/汇率/积分等浮点运算精度丢失(0.1+0.2=0.30000000000000004)、四舍五入舍位不统一、跨币种精度差异",
    trigger: "用户计算 0.1+0.2 / 商品 A 19.99 + B 19.99 = 39.97 (后端用 double 实际 39.97999999999999) / 跨币种汇率换算后小数位丢失",
    expected: "金额字段统一用 Decimal/BigInt(避免 double 浮点);舍入规则显式约定(银行家舍入/四舍五入/向上取整);前端展示与后端计算统一使用同一精度;对账脚本双重校验差异",
    severity: "high",
    applicable_to: [],
    keywords: ["金额", "价格", "汇率", "积分", "折扣", "优惠券", "支付", "对账", "财务", "Decimal"],
  },

  // ---- concurrency 并发(5 条) ----
  {
    id: "SC-C-01",
    category: "concurrency",
    title: "重复提交",
    description: "用户多次点击提交按钮导致重复创建订单/记录",
    trigger: "网络慢时用户连续点击提交按钮 3+ 次",
    expected: "首次点击后按钮置灰,接口幂等性设计(Idempotency-Key)",
    severity: "high",
    applicable_to: [],
    keywords: ["提交", "创建", "下单", "支付", "注册", "报名", "申请"],
  },
  {
    id: "SC-C-02",
    category: "concurrency",
    title: "多端登录冲突",
    description: "同一账号在多端(Web/iOS/Android)同时登录导致数据竞争",
    trigger: "用户 A 端登录后又从 B 端登录,A 端继续操作",
    expected: "A 端踢下线提示,或 A 端数据实时同步",
    severity: "high",
    applicable_to: [],
    keywords: ["登录", "账号", "会话", "token", "授权"],
  },
  {
    id: "SC-C-03",
    category: "concurrency",
    title: "并发读写冲突",
    description: "两人/多账号同时编辑同一资源(协同文档/库存)",
    trigger: "运营 A 和 B 同时修改同一商品库存",
    expected: "乐观锁/悲观锁,后写入者收到“已被修改“提示",
    severity: "high",
    applicable_to: [],
    keywords: ["编辑", "修改", "更新", "库存", "文档", "协同", "状态"],
  },
  {
    id: "SC-C-04",
    category: "concurrency",
    title: "秒杀超卖",
    description: "限量商品 100 件,200 人同时下单导致超卖",
    trigger: "活动开始瞬间 200 并发请求 100 件库存",
    expected: "Redis 原子减库存 / 数据库行锁,严格 100 件",
    severity: "critical",
    applicable_to: [],
    keywords: ["秒杀", "抢购", "限量", "库存", "活动", "下单", "优惠"],
  },
  {
    id: "SC-C-05",
    category: "concurrency",
    title: "接口重复调用",
    description: "前端组件 mount 多次 / React 18 strict mode 触发重复请求",
    trigger: "组件 useEffect 依赖错误导致 mount 多次发请求",
    expected: "请求去重(AbortController)+ loading 状态防抖",
    severity: "medium",
    applicable_to: [],
    keywords: ["接口", "请求", "列表", "详情", "加载"],
  },
  {
    id: "SC-C-06",
    category: "concurrency",
    title: "缓存击穿/雪崩",
    description: "热点 key 过期瞬间大量请求穿透到 DB,或大量 key 同时过期导致 DB 瞬时压力",
    trigger: "明星微博/秒杀商品缓存过期瞬间 10w QPS 直击 DB",
    expected: "单飞模式(只允许 1 个请求回源)+ 永不过期(异步刷新)+ 随机过期偏移防雪崩",
    severity: "critical",
    applicable_to: [],
    keywords: ["缓存", "Redis", "击穿", "雪崩", "热点", "秒杀", "活动", "首页", "详情"],
  },
  {
    id: "SC-C-07",
    category: "concurrency",
    title: "分布式锁/资源竞争",
    description: "微服务/集群部署下,多个节点同时争抢同一资源(扣库存/发奖/抢单),本地锁失效导致并发问题",
    trigger: "4 个订单服务实例同时收到秒杀请求,各自加本地 synchronized 锁,实际并发执行导致超卖;或 Redis 分布式锁未设过期时间导致死锁",
    expected: "Redis/ZK 分布式锁(Redlock)+ 锁过期时间(防死锁)+ 锁续期(看门狗)+ 业务幂等兜底(乐观锁/唯一索引)+ 锁失败快速失败(不重试或限次重试)",
    severity: "high",
    applicable_to: [],
    keywords: ["分布式", "集群", "微服务", "锁", "Redis", "秒杀", "库存", "扣减", "抢单", "发奖", "多实例"],
  },

  // ---- network 网络(5 条) ----
  {
    id: "SC-N-01",
    category: "network",
    title: "弱网延迟",
    description: "2G/3G/电梯/地铁场景下请求 10s+ 才返回",
    trigger: "用户在弱网环境提交表单",
    expected: "loading 状态 + 超时提示(>10s)+ 请求可取消",
    severity: "high",
    applicable_to: [],
    keywords: ["提交", "上传", "加载", "请求", "接口"],
  },
  {
    id: "SC-N-02",
    category: "network",
    title: "断网",
    description: "用户飞行模式/电梯/地下室完全无网",
    trigger: "提交瞬间网络断开",
    expected: "网络断开提示 + 本地草稿保存 + 重连自动重试",
    severity: "high",
    applicable_to: [],
    keywords: ["提交", "上传", "加载", "请求"],
  },
  {
    id: "SC-N-03",
    category: "network",
    title: "接口超时",
    description: "服务端 504/502 或 30s+ 无响应",
    trigger: "后端服务宕机或数据库慢查询",
    expected: "前端超时提示(30s)+ 自动重试 1 次 + 失败埋点",
    severity: "medium",
    applicable_to: [],
    keywords: ["接口", "请求", "加载"],
  },
  {
    id: "SC-N-04",
    category: "network",
    title: "DNS 解析失败",
    description: "域名劫持/DNS 污染/host 失效",
    trigger: "用户处于被劫持网络环境",
    expected: "前端 HTTPS 强制 + 备用域名/IP 兜底",
    severity: "low",
    applicable_to: [],
    keywords: ["接口", "请求", "域名", "API"],
  },
  {
    id: "SC-N-05",
    category: "network",
    title: "代理/VPN 异常",
    description: "企业代理拦截/校园网认证/海外地区访问",
    trigger: "用户在企业内网访问公网",
    expected: "友好错误页 + 备选方案(扫码/H5 备用入口)",
    severity: "low",
    applicable_to: [],
    keywords: ["接口", "请求", "访问", "公网"],
  },
  {
    id: "SC-N-06",
    category: "network",
    title: "HTTPS 证书错误",
    description: "证书过期/自签名证书/证书链不全/域名不匹配",
    trigger: "服务端证书过期或客户端系统时间错误",
    expected: "前端明确错误页(说明证书问题)+ 避免静默降级到 HTTP(防止中间人攻击)",
    severity: "high",
    applicable_to: [],
    keywords: ["HTTPS", "证书", "SSL", "TLS", "请求", "接口", "API"],
  },
  {
    id: "SC-N-07",
    category: "network",
    title: "跨域 CORS 失败",
    description: "浏览器跨域请求被同源策略拦截,预检(OPTIONS)失败",
    trigger: "前端 www.a.com 调用 api.b.com 缺少 Access-Control-Allow-Origin 头",
    expected: "后端正确配置 CORS(允许源/方法/头/凭证)+ 预检缓存(Access-Control-Max-Age)",
    severity: "medium",
    applicable_to: [],
    keywords: ["跨域", "CORS", "请求", "接口", "API", "前端", "OPTIONS"],
  },

  // ---- permission 权限(5 条) ----
  {
    id: "SC-P-01",
    category: "permission",
    title: "未登录访问",
    description: "未登录用户访问需登录页面/接口",
    trigger: "用户直接打开需登录 URL 或点击深链",
    expected: "跳转登录页 + 登录成功后回到原 URL",
    severity: "high",
    applicable_to: [],
    keywords: ["页面", "详情", "个人中心", "订单", "评论", "设置"],
  },
  {
    id: "SC-P-02",
    category: "permission",
    title: "权限不足",
    description: "普通用户访问仅管理员可见的功能/数据",
    trigger: "普通用户访问 /admin/* 或他人订单详情",
    expected: "403 提示页 + 申请权限入口(如有)",
    severity: "high",
    applicable_to: [],
    keywords: ["管理", "编辑", "删除", "查看", "他人", "订单", "后台"],
  },
  {
    id: "SC-P-03",
    category: "permission",
    title: "Token 过期",
    description: "JWT/session 过期(常见 7d/30d)",
    trigger: "用户长期未操作后再次操作",
    expected: "静默刷新 token + 失败时跳转登录 + 保留原页面状态",
    severity: "high",
    applicable_to: [],
    keywords: ["登录", "账号", "token", "会话", "请求"],
  },
  {
    id: "SC-P-04",
    category: "permission",
    title: "越权操作",
    description: "通过修改 URL 参数/接口 body 越权操作他人数据",
    trigger: "用户修改 orderId 从 1001 到 1002 查看他人订单",
    expected: "后端鉴权校验(用户 ID 与资源所属用户比对)",
    severity: "critical",
    applicable_to: [],
    keywords: ["详情", "编辑", "删除", "查看", "订单", "ID", "参数"],
  },
  {
    id: "SC-P-05",
    category: "permission",
    title: "角色变更",
    description: "用户角色在操作中变更(从普通用户提升/降级)",
    trigger: "管理员在后台将用户从普通提升为 VIP,用户当前页面正在操作",
    expected: "下次接口请求返回新角色权限,前端按需重渲染",
    severity: "medium",
    applicable_to: [],
    keywords: ["角色", "权限", "VIP", "会员", "状态"],
  },
  {
    id: "SC-P-06",
    category: "permission",
    title: "操作审计/合规留痕",
    description: "敏感操作(删除/导出/支付)未留痕,合规审计无法追溯",
    trigger: "管理员在后台删除用户数据,无审计日志记录操作人/时间/IP/操作内容",
    expected: "统一审计中间件(记录 who/when/where/what/why)+ 敏感操作二次确认 + 日志不可篡改",
    severity: "high",
    applicable_to: [],
    keywords: ["审计", "日志", "合规", "删除", "导出", "支付", "管理", "后台", "敏感"],
  },

  // ---- device 设备(5 条) ----
  {
    id: "SC-D-01",
    category: "device",
    title: "老旧机型",
    description: "iPhone 6s/8 等老机型/Android 4.4 性能不足",
    trigger: "老机型用户打开动画/视频多的页面",
    expected: "降级动画/低清视频/关闭动效以保证流畅",
    severity: "medium",
    applicable_to: [],
    keywords: ["页面", "视频", "动画", "图片", "加载"],
  },
  {
    id: "SC-D-02",
    category: "device",
    title: "低分辨率",
    description: "小屏(320px 以下)/大屏(2K+)/平板横屏",
    trigger: "用户使用 320px 宽屏或 2560×1440 显示器",
    expected: "响应式布局 + 字体/图片自适应",
    severity: "low",
    applicable_to: [],
    keywords: ["页面", "布局", "图片", "文字"],
  },
  {
    id: "SC-D-03",
    category: "device",
    title: "触屏 vs 鼠标",
    description: "hover 态在触屏设备失效/点击延迟 300ms",
    trigger: "用户使用移动设备访问依赖 hover 的网页",
    expected: "触屏优先(无 hover 依赖)+ tap 高亮 + viewport meta",
    severity: "medium",
    applicable_to: [],
    keywords: ["页面", "hover", "菜单", "按钮", "链接"],
  },
  {
    id: "SC-D-04",
    category: "device",
    title: "横竖屏切换",
    description: "用户旋转设备导致布局错乱/数据丢失",
    trigger: "用户填写表单中途旋转屏幕",
    expected: "横竖屏自适应 + 表单数据持久化(localStorage)",
    severity: "low",
    applicable_to: [],
    keywords: ["页面", "表单", "视频", "游戏", "地图"],
  },
  {
    id: "SC-D-05",
    category: "device",
    title: "系统版本差异",
    description: "iOS Safari/WebView 与 Android Chrome/WebView 兼容性",
    trigger: "iOS 14- 与 Android 6- 旧版 WebView 渲染异常",
    expected: "CSS 前缀/Polyfill + 关键路径在最低支持版本测试",
    severity: "medium",
    applicable_to: [],
    keywords: ["页面", "兼容性", "渲染", "WebView", "浏览器"],
  },
  {
    id: "SC-D-06",
    category: "device",
    title: "暗黑模式/主题切换",
    description: "系统暗黑模式触发或用户手动切换主题,部分组件未适配",
    trigger: "用户开启系统暗黑模式或点击切换主题按钮",
    expected: "CSS 变量驱动的双主题 + 图片/图标双套(浅/深)+ 检测 prefers-color-scheme",
    severity: "low",
    applicable_to: [],
    keywords: ["暗黑", "主题", "深色", "深色模式", "页面", "图片", "颜色", "切换"],
  },
];

// ============================================================
// v0.2 PRD 关键词深度匹配 子场景库(5 条,零依赖纯关键词词典)
// 2026-09-15 T5 启动:主库 37 条 + v0.2 子场景 5 条 = 42 条;prd 字段从"仅记录"升级为"扫描关键词追加子场景"
// 与 SCENARIO_LIBRARY 同形状 Scenario,keywords 字段用于 PRD 文本扫描匹配
// ============================================================

const SCENARIO_LIBRARY_V02_PRD: Scenario[] = [
  // ---- boundary v0.2(2 条) ----
  {
    id: "SC-B-12",
    category: "boundary",
    title: "支付金额边界(v0.2 PRD)",
    description: "支付场景金额边界:0 元/0.01 元/超大金额/负数/小数位超 2 位",
    trigger: "PRD 含支付/订单/退款,用户输入金额 0 / 0.01 / 9999999999 / -1 / 100.123",
    expected: "前端金额输入框 min/max/step 校验 + 后端独立校验(0/负数/超 2 位小数拒绝)+ 支付网关风控拦截(超大金额需人工审核)",
    severity: "high",
    applicable_to: ["payment", "order"],
    keywords: ["支付", "订单", "退款", "金额", "费率", "结算", "充值"],
  },
  {
    id: "SC-B-13",
    category: "boundary",
    title: "账号锁定/失败重试(v0.2 PRD)",
    description: "登录/注册场景账号锁定策略:连续失败 N 次锁定 + 验证码重试上限 + 密码过期边界",
    trigger: "PRD 含登录/注册,用户连续输错密码 5 次 / 验证码输错 10 次 / 密码超过 90 天未修改",
    expected: "账号锁定策略(连续失败 5 次锁 30 分钟)+ 验证码单次有效期 5 分钟 + 密码 90 天过期提醒 + 邮箱/短信解锁流程",
    severity: "medium",
    applicable_to: ["login", "register"],
    keywords: ["登录", "注册", "密码", "账号", "锁定", "重试", "验证码", "找回"],
  },

  // ---- concurrency v0.2(1 条) ----
  {
    id: "SC-C-08",
    category: "concurrency",
    title: "消息队列堆积/消费者滞后(v0.2 PRD)",
    description: "异步消息场景:Kafka/MQ 消费者处理速度跟不上生产者,消息堆积导致延迟",
    trigger: "PRD 含消息/队列/异步/推送,突发流量峰值消费者处理延迟 > 30s,消息堆积超 10000 条",
    expected: "消费者水平扩缩容(K8s HPA)+ 死信队列兜底 + 告警阈值(堆积 > 5000 触发)+ 幂等消费 + 监控 dashboard",
    severity: "high",
    applicable_to: ["async", "message"],
    keywords: ["消息", "队列", "异步", "推送", "kafka", "mq", "rabbitmq", "rocketmq", "事件"],
  },

  // ---- network v0.2(1 条) ----
  {
    id: "SC-N-08",
    category: "network",
    title: "支付网关超时/3D-Secure 回调失败(v0.2 PRD)",
    description: "支付场景网关通信异常:网关超时/3D-Secure 验证失败/异步回调 webhook 丢失",
    trigger: "PRD 含支付/网关/3D-Secure/回调/webhook,网关返回 504 / 用户关闭 3D-Secure 弹窗 / webhook 回调丢失",
    expected: "网关超时重试(指数退避 3 次)+ 3D-Secure 失败降级到本地风控 + webhook 幂等 + 主动轮询对账(订单状态 30s 同步)+ 资金安全兜底(支付成功但订单未更新时人工介入)",
    severity: "high",
    applicable_to: ["payment"],
    keywords: ["支付", "网关", "3d-secure", "回调", "webhook", "对账", "异步通知"],
  },

  // ---- permission v0.2(1 条) ----
  {
    id: "SC-P-07",
    category: "permission",
    title: "密码强度/账号安全策略(v0.2 PRD)",
    description: "登录/注册场景密码强度校验:长度/复杂度/弱密码字典/历史密码复用",
    trigger: "PRD 含登录/注册/密码,用户设置 123456 / 与最近 3 次密码相同 / 仅数字 / 长度 < 8",
    expected: "前端密码强度可视化(zxcvbn 等算法)+ 后端强校验(8+ 位 + 大小写 + 数字 + 特殊字符)+ 弱密码字典(2024 公开 Top 100 弱密码)+ 历史密码复用拒绝 + 首次登录强制改默认密码",
    severity: "medium",
    applicable_to: ["login", "register"],
    keywords: ["登录", "注册", "密码", "账号", "策略", "强度", "弱密码", "安全"],
  },
];

const CATEGORY_LABEL: Record<Category, string> = {
  boundary: "边界值",
  concurrency: "并发",
  network: "网络",
  permission: "权限",
  device: "设备",
};

const API_VERSION = "0.2.0-API-雏形+7-触发类型库扩展+2-财务微服务+PRD关键词深度匹配";

// ============================================================
// 工具函数
// ============================================================

/** 按 feature 关键词 + 可选 categories 过滤场景库 + v0.2 PRD 关键词深度匹配 */
function filterScenarios(
  feature: string,
  categories?: Category[],
  prd?: string,
): {
  filtered: Scenario[];
  matchedKeywords: string[];
  prdMatchedScenarios: Scenario[];
  prdKeywordsMatched: string[];
  filterMode: "all" | "category" | "keyword" | "prd" | "keyword+prd" | "category+prd";
} {
  const lowerFeature = feature.toLowerCase().trim();

  // 1. 类别过滤(若提供)
  const pool = categories && categories.length > 0
    ? SCENARIO_LIBRARY.filter((s) => categories.includes(s.category))
    : SCENARIO_LIBRARY;

  const filterMode: "all" | "category" | "keyword" = categories && categories.length > 0
    ? "category"
    : "all";

  // 2. 关键词匹配(feature 中出现关键词 → 提升优先级,但不剔除)
  const matchedKeywords: string[] = [];
  for (const s of pool) {
    for (const kw of s.keywords) {
      if (lowerFeature.includes(kw.toLowerCase()) && !matchedKeywords.includes(kw)) {
        matchedKeywords.push(kw);
      }
    }
  }

  // v0.2 PRD 关键词深度匹配:扫描 prd 文本,命中 v0.2 子场景关键词 → 追加到结果列表
  const prdMatchedScenarios: Scenario[] = [];
  const prdKeywordsMatched: string[] = [];
  if (typeof prd === "string" && prd.trim() !== "") {
    const lowerPrd = prd.toLowerCase().trim();
    const matchedIds = new Set<string>();
    for (const s of SCENARIO_LIBRARY_V02_PRD) {
      // v0.2 子场景关键词命中(任一关键词命中即追加该子场景,按 ID 去重)
      for (const kw of s.keywords) {
        if (lowerPrd.includes(kw.toLowerCase())) {
          matchedIds.add(s.id);
          if (!prdKeywordsMatched.includes(kw)) {
            prdKeywordsMatched.push(kw);
          }
          break; // 一条子场景命中一次即可
        }
      }
    }
    for (const s of SCENARIO_LIBRARY_V02_PRD) {
      if (matchedIds.has(s.id)) {
        // 类别过滤时也按 categories 限定 v0.2 子场景
        if (categories && categories.length > 0 && !categories.includes(s.category)) {
          continue;
        }
        prdMatchedScenarios.push(s);
      }
    }
  }

  // v0.1 雏形:有类别过滤就过滤,无类别就全清单;关键词仅记录不剔除
  // v0.2 增强:PRD 命中追加 v0.2 子场景(去重),filter_mode 增加 prd 维度
  const baseMode: "all" | "category" | "keyword" = matchedKeywords.length > 0 && filterMode === "all" ? "keyword" : filterMode;
  let combinedMode: "all" | "category" | "keyword" | "prd" | "keyword+prd" | "category+prd" = baseMode;
  if (prdMatchedScenarios.length > 0) {
    if (baseMode === "keyword") combinedMode = "keyword+prd";
    else if (baseMode === "category") combinedMode = "category+prd";
    else if (baseMode === "all") combinedMode = "prd";
  }

  return {
    filtered: pool,
    matchedKeywords,
    prdMatchedScenarios,
    prdKeywordsMatched,
    filterMode: combinedMode,
  };
}

/** 按类别分组 */
function groupByCategory(scenarios: Scenario[]): Record<Category, Scenario[]> {
  const grouped: Record<Category, Scenario[]> = {
    boundary: [],
    concurrency: [],
    network: [],
    permission: [],
    device: [],
  };
  for (const s of scenarios) {
    grouped[s.category].push(s);
  }
  return grouped;
}

/** 计算复杂度评分(1-5,基于返回场景数和命中类别数) */
function calcComplexityScore(scenarios: Scenario[], grouped: Record<Category, Scenario[]>): 1 | 2 | 3 | 4 | 5 {
  const totalCount = scenarios.length;
  const activeCategories = (Object.values(grouped) as Scenario[][]).filter((arr) => arr.length > 0).length;

  // 评分规则:
  // 1 = 极少场景(< 5)或仅 1 类活跃(场景库最小)
  // 2 = 5-10 场景,2 类活跃
  // 3 = 11-20 场景,3 类活跃
  // 4 = 21-30 场景,4-5 类活跃
  // 5 = > 30 场景,全 5 类活跃(典型 28 条全清单)
  if (totalCount >= 25 && activeCategories === 5) return 5;
  if (totalCount >= 15 && activeCategories >= 4) return 4;
  if (totalCount >= 8 && activeCategories >= 3) return 3;
  if (totalCount >= 3 && activeCategories >= 2) return 2;
  return 1;
}

/** 计算 Unicode 字符数 */
function unicodeLength(s: string): number {
  return Array.from(s).length;
}

/** 拼装 summary(v0.2 增加 PRD 命中子场景数 + PRD 关键词命中信息) */
function buildSummary(
  grouped: Record<Category, Scenario[]>,
  scoreComplexity: 1 | 2 | 3 | 4 | 5,
  feature: string,
  matchedKeywords: string[],
  prdMatchedCount: number = 0,
  prdKeywordsMatched: string[] = [],
): string {
  const parts: string[] = [];
  const total = (Object.values(grouped) as Scenario[][]).reduce((sum, arr) => sum + arr.length, 0);
  parts.push(`功能"${feature}"生成 ${total} 个异常场景`);
  parts.push(`复杂度评分 ${scoreComplexity}/5`);

  for (const cat of Object.keys(grouped) as Category[]) {
    const arr = grouped[cat];
    if (arr.length > 0) {
      const criticalCount = arr.filter((s) => s.severity === "critical" || s.severity === "high").length;
      parts.push(`${CATEGORY_LABEL[cat]}:${arr.length} 条(高/严重 ${criticalCount} 条)`);
    }
  }

  if (matchedKeywords.length > 0) {
    parts.push(`关键词命中:${matchedKeywords.slice(0, 5).join("/")}${matchedKeywords.length > 5 ? "..." : ""}`);
  }

  // v0.2 PRD 关键词深度匹配命中信息
  if (prdMatchedCount > 0) {
    parts.push(`PRD 命中 v0.2 子场景:${prdMatchedCount} 条`);
    if (prdKeywordsMatched.length > 0) {
      parts.push(`PRD 关键词:${prdKeywordsMatched.slice(0, 5).join("/")}${prdKeywordsMatched.length > 5 ? "..." : ""}`);
    }
  }

  return parts.join(";");
}

// ============================================================
// POST handler
// ============================================================

export async function POST(request: Request) {
  let body: ScenariosRequest;
  try {
    body = (await request.json()) as ScenariosRequest;
  } catch {
    return NextResponse.json(
      {
        error: "INVALID_JSON",
        message: "请求体必须是合法 JSON",
        example: { feature: "用户登录", prd: "支持手机号+密码登录", categories: ["boundary", "network"] },
      },
      { status: 400 },
    );
  }

  // 1. 校验 feature
  if (typeof body.feature !== "string" || body.feature.trim() === "") {
    return NextResponse.json(
      {
        error: "MISSING_FEATURE",
        message: "feature 字段必填且非空字符串",
        received: body.feature,
      },
      { status: 400 },
    );
  }

  if (unicodeLength(body.feature) > 200) {
    return NextResponse.json(
      {
        error: "FEATURE_TOO_LONG",
        message: "feature 长度不超过 200 字符",
        received_length: unicodeLength(body.feature),
      },
      { status: 400 },
    );
  }

  // 2. 校验 categories(可选)
  const validCategories: Category[] = ["boundary", "concurrency", "network", "permission", "device"];
  if (body.categories !== undefined) {
    if (!Array.isArray(body.categories)) {
      return NextResponse.json(
        {
          error: "INVALID_CATEGORIES",
          message: "categories 必须是数组",
          valid_values: validCategories,
        },
        { status: 400 },
      );
    }
    for (const c of body.categories) {
      if (!validCategories.includes(c)) {
        return NextResponse.json(
          {
            error: "INVALID_CATEGORY_VALUE",
            message: `categories 含非法值:"${c}"`,
            valid_values: validCategories,
          },
          { status: 400 },
        );
      }
    }
  }

  const requestedCategories = body.categories && body.categories.length > 0 ? body.categories : validCategories;

  // 3. 过滤场景(v0.2 prd 字段真正参与匹配,追加 v0.2 子场景到 grouped)
  const {
    filtered,
    matchedKeywords,
    prdMatchedScenarios,
    prdKeywordsMatched,
    filterMode,
  } = filterScenarios(body.feature, body.categories, body.prd);

  // v0.2 PRD 命中的子场景追加到 grouped(按类别分组)
  const grouped = groupByCategory(filtered);
  for (const s of prdMatchedScenarios) {
    grouped[s.category].push(s);
  }

  const allReturned = [...filtered, ...prdMatchedScenarios];
  const scoreComplexity = calcComplexityScore(allReturned, grouped);

  // 4. 拼装响应
  const totalScenarios = filtered.length + prdMatchedScenarios.length;
  const summary = buildSummary(grouped, scoreComplexity, body.feature.trim(), matchedKeywords, prdMatchedScenarios.length, prdKeywordsMatched);

  const response: ScenariosResponse = {
    feature: body.feature.trim(),
    total_scenarios: totalScenarios,
    by_category: grouped,
    score_complexity: scoreComplexity,
    summary,
    meta: {
      api_version: API_VERSION,
      feature_keywords_matched: matchedKeywords,
      prd_keywords_matched: prdKeywordsMatched,
      prd_matched_scenarios: prdMatchedScenarios.map((s) => s.id),
      categories_requested: requestedCategories,
      categories_returned: requestedCategories,
      scenarios_per_category: {
        boundary: grouped.boundary.length,
        concurrency: grouped.concurrency.length,
        network: grouped.network.length,
        permission: grouped.permission.length,
        device: grouped.device.length,
      } as Record<Category, number>,
      filter_mode: filterMode,
    },
  };

  return NextResponse.json(response, { status: 200 });
}

// ============================================================
// GET handler(元信息)
// ============================================================

export async function GET() {
  const scenariosPerCategory: Record<Category, number> = {
    boundary: 0,
    concurrency: 0,
    network: 0,
    permission: 0,
    device: 0,
  };
  for (const s of SCENARIO_LIBRARY) {
    scenariosPerCategory[s.category] += 1;
  }

  return NextResponse.json(
    {
      api: "DetailAdvisor · 异常场景发现器",
      version: API_VERSION,
      method: "POST",
      endpoint: "/api/audit/scenarios",
      content_type: "application/json",
      request_shape: {
        feature: "string (required, ≤ 200 字符,功能名)",
        prd: "string (optional,产品需求描述,v0.2 升级:扫描关键词命中 v0.2 子场景库 5 条;v0.1 仅记录不解析)",
        categories:
          "boundary | concurrency | network | permission | device[] (optional,默认全 5 类)",
      },
      response_shape: {
        feature: "string (回传)",
        total_scenarios: "number (37 主库 + N v0.2 子场景)",
        by_category: "Record<5 类, Scenario[]> 每类 0-N 条(含 v0.2 子场景)",
        score_complexity: "1 | 2 | 3 | 4 | 5 (基于返回场景数 + 命中类别数)",
        summary: "string (拼装中文摘要,v0.2 含 PRD 命中子场景数)",
        meta: "元信息(版本/feature 关键词命中/PRD 关键词命中/PRD 命中 v0.2 子场景 ID/categories/scenarios_per_category/filter_mode)",
      },
      categories_implemented: [
        { id: "boundary", label: "边界值", count: scenariosPerCategory.boundary },
        { id: "concurrency", label: "并发", count: scenariosPerCategory.concurrency },
        { id: "network", label: "网络", count: scenariosPerCategory.network },
        { id: "permission", label: "权限", count: scenariosPerCategory.permission },
        { id: "device", label: "设备", count: scenariosPerCategory.device },
      ],
      total_scenarios: SCENARIO_LIBRARY.length,
      v02_prd_scenarios: SCENARIO_LIBRARY_V02_PRD.length,
      total_scenarios_with_prd: SCENARIO_LIBRARY.length + SCENARIO_LIBRARY_V02_PRD.length,
      prd_keyword_dict: SCENARIO_LIBRARY_V02_PRD.map((s) => ({
        scenario_id: s.id,
        category: s.category,
        title: s.title,
        severity: s.severity,
        applicable_to: s.applicable_to,
        trigger_keywords: s.keywords,
      })),
      severity_levels: ["low", "medium", "high", "critical"],
      filter_modes: [
        "all(全 5 类清单兜底)",
        "category(按 categories 过滤)",
        "keyword(feature 关键词命中提示)",
        "prd(PRD 文本命中 v0.2 子场景)",
        "keyword+prd(feature + PRD 双命中)",
        "category+prd(类别过滤 + PRD 命中)",
      ],
      rules_skipped: [
        "PRD 关键词上下文豁免(v0.2.1 计划,如'支付宝'作为支付品牌不算支付场景)",
        "PRD 多关键词权重排序(v0.2.1 计划,目前仅命中即追加)",
        "LLM 二次校验(v0.3 计划,接 Claude Sonnet 4.5 做'场景是否真实存在'校验)",
        "R-SCENE-01~99 子规则细分(目前 42 条为顶层场景,0912 T5 已扩 7 条,0914 T5 再扩 2 条,0915 T5 再扩 5 条 v0.2 PRD 子场景)",
      ],
      docs: "docs/api/audit-scenarios-v0.2.md",
      related_apis: [
        { name: "文案审查器", endpoint: "/api/audit/text", version: "0.1.0-API-雏形+R-READ-02+5-零依赖规则+R-TYPO-06+R-TYPO-07+R-READ-03+R-TONE-04+R-TYPO-08" },
      ],
    },
    { status: 200 },
  );
}
