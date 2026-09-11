<template>
  <!-- ═══════════════════════════════════════════════════════════════
       16 营销 · 代理商管理（设计稿 v1.6 #sec-agent · 行 1965~2225）
       根节点直接是内容片段，外层由 PlatformLayout 的 <main class="pf-main"> 包裹。
       数据：本页无对应接口（api.ts 未提供代理商相关 API），全部以空态 + TODO 占位，
       严禁硬编码业务示例值（代理商名称 / 分成比例 / 金额等）。
       ═══════════════════════════════════════════════════════════════ -->
  <div class="agent-mgmt">
    <!-- 主面板：页签 ① 代理商配置 / ② 代理商分润 -->
    <div class="panel">
      <div class="tabs">
        <span class="tab on">① 代理商配置</span>
        <span class="tab">② 代理商分润 <span class="v13-tag lt">v1.3</span></span>
      </div>

      <div class="p-bd">
        <!-- ───────── ① 代理商配置 页头 ───────── -->
        <div class="pg-hd">
          <div>
            <div class="pt4">代理商配置 <span class="v13-tag lt">v1.3</span></div>
            <p class="pd">
              代理商 = 平台签约渠道伙伴：在授权区域内发展商户、按层级拿货并赚取现金分润 ·
              归属优先级：同一商户同时命中代理商邀请与老带新时，代理商邀请优先
            </p>
          </div>
          <div class="pg-act">
            <span class="btn" @click="todo('分润规则')">分润规则 ›</span>
            <span class="btn" @click="todo('导出台账')">导出台账</span>
            <span class="btn btn-p" @click="openCreate">+ 开通代理商</span>
          </div>
        </div>

        <!-- 概览指标（4 张 KPI） -->
        <div class="g4">
          <div class="kpi">
            <div class="kt">代理商总数</div>
            <div class="kv">{{ kpi?.total ?? '—' }}</div>
            <div class="kd">{{ kpi ? `一级 ${kpi.lvl1} · 二级 ${kpi.lvl2}` : '—' }}</div>
          </div>
          <div class="kpi">
            <div class="kt">累计发展商户</div>
            <div class="kv">{{ kpi?.merchants ?? '—' }}</div>
            <div class="kd">占付费租户 <span class="up">{{ kpi?.merchantsPct ?? '—' }}</span></div>
          </div>
          <div class="kpi">
            <div class="kt">本月分润（渠道成本线）</div>
            <div class="kv">{{ money(kpi?.monthProfit) }}</div>
            <div class="kd">现金分佣 · 与积分线并存</div>
          </div>
          <div class="kpi">
            <div class="kt">待结算金额</div>
            <div class="kv">{{ money(kpi?.pendingSettle) }}</div>
            <div class="kd">{{ kpi?.pendingSettleCount ?? '—' }} 家 · 月结账期</div>
          </div>
        </div>

        <!-- 代理商列表 -->
        <div class="panel mt12">
          <div class="p-hd">
            <span class="pt">代理商列表</span>
            <div class="frow">
              <span class="sel">全部层级 ▾</span>
              <span class="sel">全部状态 ▾</span>
              <input class="ipt" placeholder="搜索名称 / 授权区域 / 推广码" />
            </div>
          </div>
          <div class="tblwrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>代理商名称</th>
                  <th>等级</th>
                  <th>授权区域</th>
                  <th>联系人</th>
                  <th class="num">发展商户数</th>
                  <th class="num">累计销售额</th>
                  <th class="num">累计分润</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="agentList.length === 0">
                  <td :colspan="9" class="empty">暂无代理商数据</td>
                </tr>
                <tr v-for="a in agentList" :key="a.id">
                  <td>
                    <b>{{ a.name }}</b>
                    <span class="sub">{{ a.sub }}</span>
                  </td>
                  <td><span class="tag" :class="a.levelClass">{{ a.level }}</span></td>
                  <td>{{ a.region }}</td>
                  <td>{{ a.contact }}<span class="sub">{{ a.contactPhone }}</span></td>
                  <td class="num"><b>{{ a.merchantCount }}</b></td>
                  <td class="num">{{ a.salesTotal }}</td>
                  <td class="num"><b>{{ a.profitTotal }}</b></td>
                  <td><span class="tag" :class="a.statusClass">{{ a.status }}</span></td>
                  <td>
                    <span class="btn-t">详情</span>
                    <span class="btn-t">编辑</span>
                    <span class="btn-t">台账</span>
                    <span class="btn-t dgr">冻结</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="pagebar">
            <span>共 {{ agentList.length }} 家代理商 · 每页 10 条</span>
            <div class="pgbtns">
              <span v-for="p in agentTotalPages" :key="p" :class="{ on: p === agentPage }">{{ p }}</span>
              <span v-if="agentTotalPages > 1">›</span>
            </div>
          </div>
        </div>

        <!-- 层级权益配置（一级 / 二级） -->
        <div class="panel mt12">
          <div class="p-hd">
            <span class="pt">层级权益配置 <span class="v13-tag lt">v1.3</span></span>
            <span class="ph-s">按层级统一预置，开通时自动套用；可对单个代理商单独微调并留痕</span>
          </div>
          <div class="p-bd">
            <div class="g2">
              <!-- 一级代理 -->
              <div class="panel">
                <div class="p-hd">
                  <span class="pt lv-pt">一级代理</span>
                  <span class="tag tag-b">可发展二级代理</span>
                </div>
                <div class="p-bd lv-bd">
                  <div>
                    <p class="b lv-label">可售套餐范围（从套餐模板勾选）</p>
                    <div class="mx">
                      <div class="mx-hd">当前在售套餐模板 4 个 · 免费版不参与分销</div>
                      <div class="mx-bd">
                        <span class="mx-it"><span class="ck" :class="{ on: l1.tiers.basic }"></span>基础版 ¥4,800/年</span>
                        <span class="mx-it"><span class="ck" :class="{ on: l1.tiers.standard }"></span>标准版 ¥9,800/年</span>
                        <span class="mx-it"><span class="ck" :class="{ on: l1.tiers.flagship }"></span>旗舰版 ¥19,800/年</span>
                        <span class="mx-it mx-locked"><span class="ck"></span>免费版（不可勾选）</span>
                      </div>
                    </div>
                  </div>
                  <div class="frow">
                    <span class="lv-sml">拿货折扣区间</span>
                    <input class="ipt cell-num" :style="{ width: 'var(--mtx-cell-w)' }" v-model="l1.discountLow" />
                    <span class="small">至</span>
                    <input class="ipt cell-num" :style="{ width: 'var(--mtx-cell-w)' }" v-model="l1.discountHigh" />
                    <span class="small">低于下限需超级管理员审批</span>
                  </div>
                  <div class="lv-toggle">
                    <span class="tg" :class="{ off: !l1.canDevelop }"></span>
                    <b class="lv-toggle-t">允许发展下级代理</b>
                    <span class="small">二级代理由一级自行招募 · 平台备案审核后生效</span>
                  </div>
                </div>
              </div>
              <!-- 二级代理 -->
              <div class="panel">
                <div class="p-hd">
                  <span class="pt lv-pt">二级代理</span>
                  <span class="tag tag-gy">层级封顶 · 不可再发展</span>
                </div>
                <div class="p-bd lv-bd">
                  <div>
                    <p class="b lv-label">可售套餐范围（从套餐模板勾选）</p>
                    <div class="mx">
                      <div class="mx-hd">受上级一级代理可售范围约束（取交集）</div>
                      <div class="mx-bd">
                        <span class="mx-it"><span class="ck" :class="{ on: l2.tiers.basic }"></span>基础版 ¥4,800/年</span>
                        <span class="mx-it"><span class="ck" :class="{ on: l2.tiers.standard }"></span>标准版 ¥9,800/年</span>
                        <span class="mx-it"><span class="ck" :class="{ on: l2.tiers.flagship }"></span>旗舰版（未开放）</span>
                        <span class="mx-it mx-locked"><span class="ck"></span>免费版（不可勾选）</span>
                      </div>
                    </div>
                  </div>
                  <div class="frow">
                    <span class="lv-sml">拿货折扣区间</span>
                    <input class="ipt cell-num" :style="{ width: 'var(--mtx-cell-w)' }" v-model="l2.discountLow" />
                    <span class="small">至</span>
                    <input class="ipt cell-num" :style="{ width: 'var(--mtx-cell-w)' }" v-model="l2.discountHigh" />
                    <span class="small">不得优于上级拿货价</span>
                  </div>
                  <div class="lv-toggle">
                    <span class="tg off"></span>
                    <b class="lv-toggle-t">允许发展下级代理</b>
                    <span class="small">二级为最末层级，开关锁定关闭</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ───────── ② 代理商分润 页头 ───────── -->
        <div class="pg-hd mt20">
          <div>
            <div class="pt4">代理商分润 <span class="v13-tag lt">v1.3</span></div>
            <p class="pd">
              现金分佣配置与结算：比例矩阵手动配置（不内置定死）→ 分润模式开关 → 按账期结算 → 退款 / 作废自动冲回 ·
              分润为平台<b>渠道成本线</b>，与老带新<b>营销成本线</b>并存互不替代
            </p>
          </div>
          <div class="pg-act">
            <span class="btn" @click="todo('分润试算器')">分润试算器</span>
          </div>
        </div>

        <!-- 分润规则配置 · 比例矩阵 -->
        <div class="panel mt12 agent-profit-panel">
          <div class="p-hd">
            <span class="pt">分润规则配置 · 比例矩阵 <span class="v13-tag lt">v1.3</span></span>
            <span class="ph-s">行 = 代理商层级 · 列 = 套餐档位 · 单元格 = 分润比例（占分润基数 %）</span>
            <span class="tag tag-o">未生效 · 配置未完整</span>
          </div>
          <div class="p-bd profit-bd">
            <div class="tipbar w">
              <span class="ic">!</span>
              <span>
                <b>请先配置分润比例：</b>矩阵存在未填项——分润比例<b>不内置定死</b>，须由平台管理员手动填写并保存；
                矩阵未配置完整时，代理商分润<b>整体置灰不生效</b>，新签订单暂不产生分润，矩阵补全并保存后自动启用。
              </span>
            </div>

            <div class="v13-mtx v13-dim">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>代理商层级 \ 套餐档位</th>
                    <th>基础版（¥4,800/年）</th>
                    <th>标准版（¥9,800/年）</th>
                    <th>旗舰版（¥19,800/年）</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, ri) in matrix" :key="ri">
                    <td>
                      <b>{{ row.level }}</b>
                      <span class="sub">{{ row.sub }}</span>
                    </td>
                    <td v-for="(c, ci) in row.cells" :key="ci">
                      <input
                        class="ipt cell-in"
                        :class="{ 'is-unset': c.value == null }"
                        v-model="c.value"
                        :placeholder="c.value == null ? '未设置' : ''"
                      />
                      <span class="small">%</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p class="small mod-rec">
              <span class="v13-tag lt mod-rec-tag">v1.3</span>
              <b>修改记录：</b>暂无配置变更留痕（矩阵完整配置并保存后将自动记录操作人与时间，仅对此后新订单生效，历史账单按成交时比例结算）。全部配置变更留痕可审计。
            </p>

            <div class="profit-ft">
              <span class="btn" @click="resetMatrix">清空重填</span>
              <span class="btn btn-p save-disabled" @click="todo('保存配置')">保存配置</span>
            </div>
          </div>
        </div>

        <!-- 分润模式开关 -->
        <div class="panel mt12">
          <div class="p-hd">
            <span class="pt">分润模式开关</span>
            <span class="tag tag-o">待矩阵配置完整后整体生效</span>
          </div>
          <div class="p-bd profit-bd">
            <div class="lv-toggle">
              <span class="tg" :class="{ off: !sw.newOrder }" @click="sw.newOrder = !sw.newOrder"></span>
              <b class="lv-toggle-t">新签订单分润</b>
              <span class="small">代理商发展商户首次付费，按矩阵比例计分润</span>
            </div>
            <div class="lv-toggle">
              <span class="tg off" @click="sw.renew = !sw.renew"></span>
              <b class="lv-toggle-t">续费订单分润</b>
              <span class="small">开启后按新签比例的</span>
              <input class="ipt cell-num" :style="{ width: 'var(--mtx-cell-w)' }" v-model="sw.renewRate" />
              <span class="small">% 计发 · 默认关闭</span>
            </div>
            <div class="lv-toggle">
              <span class="tg off" @click="sw.valueAdd = !sw.valueAdd"></span>
              <b class="lv-toggle-t">增值收入分润（额度包 / AI 计费）</b>
              <span class="small">额度包与 AI 超额费用按矩阵比例计分润 · 默认关闭</span>
            </div>
          </div>
        </div>

        <!-- 计算基数说明 -->
        <div class="tipbar mt12">
          <span class="ic">i</span>
          <span>
            <b>计算基数：分润基数 = 订单实收现金金额。</b>积分抵扣部分与平台券部分<b>不计入</b>分润基数
            （与 v1.2「积分抵扣 Token」机制咬合：积分属营销资产冲抵、不形成现金实收）；优惠码折扣后的实收金额即为基数。
          </span>
        </div>

        <!-- 结算规则 -->
        <div class="panel mt12">
          <div class="p-hd"><span class="pt">结算规则</span></div>
          <div class="p-bd">
            <div class="frow" style="align-items: flex-end">
              <span class="fld">
                <span>结算账期</span>
                <span class="sel">月结（每月 5 日出账） ▾</span>
              </span>
              <span class="fld">
                <span>提现门槛</span>
                <input class="ipt" v-model="settleCfg.threshold" />
              </span>
              <span class="fld">
                <span>结算方式</span>
                <span class="sel">对公转账 ▾</span>
              </span>
            </div>
            <p class="small mt8">
              账期支持 月结 / 季结 切换（切换后下一账期生效）；单期分润低于提现门槛自动滚存至下期；
              提现申请经平台财务审核后放款。
            </p>
          </div>
        </div>

        <!-- 分润台账 -->
        <div class="panel mt12">
          <div class="p-hd">
            <span class="pt">分润台账</span>
            <div class="frow">
              <span class="sel">代理商：全部 ▾</span>
              <span class="sel">状态：全部 ▾</span>
              <input class="ipt" placeholder="搜索商户 / 订单号" />
              <span class="btn" @click="todo('导出')">导出</span>
            </div>
          </div>
          <div class="tblwrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>商户（租户）</th>
                  <th>订单号</th>
                  <th>套餐</th>
                  <th class="num">订单实收</th>
                  <th class="num">分润基数</th>
                  <th>比例</th>
                  <th class="num">分润金额</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="ledgerList.length === 0">
                  <td :colspan="10" class="empty">暂无分润台账记录</td>
                </tr>
                <tr v-for="r in ledgerList" :key="r.id">
                  <td>{{ r.time }}</td>
                  <td><b>{{ r.tenant }}</b><span class="sub">{{ r.agent }}</span></td>
                  <td>{{ r.orderNo }}</td>
                  <td>{{ r.plan }}</td>
                  <td class="num">{{ r.received }}</td>
                  <td class="num">{{ r.base }}</td>
                  <td><span class="tag" :class="r.ratioClass">{{ r.ratio }}</span></td>
                  <td class="num"><b>{{ r.amount }}</b></td>
                  <td><span class="tag" :class="r.statusClass">{{ r.status }}</span></td>
                  <td><span class="btn-t">明细</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="pagebar">
            <span>共 {{ ledgerList.length }} 条分润记录 · 每页 10 条</span>
            <div class="pgbtns">
              <span v-for="p in ledgerTotalPages" :key="p" :class="{ on: p === ledgerPage }">{{ p }}</span>
              <span v-if="ledgerTotalPages > 1">›</span>
            </div>
          </div>
        </div>

        <!-- 结算管理 -->
        <div class="panel mt12">
          <div class="p-hd">
            <span class="pt">结算管理</span>
            <span class="ph-s">账期 2026-09（月结）· 结算单经财务复核后推送代理商确认</span>
          </div>
          <div class="p-bd">
            <div class="g3">
              <!-- 待结算汇总 -->
              <div class="panel">
                <div class="p-bd">
                  <p class="b sum-title">待结算汇总</p>
                  <div class="sum-amount">{{ money(settle?.pendingTotal) }}</div>
                  <p class="small mt6">
                    {{ settle?.pendingCount ?? '—' }} 家代理商 ·
                    {{ settle?.pendingBatches ?? '—' }} 笔待结算 · 账期 2026-09
                  </p>
                  <template v-if="settle && settle.byAgent.length">
                    <div class="qrow" v-for="(s, i) in settle.byAgent" :key="i">
                      <span>{{ s.name }}</span>
                      <span class="bar"></span>
                      <em>{{ money(s.amount) }}</em>
                    </div>
                  </template>
                  <div v-else class="empty sum-empty">暂无待结算明细</div>
                </div>
              </div>
              <!-- 按账期生成结算单 -->
              <div class="panel">
                <div class="p-bd gen-bd">
                  <p class="b sum-title">按账期生成结算单</p>
                  <span class="fld">
                    <span>结算账期</span>
                    <span class="sel">2026-09（月结） ▾</span>
                  </span>
                  <span class="btn btn-p gen-btn" @click="todo('生成结算单')">按账期生成结算单</span>
                  <p class="small">
                    生成后锁定当期台账快照，进入财务复核 → 推送代理商确认 → 对公放款；同一账期重复生成需二次确认。
                  </p>
                </div>
              </div>
              <!-- 提现申请审核 -->
              <div class="panel">
                <div class="p-bd wd-bd">
                  <p class="b sum-title">
                    提现申请审核
                    <span class="tag tag-o">{{ withdrawList.length }} 笔待审</span>
                  </p>
                  <template v-if="withdrawList.length">
                    <div class="wd-card" v-for="(w, i) in withdrawList" :key="i">
                      <div class="wd-card-hd">
                        <b class="wd-name">{{ w.name }}</b>
                        <span class="tag" :class="w.statusClass">{{ w.status }}</span>
                      </div>
                      <p class="small wd-meta">{{ w.amount }} · {{ w.date }} · {{ w.method }}</p>
                      <p class="mt6 wd-act">
                        <span class="btn-t" style="color: var(--color-success)" @click="todo('通过')">通过</span>
                        <span class="btn-t dgr" @click="todo('驳回')">驳回</span>
                        <span class="btn-t gy" @click="todo('详情')">详情</span>
                      </p>
                    </div>
                  </template>
                  <div v-else class="empty">暂无待审提现</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 冲退规则 -->
        <div class="tipbar w mt12">
          <span class="ic">!</span>
          <span>
            <b>冲退规则：</b>商户退款或订单作废 → 对应分润<b>自动冲回</b>——
            <b>未结算</b>：直接从待结算金额中扣减；<b>已结算</b>：从该代理商后续分润中扣减
            （不足滚存记负，结清前冻结新增提现）。冲回与 v1.2 老带新积分冲回并行执行、互不影响。
          </span>
        </div>

        <!-- 双轨归因说明 -->
        <p class="b attr-title">双轨归因说明 <span class="v13-tag lt">v1.3</span></p>
        <div class="v13-track mt8">
          <div class="tk is-blue">
            <div class="tk-hd"><span class="tag tag-b">老带新</span>商户侧 · 积分奖励</div>
            <p class="tk-bd">
              归属<b>营销成本线</b>：邀请人（老商户）获订单实付 × 20% 积分（年度上限 60,000 · 冷静期 7 天 ·
              退款 / 注销自动冲回），可抵续费 / AI 用量 / 提现。以<b>积分</b>发放，不形成现金支出。
            </p>
          </div>
          <span class="vs">并存 · 互不替代</span>
          <div class="tk">
            <div class="tk-hd"><span class="tag tag-b">代理商分润</span>渠道侧 · 现金分佣</div>
            <p class="tk-bd">
              归属<b>渠道成本线</b>：签约代理商按比例矩阵对发展商户订单计<b>现金分润</b>，按账期结算提现；
              比例由平台手动配置，与积分线费率互不关联。
            </p>
          </div>
        </div>

        <!-- 归因优先级 -->
        <div class="v11-note mt10">
          <span class="v13-tag lt" style="flex: none">v1.3</span>
          <span>
            <b>归因优先级：</b>同一商户同时存在「代理商邀请」与「老带新邀请」两种归因时，<b>代理商邀请优先</b>——
            该商户订单计现金分润，不再发老带新积分奖励；未命中代理商归因的商户仍走老带新积分线。
            归因关系注册时锁定落库，24h 内可申诉改绑。
          </span>
        </div>
      </div>
    </div>

    <!-- ───────── 开通代理商 抽屉（点击「+ 开通代理商」展开） ───────── -->
    <div v-if="showCreate" class="ov" @click="closeCreate"></div>
    <div v-if="showCreate" class="drawer" role="dialog" aria-label="开通代理商">
      <div class="d-hd">
        <span class="pt">开通代理商 <span class="v13-tag lt">v1.3</span></span>
        <span class="d-x" @click="closeCreate">✕</span>
      </div>
      <div class="d-bd">
        <!-- 基本信息 -->
        <div>
          <p class="b d-sec">基本信息</p>
          <div class="fld">
            <span>代理商名称 <i class="req">*</i></span>
            <input class="ipt" v-model="form.name" placeholder="请输入代理商名称" />
          </div>
          <div class="frow mt8" style="align-items: flex-start">
            <span class="fld" style="flex: 1">
              <span>联系人 <i class="req">*</i></span>
              <input class="ipt" v-model="form.contact" placeholder="联系人" />
            </span>
            <span class="fld" style="flex: 1">
              <span>手机号 <i class="req">*</i></span>
              <input class="ipt" v-model="form.phone" placeholder="手机号" />
            </span>
          </div>
        </div>
        <!-- 授权区域 -->
        <div>
          <p class="b d-sec">
            授权区域
            <span class="small d-sec-sub">（省 / 市 / 区多选 · 与现有代理商授权范围实时查重）</span>
          </p>
          <div class="frow">
            <span class="sel">江苏省 ▾</span>
            <span class="sel">苏州市 ▾</span>
            <span class="sel">工业园区 ▾</span>
            <span class="btn btn-s" @click="todo('添加区域')">+ 添加区域</span>
          </div>
          <div class="zone-tags" v-if="form.zones.length">
            <span class="v13-zone-tag" v-for="(z, i) in form.zones" :key="i">
              <b>{{ z }}</b><i class="x" @click="form.zones.splice(i, 1)">✕</i>
            </span>
          </div>
          <span v-if="hasOverlap" class="tag tag-o">与现有代理商授权重叠 {{ overlapCount }} 项 · 需仲裁</span>
        </div>
        <!-- 层级选择 -->
        <div>
          <p class="b d-sec">层级选择</p>
          <div class="frow">
            <span class="lv-radio"><span class="rd on"></span>一级代理（直接签约平台）</span>
            <span class="lv-radio lv-radio-off"><span class="rd"></span>二级代理（需选择上级并备案）</span>
          </div>
          <p class="small mt8">套用层级权益：可售套餐 基础版 / 标准版 / 旗舰版 · 拿货折扣 7.5 ~ 8.8 折 · 允许发展下级代理</p>
        </div>
        <!-- 专属推广码 -->
        <div>
          <p class="b d-sec">专属推广码</p>
          <div class="promo-row">
            <span class="mask">{{ form.promoCode || 'DL-****-****' }}</span>
            <span class="tag tag-g">已自动生成 · 保存后激活</span>
            <span class="btn-t" @click="todo('重新生成')">重新生成</span>
            <span class="qr-box" aria-hidden="true">推广码二维码</span>
          </div>
          <p class="small mt6">推广码激活后，经此码注册的商户自动归因本代理商（归因优先级高于老带新）。</p>
        </div>
        <!-- 签约有效期 -->
        <div>
          <p class="b d-sec">签约有效期</p>
          <div class="frow">
            <span class="sel">2 年 ▾</span>
            <input class="ipt" v-model="form.startDate" placeholder="起始日期" />
            <span class="small">至</span>
            <input class="ipt" v-model="form.endDate" placeholder="到期日期" />
          </div>
          <p class="small mt6">到期前 60 天自动提醒续签；未续签进入宽限期（30 天，仅可结算不出新单）。</p>
        </div>
        <!-- 结算账户信息 -->
        <div>
          <p class="b d-sec">结算账户信息</p>
          <div class="frow" style="align-items: flex-start">
            <span class="fld" style="flex: 1">
              <span>开户名</span>
              <input class="ipt" v-model="form.accountName" placeholder="开户名" />
            </span>
            <span class="fld" style="flex: 1">
              <span>开户行</span>
              <input class="ipt" v-model="form.bank" placeholder="开户行" />
            </span>
          </div>
          <div class="frow mt8">
            <span class="fld" style="flex: 1">
              <span>银行账号</span>
              <span class="mask">{{ form.bankAccount || '**** **** **** ****' }}</span>
            </span>
            <span class="fld" style="flex: 1">
              <span>结算方式</span>
              <span class="sel">对公转账 ▾</span>
            </span>
          </div>
        </div>
        <div class="tipbar">
          <span class="ic">i</span>
          <span>保存后系统自动生成代理商账号并发送短信邀请；代理商可在其分账号后台查看商户、订单与分润台账。</span>
        </div>
      </div>
      <div class="d-ft">
        <span class="btn" @click="closeCreate">取消</span>
        <span class="btn btn-p" @click="saveAgent">保存并生成代理商账号</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

/* ═══════════════════════════════════════════════════════════════
   数据层：本页无对应接口（api.ts 未提供代理商相关 API）。
   全部以空数组 / null 初始化并渲染空态；接入后端时在此补充调用。
   TODO: 待接入 代理商相关接口（建议新增 src/api/agent.ts，挂载到 /platform/agents*）
   ═══════════════════════════════════════════════════════════════ */
interface Kpi {
  total?: number
  lvl1?: number
  lvl2?: number
  merchants?: number
  merchantsPct?: string
  monthProfit?: number
  pendingSettle?: number
  pendingSettleCount?: number
}
const kpi = ref<Kpi | null>(null)

const agentList = ref<any[]>([]) // TODO: GET /platform/agents
const agentPage = ref(1)
const agentPageSize = 10
const agentTotalPages = computed(() => Math.max(1, Math.ceil(agentList.value.length / agentPageSize)))

const ledgerList = ref<any[]>([]) // TODO: GET /platform/agents/profit-ledger
const ledgerPage = ref(1)
const ledgerTotalPages = computed(() => Math.max(1, Math.ceil(ledgerList.value.length / agentPageSize)))

interface Settle {
  pendingTotal?: number
  pendingCount?: number
  pendingBatches?: number
  byAgent: { name: string; amount: number }[]
}
const settle = ref<Settle | null>(null) // TODO: GET /platform/agents/settlement-summary
const withdrawList = ref<any[]>([]) // TODO: GET /platform/agents/withdraw-apply?status=PENDING

/* 层级权益配置（配置型 UI，非业务记录；接入后由接口回填） */
const l1 = ref({
  tiers: { basic: true, standard: true, flagship: true, free: false },
  discountLow: '7.5',
  discountHigh: '8.8',
  canDevelop: true,
})
const l2 = ref({
  tiers: { basic: true, standard: true, flagship: false, free: false },
  discountLow: '8.2',
  discountHigh: '9.0',
  canDevelop: false,
})

/* 分润比例矩阵（行=层级 / 列=套餐档位）；默认未配置（null=未设置），保存后生效 */
const matrix = ref([
  { level: '一级代理', sub: '直接签约平台', cells: [{ value: null }, { value: null }, { value: null }] },
  { level: '二级代理', sub: '由一级发展 · 平台备案', cells: [{ value: null }, { value: null }, { value: null }] },
])
function resetMatrix() {
  matrix.value.forEach((r) => r.cells.forEach((c) => (c.value = null)))
}

/* 分润模式开关（配置型 UI） */
const sw = ref({ newOrder: true, renew: false, renewRate: 60, valueAdd: false })

/* 结算规则配置 */
const settleCfg = ref({ period: '月结', threshold: '¥ 500', method: '对公转账' })

/* 开通代理商抽屉表单 */
const showCreate = ref(false)
const hasOverlap = ref(false)
const overlapCount = ref(0)
const form = ref({
  name: '',
  contact: '',
  phone: '',
  zones: [] as string[],
  promoCode: '',
  startDate: '',
  endDate: '',
  accountName: '',
  bank: '',
  bankAccount: '',
})

function openCreate() {
  showCreate.value = true
}
function closeCreate() {
  showCreate.value = false
}
function saveAgent() {
  // TODO: POST /platform/agents 创建代理商并生成账号
  showCreate.value = false
}
function todo(_name: string) {
  // TODO: 待接入对应操作（分润规则 / 试算 / 导出 / 生成结算单 等）
}

function money(n: number | null | undefined): string {
  if (n == null) return '—'
  return '¥' + n.toLocaleString('zh-CN')
}
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   仅在本页使用的专属结构（v1.3 修订组件 / 抽屉 / 修订标记），
   设计稿专用类尚未移植进 components.css，按约束在此用 var(--token) 局部实现。
   ═══════════════════════════════════════════════════════════════ */

/* ── v1.3 修订标记 ── */
.v13-tag {
  display: inline-flex;
  align-items: center;
  font-size: var(--text-xs);
  line-height: 1;
  padding: var(--tag-padding);
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--text-inverse);
  font-weight: var(--font-bold);
  white-space: nowrap;
}
.v13-tag.lt {
  background: var(--color-primary-bg);
  color: var(--color-primary-hover);
  border: 1px solid var(--color-primary-soft);
}

/* ── 区域标签（授权区域已选） ── */
.v13-zone-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  line-height: 1;
  padding: var(--tag-padding);
  border-radius: var(--radius-md);
  background: var(--color-primary-bg);
  border: 1px solid var(--color-primary-soft);
  color: var(--color-primary-hover);
  white-space: nowrap;
}
.v13-zone-tag b {
  font-weight: var(--font-semibold);
}
.v13-zone-tag .x {
  color: var(--color-primary-hover);
  opacity: 0.6;
  font-style: normal;
  cursor: default;
}

/* ── 比例矩阵（分润规则） ── */
.v13-mtx {
  border: 1px solid var(--g2);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--bg-card);
}
.v13-mtx .cell-in {
  width: var(--mtx-cell-w);
  text-align: center;
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-sm);
}
.v13-mtx .cell-in.is-unset {
  border-style: dashed;
  color: var(--g4);
}
.v13-dim {
  opacity: 0.55;
  filter: grayscale(0.5);
}

/* ── 双轨归因轨道 ── */
.v13-track {
  display: flex;
  align-items: stretch;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.v13-track .tk {
  flex: 1;
  border: 1px solid var(--color-primary-soft);
  border-radius: var(--radius-xl);
  padding: var(--space-3);
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.v13-track .tk.is-blue {
  background: var(--color-primary-bg);
}
.v13-track .tk .tk-hd {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-md);
  font-weight: var(--font-bold);
}
.v13-track .tk .tk-bd {
  font-size: var(--text-xs);
  color: var(--g6);
  line-height: 1.7;
}
.v13-track .vs {
  align-self: center;
  flex: none;
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  color: var(--g4);
  border: 1px dashed var(--g3);
  border-radius: var(--radius-full);
  padding: var(--space-1) var(--space-2);
  background: var(--g0);
}

/* ── v1.1 修订标记（归因优先级说明） ── */
.v11-note {
  display: flex;
  gap: var(--space-1);
  align-items: flex-start;
  font-size: var(--text-xs);
  color: var(--g5);
  background: var(--color-primary-bg);
  border: 1px dashed var(--color-primary-soft);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  line-height: 1.6;
}

/* ── 开通代理商抽屉 ── */
.ov {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  z-index: 999;
}
.drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: var(--drawer-width);
  max-width: 92%;
  background: var(--bg-card);
  z-index: 1000;
  box-shadow: var(--drawer-shadow);
  display: flex;
  flex-direction: column;
}
.d-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--g2);
  flex: none;
}
.d-hd .pt {
  font-size: var(--text-md);
  font-weight: var(--font-bold);
}
.d-x {
  color: var(--g4);
  font-size: var(--text-lg);
  line-height: 1;
  padding: var(--tag-padding);
  border-radius: var(--radius-sm);
}
.d-x:hover {
  background: var(--g0);
  color: var(--g6);
}
.d-bd {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-3) var(--space-4);
  display: grid;
  gap: var(--space-3);
}
.d-ft {
  flex: none;
  border-top: 1px solid var(--g2);
  padding: var(--space-3) var(--space-4);
  display: flex;
  gap: var(--space-2);
  background: var(--bg-card);
}

/* ── 局部微调（复用 token，避免写死字面尺寸） ── */
.lv-pt {
  font-size: var(--text-sm);
}
.lv-bd {
  display: grid;
  gap: var(--space-3);
}
.lv-label {
  font-size: var(--text-xs);
  margin-bottom: var(--space-1);
}
.lv-sml {
  font-size: var(--text-xs);
  color: var(--g6);
}
.lv-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
}
.lv-toggle-t {
  font-size: var(--text-md);
}
.cell-num {
  text-align: center;
}
.mx-locked {
  opacity: 0.5;
}
.profit-bd {
  display: grid;
  gap: var(--space-3);
}
.profit-ft {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.save-disabled {
  opacity: 0.55;
  border-style: dashed;
}
.mod-rec {
  border-top: 1px dashed var(--g2);
  padding-top: var(--space-2);
}
.mod-rec-tag {
  margin-right: var(--space-1);
}
.agent-profit-panel {
  border-color: var(--color-primary-soft);
}
.sum-title {
  font-size: var(--text-sm);
}
.sum-amount {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  margin-top: var(--space-1);
}
.sum-empty {
  padding: var(--space-3) 0;
}
.gen-bd {
  display: grid;
  gap: var(--space-2);
}
.gen-btn {
  justify-content: center;
}
.wd-bd {
  display: grid;
  gap: var(--space-2);
}
.wd-card {
  border: 1px solid var(--g2);
  border-radius: var(--radius-lg);
  padding: var(--space-2);
}
.wd-card-hd {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.wd-name {
  font-size: var(--text-xs);
}
.wd-meta {
  margin-top: var(--space-1);
}
.wd-act {
  margin-top: var(--space-1);
}
.attr-title {
  font-size: var(--text-sm);
  margin-top: var(--space-4);
}
.d-sec {
  font-size: var(--text-sm);
  margin-bottom: var(--space-2);
}
.d-sec-sub {
  font-weight: 400;
}
.req {
  color: var(--color-danger);
  font-style: normal;
}
.zone-tags {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
  margin-top: var(--space-2);
}
.promo-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.qr-box {
  margin-left: auto;
  width: var(--space-10);
  height: var(--space-10);
  display: grid;
  place-items: center;
  font-size: var(--text-xs);
  color: var(--g5);
  border: 1px solid var(--g2);
  border-radius: var(--radius-sm);
  background: var(--g0);
}
.lv-radio {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}
.lv-radio-off {
  color: var(--g5);
}
</style>
