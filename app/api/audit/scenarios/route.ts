/**
 * 异常场景发现器 API · v0.1 API 雏形
 *
 * Phase 1 §6 模块 3"上线异常场景发现器"启动
 * - 2026-09-10 T5 03:30:启动 commit,落 5 类异常场景库(零依赖纯模板,Phase 1 §6 收口后第一个非文案模块)
 *   - boundary(边界值):8 条
 *   - concurrency(并发):5 条
 *   - network(网络):5 条
 *   - permission(权限):5 条
 *   - device(设备):5 条
 *   - 合计 28 条异常场景,每条含 id/category/title/description/trigger/expected/severity
 *
 * 设计思路(v0.1 雏形):
 * - 零依赖纯模板:5 类异常场景库(SCENARIO_LIBRARY)是静态常量,POST 直接按 feature 关键词做"触发类型匹配",
 *   不命中关键词则返回全 5 类完整清单
 * - 不做"按 PRD 文本生成新场景",只做"按模板筛选 + 全清单兜底"两档
 * - v0.2 可接 PRD 关键词匹配扩展(v0.1 是 v0.2 的子集)
 * - v0.3 可接 LLM 二次校验(类似 v0.1 文案审查的 R-READ-02 路径)
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
    categories_requested: Category[];
    categories_returned: Category[];
    scenarios_per_category: Record<Category, number>;
    filter_mode: "all" | "category" | "keyword";
  };
}

// ============================================================
// 5 类异常场景库(静态常量,28 条,零外部依赖)
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
];

const CATEGORY_LABEL: Record<Category, string> = {
  boundary: "边界值",
  concurrency: "并发",
  network: "网络",
  permission: "权限",
  device: "设备",
};

const API_VERSION = "0.1.0-API-雏形";

// ============================================================
// 工具函数
// ============================================================

/** 按 feature 关键词 + 可选 categories 过滤场景库 */
function filterScenarios(feature: string, categories?: Category[]): {
  filtered: Scenario[];
  matchedKeywords: string[];
  filterMode: "all" | "category" | "keyword";
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

  // v0.1 雏形:有类别过滤就过滤,无类别就全清单;关键词仅记录不剔除
  // 后续 v0.2 可扩展:无关键词命中且无类别过滤时,降级为"返回全清单 + 提示"模式
  return {
    filtered: pool,
    matchedKeywords,
    filterMode: matchedKeywords.length > 0 && filterMode === "all" ? "keyword" : filterMode,
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

/** 拼装 summary */
function buildSummary(
  grouped: Record<Category, Scenario[]>,
  scoreComplexity: 1 | 2 | 3 | 4 | 5,
  feature: string,
  matchedKeywords: string[],
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

  // 3. 过滤场景
  const { filtered, matchedKeywords, filterMode } = filterScenarios(body.feature, body.categories);
  const grouped = groupByCategory(filtered);
  const scoreComplexity = calcComplexityScore(filtered, grouped);

  // 4. 拼装响应
  const totalScenarios = filtered.length;
  const summary = buildSummary(grouped, scoreComplexity, body.feature.trim(), matchedKeywords);

  const response: ScenariosResponse = {
    feature: body.feature.trim(),
    total_scenarios: totalScenarios,
    by_category: grouped,
    score_complexity: scoreComplexity,
    summary,
    meta: {
      api_version: API_VERSION,
      feature_keywords_matched: matchedKeywords,
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
        prd: "string (optional,产品需求描述,v0.1 仅记录不解析)",
        categories:
          "boundary | concurrency | network | permission | device[] (optional,默认全 5 类)",
      },
      response_shape: {
        feature: "string (回传)",
        total_scenarios: "number",
        by_category: "Record<5 类, Scenario[]> 每类 0-N 条",
        score_complexity: "1 | 2 | 3 | 4 | 5 (基于返回场景数 + 命中类别数)",
        summary: "string (拼装中文摘要)",
        meta: "元信息(版本/关键词命中/categories/scenarios_per_category/filter_mode)",
      },
      categories_implemented: [
        { id: "boundary", label: "边界值", count: scenariosPerCategory.boundary },
        { id: "concurrency", label: "并发", count: scenariosPerCategory.concurrency },
        { id: "network", label: "网络", count: scenariosPerCategory.network },
        { id: "permission", label: "权限", count: scenariosPerCategory.permission },
        { id: "device", label: "设备", count: scenariosPerCategory.device },
      ],
      total_scenarios: SCENARIO_LIBRARY.length,
      severity_levels: ["low", "medium", "high", "critical"],
      filter_modes: ["all(全 5 类清单兜底)", "category(按 categories 过滤)", "keyword(feature 关键词命中提示)"],
      rules_skipped: [
        "PRD 关键词深度匹配(v0.2 计划,接 LLM 或词典匹配)",
        "LLM 二次校验(v0.3 计划,接 Claude Sonnet 4.5)",
        "R-SCENE-01~99 子规则细分(目前 28 条为顶层场景,后续可按行业细分子规则)",
      ],
      docs: "docs/api/audit-scenarios-v0.1.md",
      related_apis: [
        { name: "文案审查器", endpoint: "/api/audit/text", version: "0.1.0-API-雏形+R-READ-02+5-零依赖规则+R-TYPO-06+R-TYPO-07+R-READ-03+R-TONE-04+R-TYPO-08" },
      ],
    },
    { status: 200 },
  );
}
