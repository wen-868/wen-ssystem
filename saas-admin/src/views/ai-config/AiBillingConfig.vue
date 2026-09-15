<template>
  <!-- ═══════════════════════════════════════════════════════════════
       05 AI 中心 · 计费管理（设计稿 v1.6 #sec-ai · 行 965~1090，Tab ②③④）
       根节点直接是内容片段，外层由 PlatformLayout 的 <main class="pf-main"> 包裹。
       计费策略 / 额度包 / 积分汇率均接真实配置端点（主后端 /platform/ai-billing/*，契约 §四），
       未配置时按设计稿要求置灰阻断并提示，绝不回退到任何写死业务值（护栏④）。
       ═══════════════════════════════════════════════════════════════ -->
  <div class="ai-billing">
    <!-- ════════ 页头 ════════ -->
    <div class="pg-hd">
      <div>
        <div class="pt4">计费管理</div>
        <p class="pd">
          AI 超额费用 = 模型成本单价 × 套餐倍率；积分可冲抵平台公共模型费用（v1.2）；价格调整需密码二次确认并留档快照
        </p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="todo('计费策略快照')">配置快照</span>
      </div>
    </div>

    <!-- ════════ 子页签 ════════ -->
    <div class="tabs">
      <span class="tab" :class="{ on: billingTab === 'strategy' }" @click="billingTab = 'strategy'">② 计费策略</span>
      <span class="tab" :class="{ on: billingTab === 'pack' }" @click="billingTab = 'pack'">③ 额度包商品</span>
      <span class="tab" :class="{ on: billingTab === 'points' }" @click="billingTab = 'points'">
        ④ 积分抵扣 <span class="ver-tag">v1.2</span>
      </span>
    </div>

    <!-- ════════ Tab 计费策略（行 965~989） ════════ -->
    <div v-show="billingTab === 'strategy'">
      <div class="panel mt12">
        <div class="p-hd">
          <span class="pt"><span class="tag tag-b" style="margin-right:6px">Tab 2</span>计费策略 · 按套餐加成倍率</span>
          <span class="ph-s">AI 超额费用 = 模型成本单价 × 套餐倍率；价格调整需密码二次确认并留档快照</span>
        </div>
        <div class="p-bd" style="padding-top:10px">
          <div class="g2">
            <div>
              <div class="panel flush">
                <div class="p-hd">
                  <span class="pt" style="font-size:12.5px">套餐加成倍率与月度额度用尽策略</span>
                  <span class="tag tag-gy" v-if="!strategyConfigured">未配置</span>
                  <span class="tag tag-g" v-else>已配置</span>
                </div>
                <div class="p-bd">
                  <!-- 未配置：置灰阻断并提示（护栏④：系统不内置任何预设倍率） -->
                  <div v-if="!strategyConfigured" class="tipbar">
                    <span class="ic">i</span>
                    <span>
                      套餐加成倍率与月度额度用尽策略<b>尚未配置</b>：各套餐的加成倍率、用尽策略、降级模型均未落库，
                      <b>系统不内置任何预设值</b>。填写并保存后生效（仅对后续新消耗生效）。
                    </span>
                  </div>

                  <div class="tblwrap" v-else>
                    <table class="tbl">
                      <thead>
                        <tr>
                          <th>套餐</th>
                          <th class="num">加成倍率</th>
                          <th>月度额度用尽策略</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="p in billingRows" :key="p.planName">
                          <td><b>{{ p.planName }}</b></td>
                          <td class="num">
                            <input
                              class="ipt sm"
                              type="number"
                              min="0"
                              step="0.1"
                              v-model.number="billingStrategy.plans[p.planName].multiplier"
                              placeholder="倍率"
                            />
                          </td>
                          <td>
                            <select class="ipt sm" v-model="billingStrategy.plans[p.planName].exhaustion">
                              <option v-for="o in EXHAUSTION_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                            </select>
                            <input
                              v-if="billingStrategy.plans[p.planName].exhaustion === 'downgrade'"
                              class="ipt sm mt6"
                              v-model="billingStrategy.plans[p.planName].downgradeModel"
                              placeholder="降级目标模型"
                            />
                          </td>
                          <td>
                            <span class="btn-t" @click="saveStrategyRow(p.planName)">
                              {{ strategySaving === p.planName ? '保存中…' : '保存' }}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div class="empty" v-if="billingRows.length === 0">暂无套餐数据 · 接口未返回可售套餐（GET /platform/subscriptions-management/plans）</div>
                </div>
              </div>

              <!-- 租户计费套餐（既有 t_tenant_ai_billing，封装已有但未调用 → 本轮补接，契约 §七 C） -->
              <div class="panel flush mt12">
                <div class="p-hd">
                  <span class="pt" style="font-size:12.5px">租户计费套餐（既有 t_tenant_ai_billing）</span>
                  <span class="ph-s">超额单价 / 月费按租户维度落库</span>
                </div>
                <div class="p-bd">
                  <div class="tblwrap">
                    <table class="tbl">
                      <thead>
                        <tr>
                          <th>租户</th>
                          <th>套餐类型</th>
                          <th class="num">超额单价(元/千Token)</th>
                          <th class="num">月费(元)</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="b in tenantBillings" :key="b.tenantId">
                          <td><b>{{ b.tenantId }}</b></td>
                          <td>{{ b.planType || '—' }}</td>
                          <td class="num">
                            <input class="ipt sm" type="number" min="0" step="0.01" v-model.number="b.overagePrice" placeholder="未配置" />
                          </td>
                          <td class="num">
                            <input class="ipt sm" type="number" min="0" step="0.01" v-model.number="b.monthlyPrice" placeholder="未配置" />
                          </td>
                          <td>
                            <span class="btn-t" @click="saveTenantBilling(b)">
                              {{ tenantBillingSaving === b.tenantId ? '保存中…' : '保存' }}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div class="empty" v-if="tenantBillings.length === 0">暂无租户计费套餐 · 待接入 GET /platform/ai/billing（ai-base）</div>
                </div>
              </div>
            </div>

            <div>
              <div class="panel flush">
                <div class="p-hd">
                  <span class="pt" style="font-size:12.5px">免费版赠送额度设置</span>
                  <span class="tag tag-o">获客钩子</span>
                  <span class="tag tag-gy" v-if="!freeGrantConfigured">未配置</span>
                  <span class="tag tag-g" v-else>已配置</span>
                </div>
                <div class="p-bd" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                  <span v-if="!freeGrantConfigured" class="tipbar" style="grid-column:1/-1">
                    <span class="ic">i</span>
                    <span>免费版赠送额度<b>尚未配置</b>：每月赠送调用次数与赠送模型均未落库，<b>系统不内置任何预设值</b>。填写并保存后生效。</span>
                  </span>
                  <template v-else>
                    <span class="fld">
                      <span>每月赠送调用次数</span>
                      <input class="ipt" type="number" min="0" step="1" v-model.number="freeGrant.monthlyCalls" placeholder="如 50 次/月" />
                    </span>
                    <span class="fld">
                      <span>赠送模型</span>
                      <el-select
                        v-model="freeGrant.grantModel"
                        placeholder="请选择赠送模型"
                        filterable
                        allow-create
                        default-first-option
                        style="width:100%"
                      >
                        <el-option v-for="m in modelOptions" :key="m.name" :label="m.displayName || m.name" :value="m.name" />
                      </el-select>
                    </span>
                  </template>
                  <p class="small" style="grid-column:1/-1">
                    免费额度月初重置不累计；用尽后商家后台出现「升级基础版」引导卡（AI 额度同时是获客钩子与付费点）。<br />
                    <span class="ver-tag">v1.1</span><b style="color:var(--color-primary-active)">免费版仅可使用平台公共模型，不支持自定义模型</b>——赠送额度不可用于租户自定义模型，自定义模型调用仅按付费套餐倍率计量。
                  </p>
                </div>
              </div>
              <div class="pg-act mt12">
                <span class="btn btn-p" @click="saveFreeGrant" v-if="freeGrantConfigured">{{ freeGrantSaving ? '保存中…' : '保存配置' }}</span>
                <span class="btn btn-p" @click="markFreeGrantTouched" v-else>配置</span>
                <span class="btn" @click="loadFreeGrant" v-if="freeGrantConfigured">重新读取</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ════════ Tab 额度包商品（行 990~997） ════════ -->
    <div v-show="billingTab === 'pack'">
      <div class="panel mt12">
        <div class="p-hd">
          <span class="pt"><span class="tag tag-b" style="margin-right:6px">Tab 3</span>额度包商品</span>
          <span class="btn btn-p" @click="openPackDialog(null)">+ 新建额度包</span>
        </div>
        <div class="p-bd g3" style="padding-top:10px">
          <!-- 未配置：置灰阻断并提示（护栏④） -->
          <div class="panel flush" v-if="!quotaConfigured" style="grid-column:1/-1">
            <div class="p-bd">
              <div class="tipbar">
                <span class="ic">i</span>
                <span>
                  额度包商品<b>尚未配置</b>：名称 / 额度 Token / 售价 / 有效期 / 适用套餐 / 限购数量均未落库，
                  <b>系统不内置任何预设商品（设计稿 500,000 Token / ¥99 等仅为示意）</b>。点击「+ 新建额度包」创建并保存后生效。
                </span>
              </div>
            </div>
          </div>

          <template v-else>
            <div class="panel flush" v-for="pk in quotaPacks" :key="pk.id">
              <div class="p-bd">
                <div class="model-top">
                  <b class="model-name">{{ packView(pk).name }}</b>
                  <span class="tag" :class="packView(pk).statusClass">{{ packView(pk).statusText }}</span>
                </div>
                <div class="qrow mt8">
                  <span style="width:60px">额度</span>
                  <div class="qfill"></div>
                  <em>{{ packView(pk).quota }}</em>
                </div>
                <div class="qrow">
                  <span style="width:60px">售价</span>
                  <div class="qfill"></div>
                  <em><b style="font-size:14px;color:var(--ink)">{{ packView(pk).price }}</b></em>
                </div>
                <p class="small mt8">
                  {{ packView(pk).valid }} · {{ packView(pk).sold }}
                  <span class="lk fr" @click="openPackDialog(pk)">编辑 · 下架 ›</span>
                </p>
              </div>
            </div>
            <div class="panel flush dashed add-card">
              <div class="center">
                <b class="rule-title">新建额度包</b>
                <p class="small mt6">名称 / 额度 Token 数 / 售价 / 有效期 /<br />适用套餐范围 / 限购数量</p>
              </div>
            </div>
          </template>
          <div class="empty" v-if="quotaConfigured && quotaPacks.length === 0">暂无额度包商品，点击右上角「+ 新建额度包」创建</div>
        </div>
      </div>
    </div>

    <!-- ════════ Tab 积分抵扣（行 998~1090） ════════ -->
    <div v-show="billingTab === 'points'">
      <div class="panel mt12">
        <div class="p-hd">
          <span class="pt"><span class="tag tag-b" style="margin-right:6px">Tab 4</span>积分抵扣 · Token 结算冲抵 <span class="ver-tag">v1.2 新增</span></span>
          <span class="ph-s">用量照常计量 · 结算时积分按当前配置汇率冲抵应计费用（积分余额映射为可抵扣 Token 量）</span>
        </div>
        <div class="p-bd" style="display:grid;gap:12px">
          <!-- 抵扣汇率配置 -->
          <div class="panel flush" style="border-color:var(--color-primary-soft)">
            <div class="p-hd">
              <span class="pt" style="font-size:12.5px">抵扣汇率配置 <span class="ver-tag">v1.2</span> <span class="tag tag-gy">手动配置 · 非固定值</span></span>
              <span class="ph-s">Token 计量与模型单价不因积分变化，汇率仅用于结算冲抵</span>
            </div>
            <div class="p-bd" style="display:grid;gap:11px">
              <!-- 未配置：置灰阻断并提示（护栏④：系统不内置 1:50 等任何固定汇率） -->
              <div v-if="!pointsRateConfigured" class="tipbar">
                <span class="ic">i</span>
                <span>
                  积分抵扣汇率<b>尚未配置</b>：积分面额、折算 Token 数、启用开关均未落库，
                  <b>系统不内置任何预设汇率（设计稿 1:50 / 10 万积分≈500 万 token 等仅为示意）</b>。
                  填写并保存后「启用积分抵扣」总开关方可开启。
                </span>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:10px 14px;align-items:flex-end" v-else>
                <span class="fld" style="width:150px">
                  <span>积分面额</span>
                  <input class="ipt" v-model="pointsForm.points" placeholder="1 积分" />
                </span>
                <span style="font-size:14px;font-weight:700;color:var(--g6);padding-bottom:8px">=</span>
                <span class="fld" style="width:170px">
                  <span>折算 Token 数</span>
                  <input class="ipt" v-model="pointsForm.tokens" placeholder="50 token" />
                </span>
                <span class="btn btn-p" @click="savePointsRate" :class="{ 'btn-p': true, disabled: pointsRateSaving }">{{ pointsRateSaving ? '保存中…' : '保存配置' }}</span>
                <span style="display:flex;align-items:center;gap:8px;padding-bottom:4px;margin-left:auto;flex-wrap:wrap">
                  <span
                    class="tg"
                    :class="{ off: !pointsEnabled, locked: !pointsRateConfigured }"
                    @click="onTogglePoints"
                  ></span>
                  <b style="font-size:12.5px;white-space:nowrap">启用积分抵扣</b>
                  <span
                    class="tag"
                    :class="!pointsRateConfigured ? 'tag-gy' : pointsEnabled ? 'tag-g' : 'tag-gy'"
                  >{{ !pointsRateConfigured ? '未配置' : pointsEnabled ? '已开启' : '已关闭' }}</span>
                </span>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:12px 18px;align-items:center" v-if="pointsRateConfigured">
                <div style="flex:none;text-align:center;padding:4px 16px;border-right:1px dashed var(--g2)">
                  <div class="rate-val">{{ rateText }}</div>
                  <p class="small" style="margin-top:3px"><span class="tag tag-b">当前配置值</span> <span class="small">由上方表单配置，可随时修改，非固定规则</span></p>
                </div>
                <div style="flex:1;min-width:min(300px,100%)">
                  <div class="calc-note">
                    <b>换算示例</b>
                    <span>
                      10 万积分 ≈ <b>{{ convTokensText }}</b> 可抵扣 Token 量
                      ≈ 按公共模型均价（{{ publicPriceText }}）约抵 <b>{{ convAmountText }}</b> 用量
                    </span>
                  </div>
                  <p class="small" style="margin-top:6px">
                    汇率由平台管理员手动配置，调整后<b style="color:var(--color-warning)">仅对新消耗生效</b>（消耗时锁定汇率，已抵扣部分不追溯）；
                    <template v-if="!convHasRate">汇率未填写：请在上方输入积分面额与折算 Token 数后保存。</template>
                    <template v-else-if="publicModelAvgPrice === null">公共模型单价接口未返回（t_ai_external_model 暂无单价字段），金额暂不可折算，仅展示 Token 量。</template>
                    <template v-else>金额按公共模型均价（{{ publicPriceText }}）实时折算。</template>
                  </p>
                </div>
              </div>
              <p class="small" style="border-top:1px dashed var(--g2);padding-top:8px">
                <span class="ver-tag">v1.2</span><b>修改记录：</b>暂无修改记录（配置变更留痕可审计）。
              </p>
            </div>
          </div>

          <!-- 抵扣范围 + 适用模型约束 -->
          <div class="g2">
            <div class="panel flush">
              <div class="p-hd">
                <span class="pt" style="font-size:12.5px">抵扣范围 <span class="ver-tag">v1.2</span></span>
                <span class="tag tag-g">按套餐矩阵开启中</span>
              </div>
              <div class="p-bd" style="display:grid;gap:10px">
                <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">
                  <span
                    class="tg"
                    :class="{ off: !pointsEnabled, locked: !pointsRateConfigured }"
                    @click="onTogglePoints"
                  ></span>
                  <b style="font-size:12.5px">全局积分抵扣开关</b>
                  <span class="small" style="margin-left:auto">
                    {{ pointsRateConfigured ? '关闭后全部租户暂停积分冲抵，仅按扣减顺序结算' : '未配置汇率：请先在上方「抵扣汇率配置」保存汇率后再启用' }}
                  </span>
                </div>
                <div class="tblwrap" v-if="planColumns.length">
                  <table class="tbl">
                    <thead>
                      <tr>
                        <th v-for="pl in planColumns" :key="pl">{{ pl }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style="text-align:center" v-for="pl in planColumns" :key="pl">
                          <span class="tg" :class="{ off: !rangeOn[pl] }" @click="rangeOn[pl] = !rangeOn[pl]"></span>
                          <p class="small" style="margin-top:5px" v-if="pl === '免费版'"><span class="tag tag-o">积分主要消耗出口</span></p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="empty" v-else>暂无套餐数据 · 接口未返回可售套餐（GET /platform/subscriptions-management/plans）</div>
              </div>
            </div>
            <div class="panel flush">
              <div class="p-hd">
                <span class="pt" style="font-size:12.5px">适用模型与抵扣约束</span>
              </div>
              <div class="p-bd" style="display:grid;gap:9px">
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                  <span class="tag tag-b">平台公共模型 · 可用积分抵扣</span>
                  <span class="v11-lock">
                    <span class="lkic">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
                        <rect x="4" y="11" width="16" height="10" rx="2" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                    </span>
                    租户自定义模型 · 不可积分抵扣
                    <span class="v11-onlypay">仅付费</span>
                  </span>
                </div>
                <div class="v11-note">
                  <span class="ver-tag" style="margin-top:1px;flex:none">v1.2</span>
                  <span><b>仅限平台公共模型，自定义模型不可用积分抵扣</b>——与 v1.1 付费墙规则咬合：自定义模型调用仅按付费套餐倍率计量，不参与积分冲抵。</span>
                </div>
                <div class="tipbar w" style="padding:8px 11px">
                  <span class="ic">!</span>
                  <span>抵扣部分<b>不可退、不可转赠</b>；老带新奖励积分冲回时，若对应积分已消耗，则从后续获取积分中扣减（不足记负）。</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Token 结算扣减顺序 -->
          <div>
            <p class="b" style="font-size:12px;margin-bottom:7px">Token 结算扣减顺序（固定顺序，租户不可调整）<span class="ver-tag" style="margin-left:6px">v1.2</span></p>
            <div class="steps">
              <div class="step on"><span class="sn">1</span><div><b>积分抵扣</b><p class="sd">营销资产优先消耗</p></div></div>
              <span class="step-line"></span>
              <div class="step"><span class="sn">2</span><div><b>套餐内含额度</b><p class="sd">当期套餐内含部分</p></div></div>
              <span class="step-line"></span>
              <div class="step"><span class="sn">3</span><div><b>额度包</b><p class="sd">已购加量包余额</p></div></div>
              <span class="step-line"></span>
              <div class="step"><span class="sn">4</span><div><b>超额计费</b><p class="sd">按套餐倍率并入账单</p></div></div>
            </div>
            <p class="small mt8">当前节点说明：<b style="color:var(--color-primary-active)">积分（营销资产）优先消耗，保护已付费资源</b>——先冲抵积分，再扣套餐内含与额度包，最后才进入超额计费。</p>
          </div>

          <!-- 积分抵扣流水 -->
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:7px">
              <p class="b" style="font-size:12px">积分抵扣流水（逐次冲抵明细）</p>
              <div class="frow">
                <span class="sel">租户：全部 <span class="caret">▾</span></span>
                <span class="sel">套餐版本：全部 <span class="caret">▾</span></span>
                <span class="btn" @click="todo('导出抵扣流水')">导出</span>
              </div>
            </div>
            <div class="tblwrap">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>租户</th>
                    <th>套餐版本</th>
                    <th>模型</th>
                    <th class="num">消耗 Token</th>
                    <th class="num">抵扣积分</th>
                    <th class="num">操作后积分余额</th>
                    <th>来源模型</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="f in pointsFlow" :key="f.id">
                    <td>{{ f.time }}</td>
                    <td><b>{{ f.tenant }}</b></td>
                    <td>{{ f.plan }}</td>
                    <td>{{ f.model }}</td>
                    <td class="num">{{ f.tokens }}</td>
                    <td class="num"><b style="color:var(--color-warning)">{{ f.points }}</b></td>
                    <td class="num">{{ f.balance }}</td>
                    <td><span class="tag tag-b">{{ f.source }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="empty" v-if="pointsFlow.length === 0">暂无积分抵扣流水</div>
            <p class="small mt8">抵扣积分 = 消耗 Token ÷ 当前配置汇率（向上取整）；消耗时锁定汇率，汇率调整不追溯已抵扣流水；<span class="ver-tag" style="margin-left:2px">v1.2</span></p>
          </div>

          <!-- 租户视角 -->
          <div class="tenant-view">
            <span class="ver-tag" style="flex:none">v1.2 租户视角</span>
            <div style="flex:1;min-width:min(280px,100%)">
              <div style="font-size:14px">当前积分余额：<b style="font-size:19px;color:var(--color-primary-active)">—</b> <span style="color:var(--g5)">→</span> 约可抵扣 <b style="font-size:19px;color:var(--color-primary-active)">—</b></div>
              <p class="small" style="margin-top:2px">按当前配置汇率实时折算 · 展示于商户端 AI 页面 · 积分变动即时刷新可抵扣量</p>
            </div>
            <span class="btn btn-p" style="flex:none" @click="todo('前往商户端预览')">前往商户端预览</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 额度包新建/编辑弹窗 -->
    <el-dialog v-model="packDialog.visible" :title="packDialog.editingId ? '编辑额度包' : '新建额度包'" width="520px" :close-on-click-modal="false">
      <el-form label-width="120px">
        <el-form-item label="名称">
          <el-input v-model="packDialog.form.name" placeholder="如 AI 加量包 · 轻量" />
        </el-form-item>
        <el-form-item label="额度 Token 数">
          <el-input-number v-model="packDialog.form.tokens" :min="1" :step="10000" style="width:100%" />
        </el-form-item>
        <el-form-item label="售价(元)">
          <el-input-number v-model="packDialog.form.price" :min="0" :step="1" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="有效期(月)">
          <el-input-number v-model="packDialog.form.validMonths" :min="1" :step="1" style="width:100%" />
        </el-form-item>
        <el-form-item label="适用套餐范围">
          <el-select v-model="packDialog.form.applicablePlans" multiple placeholder="空 = 不限" style="width:100%">
            <el-option v-for="pl in planColumns" :key="pl" :label="pl" :value="pl" />
          </el-select>
        </el-form-item>
        <el-form-item label="限购数量">
          <el-input-number v-model="packDialog.form.purchaseLimit" :min="0" :step="1" style="width:100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="packDialog.form.status" style="width:100%">
            <el-option label="在售" value="on_sale" />
            <el-option label="下架" value="off_shelf" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="packDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="packDialog.saving" @click="savePack">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getPlans } from '../../api'
import {
  getAiBillingStrategy,
  updateAiBillingStrategy,
  getAiFreeGrant,
  updateAiFreeGrant,
  getAiQuotaPacks,
  updateAiQuotaPacks,
  getAiPointsRate,
  updateAiPointsRate,
} from '../../api'
import {
  listAiBillings,
  updateTenantAiBilling,
  listExternalModels,
  listExternalModelOptions,
} from '../../api/ai-config'

const billingTab = ref<'strategy' | 'pack' | 'points'>('strategy')

// 通用解包：兼容两套客户端（主后端 api 返回 AxiosResponse、ai-base aiRequest 返回已解包 body）
function payloadOf(res: any): any {
  if (res == null) return null
  if (res.data != null && res.data.data != null) return res.data.data
  if (res.data != null) return res.data
  return res
}
function toNum(v: any): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** 金额格式化（元，2 位小数 + 千分位） */
function fmtMoney(v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return '¥' + Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
/** 整数格式化（千分位） */
function fmtInt(v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return Number(v).toLocaleString('en-US')
}

// ==================== 套餐列表（复用现有 api.getPlans 填充「套餐」列） ====================
const planColumns = ref<string[]>([])
const rangeOn = reactive<Record<string, boolean>>({})

async function loadPlans() {
  try {
    const res: any = await getPlans()
    const d = payloadOf(res)
    const list: any[] = Array.isArray(d) ? d : d?.records ?? d?.list ?? []
    const names = (list as any[])
      .map((p) => p.planName || p.name || p.planCode)
      .filter((n): n is string => !!n)
    planColumns.value = names
    names.forEach((n) => (rangeOn[n] = false))
  } catch {
    /* 禁模拟数据：接口失败不回落任何写死的套餐名，保持空态 */
    planColumns.value = []
  }
}

// ==================== Tab2 · 套餐加成倍率与月度额度用尽策略（ai:billing_strategy） ====================
interface StrategyRow {
  multiplier: number | null
  exhaustion: string | null
  downgradeModel: string
  note: string
}
const billingStrategy = reactive<{ plans: Record<string, StrategyRow> }>({ plans: {} })
const strategyConfigured = ref(false)
const strategySaving = ref<string | null>(null)
const EXHAUSTION_OPTIONS = [
  { value: 'disable', label: '停用+升级引导' },
  { value: 'downgrade', label: '降级至基础模型' },
  { value: 'overage', label: '超额计费' },
] as const

const billingRows = computed(() =>
  planColumns.value.map((name) => {
    const r = billingStrategy.plans[name]
    return { planName: name, configured: !!r }
  })
)

async function loadBillingStrategy() {
  try {
    const res: any = await getAiBillingStrategy()
    const d = payloadOf(res) ?? {}
    strategyConfigured.value = !!d._configured
    if (!d._configured) {
      billingStrategy.plans = {}
      return
    }
    const plans = d.plans ?? {}
    const next: Record<string, StrategyRow> = {}
    for (const name of planColumns.value) {
      const cfg = plans[name] ?? {}
      next[name] = {
        multiplier: toNum(cfg.multiplier),
        exhaustion: cfg.exhaustion ?? null,
        downgradeModel: cfg.downgradeModel ?? '',
        note: cfg.note ?? '',
      }
    }
    billingStrategy.plans = next
  } catch {
    /* 读取失败保持未配置态（空态），绝不回落为任何默认倍率 */
    strategyConfigured.value = false
    billingStrategy.plans = {}
  }
}

async function saveStrategyRow(plan: string) {
  const row = billingStrategy.plans[plan]
  if (!row) return
  strategySaving.value = plan
  try {
    // PUT 请求体为整包（含 version），落库前经 zod 校验；_configured/_unconfigured 为只读元字段，不回写。
    // 仅纳入「倍率与用尽策略均已填」的套餐（zod 要求 multiplier 为正整数、exhaustion 为枚举），
    // 未填完整的套餐不进入 packs，避免 400，也符合「未配置子项省略」护栏④。
    const payload: any = { version: 1, plans: {} }
    for (const name of planColumns.value) {
      const r = billingStrategy.plans[name]
      if (r == null || r.multiplier == null || r.exhaustion == null) continue
      payload.plans[name] = {
        multiplier: Number(r.multiplier),
        exhaustion: r.exhaustion,
        downgradeModel: r.exhaustion === 'downgrade' ? (r.downgradeModel || '') : '',
        note: r.note || '',
      }
    }
    await updateAiBillingStrategy(payload)
    strategyConfigured.value = true
    ElMessage.success(`「${plan}」加成倍率已保存`)
  } catch {
    /* 错误提示由请求拦截器统一处理，此处只做内容态 */
  } finally {
    strategySaving.value = null
  }
}

// ==================== Tab2 · 免费版赠送额度（ai:free_grant） ====================
const freeGrant = reactive<{ monthlyCalls: number | null; grantModel: string }>({
  monthlyCalls: null,
  grantModel: '',
})
const freeGrantConfigured = ref(false)
const freeGrantSaving = ref(false)
const modelOptions = ref<{ name: string; displayName?: string; modelName?: string }[]>([])

function markFreeGrantTouched() {
  freeGrantConfigured.value = true
}

async function loadModelOptions() {
  try {
    const res: any = await listExternalModelOptions()
    const d = payloadOf(res)
    const list = Array.isArray(d) ? d : d?.list ?? []
    modelOptions.value = Array.isArray(list) ? list : []
  } catch {
    /* 接口不可用 → 空态，不回落写死模型枚举 */
    modelOptions.value = []
  }
}

async function loadFreeGrant() {
  try {
    const res: any = await getAiFreeGrant()
    const d = payloadOf(res) ?? {}
    freeGrantConfigured.value = !!d._configured
    if (!d._configured) return
    freeGrant.monthlyCalls = toNum(d.monthlyCalls)
    freeGrant.grantModel = d.grantModel ?? ''
  } catch {
    freeGrantConfigured.value = false
  }
}

async function saveFreeGrant() {
  if (!freeGrantConfigured.value) return
  freeGrantSaving.value = true
  try {
    const payload: any = { version: 1 }
    if (freeGrant.monthlyCalls != null) payload.monthlyCalls = Number(freeGrant.monthlyCalls)
    if (freeGrant.grantModel) payload.grantModel = freeGrant.grantModel
    await updateAiFreeGrant(payload)
    ElMessage.success('免费版赠送额度已保存')
    await loadFreeGrant()
  } catch {
    /* 错误提示由请求拦截器统一处理 */
  } finally {
    freeGrantSaving.value = false
  }
}

// ==================== Tab2 · 租户计费套餐（既有 t_tenant_ai_billing，契约 §七 C） ====================
const tenantBillings = ref<any[]>([])
const tenantBillingSaving = ref<string | null>(null)

async function loadTenantBillings() {
  try {
    const res: any = await listAiBillings({ page: 1, pageSize: 100 })
    const d = payloadOf(res)
    tenantBillings.value = Array.isArray(d) ? d : d?.list ?? d?.records ?? []
  } catch {
    tenantBillings.value = []
  }
}

async function saveTenantBilling(row: any) {
  if (!row?.tenantId) return
  tenantBillingSaving.value = row.tenantId
  try {
    const payload: any = {}
    if (row.overagePrice != null && row.overagePrice !== '') payload.overagePrice = Number(row.overagePrice)
    if (row.monthlyPrice != null && row.monthlyPrice !== '') payload.monthlyPrice = Number(row.monthlyPrice)
    await updateTenantAiBilling(row.tenantId, payload)
    ElMessage.success(`「${row.tenantId}」计费套餐已保存`)
  } catch {
    /* 错误提示由请求拦截器统一处理 */
  } finally {
    tenantBillingSaving.value = null
  }
}

// ==================== Tab3 · 额度包商品（ai:quota_pack） ====================
const quotaPacks = ref<any[]>([])
const quotaConfigured = ref(false)

function packView(pk: any) {
  const off = pk?.status === 'off_shelf'
  return {
    name: pk?.name ?? '—',
    status: pk?.status ?? 'on_sale',
    statusText: off ? '已下架' : '在售',
    statusClass: off ? 'tag-gy' : 'tag-g',
    quota: pk?.tokens != null ? `${fmtInt(pk.tokens)} Token` : '—',
    price: pk?.price != null ? fmtMoney(pk.price) : '—',
    valid: pk?.validMonths != null ? `有效期 ${pk.validMonths} 个月` : '有效期 —',
    // 销量类数据（「本月售出 214 份」）属交易数据，本轮保持空态（契约 §3.3）
    sold: '本月售出 —',
  }
}

async function loadQuotaPacks() {
  try {
    const res: any = await getAiQuotaPacks()
    const d = payloadOf(res) ?? {}
    quotaConfigured.value = !!d._configured
    if (!d._configured) {
      quotaPacks.value = []
      return
    }
    quotaPacks.value = Array.isArray(d.packs) ? d.packs : []
  } catch {
    quotaConfigured.value = false
    quotaPacks.value = []
  }
}

const packDialog = reactive({
  visible: false,
  saving: false,
  editingId: null as string | null,
  form: {
    name: '',
    tokens: null as number | null,
    price: null as number | null,
    validMonths: null as number | null,
    applicablePlans: [] as string[],
    purchaseLimit: null as number | null,
    status: 'on_sale' as string,
  },
})

function openPackDialog(pk: any) {
  if (pk) {
    packDialog.editingId = pk.id ?? null
    packDialog.form = {
      name: pk.name ?? '',
      tokens: toNum(pk.tokens),
      price: toNum(pk.price),
      validMonths: toNum(pk.validMonths),
      applicablePlans: Array.isArray(pk.applicablePlans) ? pk.applicablePlans : [],
      purchaseLimit: pk.purchaseLimit != null ? Number(pk.purchaseLimit) : null,
      status: pk.status ?? 'on_sale',
    }
  } else {
    packDialog.editingId = null
    packDialog.form = {
      name: '',
      tokens: null,
      price: null,
      validMonths: null,
      applicablePlans: [],
      purchaseLimit: null,
      status: 'on_sale',
    }
  }
  packDialog.visible = true
}

async function savePack() {
  packDialog.saving = true
  try {
    const packs = quotaPacks.value.map((p) => ({ ...p }))
    const item: any = {
      name: packDialog.form.name,
      tokens: packDialog.form.tokens != null ? Number(packDialog.form.tokens) : null,
      price: packDialog.form.price != null ? Number(packDialog.form.price) : null,
      validMonths: packDialog.form.validMonths != null ? Number(packDialog.form.validMonths) : null,
      applicablePlans: packDialog.form.applicablePlans ?? [],
      purchaseLimit: packDialog.form.purchaseLimit != null ? Number(packDialog.form.purchaseLimit) : null,
      status: packDialog.form.status,
    }
    if (packDialog.editingId != null) {
      const idx = packs.findIndex((p) => (p.id ?? null) === packDialog.editingId)
      if (idx >= 0) packs[idx] = { ...packs[idx], ...item }
      else packs.push({ id: packDialog.editingId, ...item })
    } else {
      packs.push({ id: `pack-${Date.now()}`, ...item })
    }
    await updateAiQuotaPacks({ version: 1, packs })
    ElMessage.success('额度包已保存')
    packDialog.visible = false
    await loadQuotaPacks()
  } catch {
    /* 错误提示由请求拦截器统一处理 */
  } finally {
    packDialog.saving = false
  }
}

// ==================== Tab4 · 积分抵扣汇率（ai:points_rate） ====================
const pointsEnabled = ref(false)
const pointsForm = reactive({ points: '', tokens: '' })
const pointsRateSaving = ref(false)
const rateText = computed(() => {
  if (pointsForm.points && pointsForm.tokens) return `${pointsForm.points} 积分 = ${pointsForm.tokens} token`
  return '—'
})
/** 汇率是否已配置：未配置则总开关置灰阻断并提示（设计稿要求，非固定值） */
const pointsRateConfigured = computed(() => !!(pointsForm.points && pointsForm.tokens))

async function loadPointsRate() {
  try {
    const res: any = await getAiPointsRate()
    const d = payloadOf(res) ?? {}
    if (d._configured) {
      pointsForm.points = d.points != null ? String(d.points) : ''
      pointsForm.tokens = d.tokens != null ? String(d.tokens) : ''
      pointsEnabled.value = !!d.enabled
    }
  } catch {
    /* 读取失败保持未配置态（空态），绝不回落为任何默认汇率 */
  }
}

function onTogglePoints() {
  if (!pointsRateConfigured.value) {
    ElMessage.warning('请先配置汇率')
    return
  }
  pointsEnabled.value = !pointsEnabled.value
}

async function savePointsRate() {
  if (!pointsRateConfigured.value) return
  pointsRateSaving.value = true
  try {
    await updateAiPointsRate({
      version: 1,
      points: Number(pointsForm.points),
      tokens: Number(pointsForm.tokens),
      enabled: pointsEnabled.value,
    })
    ElMessage.success('抵扣汇率已保存')
    await loadPointsRate()
  } catch {
    /* 错误提示由请求拦截器统一处理 */
  } finally {
    pointsRateSaving.value = false
  }
}

// ==================== Tab4 · 换算示例实时计算（契约 §6.2，原 L179 写死 500 万 / ¥250） ====================
// 输入项：① 汇率 points/tokens（来自上方表单实时值）；② 公共模型均价（¥/千 Token，来自 listExternalModels）
// 任一项缺失 → 对应段显示「—」并提示需先配置，绝不回退到 500 万 / ¥250 等写死数字。
const publicModelAvgPrice = ref<number | null>(null)

async function loadExternalModelPrice() {
  try {
    const res: any = await listExternalModels()
    const d = payloadOf(res)
    const list: any[] = Array.isArray(d) ? d : d?.list ?? []
    const prices: number[] = []
    for (const m of list) {
      const inP = toNum(m?.inputPrice ?? m?.input_price)
      const outP = toNum(m?.outputPrice ?? m?.output_price)
      if (inP != null && outP != null) prices.push((inP + outP) / 2)
      else {
        const u = toNum(m?.unitPrice ?? m?.price ?? m?.unit_price)
        if (u != null) prices.push(u)
      }
    }
    // t_ai_external_model 当前无单价列 → 均价恒为 null，金额段显示「—」（接口未返回单价字段）
    publicModelAvgPrice.value = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null
  } catch {
    publicModelAvgPrice.value = null
  }
}

const convHasRate = computed(() => {
  const p = Number(pointsForm.points)
  const t = Number(pointsForm.tokens)
  return Number.isFinite(p) && Number.isFinite(t) && p > 0 && t > 0
})
/** 可抵扣 Token = 100000 × (tokens / points) */
const convTokens = computed(() => (convHasRate.value ? 100000 * (Number(pointsForm.tokens) / Number(pointsForm.points)) : null))
const convTokensText = computed(() => (convTokens.value != null ? `${fmtInt(Math.round(convTokens.value))} token` : '—'))
/** 金额 ≈ 可抵扣 Token / 1000 × 公共模型均价 */
const convAmount = computed(() =>
  convTokens.value != null && publicModelAvgPrice.value != null
    ? (convTokens.value / 1000) * publicModelAvgPrice.value
    : null
)
const convAmountText = computed(() => (convAmount.value != null ? fmtMoney(convAmount.value) : '—'))
const publicPriceText = computed(() =>
  publicModelAvgPrice.value != null ? `${fmtMoney(publicModelAvgPrice.value)}/千Token` : '未返回'
)

// ==================== 积分抵扣流水（无接口：空态） ====================
interface PointsFlow {
  id: number
  time: string
  tenant: string
  plan: string
  model: string
  tokens: string
  points: string
  balance: string
  source: string
}
const pointsFlow = ref<PointsFlow[]>([])

function todo(msg: string) {
  ElMessage.info(`${msg}（接口待接入）`)
}

onMounted(async () => {
  await loadPlans()
  await Promise.allSettled([
    loadBillingStrategy(),
    loadFreeGrant(),
    loadModelOptions(),
    loadQuotaPacks(),
    loadPointsRate(),
    loadExternalModelPrice(),
    loadTenantBillings(),
  ])
})
</script>

<style scoped>
.ai-billing {
  /* 根容器作用域锚点 */
}
.flush {
  box-shadow: none;
}
/* 未配置汇率时总开关置灰不可点（点击由 onTogglePoints 拦截并提示「请先配置汇率」） */
.tg.locked {
  cursor: not-allowed;
  opacity: 0.6;
}
.dashed {
  border-style: dashed;
}
.qfill {
  flex: 1 1 auto;
  min-width: 8px;
}
.caret {
  color: var(--g4);
  font-size: var(--ctrl-caret-size);
  margin-left: auto;
}
.model-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.model-name {
  font-size: var(--text-md);
  font-weight: var(--font-bold);
}
.rule-title {
  font-size: var(--text-md);
  font-weight: var(--font-bold);
}
.center {
  text-align: center;
  min-height: var(--tpl-card-min-h);
  display: grid;
  place-items: center;
}
.lk.fr {
  float: right;
  cursor: pointer;
}
.rate-val {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--color-primary-active);
  letter-spacing: 0.5px;
  white-space: nowrap;
}
.calc-note {
  background: var(--color-primary-bg);
  border: 1px dashed var(--color-primary-soft);
  border-radius: var(--radius-lg);
  padding: 9px 13px;
  font-size: var(--text-sm);
  color: var(--color-primary-active);
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.v11-lock {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--text-xs);
  padding: 2px 9px;
  border-radius: var(--radius-full);
  border: 1px solid var(--g2);
  background: var(--g0);
  color: var(--g5);
}
.v11-lock .lkic {
  display: inline-grid;
  place-items: center;
  width: 13px;
  height: 13px;
  border-radius: 4px;
  background: var(--g3);
  color: var(--g6);
  flex: none;
}
.v11-onlypay {
  display: inline-flex;
  align-items: center;
  font-size: var(--text-xs);
  line-height: 1;
  padding: 2px 5px;
  border-radius: var(--radius-sm);
  background: var(--color-warning-soft);
  border: 1px solid var(--warning-line);
  color: var(--color-warning);
  font-weight: var(--font-semibold);
  margin-left: 4px;
}
.v11-note {
  display: flex;
  gap: 7px;
  align-items: flex-start;
  font-size: var(--text-xs);
  color: var(--g5);
  background: var(--color-primary-bg);
  border: 1px dashed var(--color-primary-soft);
  border-radius: var(--radius-lg);
  padding: 7px 11px;
  line-height: 1.6;
}
.tenant-view {
  border: 1px solid var(--color-primary-soft);
  background: var(--color-primary-bg);
  border-radius: var(--radius-lg);
  padding: 12px 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  align-items: center;
}
.ipt.sm {
  width: 100%;
  min-width: 90px;
}
.mt6 {
  margin-top: 6px;
}
</style>
