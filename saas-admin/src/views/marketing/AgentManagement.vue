<template>
  <!-- ═══════════════════════════════════════════════════════════════
       16 营销 · 代理商管理（设计稿 v1.6 #sec-agent · 行 1965~2225）
       根节点直接是内容片段，外层由 PlatformLayout 的 <main class="pf-main"> 包裹。
       数据（R101-C6-3-3 档 1 已接线）：Tab① 代理商配置 = 代理商档案（GET/POST/PUT /platform/agents、
       状态流转 POST /platform/agents/:id/status）+ 层级权益配置（GET/POST/PUT /platform/agents/levels）；
       Tab② 代理商分润（台账 / 结算 / 提现 / 计提）属档 2/档 3，**未开工**，保持诚实空态并显式标注。
       严禁硬编码业务示例值（代理商名称 / 分成比例 / 金额等）；未配置项一律留空（NULL），不得写 0 冒充。
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
            <div class="kv">{{ agentTotalText }}</div>
            <div class="kd">来自代理商列表真实统计（层级分布按层级配置自行查看）</div>
          </div>
          <div class="kpi">
            <div class="kt">累计发展商户</div>
            <div class="kv">—</div>
            <div class="kd">商户归属统计属档 2（未开工）· 不预置数值</div>
          </div>
          <div class="kpi">
            <div class="kt">本月分润（渠道成本线）</div>
            <div class="kv">—</div>
            <div class="kd">计提属档 2（未开工）· 本单不产生任何计提</div>
          </div>
          <div class="kpi">
            <div class="kt">待结算金额</div>
            <div class="kv">—</div>
            <div class="kd">结算属档 3（未开工）· 不预置数值</div>
          </div>
        </div>

        <!-- 代理商列表（R101-C6-3-3 档 1：GET /platform/agents 真实数据；档 2 聚合列留「—」） -->
        <div class="panel mt12">
          <div class="p-hd">
            <span class="pt">代理商列表</span>
            <div class="frow">
              <input
                class="ipt"
                v-model="agentKeyword"
                placeholder="搜索编码 / 名称 / 区域 / 联系人"
                @keyup.enter="searchAgents"
              />
              <span class="btn" @click="searchAgents">搜索</span>
              <span class="btn" @click="loadAgents">刷新</span>
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
                <tr v-if="agentLoading">
                  <td :colspan="9" class="empty">加载中…</td>
                </tr>
                <tr v-else-if="agentError">
                  <td :colspan="9" class="empty">{{ agentError }}</td>
                </tr>
                <tr v-else-if="agentList.length === 0">
                  <td :colspan="9" class="empty">{{ agentKeyword ? '没有匹配的代理商' : '暂无代理商数据' }}</td>
                </tr>
                <template v-else>
                  <tr v-for="a in agentList" :key="a.id">
                    <td>
                      <b>{{ a.agentName }}</b>
                      <span class="sub">{{ a.agentCode }}</span>
                    </td>
                    <td><span class="tag tag-b">{{ a.levelName || '层级未匹配' }}</span></td>
                    <td>{{ a.region || '—' }}</td>
                    <td>{{ a.contactName || '—' }}<span class="sub">{{ a.contactPhone || '' }}</span></td>
                    <td class="num">—</td>
                    <td class="num">—</td>
                    <td class="num">—</td>
                    <td><span class="tag" :class="statusClass(a.status)">{{ statusText(a.status) }}</span></td>
                    <td>
                      <span class="btn-t" @click="openEdit(a)">编辑</span>
                      <span v-if="a.status === 'PENDING'" class="btn-t" @click="changeStatus(a, 'ACTIVE')">通过</span>
                      <span v-if="a.status === 'ACTIVE'" class="btn-t" @click="changeStatus(a, 'FROZEN')">冻结</span>
                      <span v-if="a.status === 'FROZEN'" class="btn-t" @click="changeStatus(a, 'ACTIVE')">解冻</span>
                      <span
                        v-if="a.status === 'ACTIVE' || a.status === 'FROZEN'"
                        class="btn-t dgr"
                        @click="changeStatus(a, 'TERMINATED')"
                      >终止</span>
                      <span class="btn-t gy" title="分润台账属档 2，未开工">台账</span>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <div class="pagebar">
            <span>
              共 {{ agentTotal === null ? '—' : agentTotal }} 家代理商 · 每页 {{ agentPageSize }} 条 ·
              「发展商户数 / 累计销售额 / 累计分润」属档 2（未开工），一律留「—」
            </span>
            <div class="pgbtns">
              <span v-if="agentPage > 1" @click="gotoPage(agentPage - 1)">‹</span>
              <span v-for="p in agentTotalPages" :key="p" :class="{ on: p === agentPage }" @click="gotoPage(p)">{{ p }}</span>
              <span v-if="agentTotalPages > 1 && agentPage < agentTotalPages" @click="gotoPage(agentPage + 1)">›</span>
            </div>
          </div>
        </div>

        <!-- 层级权益配置（R101-C6-3-3 档 1：/platform/agents/levels 真实数据；D11③ 层级名称自定义） -->
        <div class="panel mt12">
          <div class="p-hd">
            <span class="pt">层级权益配置 <span class="v13-tag lt">v1.3</span></span>
            <span class="ph-s">层级名称自定义（D11③）；未配置项一律留空（NULL），不预置任何数值</span>
            <span class="btn" @click="showLevelForm = !showLevelForm">{{ showLevelForm ? '收起新建' : '+ 新建层级' }}</span>
          </div>
          <div class="p-bd" v-if="showLevelForm">
            <div class="frow">
              <span class="fld">
                <span>层级编码 <i class="req">*</i></span>
                <input class="ipt" v-model="levelForm.levelCode" placeholder="如 level_a" />
              </span>
              <span class="fld">
                <span>层级名称 <i class="req">*</i></span>
                <input class="ipt" v-model="levelForm.levelName" placeholder="自定义名称，不写死「一级/二级」" />
              </span>
              <span class="fld">
                <span>排序号</span>
                <input class="ipt" v-model="levelForm.sortNo" placeholder="0" />
              </span>
            </div>
            <div class="frow mt8">
              <span class="btn btn-p" @click="saveNewLevel">创建层级</span>
              <span class="small">系统零预置：不内置任何层级、比例或折扣值，全部由管理员创建与配置</span>
            </div>
          </div>
          <div class="p-bd">
            <div v-if="levelList.length === 0" class="empty">尚未创建层级 —— 系统不预置层级，请先「+ 新建层级」</div>
            <div v-else class="g2">
              <div class="panel" v-for="lv in levelList" :key="lv.id">
                <div class="p-hd">
                  <span class="pt lv-pt">{{ lv.levelName }}</span>
                  <span class="tag" :class="lv.allowSubLevel ? 'tag-b' : 'tag-gy'">{{ lv.allowSubLevel ? '可发展下级代理' : '不发展下级' }}</span>
                  <span class="tag tag-gy">{{ lv.status === 'ACTIVE' ? '启用' : '停用' }}</span>
                </div>
                <div class="p-bd lv-bd">
                  <div>
                    <p class="b lv-label">可售套餐范围（planId 数组；未勾选=未配置 ⇒ NULL）</p>
                    <div class="mx">
                      <div class="mx-hd">套餐来自「套餐管理」真实数据；系统不预置可售范围</div>
                      <div class="mx-bd">
                        <span v-if="planOptions.length === 0" class="mx-it mx-locked"><span class="ck"></span>套餐管理暂无套餐</span>
                        <span v-for="p in planOptions" :key="p.id" class="mx-it" @click="toggleScope(lv, p.id)">
                          <span class="ck" :class="{ on: levelDrafts[lv.id].planScope.includes(p.id) }"></span>{{ p.planName }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="frow">
                    <span class="lv-sml">拿货折扣区间</span>
                    <input class="ipt cell-num" :style="{ width: 'var(--mtx-cell-w)' }" v-model="levelDrafts[lv.id].discountLow" placeholder="未配置" />
                    <span class="small">至</span>
                    <input class="ipt cell-num" :style="{ width: 'var(--mtx-cell-w)' }" v-model="levelDrafts[lv.id].discountHigh" placeholder="未配置" />
                    <span class="small">留空=未配置（不写 0 冒充）</span>
                  </div>
                  <div class="lv-toggle">
                    <span class="tg" :class="{ off: !levelDrafts[lv.id].allowSubLevel }" @click="levelDrafts[lv.id].allowSubLevel = !levelDrafts[lv.id].allowSubLevel"></span>
                    <b class="lv-toggle-t">允许发展下级代理</b>
                    <span class="small">按层级统一配置（点开关切换）</span>
                  </div>
                  <div class="frow">
                    <span class="lv-sml">分润模式</span>
                    <span class="lv-radio" @click="levelDrafts[lv.id].profitModeSignup = !levelDrafts[lv.id].profitModeSignup">
                      <span class="rd" :class="{ on: levelDrafts[lv.id].profitModeSignup }"></span>新签
                    </span>
                    <span class="lv-radio" @click="levelDrafts[lv.id].profitModeRenew = !levelDrafts[lv.id].profitModeRenew">
                      <span class="rd" :class="{ on: levelDrafts[lv.id].profitModeRenew }"></span>续费
                    </span>
                    <span class="lv-radio lv-radio-off" title="D11②：增值收入初期关闭">
                      <span class="rd"></span>增值（初期关闭）
                    </span>
                  </div>
                  <div class="frow">
                    <span class="lv-sml">分润比例（配置值）</span>
                    <input class="ipt cell-num" :style="{ width: 'var(--mtx-cell-w)' }" v-model="levelDrafts[lv.id].profitRateSignup" placeholder="未配置" />
                    <span class="small">% 新签</span>
                    <input class="ipt cell-num" :style="{ width: 'var(--mtx-cell-w)' }" v-model="levelDrafts[lv.id].profitRateRenew" placeholder="未配置" />
                    <span class="small">% 续费</span>
                  </div>
                  <div class="frow">
                    <span class="small">档 1 只保存配置值，<b>不产生任何计提</b>；台账 / 结算 / 提现属档 2/3（未开工）</span>
                    <span class="btn btn-p" @click="saveLevel(lv)">保存层级配置</span>
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

        <!-- ★ 档 2 未开工声明（R101-C6-3-3 红线：本页不得产生任何计提，也不得预置任何示例数值） -->
        <div class="tipbar w mt12">
          <span class="ic">!</span>
          <span>
            <b>档 2 未开工：</b>分润台账 / 比例计提 / 结算 / 提现均<strong>未实现</strong>（代理商域分档交付，档 1 = 档案 + 层级权益配置，
            <b>不产生任何计提</b>）。本页所有金额与比例一律留空（未配置=无值），<b>不预置任何示例值</b>；
            待档 2 立项卡下达后再接线。
          </span>
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
                    <th>基础版</th>
                    <th>标准版</th>
                    <th>旗舰版</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="matrix.length === 0">
                    <td colspan="4" class="empty">暂无层级配置 —— 请先在「① 代理商配置 · 层级权益配置」创建层级</td>
                  </tr>
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
                        disabled
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
                        <span class="btn-t" style="color: var(--color-success-text)" @click="todo('通过')">通过</span><!-- S3-137-F1：文字用成功色文字变体 -->
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
        <span class="pt">{{ editingId === null ? '开通代理商' : '编辑代理商' }} <span class="v13-tag lt">v1.3</span></span>
        <span class="d-x" @click="closeCreate">✕</span>
      </div>
      <div class="d-bd">
        <!-- 基本信息（字段集与后端 POST /platform/agents 逐字一致） -->
        <div>
          <p class="b d-sec">基本信息</p>
          <div class="fld">
            <span>代理商编码 <i class="req">*</i></span>
            <input class="ipt" v-model="form.agentCode" placeholder="唯一编码，如 AG001" :disabled="editingId !== null" />
          </div>
          <div class="fld mt8">
            <span>代理商名称 <i class="req">*</i></span>
            <input class="ipt" v-model="form.agentName" placeholder="请输入代理商名称" />
          </div>
          <div class="frow mt8" style="align-items: flex-start">
            <span class="fld" style="flex: 1">
              <span>联系人</span>
              <input class="ipt" v-model="form.contactName" placeholder="联系人（可留空）" />
            </span>
            <span class="fld" style="flex: 1">
              <span>手机号</span>
              <input class="ipt" v-model="form.contactPhone" placeholder="手机号（可留空）" />
            </span>
          </div>
        </div>
        <!-- 授权区域（档 1 只落单列 region 文本；多选与重叠查重不在本单） -->
        <div>
          <p class="b d-sec">
            授权区域
            <span class="small d-sec-sub">（档 1 落单列文本；省/市/区多选与重叠查重不在本单）</span>
          </p>
          <div class="frow">
            <input class="ipt" style="flex: 1" v-model="form.region" placeholder="如：江苏省苏州市工业园区（可留空）" />
          </div>
        </div>
        <!-- 层级选择（真实层级来自层级权益配置；无层级时阻断并提示，不预置层级） -->
        <div>
          <p class="b d-sec">层级选择</p>
          <div class="frow" v-if="levelList.length">
            <select class="ipt" style="flex: 1" v-model.number="form.levelId">
              <option :value="null" disabled>请选择层级</option>
              <option v-for="lv in levelList" :key="lv.id" :value="lv.id">{{ lv.levelName }}（{{ lv.levelCode }}）</option>
            </select>
          </div>
          <p class="small mt8" v-else>尚未创建层级：<b>档 1 不预置层级</b>，请先到「层级权益配置」新建层级后再建档。</p>
        </div>
        <!-- 备注（档 1 字段集内） -->
        <div>
          <p class="b d-sec">备注</p>
          <input class="ipt" style="width: 100%" v-model="form.remark" placeholder="可留空（未填写落 NULL，不写空串）" />
        </div>
        <!-- 推广码 / 签约有效期 / 结算账户：档 1 后端不接收这些字段 ⇒ 不采集（避免"填了不落库"的假表单） -->
        <div class="tipbar">
          <span class="ic">i</span>
          <span>
            专属推广码（归因）属 C6-3-2、结算账户属档 3（未开工），<b>本期不采集、不落库</b>；
            档 1 建档只写：编码 / 名称 / 层级 / 区域 / 联系人 / 备注。
          </span>
        </div>
      </div>
      <div class="d-ft">
        <span class="btn" @click="closeCreate">取消</span>
        <span class="btn btn-p" @click="saveAgent">{{ editingId === null ? '保存建档' : '保存修改' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  listAgents,
  createAgent,
  updateAgent,
  changeAgentStatus,
  listAgentLevels,
  createAgentLevel,
  updateAgentLevel,
  getPlans,
  type AgentRow,
  type AgentLevelRow,
  type AgentUpdateBody,
  type AgentLevelUpdateBody
} from '../../api'

/* ═══════════════════════════════════════════════════════════════
   数据层：R101-C6-3-3 **档 1** 已接线
   · Tab① 代理商配置 = 代理商档案（列表/详情/新建/更新/状态流转）+ 层级权益配置（读写成套）
   · Tab② 代理商分润（台账 / 结算 / 提现 / 计提）属档 2 / 档 3，**未开工**：
     全部保持诚实空态并显式标注，页面不产生任何计提，也不预置任何示例数值。
   ═══════════════════════════════════════════════════════════════ */

/** 后端响应解包：axios 拦截器原样返回 AxiosResponse ⇒ data.data 为业务载荷 */
function payloadOf(res: any): any {
  return res?.data?.data ?? res?.data ?? null
}

/** 空白串 ⇒ null（列语义 NULL=未填写，不用空串冒充） */
function blankToNull(value: string | null | undefined): string | null {
  const text = String(value ?? '').trim()
  return text === '' ? null : text
}

/* ── ① 代理商档案 ─────────────────────────────────────────── */
const agentList = ref<AgentRow[]>([])
const agentTotal = ref<number | null>(null)
const agentPage = ref(1)
const agentPageSize = 10
const agentKeyword = ref('')
const agentLoading = ref(false)
const agentError = ref('')
const agentTotalPages = computed(() =>
  Math.max(1, Math.ceil((agentTotal.value ?? 0) / agentPageSize))
)
const agentTotalText = computed(() => (agentTotal.value === null ? '—' : String(agentTotal.value)))

const STATUS_TEXT: Record<string, string> = {
  PENDING: '待审核',
  ACTIVE: '正常',
  FROZEN: '冻结',
  TERMINATED: '终止'
}
const STATUS_CLASS: Record<string, string> = {
  PENDING: 'tag-o',
  ACTIVE: 'tag-b',
  FROZEN: 'tag-gy',
  TERMINATED: 'tag-gy'
}
function statusText(status: string): string {
  return STATUS_TEXT[status] ?? status
}
function statusClass(status: string): string {
  return STATUS_CLASS[status] ?? 'tag-gy'
}

async function loadAgents() {
  agentLoading.value = true
  agentError.value = ''
  try {
    const res: any = await listAgents({
      page: agentPage.value,
      pageSize: agentPageSize,
      keyword: agentKeyword.value.trim() || undefined
    })
    const data = payloadOf(res)
    agentList.value = Array.isArray(data?.items) ? data.items : []
    const total = Number(data?.total)
    agentTotal.value = Number.isFinite(total) ? total : agentList.value.length
  } catch {
    // 拦截器已给中文提示；这里只做内容区错误态，不造数
    agentList.value = []
    agentTotal.value = null
    agentError.value = '代理商列表加载失败 —— 已留空，不造数'
  } finally {
    agentLoading.value = false
  }
}

function searchAgents() {
  agentPage.value = 1
  void loadAgents()
}

function gotoPage(page: number) {
  const next = Math.min(Math.max(1, page), agentTotalPages.value)
  if (next === agentPage.value) return
  agentPage.value = next
  void loadAgents()
}

/* ── ①-b 层级权益配置（D11③ 层级名称自定义；零预置） ───────── */
interface LevelDraft {
  levelName: string
  allowSubLevel: boolean
  planScope: number[]
  discountLow: string
  discountHigh: string
  profitModeSignup: boolean
  profitModeRenew: boolean
  profitModeUpsell: boolean
  profitRateSignup: string
  profitRateRenew: string
  profitRateUpsell: string
  sortNo: string
  status: 'ACTIVE' | 'DISABLED'
}

const levelList = ref<AgentLevelRow[]>([])
const levelDrafts = ref<Record<number, LevelDraft>>({})
const planOptions = ref<{ id: number; planName: string }[]>([])
const showLevelForm = ref(false)
const levelForm = ref({ levelCode: '', levelName: '', sortNo: '' })

/** 未配置 ⇒ 空串（输入框留空），不用 0 冒充；回填时 null 也落空串 */
function numText(value: number | null): string {
  return value === null || value === undefined ? '' : String(value)
}

function syncDrafts() {
  const next: Record<number, LevelDraft> = {}
  for (const lv of levelList.value) {
    next[lv.id] = {
      levelName: lv.levelName,
      allowSubLevel: lv.allowSubLevel,
      planScope: Array.isArray(lv.planScope) ? [...lv.planScope] : [],
      discountLow: numText(lv.discountLow),
      discountHigh: numText(lv.discountHigh),
      profitModeSignup: lv.profitModeSignup,
      profitModeRenew: lv.profitModeRenew,
      profitModeUpsell: lv.profitModeUpsell,
      profitRateSignup: numText(lv.profitRateSignup),
      profitRateRenew: numText(lv.profitRateRenew),
      profitRateUpsell: numText(lv.profitRateUpsell),
      sortNo: String(lv.sortNo ?? 0),
      status: lv.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE'
    }
  }
  levelDrafts.value = next
}

async function loadLevels() {
  try {
    const res: any = await listAgentLevels()
    const items = payloadOf(res)?.items
    levelList.value = Array.isArray(items) ? items : []
  } catch {
    levelList.value = []
  }
  syncDrafts()
  buildProfitMatrix()
}

async function loadPlans() {
  try {
    const res: any = await getPlans()
    const records = payloadOf(res)?.records
    planOptions.value = (Array.isArray(records) ? records : [])
      .map((p: any) => ({
        id: Number(p.id ?? p.planId),
        planName: String(p.planName || p.name || p.planCode || '')
      }))
      .filter((p) => Number.isFinite(p.id) && p.id > 0)
  } catch {
    // 套餐管理取不到 ⇒ 可售套餐范围面板显示「套餐管理暂无套餐」，不编造套餐名
    planOptions.value = []
  }
}

function toggleScope(lv: AgentLevelRow, planId: number) {
  const draft = levelDrafts.value[lv.id]
  if (!draft) return
  const index = draft.planScope.indexOf(planId)
  if (index >= 0) draft.planScope.splice(index, 1)
  else draft.planScope.push(planId)
}

async function saveNewLevel() {
  const lf = levelForm.value
  if (!lf.levelCode.trim() || !lf.levelName.trim()) {
    ElMessage.error('层级编码与层级名称为必填项')
    return
  }
  try {
    await createAgentLevel({
      levelCode: lf.levelCode.trim(),
      levelName: lf.levelName.trim(),
      sortNo: lf.sortNo.trim() === '' ? undefined : Number(lf.sortNo)
    })
    ElMessage.success('层级已创建（比例 / 折扣 / 可售套餐范围未配置 ⇒ 留空为 NULL）')
    levelForm.value = { levelCode: '', levelName: '', sortNo: '' }
    showLevelForm.value = false
    await loadLevels()
  } catch {
    // 拦截器已提示（重复编码 ⇒ 409 中文文案）
  }
}

async function saveLevel(lv: AgentLevelRow) {
  const draft = levelDrafts.value[lv.id]
  if (!draft) return

  const parseNum = (text: string): number | null => {
    const trimmed = text.trim()
    return trimmed === '' ? null : Number(trimmed)
  }
  const numeric = [
    ['discountLow', parseNum(draft.discountLow), lv.discountLow],
    ['discountHigh', parseNum(draft.discountHigh), lv.discountHigh],
    ['profitRateSignup', parseNum(draft.profitRateSignup), lv.profitRateSignup],
    ['profitRateRenew', parseNum(draft.profitRateRenew), lv.profitRateRenew]
  ] as const
  for (const [field, next] of numeric) {
    if (next !== null && !Number.isFinite(next)) {
      ElMessage.error(`${field} 须为数字，或留空表示未配置`)
      return
    }
  }

  const body: AgentLevelUpdateBody = {}
  if (draft.allowSubLevel !== lv.allowSubLevel) body.allowSubLevel = draft.allowSubLevel
  const nextScope = draft.planScope.length ? [...draft.planScope].sort((a, b) => a - b) : null
  const currentScope = lv.planScope && lv.planScope.length ? [...lv.planScope].sort((a, b) => a - b) : null
  if (JSON.stringify(nextScope) !== JSON.stringify(currentScope)) body.planScope = nextScope
  for (const [field, next, current] of numeric) {
    if (next !== current) (body as any)[field] = next
  }
  if (draft.profitModeSignup !== lv.profitModeSignup) body.profitModeSignup = draft.profitModeSignup
  if (draft.profitModeRenew !== lv.profitModeRenew) body.profitModeRenew = draft.profitModeRenew

  if (Object.keys(body).length === 0) {
    ElMessage.info('层级配置没有变化，未提交')
    return
  }
  try {
    await updateAgentLevel(lv.id, body)
    ElMessage.success('层级配置已保存（档 1 只存配置值，不产生任何计提）')
    await loadLevels()
  } catch {
    // 拦截器已提示（折扣倒挂 / 无变更等 ⇒ 400 中文文案）
  }
}

/* ── ①-c 建档 / 编辑抽屉（字段集与后端 POST /platform/agents 一致） ── */
interface AgentForm {
  agentCode: string
  agentName: string
  levelId: number | null
  region: string
  contactName: string
  contactPhone: string
  remark: string
}

const showCreate = ref(false)
const editingId = ref<number | null>(null)
const form = ref<AgentForm>({
  agentCode: '',
  agentName: '',
  levelId: null,
  region: '',
  contactName: '',
  contactPhone: '',
  remark: ''
})

function openCreate() {
  editingId.value = null
  form.value = {
    agentCode: '',
    agentName: '',
    levelId: null,
    region: '',
    contactName: '',
    contactPhone: '',
    remark: ''
  }
  showCreate.value = true
}

function openEdit(agent: AgentRow) {
  editingId.value = agent.id
  form.value = {
    agentCode: agent.agentCode,
    agentName: agent.agentName,
    levelId: agent.levelId,
    region: agent.region ?? '',
    contactName: agent.contactName ?? '',
    contactPhone: agent.contactPhone ?? '',
    remark: agent.remark ?? ''
  }
  showCreate.value = true
}

function closeCreate() {
  showCreate.value = false
}

async function saveAgent() {
  const f = form.value
  if (!f.agentName.trim()) {
    ElMessage.error('请填写代理商名称')
    return
  }

  if (editingId.value === null) {
    if (!f.agentCode.trim()) {
      ElMessage.error('请填写代理商编码')
      return
    }
    if (f.levelId == null) {
      ElMessage.error('请选择层级（若尚无层级，请先新建层级权益配置）')
      return
    }
    try {
      await createAgent({
        agentCode: f.agentCode.trim(),
        agentName: f.agentName.trim(),
        levelId: f.levelId,
        region: blankToNull(f.region),
        contactName: blankToNull(f.contactName),
        contactPhone: blankToNull(f.contactPhone),
        remark: blankToNull(f.remark)
      })
      ElMessage.success('代理商档案已创建（状态：待审核）')
      showCreate.value = false
      await loadAgents()
    } catch {
      // 拦截器已提示（重复编码 ⇒ 409 / 层级不存在 ⇒ 400）
    }
    return
  }

  const current = agentList.value.find((item) => item.id === editingId.value)
  const body: AgentUpdateBody = {}
  if (current) {
    if (f.agentName.trim() !== current.agentName) body.agentName = f.agentName.trim()
    if (f.levelId != null && f.levelId !== current.levelId) body.levelId = f.levelId
    if (blankToNull(f.region) !== (current.region ?? null)) body.region = blankToNull(f.region)
    if (blankToNull(f.contactName) !== (current.contactName ?? null)) body.contactName = blankToNull(f.contactName)
    if (blankToNull(f.contactPhone) !== (current.contactPhone ?? null)) body.contactPhone = blankToNull(f.contactPhone)
    if (blankToNull(f.remark) !== (current.remark ?? null)) body.remark = blankToNull(f.remark)
  }
  if (Object.keys(body).length === 0) {
    ElMessage.info('没有字段发生变化，未提交')
    return
  }
  try {
    await updateAgent(editingId.value, body)
    ElMessage.success('代理商档案已保存')
    showCreate.value = false
    await loadAgents()
  } catch {
    // 拦截器已提示
  }
}

/** 状态流转（状态机由后端裁决：非法流转 ⇒ 400 中文文案） */
async function changeStatus(agent: AgentRow, status: 'ACTIVE' | 'FROZEN' | 'TERMINATED') {
  try {
    await changeAgentStatus(agent.id, { status })
    ElMessage.success(`已流转：${statusText(agent.status)} → ${statusText(status)}`)
    await loadAgents()
  } catch {
    // 拦截器已提示
  }
}

/* ── ② 代理商分润（档 2 未开工；下面均为诚实空态 / 只读占位） ── */
const ledgerList = ref<any[]>([])
const ledgerPage = ref(1)
const ledgerTotalPages = computed(() => Math.max(1, Math.ceil(ledgerList.value.length / agentPageSize)))

interface Settle {
  pendingTotal?: number
  pendingCount?: number
  pendingBatches?: number
  byAgent: { name: string; amount: number }[]
}
const settle = ref<Settle | null>(null)
const withdrawList = ref<any[]>([])

/**
 * 比例矩阵：行 = 真实层级（D11③ 自定义命名），列 = 套餐档位。
 * 档 2 未开工 ⇒ 单元格一律保持"未设置"且输入禁用（不产生任何计提、不落任何比例）。
 */
const MATRIX_PLACEHOLDER_COLUMNS = 3
const matrix = ref<{ level: string; sub: string; cells: { value: null }[] }[]>([])
function buildProfitMatrix() {
  matrix.value = levelList.value.map((lv) => ({
    level: lv.levelName,
    sub: lv.levelCode,
    cells: Array.from({ length: MATRIX_PLACEHOLDER_COLUMNS }, () => ({ value: null }))
  }))
}
function resetMatrix() {
  matrix.value.forEach((row) => row.cells.forEach((cell) => (cell.value = null)))
}

const sw = ref({ newOrder: false, renew: false, renewRate: '', valueAdd: false })
const settleCfg = ref({ period: '月结', threshold: '', method: '对公转账' })

function todo(_name: string) {
  // 档 2/档 3（台账 / 试算 / 结算 / 提现）未开工：不产生任何变更
}

function money(n: number | null | undefined): string {
  if (n == null) return '—'
  return '¥' + n.toLocaleString('zh-CN')
}

onMounted(() => {
  void loadLevels()
  void loadPlans()
  void loadAgents()
})
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
