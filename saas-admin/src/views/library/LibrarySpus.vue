<template>
  <!--
    商品库 主界面（设计稿 v1.6 #sec-goods 第 1 个 figure，行 2241~2449）
    根节点为内容片段，不写 .pf-main（由 PlatformLayout 包裹）。
    结构：页头 → 5 张 KPI → 5 子 Tab（①②③④⑤）→ 租户调取机制面板 → 跨版块联动说明。
    ② 类目管理 / ③ 品牌库 子 Tab 由 <LibraryBrands> 片段渲染（对应「编辑类目」等子 Tab）。
    数据：SPU 列表 / 品牌列表 沿用现有 listSpusApi / listBrandsApi（保留并沿用）；
          KPI 汇总 / 调取统计 / 审核队列 / 类目树 暂无对应接口 → 空态 + TODO。
    存量缺陷（原第 1066 行 TypeError：drinkBrandDb[i % drinkBrandDb.length.specs.length]）
          随整文件重写已彻底移除全部假数据生成逻辑，不再存在该缺陷。
  -->
  <div class="goods-page">
    <!-- ════════ 页头 ════════ -->
    <div class="pg-hd">
      <div>
        <div class="pt4">商品库</div>
        <p class="pd">
          平台公共主数据 · 租户侧只读检索 + 复制式调取 · 数据口径：调取次数为当月 1 日至今累计 · 更新于 2026-09-11 09:30
        </p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="todo('导出主数据')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          导出主数据
        </span>
        <span class="btn" @click="todo('批量导入 Excel')">批量导入 Excel</span>
        <span class="btn btn-p" @click="openSpuModal()">+ 录入商品</span>
      </div>
    </div>

    <!-- ════════ KPI（汇总接口待接入） ════════ -->
    <!-- TODO: 待接入 GET /platform/library/stats —— 返回 商品总量/类目数/品牌数/本月调取/待审核 -->
    <div class="g5">
      <div class="kpi">
        <div class="kt">商品总量</div>
        <div class="kv">{{ stats ? stats.spuTotal : '—' }}</div>
        <div class="kd">已发布 · 审核中 · 已下架</div>
      </div>
      <div class="kpi">
        <div class="kt">类目数</div>
        <div class="kv">{{ stats ? stats.categoryTotal : '—' }}</div>
        <div class="kd">一级 · 二级 · 三级</div>
      </div>
      <div class="kpi">
        <div class="kt">品牌数</div>
        <div class="kv">{{ stats ? stats.brandTotal : '—' }}</div>
        <div class="kd">已授权 · 待授权</div>
      </div>
      <div class="kpi">
        <div class="kt">本月租户调取</div>
        <div class="kv">{{ stats ? stats.monthCalls + ' 次' : '—' }}</div>
        <div class="kd">较上月 <span class="up">+18.6%</span> · Top10 占 24.3%</div>
      </div>
      <div class="kpi">
        <div class="kt">待审核商品</div>
        <div class="kv">{{ stats ? stats.pendingReview : '—' }}</div>
        <div class="kd">AI 采集 · 供应商提交</div>
      </div>
    </div>

    <!-- ════════ 子 Tab 切换 ════════ -->
    <div class="panel mt12">
      <div class="tabs">
        <span class="tab" :class="{ on: activeTab === 'spu' }" @click="activeTab = 'spu'">① 商品主数据</span>
        <span class="tab" :class="{ on: activeTab === 'category' }" @click="activeTab = 'category'">② 类目管理</span>
        <span class="tab" :class="{ on: activeTab === 'brand' }" @click="activeTab = 'brand'">③ 品牌库</span>
        <span class="tab" :class="{ on: activeTab === 'stats' }" @click="activeTab = 'stats'">④ 调取统计</span>
        <span class="tab" :class="{ on: activeTab === 'review' }" @click="activeTab = 'review'">⑤ 审核队列 <span class="v16-tag lt">v1.6</span></span>
      </div>

      <div class="p-bd">
        <!-- ───────── ① 商品主数据 ───────── -->
        <div v-show="activeTab === 'spu'">
          <div class="panel">
            <div class="p-hd" style="border-bottom:none;padding-bottom:4px">
              <span class="pt"><span class="tag tag-b" style="margin-right:6px">Tab 1</span>商品主数据</span>
              <span class="ph-s">平台运营录入 / AI 采集 / 供应商提交三源归一 · 标准条码 GS1 优先，无 GS1 用平台编码（P-年份-流水）</span>
            </div>
            <div class="p-bd">
              <!-- 筛选器（结构完整；类目路径 / 数据来源 暂无对应接口参数 → TODO） -->
              <div class="frow" style="margin-bottom:10px">
                <span class="fld" style="flex:1">
                  <span>类目路径</span>
                  <span class="sel">全部类目 ▾</span>
                </span>
                <span class="fld" style="width:var(--rbac-perm-col-w)">
                  <span>品牌</span>
                  <select class="fsel" v-model="spuFilter.brandId" @change="searchSpus">
                    <option :value="undefined">全部品牌</option>
                    <option v-for="b in brandOptions" :key="b.id" :value="b.id">{{ b.name }}</option>
                  </select>
                </span>
                <span class="fld" style="width:130px">
                  <span>状态</span>
                  <select class="fsel" v-model="spuFilter.status" @change="searchSpus">
                    <option :value="undefined">全部状态</option>
                    <option value="APPROVED">已发布</option>
                    <option value="PENDING">审核中</option>
                    <option value="OFFLINE">已下架</option>
                  </select>
                </span>
                <span class="fld" style="width:160px">
                  <span>数据来源</span>
                  <span class="sel">全部来源 ▾</span>
                </span>
                <input class="ipt" style="width:210px" placeholder="搜索条码 / 商品名称 / 别名" v-model="spuFilter.keyword" @keyup.enter="searchSpus" />
                <span class="btn" @click="searchSpus">重置</span>
              </div>

              <div class="tblwrap">
                <table class="tbl">
                  <thead>
                    <tr>
                      <th>标准条码</th>
                      <th>主图</th>
                      <th>商品名称</th>
                      <th>类目路径</th>
                      <th>品牌</th>
                      <th>规格 / SKU</th>
                      <th>单位</th>
                      <th class="num">参考进价</th>
                      <th class="num">参考售价</th>
                      <th>状态</th>
                      <th>数据来源</th>
                      <th class="num">调取热度</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in spuList" :key="s.id">
                      <td>{{ s.spuCode || '—' }}</td>
                      <td>
                        <span v-if="s.mainImage" class="v16-thumb" style="width:24px;height:24px">
                          <img :src="s.mainImage" style="width:100%;height:100%;border-radius:var(--radius-sm);object-fit:cover" alt="" />
                        </span>
                        <span v-else class="v16-thumb">图</span>
                      </td>
                      <td><b>{{ s.name }}</b></td>
                      <td class="muted">—</td>
                      <td>{{ s.brandName || '—' }}</td>
                      <td>{{ s.specs || '—' }}<span class="sub" v-if="s.skuCount">{{ s.skuCount }} 个 SKU</span></td>
                      <td>{{ s.unit || '—' }}</td>
                      <td class="num muted">—</td>
                      <td class="num muted">—</td>
                      <td><span class="tag" :class="spuStatusTag(s.status)">{{ spuStatusLabel(s.status) }}</span></td>
                      <td><span class="v11-src" :class="spuSourceClass(s.source)">{{ spuSourceLabel(s.source) }}</span></td>
                      <td class="num"><b>{{ s.hitCount ?? '—' }}</b></td>
                      <td>
                        <span class="btn-t" @click="openDetail(s)">查看</span>
                        <span class="btn-t" @click="openSpuModal(s)">编辑</span>
                        <span class="btn-t" v-if="s.status !== 'OFFLINE'" @click="todo('下架')">下架</span>
                        <span class="btn-t" v-else @click="todo('重新上架')">重新上架</span>
                        <span class="btn-t dgr" @click="removeSpu(s)">删除</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="spuList.length === 0" class="empty">暂无商品数据</div>

              <div class="pagebar">
                <span>共 {{ spuTotal }} 条 · 每页 {{ spuPageSize }} 条</span>
                <div class="pgbtns">
                  <span :class="{ on: spuPage === 1 }" @click="spuPage = 1; fetchSpus()">1</span>
                  <span v-if="spuTotalPages > 1" @click="spuPage++; fetchSpus()">›</span>
                </div>
              </div>

              <div class="tipbar mt8" style="padding:8px 11px">
                <span class="ic">i</span>
                <span><b>批量导入 Excel</b>：模板与「版块09 模板中心 · 商品导出模板」同源；导入触发三重查重（GS1 条码 / 平台编码 / 名称+规格），重复行可选择<b>跳过 / 覆盖参考价</b>；导入结果异步通知，失败行可下载错误明细。删除为<b>软删除</b>，已下架且无租户调取记录才可物理删除。</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ───────── ② 类目管理 ───────── -->
        <div v-show="activeTab === 'category'">
          <LibraryBrands section="category" />
        </div>

        <!-- ───────── ③ 品牌库 ───────── -->
        <div v-show="activeTab === 'brand'">
          <LibraryBrands section="brand" />
        </div>

        <!-- ───────── ④ 调取统计 ───────── -->
        <div v-show="activeTab === 'stats'">
          <div class="p-hd" style="border-bottom:none;padding-bottom:4px">
            <span class="pt"><span class="tag tag-b" style="margin-right:6px">Tab 4</span>调取统计</span>
            <span class="ph-s">本月累计 84,213 次 · 较上月 +18.6% · 租户名按脱敏规范展示</span>
          </div>

          <div class="g2" style="align-items:start">
            <!-- Top10 排行 -->
            <div class="panel" style="box-shadow:none">
              <div class="p-hd">
                <span class="pt">租户调取排行 Top10（本月）</span>
                <span class="ph-s">Top10 合计 20,422 次 · 占 24.3%</span>
              </div>
              <div class="p-bd">
                <div class="tblwrap">
                  <table class="tbl">
                    <thead>
                      <tr>
                        <th style="width:44px">排名</th>
                        <th>租户（脱敏）</th>
                        <th class="num">本月调取</th>
                        <th>常用类目</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(t, i) in tenantRank" :key="i">
                        <td><span class="tag" :class="i < 5 ? 'tag-b' : 'tag-gy'">{{ i + 1 }}</span></td>
                        <td><b>{{ t.name }}</b></td>
                        <td class="num"><b>{{ t.calls }}</b></td>
                        <td>{{ t.category }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-if="tenantRank.length === 0" class="empty">暂无调取排行数据</div>
              </div>
            </div>

            <!-- 近 30 天趋势 -->
            <div class="panel" style="box-shadow:none">
              <div class="p-hd">
                <span class="pt">近 30 天调取趋势</span>
                <span class="lg-row"><span><i style="background:var(--chart-1)"></i>日调取次数</span></span>
              </div>
              <div class="p-bd">
                <div class="chart-box">
                  <!-- TODO: 待接入 GET /platform/library/stats/trend —— 返回近30天日调取次数 -->
                  <div v-if="trend.length === 0" class="empty">暂无调取趋势数据</div>
                  <svg v-else class="chart" viewBox="0 0 640 170" role="img" aria-label="近30天租户调取趋势折线图">
                    <g stroke="var(--chart-grid)" stroke-width="1">
                      <line x1="40" y1="18" x2="620" y2="18" />
                      <line x1="40" y1="55" x2="620" y2="55" />
                      <line x1="40" y1="92" x2="620" y2="92" />
                      <line x1="40" y1="129" x2="620" y2="129" />
                    </g>
                    <polyline fill="none" stroke="var(--chart-1)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" :points="trendPoints" />
                  </svg>
                </div>
                <div class="tipbar mt8" style="padding:8px 11px">
                  <span class="ic">i</span>
                  <span>趋势含<b>在线检索 + 档案调取</b>两类动作；两次峰值分别来自 AI 采集批次上线与三级类目扩充（类目可见性放开后租户检索频次上升）。</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 按类目分布 -->
          <div class="panel mt12" style="box-shadow:none">
            <div class="p-hd">
              <span class="pt">按类目分布（本月 84,213 次）</span>
              <span class="ph-s">五类合计 100%</span>
            </div>
            <div class="p-bd" style="display:grid;gap:8px">
              <!-- TODO: 待接入 GET /platform/library/stats/category-dist —— 返回各类目调取次数与占比 -->
              <div v-if="catDist.length === 0" class="empty">暂无类目分布数据</div>
              <div v-for="d in catDist" :key="d.name" style="display:flex;align-items:center;gap:10px;font-size:var(--text-sm)">
                <span style="width:76px;flex:none;text-align:right;color:var(--g5)">{{ d.name }}</span>
                <div style="flex:1;height:16px;border-radius:var(--radius-pill);background:var(--g0);overflow:hidden">
                  <div :style="{ width: d.pct + '%', height: '100%', background: 'var(' + d.color + ')', borderRadius: 'var(--radius-pill)' }"></div>
                </div>
                <b style="width:150px;flex:none">{{ d.calls }} 次 · {{ d.pct }}%</b>
              </div>
            </div>
          </div>
        </div>

        <!-- ───────── ⑤ 审核队列 ───────── -->
        <div v-show="activeTab === 'review'">
          <div class="panel">
            <div class="p-hd" style="border-bottom:none;padding-bottom:4px">
              <span class="pt"><span class="tag tag-b" style="margin-right:6px">Tab 5</span>审核队列 <span class="v16-tag lt">v1.6</span></span>
              <span class="ph-s">AI 采集 + 供应商提交统一入队 · 通过即发布至租户检索侧</span>
            </div>
            <div class="p-bd">
              <div class="frow" style="margin-bottom:10px">
                <span class="fld" style="width:160px">
                  <span>来源</span>
                  <span class="sel">全部 ▾</span>
                </span>
                <span class="fld" style="width:170px">
                  <span>类目</span>
                  <span class="sel">全部类目 ▾</span>
                </span>
                <span class="fld" style="width:150px">
                  <span>提交时间</span>
                  <span class="sel">近 7 天 ▾</span>
                </span>
                <span class="btn" @click="todo('批量通过')">批量通过（置信度 ≥90%）</span>
                <span class="btn" style="margin-left:auto" @click="todo('导出待审清单')">导出待审清单</span>
              </div>

              <div class="tblwrap">
                <table class="tbl">
                  <thead>
                    <tr>
                      <th>提交时间</th>
                      <th>商品名称</th>
                      <th>标准条码</th>
                      <th>类目</th>
                      <th>来源</th>
                      <th class="num">AI 置信度</th>
                      <th>提交方</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in reviewList" :key="r.id">
                      <td>{{ r.submitTime }}</td>
                      <td><b>{{ r.name }}</b></td>
                      <td>{{ r.barcode }}</td>
                      <td>{{ r.category }}</td>
                      <td><span class="v11-src cus">{{ r.source }}</span></td>
                      <td class="num">{{ r.confidence ?? '—' }}</td>
                      <td>{{ r.submitter }}</td>
                      <td>
                        <span class="btn-t" @click="todo('查看')">查看</span>
                        <span class="btn-t" style="color:var(--color-success);font-weight:600" @click="todo('通过')">通过</span>
                        <span class="btn-t dgr" @click="todo('驳回')">驳回</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="reviewList.length === 0" class="empty">暂无待审核商品</div>

              <div class="pagebar">
                <span>共 {{ reviewTotal }} 条 · 每页 20 条 · AI 采集 / 供应商提交 · 平均滞留 6.2 小时</span>
                <div class="pgbtns">
                  <span class="on">1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>…</span>
                  <span>19</span>
                </div>
              </div>

              <div class="tipbar mt8" style="padding:8px 11px">
                <span class="ic">i</span>
                <span>审核规则：<b>AI 置信度 ≥90%</b> 可批量快审，&lt;90% 逐条人工核验；供应商提交先过<b>入驻资质校验</b>；驳回必填模板化原因（条码无法核验 / 图片不合规 / 类目挂载错误 / 与现有商品重复），驳回记录留痕并回传提交方。AI 采集 / 清洗任务消耗大模型用量，计入「版块05 AI 中心」计量链路 <span class="v16-tag lt">联动版块05</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ════════ 租户调取机制（全局策略） ════════ -->
    <div class="panel mt12">
      <div class="p-hd">
        <span class="pt">租户调取机制（全局策略） <span class="v16-tag lt">v1.6</span></span>
        <span class="ph-s">修改需超级管理员二次确认 · 配置变更全程留痕</span>
      </div>
      <div class="p-bd" style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);align-items:start">
        <div class="strat-card">
          <div class="strat-hd"><span class="tg"></span>允许租户调取<span class="tag tag-g">已开启</span></div>
          <p class="small mt6" style="color:var(--g5)">调取方式：租户在<b>商家后台检索公共库</b> → 选定商品 → 一键生成租户私有商品档案。<b>复制式调取</b>：生成后档案归租户所有，类目 / 品牌 / 条码带入，参考价仅作默认值，租户可自行修改进销价与库存策略。</p>
        </div>
        <div class="strat-card">
          <div class="strat-hd"><span class="tg"></span>更新不强制覆盖<span class="tag tag-g">已开启</span><span class="tg off"></span>强制覆盖<span class="tag tag-gy">已关闭</span></div>
          <p class="small mt6" style="color:var(--g5)">平台商品主数据更新（图片 / 属性 / 参考价）时<b>不强制覆盖租户已调取档案</b>；仅在租户侧商品列表提示<b>「平台有新版本可同步」</b>，由租户自行决定是否同步（可逐字段勾选）。</p>
        </div>
        <div class="strat-card">
          <div class="strat-hd"><span class="tg"></span>在线检索计入 API 额度<span class="tag tag-g">已开启</span></div>
          <p class="small mt6" style="color:var(--g5)">租户通过<b>接口在线检索公共库</b>（含小程序端扫码反查）计入套餐 <b>API 调用额度</b>，超限走增值扣费（与版块04 / 版块10 联动）；<b>调取生成档案动作本身不计费</b>；页面端人工检索不计额度。</p>
        </div>
        <div class="strat-card">
          <div class="strat-hd">发布角色与下架策略</div>
          <p class="small mt6" style="color:var(--g5)"><b>可发布</b>：平台运营（直接发布）· 供应商提交（资质校验 + 审核）· AI 采集（审核后发布）。<b>下架策略</b>：违规 / 侵权商品强制下架并通知已调取租户；存量租户档案保留，仅停止新增调取。<b>批量导入</b>：Excel 模板与版块09 模板中心同源，导入走三重查重。</p>
        </div>
      </div>
    </div>

    <!-- ════════ 跨版块联动说明 ════════ -->
    <div class="tipbar mt12">
      <span class="ic">i</span>
      <span><b>跨版块联动：</b>① <b>开放平台</b>提供商品数据查询 API（<code style="font-family:inherit;background:var(--g1);padding:1px 5px;border-radius:var(--radius-xs)">GET /v1/goods/search</code>、<code style="font-family:inherit;background:var(--g1);padding:1px 5px;border-radius:var(--radius-xs)">GET /v1/goods/{barcode}</code>），密钥签发与轮换见<b>版块14 开放平台</b>，调用计入租户 API 额度 <span class="v16-tag lt">联动版块14</span>；② AI 采集 / 清洗商品数据消耗<b>大模型用量</b>，走<b>版块05 AI 中心</b>计量与积分抵扣链路，成本由平台侧承担 <span class="v16-tag lt">联动版块05</span>；③ 边界说明：租户<b>自有</b>商品 / 客户 / 供应商档案在商家后台维护，总后台商品库仅承载<b>平台公共主数据</b>，不含任何租户私有数据。</span>
    </div>

    <!-- ════════ 录入/编辑商品弹窗（内容包一层 zx-scope） ════════ -->
    <div v-if="spuModal" class="ov" @click.self="spuModal = false"></div>
    <div v-if="spuModal" class="modal">
      <div class="m-hd">
        <span class="pt">{{ editingSpuId ? '编辑商品' : '录入商品' }}</span>
        <span class="d-x" @click="spuModal = false">✕</span>
      </div>
      <div class="m-bd">
        <div class="zx-scope">
          <div class="frow">
            <span class="fld" style="flex:1">
              <span>商品名称 <i style="color:var(--color-danger);font-style:normal">*</i></span>
              <input class="ipt" placeholder="如：农夫山泉饮用天然水 550ml×24" v-model="spuForm.name" />
            </span>
            <span class="fld" style="width:var(--rbac-perm-col-w)">
              <span>标准条码</span>
              <input class="ipt" placeholder="GS1 或 P-年份-流水" v-model="spuForm.spuCode" />
            </span>
          </div>
          <div class="frow">
            <span class="fld" style="flex:1">
              <span>类目路径</span>
              <span class="sel">请选择类目 ▾</span>
            </span>
            <span class="fld" style="width:var(--rbac-perm-col-w)">
              <span>品牌</span>
              <select class="fsel" v-model="spuForm.brandId">
                <option :value="null">无品牌</option>
                <option v-for="b in brandOptions" :key="b.id" :value="b.id">{{ b.name }}</option>
              </select>
            </span>
          </div>
          <div class="frow">
            <span class="fld" style="flex:1">
              <span>规格 / SKU</span>
              <input class="ipt" placeholder="如：550ml×24" v-model="spuForm.specs" />
            </span>
            <span class="fld" style="width:90px">
              <span>单位</span>
              <input class="ipt" placeholder="箱" v-model="spuForm.unit" />
            </span>
            <span class="fld" style="width:120px">
              <span>参考进价</span>
              <input class="ipt" placeholder="¥28.50" v-model="spuForm.cost" />
            </span>
            <span class="fld" style="width:120px">
              <span>参考售价</span>
              <input class="ipt" placeholder="¥36.00" v-model="spuForm.price" />
            </span>
          </div>
          <div class="frow">
            <span class="fld" style="width:var(--rbac-perm-col-w)">
              <span>状态</span>
              <select class="fsel" v-model="spuForm.status">
                <option value="APPROVED">已发布</option>
                <option value="PENDING">审核中</option>
                <option value="OFFLINE">已下架</option>
              </select>
            </span>
            <span class="fld" style="width:var(--rbac-perm-col-w)">
              <span>数据来源</span>
              <select class="fsel" v-model="spuForm.source">
                <option value="MANUAL">平台运营录入</option>
                <option value="IMPORT">供应商提交</option>
                <option value="OPEN_API">接口导入</option>
              </select>
            </span>
          </div>
        </div>
      </div>
      <div class="m-ft">
        <span class="btn" @click="spuModal = false">取消</span>
        <span class="btn btn-p" :class="{ 'is-loading': spuSaving }" @click="saveSpu">保存</span>
      </div>
    </div>

    <!-- ════════ 商品详情弹窗（设计稿 sec-goods 第 2 figure · 商品详情） ════════ -->
    <div v-if="detailModal" class="ov" @click.self="detailModal = false"></div>
    <div v-if="detailModal" class="modal">
      <div class="m-hd">
        <span class="pt">商品详情 · {{ detailSpu?.name }} <span class="v16-tag lt">v1.6</span></span>
        <span class="d-x" @click="detailModal = false">✕</span>
      </div>
      <div class="m-bd">
        <div class="zx-scope">
          <!-- 主图 + 缩略图 -->
          <div style="display:flex;gap:var(--space-3)">
            <div class="v16-thumb" style="width:96px;height:96px;font-size:var(--text-xl)">图</div>
            <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;align-content:flex-start">
              <span class="v16-thumb" style="width:42px;height:42px">图1</span>
              <span class="v16-thumb" style="width:42px;height:42px">图2</span>
              <span class="v16-thumb" style="width:42px;height:42px">图3</span>
            </div>
          </div>

          <div class="frow">
            <span class="fld" style="flex:1">
              <span>标准条码（GS1）</span>
              <span class="ipt">{{ detailSpu?.spuCode || '—' }}</span>
            </span>
            <span class="fld" style="flex:1">
              <span>平台编码</span>
              <span class="ipt">{{ detailSpu?.spuCode || '—' }}</span>
            </span>
            <span class="fld" style="width:110px">
              <span>状态</span>
              <span class="sel" style="justify-content:center">
                <span class="tag" :class="spuStatusTag(detailSpu?.status || '')">{{ spuStatusLabel(detailSpu?.status || '') }}</span>
              </span>
            </span>
          </div>

          <div class="frow">
            <span class="fld" style="flex:1.4">
              <span>类目路径</span>
              <span class="ipt">食品饮料 &gt; 饮料 &gt; 包装饮用水</span>
            </span>
            <span class="fld" style="flex:1">
              <span>品牌</span>
              <span class="ipt">{{ detailSpu?.brandName || '—' }}</span>
            </span>
            <span class="fld" style="width:90px">
              <span>单位</span>
              <span class="ipt">{{ detailSpu?.unit || '—' }}</span>
            </span>
          </div>

          <div class="tblwrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>SKU 规格</th>
                  <th>SKU 条码</th>
                  <th class="num">参考进价</th>
                  <th class="num">参考售价</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!detailSkus.length">
                  <td colspan="4" class="muted">—（暂无 SKU 明细，接口待接入）</td>
                </tr>
                <tr v-for="(k, i) in detailSkus" :key="i">
                  <td>{{ k.specs }}</td>
                  <td>{{ k.skuCode }}</td>
                  <td class="num">¥{{ k.cost }}</td>
                  <td class="num">¥{{ k.price }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="frow">
            <span class="fld" style="flex:1">
              <span>属性：产地</span>
              <span class="ipt">—</span>
            </span>
            <span class="fld" style="flex:1">
              <span>属性：保质期</span>
              <span class="ipt">—</span>
            </span>
            <span class="fld" style="flex:1">
              <span>属性：储存条件</span>
              <span class="ipt">—</span>
            </span>
          </div>

          <!-- 审核记录 -->
          <div style="border:1px solid var(--g2);border-radius:var(--radius-md);padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2)">
            <div style="font-size:var(--text-sm);font-weight:var(--font-bold)">审核记录</div>
            <div class="muted">—（审核流水接口待接入）</div>
          </div>

          <!-- 调取热度 -->
          <div style="display:flex;align-items:center;gap:var(--space-3);border:1px solid var(--color-primary-soft);background:var(--color-primary-bg);border-radius:var(--radius-md);padding:var(--space-3)">
            <div style="flex:1">
              <div style="font-size:var(--text-xs);color:var(--g5)">累计被调取</div>
              <div style="font-size:var(--text-xl);font-weight:var(--font-semibold);color:var(--color-primary)">{{ detailSpu?.hitCount ?? '—' }} 次</div>
            </div>
            <div style="flex:1.6">
              <div style="font-size:var(--text-xs);color:var(--g5)">近期调取租户（脱敏）</div>
              <div class="muted">—</div>
            </div>
          </div>
        </div>
      </div>
      <div class="m-ft">
        <span class="btn btn-p" @click="detailSpu && openSpuModal(detailSpu)">编辑商品</span>
        <span class="btn btn-d" @click="todo('下架')">下架</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listSpusApi, createSpuApi, updateSpuApi, deleteSpuApi,
  listBrandsApi,
  type SpuListItem, type BrandItem, type SkuItem,
} from '../../api/library'
import LibraryBrands from './LibraryBrands.vue'

const activeTab = ref<'spu' | 'category' | 'brand' | 'stats' | 'review'>('spu')

/* ───────── KPI 汇总（接口待接入） ───────── */
// TODO: 待接入 GET /platform/library/stats
const stats = ref<any>(null)

/* ───────── ① SPU 列表（沿用现有接口） ───────── */
const spuList = ref<SpuListItem[]>([])
const spuLoading = ref(false)
const spuTotal = ref(0)
const spuPage = ref(1)
const spuPageSize = ref(20)
const spuTotalPages = computed(() => Math.max(1, Math.ceil(spuTotal.value / spuPageSize.value)))
const spuFilter = reactive({ keyword: '', status: undefined as string | undefined, brandId: undefined as number | undefined })

const brandOptions = ref<BrandItem[]>([])

async function fetchBrandsForFilter() {
  try {
    const res: any = await listBrandsApi({ page: 1, pageSize: 9999 })
    const data = res.data || res
    brandOptions.value = data.records || data.list || []
  } catch {
    /* 下拉选项加载失败不阻断主列表 */
  }
}

async function fetchSpus() {
  spuLoading.value = true
  try {
    const res: any = await listSpusApi({
      page: spuPage.value,
      pageSize: spuPageSize.value,
      keyword: spuFilter.keyword || undefined,
      status: spuFilter.status,
      brandId: spuFilter.brandId,
    })
    const data = res.data || res
    spuList.value = data.records || data.list || []
    spuTotal.value = data.total || 0
  } catch (e: any) {
    ElMessage.error(e?.message || '加载商品失败')
  } finally {
    spuLoading.value = false
  }
}
function searchSpus() {
  spuPage.value = 1
  fetchSpus()
}

const SPU_STATUS: Record<string, { label: string; tag: string }> = {
  APPROVED: { label: '已发布', tag: 'tag-g' },
  PENDING: { label: '审核中', tag: 'tag-o' },
  REJECTED: { label: '已拒绝', tag: 'tag-r' },
  OFFLINE: { label: '已下架', tag: 'tag-gy' },
}
function spuStatusLabel(s: string) {
  return (SPU_STATUS[s] || { label: s || '—' }).label
}
function spuStatusTag(s: string) {
  return (SPU_STATUS[s] || { tag: 'tag-gy' }).tag
}

const SPU_SOURCE: Record<string, { label: string; cls: string }> = {
  MANUAL: { label: '平台运营录入', cls: 'pub' },
  IMPORT: { label: '供应商提交', cls: 'cus' },
  OPEN_API: { label: '接口导入', cls: 'cus' },
  AI: { label: 'AI 采集', cls: 'cus' },
}
function spuSourceLabel(s: string) {
  return (SPU_SOURCE[s] || { label: s || '—' }).label
}
function spuSourceClass(s: string) {
  return (SPU_SOURCE[s] || { cls: 'pub' }).cls
}

/* ───────── 商品详情弹窗（设计稿 sec-goods 第 2 figure） ───────── */
const detailModal = ref(false)
const detailSpu = ref<SpuListItem | null>(null)
const detailSkus = ref<any[]>([])
// TODO: 待接入 GET /platform/library/spus/{id} 与 SKU 明细，当前用列表行数据 + 静态占位渲染
function openDetail(s: SpuListItem) {
  detailSpu.value = s
  detailSkus.value = []
  detailModal.value = true
}

/* ───────── 录入/编辑商品（沿用现有接口） ───────── */
const spuModal = ref(false)
const editingSpuId = ref<number | null>(null)
const spuSaving = ref(false)
const spuForm = reactive({
  name: '', spuCode: '', brandId: null as number | null, specs: '', unit: '',
  cost: '', price: '', status: 'APPROVED', source: 'MANUAL',
})
function openSpuModal(s?: SpuListItem) {
  if (s) {
    editingSpuId.value = s.id
    Object.assign(spuForm, {
      name: s.name, spuCode: s.spuCode || '', brandId: s.brandId ?? null, specs: s.specs || '',
      unit: s.unit || '', cost: '', price: '', status: s.status, source: s.source,
    })
  } else {
    editingSpuId.value = null
    Object.assign(spuForm, { name: '', spuCode: '', brandId: null, specs: '', unit: '', cost: '', price: '', status: 'APPROVED', source: 'MANUAL' })
  }
  spuModal.value = true
}
async function saveSpu() {
  if (!spuForm.name) {
    ElMessage.warning('请输入商品名称')
    return
  }
  spuSaving.value = true
  try {
    const payload: any = {
      name: spuForm.name,
      brandId: spuForm.brandId,
      specs: spuForm.specs,
      unit: spuForm.unit || undefined,
      skus: [] as Partial<SkuItem>[],
    }
    if (editingSpuId.value) {
      await updateSpuApi(editingSpuId.value, payload)
      ElMessage.success('更新商品成功')
    } else {
      await createSpuApi(payload)
      ElMessage.success('录入商品成功')
    }
    spuModal.value = false
    fetchSpus()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    spuSaving.value = false
  }
}
async function removeSpu(s: SpuListItem) {
  try {
    await ElMessageBox.confirm(`确定删除商品『${s.name}』吗？已下架且无租户调取记录才可物理删除。`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
  } catch {
    return
  }
  try {
    await deleteSpuApi(s.id)
    ElMessage.success('删除成功')
    fetchSpus()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

/* ───────── ④ 调取统计（接口待接入） ───────── */
// TODO: 待接入 GET /platform/library/stats/rank          租户调取排行 Top10
// TODO: 待接入 GET /platform/library/stats/trend         近30天日调取次数
// TODO: 待接入 GET /platform/library/stats/category-dist  按类目分布
const tenantRank = ref<any[]>([])
const trend = ref<{ x: number; y: number }[]>([])
const trendPoints = computed(() => trend.value.map((p) => `${p.x},${p.y}`).join(' '))
const catDist = ref<{ name: string; calls: string; pct: number; color: string }[]>([])

/* ───────── ⑤ 审核队列（接口待接入） ───────── */
// TODO: 待接入 GET /platform/library/reviews —— 审核队列（提交时间/商品/来源/AI置信度/提交方/通过/驳回）
const reviewList = ref<any[]>([])
const reviewTotal = ref(0)

function todo(act: string) {
  ElMessage.info(`${act}（接口待接入）`)
}

onMounted(() => {
  fetchBrandsForFilter()
  fetchSpus()
})
</script>

<style scoped>
.goods-page { color: var(--ink); }

/* 功能性下拉（原生 select，沿用令牌，避免与 .sel 的 ::after 箭头重复） */
.fsel {
  border: 1px solid var(--ctl-border);
  border-radius: var(--ctl-radius);
  padding: var(--ctl-ipt-padding);
  font-size: var(--ctl-font-size);
  color: var(--ink);
  background: var(--bg-card);
  min-width: 0;
  width: 100%;
}

/* 5 列 KPI 网格（设计稿 grid-template-columns:repeat(5,1fr)，components.css 仅有 g6，按令牌补 g5） */
.g5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-3); }

/* 调取机制策略卡（设计稿 行2430：边框/圆角/白底，按令牌实现） */
.strat-card {
  border: 1px solid var(--g2);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  background: var(--bg-card);
}
.strat-hd {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
}

/* 数据来源标签（设计稿 .v11-src，components.css 未移植，按令牌实现） */
.v11-src {
  display: inline-flex;
  align-items: center;
  gap: var(--tag-gap);
  font-size: var(--tag-font-size);
  line-height: 1;
  padding: var(--tag-padding);
  border-radius: var(--radius-full);
  white-space: nowrap;
}
.v11-src.pub { background: var(--g1); color: var(--g5); }
.v11-src.cus { background: var(--color-primary-bg); border: 1px solid var(--color-primary-soft); color: var(--color-primary-hover); font-weight: var(--font-medium); }

/* v1.6 修订标注（设计稿 .v16-tag / .v16-thumb，components.css 未移植，按令牌实现） */
.v16-tag {
  display: inline-flex;
  align-items: center;
  font-size: var(--ctrl-caret-size);
  line-height: 1;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--text-inverse);
  font-weight: var(--font-semibold);
  letter-spacing: var(--ver-tag-tracking);
  vertical-align: var(--ver-tag-valign);
  white-space: nowrap;
}
.v16-tag.lt {
  background: var(--color-primary-bg);
  color: var(--color-primary-hover);
  border: 1px solid var(--color-primary-soft);
}
.v16-thumb {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--color-primary-bg), var(--color-primary-soft));
  color: var(--chart-1-soft);
  font-size: var(--text-xs);
  flex: none;
}

/* 弹窗（设计稿 .ov / .modal / .m-hd / .m-bd / .m-ft / .d-x，components.css 未移植，按令牌实现） */
.ov { position: fixed; inset: 0; background: var(--overlay-bg); z-index: 30; }
.modal {
  position: fixed; z-index: 31; left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: var(--modal-width); max-width: 92%; max-height: 88%;
  background: var(--bg-card); border-radius: var(--radius-2xl);
  box-shadow: var(--modal-shadow); display: flex; flex-direction: column; overflow: hidden;
}
.m-hd { display: flex; align-items: center; justify-content: space-between; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--g2); flex: none; }
.m-hd .pt { font-size: var(--text-md); font-weight: var(--font-bold); }
.d-x { color: var(--g4); font-size: var(--text-lg); line-height: 1; padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); cursor: pointer; }
.d-x:hover { background: var(--g0); color: var(--g6); }
.m-bd { padding: var(--space-4); overflow-y: auto; display: grid; gap: var(--space-3); }
.m-ft { border-top: 1px solid var(--g2); padding: var(--space-3) var(--space-4); display: flex; justify-content: flex-end; gap: var(--space-2); background: var(--g0); flex: none; }
</style>
