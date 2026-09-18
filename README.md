# DetailAdvisor

> 28-细部-Detail 行业 Web 项目 · 内部代号 DetailAdvisor

## 项目说明
基于张勇的 36 行业架构,DetailAdvisor 是 细部-Detail 行业的 Web 端顾问产品。

## 同步
- GitHub: https://github.com/1500385678/DetailAdvisor
- Gitee: https://gitee.com/architectzy/DetailAdvisor

## 自动化

### T4 02:30 写当日增量计划到 `.plan/`
- 默认约定:T4 当日 02:30 起草 `.plan/YYYYMMDD.md` 计划,包含 1 个当日要做的可入库小变更
- 计划命名约定:`.plan/YYYYMMDD.md` = 当日要执行的 plan(T4 提前 24h 写好)

### T5 03:30 按 `.plan/` 计划做小步开发并 commit + push
- Gitee 优先,GitHub 兜底
- 每次 T5 必须产出 1 个可入库小变更 + 1 个 commit
- 若 T5 完成时 `.plan/YYYYMMDD.md` 存在,完成后清理(见历史 commit `chore: 清理 YYYYMMDD 临时 plan` 系列)

### "无 plan,临时决策" 模式(0902-0903-0904 漂移模式,2026-09-04 起正式纳入约定)
- 触发条件:T4 未起草 `.plan/YYYYMMDD.md` 时,T5 可按 02:30 巡检"建议(给 T5 03:30 行动)"段中的最高优项,临时决策当次 T5 主交付
- **commit message 强制规范**:必须显式记录 "无 plan,临时决策" 字样,便于后续追溯
- 临时 plan 落地:T5 开工时手动创建 `.plan/YYYYMMDD.md` 记录"临时决策依据",T5 完成后按常规流程清理
- 历史漂移轨迹:
  - 0825-0828:严格执行 `.plan/` 约定,4 个 T4/T5 周期全部有 plan
  - 0829:Next.js 16 骨架落地,`.plan/` 出现首日漂移
  - 0829-0903:5 个 T4 周期中 4 个未起草 plan,0902/0903 T5 连续 2 天无 plan 直接交付
  - 0904-起:本 README 正式把"无 plan,临时决策"模式纳入约定,T4 → T5 耦合从"严格执行"松绑到"按需执行"
  - 0904-0909:连续 6 天无 plan,临时决策模式稳定,0825-0909 共 16 个 T4/T5 周期
  - 0910:连续 7 天无 plan,临时决策模式延续,启动 Phase 1 §6 模块 3 异常场景发现器 v0.1(兑现 0908 巡检"12 规则已收口,0910+ 可启动"),0825-0910 共 17 个 T4/T5 周期
- 约束:本约定不豁免"每次 T5 必须产出 1 个可入库小变更"的硬性要求;"无 plan"只是放宽 T4 → T5 的耦合,不放弃交付

## 变更记录
- 2026-09-04:增补"无 plan,临时决策"模式段,兑现 0904 巡检"高优"项 D(0903 巡检已建议但未兑现)
- 2026-09-10:补 0904-0909 漂移轨迹 + 0910 第 7 天延续;启动 Phase 1 §6 模块 3 异常场景发现器 v0.1(`app/api/audit/scenarios/route.ts` + 2 份 docs),兑现 0908 巡检"12 规则已收口,0910+ 可启动"决策
- 2026-09-14:`4d3fc3b` 主项勾选 + 3 触发条件决策(Next.js 16 Vercel 部署 / 飞书 bot v0.1 雏形 / dogfood 5 个产品 = 28-细部-Detail 行业聚焦)+ 路线图 A 财务/微服务场景 2 条(SC-B-11 浮点精度/财务舍入 + SC-C-07 分布式锁/资源竞争),§6 主项"- [ ] 验收上线文案审查器"+"- [ ] 验收上线异常场景发现器"2 个新增主项决策触发条件全 0914 T5 完成
- 2026-09-15:`228c5c4` 启动 audit-scenarios v0.2 PRD 关键词深度匹配 雏形(37 → 42 条,新增 SC-B-12 支付金额边界 + SC-B-13 账号锁定/失败重试 + SC-C-08 消息队列堆积 + SC-N-08 支付网关超时/3D-Secure + SC-P-07 密码强度/账号安全 5 条 v0.2 子场景 + PRD_KEYWORD_DICT 静态关键词词典 + prd 字段真正参与场景匹配);`docs/api/audit-scenarios-v0.2.md` 新建(15521 字节 6 大段 + 7 个 curl 用例)
- 2026-09-17:`7cf0e54` 启动 audit-text v0.2 R-TYPO-09 同音字词表 Top 50 子集(12 → 13 规则,接管 R-TYPO-01 命名空间,3 类 50 条 HOMOPHONE_PAIRS 静态词表 tech 15 + general 20 + idiom 15,长词优先匹配 + 区间去重)+ 补登 0913 巡检日志(`.Log/巡检-细部-20260913.md` 1319 字节轻量补登,非伪造历史快照,显式标注"0917 T5 轻量补登")+ 0827-0912 连续 17 份日志节奏恢复为 18 份
- 2026-09-18:`c3d185a` 启动 audit-scenarios v0.2.1 PRD 关键词上下文豁免 + PRD 多关键词权重排序(42 条场景库不变;`PRD_BRAND_EXEMPT_DICT` 5 子场景品牌白名单 + 距离 ≤ 20 字符豁免规则 + hit_count 降序排序;meta 新增 prd_exempted_scenarios + keyword_hit_counts 2 字段,filter_mode 扩 3 档 prd-exempted 复合形态);代码 917 → 10XX 行 +78 行,zero-dependency 纯字符串距离检测
