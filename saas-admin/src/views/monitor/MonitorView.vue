<template>
  <div>
    <!-- ① 页头（设计稿 sec-ops .pg-hd） -->
    <div class="pg-hd">
      <div>
        <div class="pt4">监控告警</div>
        <p class="pd">实时运行态势 · 异常自动告警与留痕（5 分钟级触达值班人）</p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="loadAll"><el-icon><Refresh /></el-icon>{{ loading ? '刷新中…' : '刷新' }}</span>
      </div>
    </div>

    <!-- 加载 / 错误态：写明**真实失败原因**（哪个端点、什么错），并提供重试入口 -->
    <div v-if="error" class="tipbar r mt8">
      <span class="ic">!</span>
      <span>{{ error }}</span>
      <span class="btn-t" style="margin-left: var(--space-2)" @click="loadAll">重试</span>
    </div>

    <!-- ② 三项核心 KPI —— 真源 GET /platform/monitor/api-stats（D1）：
         进程运行态 GET /platform/monitor 无任何 KPI 字段，此前读它导致三项永久为「—」。
         字段口径：totalRequests=服务端追踪滚动窗口(近 60s)真实请求数；statusCodes=同窗口状态码分布；
         errorRate/errorCount=后端口径（累计错误数 / 追踪请求数，见 services/admin/monitor.service.ts:124-125）；
         todayErrorCount=当日错误日志数。后端无 P95、无环比、无告警分级字段，页面如实标注而不造数。 -->
    <div class="g3">
      <div class="kpi">
        <div class="kt">API 请求量（近 60 秒）</div>
        <div class="kv">{{ kpi.requests.value }}</div>
        <div class="kd">{{ kpi.requests.sub }}</div>
      </div>
      <div class="kpi">
        <div class="kt">API 成功率（近 60 秒）</div>
        <div class="kv" :style="kpi.successRate.color ? { color: kpi.successRate.color } : {}">{{ kpi.successRate.value }}</div>
        <div class="kd">{{ kpi.successRate.sub }}</div>
      </div>
      <div class="kpi">
        <div class="kt">今日错误数</div>
        <div class="kv" :style="kpi.todayErrors.color ? { color: kpi.todayErrors.color } : {}">{{ kpi.todayErrors.value }}</div>
        <div class="kd">{{ kpi.todayErrors.sub }}</div>
      </div>
    </div>

    <!-- ③ API 趋势 + 存储 TOP5 -->
    <div class="g2 mt12 monitor-cols">
      <div class="panel">
        <div class="p-hd">
          <span class="pt">API 请求量趋势（今日 · 小时级）</span>
          <span class="lg-row">
            <span><i :style="{ background: 'var(--chart-1)' }"></i>请求量(万)</span>
            <span><i :style="{ background: 'var(--chart-4)' }"></i>错误率(‰)</span>
          </span>
        </div>
        <div class="p-bd">
          <div ref="trendRef" class="chart-box"></div>
          <!-- D2：无小时级真源 ⇒ 空态明文，不画任何模拟曲线 -->
          <div v-if="!hasTrend" class="empty" style="height: var(--chart-h-line)">
            暂无小时级请求量数据源：api-stats 只提供近 7 天错误数（weeklyErrorTrend），
            请求计数仅有服务端 60 秒滚动窗口，本页不绘制任何模拟曲线。
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="p-hd">
          <span class="pt">存储监控 · 租户占用 TOP5</span>
          <span class="btn-t" @click="onOrphanScan">孤儿文件扫描</span>
        </div>
        <div class="p-bd" style="padding-top: var(--space-2)">
          <template v-if="storageRows.length">
            <div v-for="t in storageRows" :key="t.tenantId" class="qrow store-row">
              <span>{{ t.tenantName || t.tenantCode || t.tenantId }}</span>
              <span v-if="t.usagePercent == null" class="small" style="flex: 1">
                使用率 —（配额未配置，quotaSource={{ t.quotaSource }}）
              </span>
              <span v-else class="bar" :class="storageTone(t.usagePercent)" style="flex: 1">
                <i :style="{ width: Math.min(100, t.usagePercent) + '%' }"></i>
              </span>
              <em>{{ storageUsageText(t) }}</em>
            </div>
          </template>
          <div v-else class="empty">暂无租户存储占用数据（后端 monitor/storage/top5 返回 records 为空）</div>
          <div class="tipbar r mt10">
            <span class="ic">!</span>
            <span>
              {{ thresholdTip }}
              <template v-if="storageNotes.length"><br />{{ storageNotes.join(' · ') }}</template>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ④ 各租户 API 调用量统计 · 超限告警（设计稿 v1.5 新增） -->
    <div class="panel mt12">
      <div class="pg-hd">
        <div>
          <div class="pt4">各租户 API 调用量统计 · 超限告警 <span class="ver-tag">v1.5 新增</span></div>
          <p class="pd">按套餐配额逐租户统计当月 API 调用量 · 三档阈值分级处置（阈值取「阈值配置」真实值，未配置即显示未配置）· 超额部分按增值服务口径自动出账</p>
        </div>
        <div class="pg-act">
          <span class="btn" @click="onExportMonthly">导出月报</span>
          <span class="btn btn-p" @click="openThresholdCfg">阈值配置</span>
        </div>
      </div>
      <div class="tblwrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>租户 / 对接场景</th>
              <th class="num">本月调用量</th>
              <th>配额 / 使用率</th>
              <th>状态</th>
              <th>触发动作与关联单据</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in tenantApiRows" :key="r.tenantId">
              <td>
                <b>{{ r.tenantName || r.tenantId }}</b>
                <span v-if="r.tenantCode" class="small"> {{ r.tenantCode }}</span>
              </td>
              <td class="num">
                {{ r.callCount }}
                <span class="small">
                  · 错误 {{ r.errorCount }}<template v-if="r.errorRate != null">（{{ r.errorRate }}%）</template>
                </span>
              </td>
              <td>—<span class="small"> 后端无配额载体</span></td>
              <td>—</td>
              <td>—<span class="small"> 后端无关联单据载体</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="!tenantApiRows.length" class="empty">暂无租户 API 调用量数据（后端 monitor/tenant-api 返回 records 为空）</div>
      <p v-if="tenantApiMeta" class="small mt8" style="padding: 0 14px">
        统计周期 {{ tenantApiMeta.period }} · 扫描上限 {{ tenantApiMeta.scanLimit }}
        <template v-if="tenantApiMeta.scanLimitReached">（已触达上限，结果可能不完整）</template>
        <template v-if="tenantApiMeta.unavailable.length">
          <br />无载体字段（后端 unavailable 逐条说明）：
          <template v-for="(u, i) in tenantApiMeta.unavailable" :key="u.key"><span v-if="i"> · </span>{{ u.key }}：{{ u.reason }}</template>
        </template>
      </p>
      <!-- 阈值通知渠道：一律取 GET /platform/monitor/thresholds 的真实配置；
           未配置（thresholds=null）时置灰并给出具名原因，**不回落设计稿内置默认值** -->
      <div class="frow" style="margin-top: var(--space-3)">
        <span v-for="g in notifyGroups" :key="g.level" class="fld" style="flex: 1">
          <span>{{ g.title }}</span>
          <div class="notify-row">
            <span
              v-for="n in g.items"
              :key="n.key"
              class="btn"
              :class="{ 'btn-p': n.enabled, dis: !thresholdsConfigured }"
              :title="thresholdsConfigured ? '' : UNSUPPORTED.THRESHOLDS"
              @click="toggleNotify(g.level, n.key)"
              >{{ n.enabled ? '✓ ' : '' }}{{ n.label }}</span
            >
          </div>
        </span>
      </div>
      <p class="small" style="padding: 0 14px">{{ thresholdStateText }}</p>
      <div class="tipbar r" style="margin-top: var(--space-3)">
        <b>留痕与合规：</b>阈值变更、临时提额与手动解限均写入管理员操作日志（仅追加不可删改）；超额部分按「增值服务扣费」口径自动出账并同步账单中心，租户可在账单 Tab 4 查询完整流水。<span class="ver-tag">v1.5</span>
      </div>
    </div>

    <!-- ⑤ 异常接口 TOP / 日志中心 -->
    <div class="panel mt12">
      <div class="tabs">
        <span
          v-for="t in logTabs"
          :key="t.key"
          class="tab"
          :class="{ on: activeLogTab === t.key }"
          @click="activeLogTab = t.key"
          >{{ t.label }}<span v-if="t.badge" class="n">{{ t.badge }}</span></span
        >
      </div>
      <div class="tblwrap">
        <table class="tbl">
          <thead>
            <tr>
              <th v-for="c in logColumns" :key="c.key" :class="{ num: c.num }">{{ c.label }}</th>
              <th v-if="activeLogTab === 'errLog'">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in logRows" :key="i">
              <td v-for="c in logColumns" :key="c.key" :class="{ num: c.num }">{{ r.cells[c.key] ?? '—' }}</td>
              <td v-if="activeLogTab === 'errLog'">
                <span class="btn-t" @click="onStack(r.raw)">堆栈</span>
                <span class="btn-t warn dis" :title="UNSUPPORTED.TICKET" @click="notSupported('创建工单', UNSUPPORTED.TICKET)">创建工单</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="logNotice" class="empty">{{ logNotice }}</div>
      <div v-else-if="!logRows.length" class="empty">{{ logEmptyText }}</div>
      <p class="small mt8" style="padding: 0 14px 12px">
        日志中心说明：管理员操作日志 / 租户登录日志 / 系统错误日志三个 Tab 结构一致（时间 / 对象 / 操作 / 结果 / IP），支持按人、模块、时间检索，保留 ≥180 天，导出需权限；异常登录（异地 / 高频失败）自动标红。P0 告警 5 分钟内短信+电话双通道触达值班人并自动创建故障工单。
      </p>
    </div>

    <!-- ⑥ 代登录审计记录 · 五步审计法 -->
    <div class="panel mt12">
      <div class="p-hd">
        <span class="pt">
          <span class="tag tag-r" style="margin-right: var(--space-1)">独立 Tab</span>代登录审计记录 · 五步审计法
        </span>
        <div class="frow">
          <span class="sel" @click="onFilterAuditor">操作人：{{ auditOperator || '全部' }} ▾</span>
          <span class="sel" @click="onFilterMonth">月份：{{ auditMonth || '全部' }} ▾</span>
          <span class="btn" @click="onExportAudit">导出审计</span>
        </div>
      </div>
      <div class="p-bd" style="padding-top: var(--space-2)">
        <!-- 五步法是流程说明（设计稿版式）；某次会话的真实落地与否由「审计报告」弹窗按后端 steps 呈现 -->
        <div class="steps">
          <span class="step"><span class="sn">1</span>申请（工单关联必填）</span><span class="step-line"></span>
          <span class="step"><span class="sn">2</span>审批（审批人≠申请人）</span><span class="step-line"></span>
          <span class="step"><span class="sn">3</span>限时会话（≤30分钟）</span><span class="step-line"></span>
          <span class="step"><span class="sn">4</span>留痕（后端无录屏载体）</span><span class="step-line"></span>
          <span class="step"><span class="sn">5</span>回放与月度抽检</span>
        </div>
        <p v-if="auditMeta?.fieldNotes.length" class="small" style="padding: 0 14px">
          字段口径（后端 fieldNotes，无载体列一律显示 —）：
          <template v-for="(f, i) in auditMeta.fieldNotes" :key="f.field"><span v-if="i"> · </span>{{ f.field }}：{{ f.reason }}</template>
        </p>
        <div class="tblwrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>工单号</th>
                <th>操作人</th>
                <th>目标租户</th>
                <th>事由</th>
                <th>进入时间</th>
                <th>退出时间</th>
                <th class="num">时长</th>
                <th>操作摘要</th>
                <th>审批人</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in auditRows" :key="r.id">
                <td>{{ r.ticketNo || '—' }}</td>
                <td>{{ r.operator }}</td>
                <td>{{ r.tenant || r.tenantCode || r.tenantId || '—' }}</td>
                <td>{{ r.reason || '—' }}</td>
                <td>{{ fmtTime(r.enterAt) }}</td>
                <td>
                  <span v-if="auditOngoing(r)" class="tag tag-b">会话进行中</span>
                  <template v-else>{{ fmtTime(r.exitAt) }}</template>
                </td>
                <td class="num">{{ r.duration == null ? '—' : r.duration }}</td>
                <td>{{ r.actionSummary == null ? '—' : r.actionSummary }}</td>
                <td>{{ r.approver == null ? '—' : r.approver }}</td>
                <td>
                  <template v-if="auditOngoing(r)">
                    <span class="btn-t dgr dis" :title="UNSUPPORTED.TERMINATE" @click="notSupported('强制结束会话', UNSUPPORTED.TERMINATE)">强制结束</span>
                    <span class="btn-t dis" :title="UNSUPPORTED.LIVE" @click="notSupported('实时监控', UNSUPPORTED.LIVE)">实时监控</span>
                  </template>
                  <template v-else>
                    <span class="btn-t dis" :title="UNSUPPORTED.REPLAY" @click="notSupported('会话回放', UNSUPPORTED.REPLAY)">回放</span>
                    <span class="btn-t" @click="onAuditReport(r)">审计报告</span>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!auditRows.length" class="empty">暂无代登录审计记录（后端 monitor/proxy-audit 返回 records 为空）</div>
        <p class="small mt8">
          安全约束：一次性临时 Token 不可续期；会话内页面操作逐屏记录可回放；支付配置 / 密钥等敏感页强制脱敏禁改；每月抽检 ≥10% 会话，无工单 / 超频代登录自动告警。
        </p>
      </div>
    </div>

    <!-- 堆栈详情（M02：直接用 error-logs 行内 stack，不调用不存在的 /error-logs/:id/stack） -->
    <el-dialog v-model="stackVisible" title="错误日志 · 堆栈详情" :width="MODAL_W" :close-on-click-modal="false">
      <div class="zx-scope">
        <template v-if="stackRow">
          <p class="small">
            {{ fmtTime(stackRow.createdAt) }} · 来源 {{ stackRow.source || '—' }} · {{ stackRow.errorType || '—' }}
            · 严重程度 {{ stackRow.severity || '—' }}
          </p>
          <p class="small mt8">
            {{ stackRow.requestMethod ? stackRow.requestMethod + ' ' : '' }}{{ stackRow.requestUrl || '—' }}
            <template v-if="stackRow.statusCode != null"> · HTTP {{ stackRow.statusCode }}</template>
          </p>
          <p class="mt10">{{ stackRow.message || '—' }}</p>
          <pre
            v-if="stackRow.stack"
            style="max-height: 40vh; overflow: auto; white-space: pre-wrap; word-break: break-all"
            >{{ stackRow.stack }}</pre
          >
          <div v-else class="empty">无堆栈信息（该行 stack 为空）</div>
        </template>
        <div v-else class="empty">无堆栈信息</div>
      </div>
      <template #footer>
        <span class="btn" @click="stackVisible = false">关闭</span>
      </template>
    </el-dialog>

    <!-- 孤儿文件扫描（M08：真实调用 storage/orphan-scan，scanLimitReached 必须显式提示） -->
    <el-dialog v-model="orphanVisible" title="孤儿文件扫描" :width="MODAL_W" :close-on-click-modal="false">
      <div class="zx-scope">
        <div v-if="orphanLoading" class="empty">扫描中…</div>
        <div v-else-if="orphanError" class="empty">扫描失败：{{ orphanError }}</div>
        <template v-else-if="orphanData">
          <p class="small">
            命中 {{ orphanData.total }} 个文件 · 扫描上限 {{ orphanData.scanLimit }}
          </p>
          <div v-if="orphanData.scanLimitReached" class="tipbar r mt8">
            <span class="ic">!</span>
            <span>已达扫描上限（scanLimitReached=true），结果可能不完整，未覆盖的文件不在下表。</span>
          </div>
          <div v-if="orphanData.criteria.length" class="small mt8">
            扫描口径：{{ orphanData.criteria.join(' · ') }}
          </div>
          <div v-if="orphanData.notes.length" class="small mt8">
            说明：{{ orphanData.notes.join(' · ') }}
          </div>
          <div class="tblwrap mt10">
            <table class="tbl">
              <thead>
                <tr>
                  <th>租户</th>
                  <th>文件</th>
                  <th>路径</th>
                  <th class="num">大小(字节)</th>
                  <th>原因</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="f in orphanData.records" :key="f.id">
                  <td>{{ f.tenantName || f.tenantId }}</td>
                  <td>{{ f.fileName || '—' }}</td>
                  <td>{{ f.filePath || '—' }}</td>
                  <td class="num">{{ f.fileSize }}</td>
                  <td>{{ f.reasons.map(orphanReasonText).join(' / ') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="!orphanData.records.length" class="empty">本次扫描未发现孤儿文件</div>
        </template>
        <div v-else class="empty">无扫描结果</div>
      </div>
      <template #footer>
        <span class="btn" @click="orphanVisible = false">关闭</span>
        <span class="btn btn-p" @click="onOrphanScan">重新扫描</span>
      </template>
    </el-dialog>

    <!-- 阈值配置（M10：读 GET + 写 PUT /platform/monitor/thresholds；整包提交，未配置不回落默认值） -->
    <el-dialog v-model="thVisible" title="监控阈值配置（整包保存）" :width="MODAL_W" :close-on-click-modal="false">
      <div class="zx-scope">
        <p class="small">
          未配置时后端返回 thresholds=null，本表单留空且不回落任何内置默认值；三档必须满足 warn &lt; alert &lt; block（后端同口径校验）。
        </p>
        <div class="g3 mt10">
          <span class="fld">
            <span>预警阈值 warnPercent（%）</span>
            <input v-model="thForm.warnPercent" class="ipt" type="number" :placeholder="thresholdsConfigured ? '' : '未配置'" />
          </span>
          <span class="fld">
            <span>告警阈值 alertPercent（%）</span>
            <input v-model="thForm.alertPercent" class="ipt" type="number" :placeholder="thresholdsConfigured ? '' : '未配置'" />
          </span>
          <span class="fld">
            <span>处置阈值 blockPercent（%）</span>
            <input v-model="thForm.blockPercent" class="ipt" type="number" :placeholder="thresholdsConfigured ? '' : '未配置'" />
          </span>
        </div>
        <div class="frow mt10">
          <span class="fld" style="flex: 1">
            <span>warn 通知</span>
            <div class="notify-row">
              <span class="btn" :class="{ 'btn-p': thForm.warnInApp }" @click="thForm.warnInApp = !thForm.warnInApp">{{ thForm.warnInApp ? '✓ ' : '' }}站内通知</span>
              <span class="btn" :class="{ 'btn-p': thForm.warnEmail }" @click="thForm.warnEmail = !thForm.warnEmail">{{ thForm.warnEmail ? '✓ ' : '' }}邮件</span>
              <span class="btn" :class="{ 'btn-p': thForm.warnSms }" @click="thForm.warnSms = !thForm.warnSms">{{ thForm.warnSms ? '✓ ' : '' }}短信</span>
            </div>
          </span>
          <span class="fld" style="flex: 1">
            <span>alert 动作</span>
            <div class="notify-row">
              <span class="btn" :class="{ 'btn-p': thForm.alertEscalate }" @click="thForm.alertEscalate = !thForm.alertEscalate">{{ thForm.alertEscalate ? '✓ ' : '' }}升级 P2 工单</span>
              <span class="btn" :class="{ 'btn-p': thForm.alertCsm }" @click="thForm.alertCsm = !thForm.alertCsm">{{ thForm.alertCsm ? '✓ ' : '' }}通知客户成功经理</span>
            </div>
          </span>
          <span class="fld" style="flex: 1">
            <span>block 动作</span>
            <div class="notify-row">
              <span class="btn" :class="{ 'btn-p': thForm.block429 }" @click="thForm.block429 = !thForm.block429">{{ thForm.block429 ? '✓ ' : '' }}硬限流 429</span>
              <span class="btn" :class="{ 'btn-p': thForm.blockQuota }" @click="thForm.blockQuota = !thForm.blockQuota">{{ thForm.blockQuota ? '✓ ' : '' }}临时提额 +20%</span>
            </div>
          </span>
        </div>
        <p class="small mt10">{{ thresholdStateText }}</p>
      </div>
      <template #footer>
        <span class="btn" @click="thVisible = false">取消</span>
        <span class="btn btn-p" @click="submitThresholds">{{ thSaving ? '保存中…' : '保存（整包）' }}</span>
      </template>
    </el-dialog>

    <!-- 审计报告（M07：五步 steps + sessionStatus + fieldNotes，NO_CARRIER 步骤如实标注） -->
    <el-dialog v-model="reportVisible" title="代登录审计报告 · 五步审计法" :width="MODAL_W" :close-on-click-modal="false">
      <div class="zx-scope">
        <div v-if="reportLoading" class="empty">加载中…</div>
        <div v-else-if="reportError" class="empty">审计报告加载失败：{{ reportError }}</div>
        <template v-else-if="reportData">
          <p class="small">
            操作人 <b>{{ reportData.operator }}</b> · 目标租户 {{ reportData.tenantName || reportData.tenantCode || reportData.tenantId || '—' }}
            · 事由 {{ reportData.reason || '—' }}
          </p>
          <p class="small mt8">
            进入 {{ fmtTime(reportData.enterAt) }} · 退出 {{ fmtTime(reportData.expiresAt) }}
            · 限时 {{ reportData.ttlSeconds == null ? '—' : reportData.ttlSeconds + ' 秒' }}
            · 会话状态
            <span class="tag" :class="reportData.sessionStatus === 'ONGOING' ? 'tag-b' : reportData.sessionStatus === 'EXPIRED' ? 'tag-gy' : 'tag-o'">
              {{ SESSION_STATUS_TEXT[reportData.sessionStatus] || reportData.sessionStatus }}
            </span>
          </p>
          <div class="tblwrap mt10">
            <table class="tbl">
              <thead>
                <tr>
                  <th class="num">步骤</th>
                  <th>名称</th>
                  <th>状态</th>
                  <th>依据</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in reportData.steps" :key="s.step">
                  <td class="num">{{ s.step }}</td>
                  <td>{{ s.name }}</td>
                  <td>
                    <span class="tag" :class="s.status === 'DONE' ? 'tag-g' : 'tag-gy'">
                      {{ s.status === 'DONE' ? '已落地' : '无载体' }}
                    </span>
                  </td>
                  <td>{{ s.basis }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="reportData.fieldNotes.length" class="small mt8">
            字段口径：<template v-for="(f, i) in reportData.fieldNotes" :key="f.field"><span v-if="i"> · </span>{{ f.field }}：{{ f.reason }}</template>
          </p>
          <p class="small mt8">筛选条件：{{ reportData.criteria }}</p>
        </template>
        <div v-else class="empty">无审计报告数据</div>
      </div>
      <template #footer>
        <span class="btn" @click="reportVisible = false">关闭</span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { getErrorLogs } from '../../api'
import {
  fetchMonitorApiStats,
  listProxyAudit,
  exportProxyAuditCsv,
  getProxyAuditReport,
  getStorageTop5,
  scanOrphanFiles,
  getTenantApiUsage,
  exportTenantApiCsv,
  getMonitorThresholds,
  updateMonitorThresholds,
  type MonitorApiStats,
  type MonitorThresholds,
  type MonitorThresholdsResult,
  type OrphanScanResult,
  type ProxyAuditListResult,
  type ProxyAuditReportResult,
  type ProxyAuditRow,
  type StorageTopRow,
  type StorageTopResult,
  type TenantApiResult,
} from '../../api/monitor-ops'
import { saveBlobResponse, readExportRows } from '../../utils/download-blob'
import { resolveHttpErrorText } from '../../utils/http-error'

const MODAL_W = 'var(--modal-width)'

/* 图表配色一律读取 design token，避免在脚本里写死色值 */
function token(name: string, fallback = ''): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}
const COLOR = {
  primary: token('--chart-1'),
  danger: token('--chart-4'),
  grid: token('--chart-grid'),
  axis: token('--chart-axis-text'),
}

const loading = ref(false)
const error = ref('')

/** 本批「不做」的行内动作：后端无该端点，按钮置灰 + 具名原因（不得用前端能力冒充） */
const UNSUPPORTED = {
  TICKET: '后端未提供 POST /api/platform/support/tickets（工单能力属 C6 / S3-92，本批不做）',
  TERMINATE: '后端未提供 POST /api/platform/monitor/proxy-audit/:id/terminate（无会话载体表，S3-96 家族）',
  LIVE: '后端未提供 GET /api/platform/monitor/proxy-audit/:id/live（实时需客户端录屏采集，仓库零实现）',
  REPLAY: '后端未提供 GET /api/platform/monitor/proxy-audit/:id/replay（回放需客户端录屏采集，仓库零实现）',
  THRESHOLDS: '监控阈值未配置（GET /platform/monitor/thresholds 返回 thresholds=null）：本页不回落内置默认值，请先点「阈值配置」',
} as const
function notSupported(label: string, reason: string) {
  ElMessage.warning(`${label}暂不可用：${reason}`)
}

/** 统一解包：旧客户端（api.ts 实例）成功时原样返回 AxiosResponse ⇒ 取 res.data.data */
function unwrap(res: unknown): any {
  const r = res as { data?: { data?: unknown } } | null
  return r?.data?.data ?? r?.data ?? null
}
/** 真实失败原因（英文原文不上屏：HTTP 错误统一走 http-error 的中文文案） */
function errText(e: unknown): string {
  const err = e as { response?: unknown; message?: string } | null
  if (!err?.response) return err?.message || '请求失败'
  return resolveHttpErrorText(e)
}
function fmtTime(v: unknown): string {
  if (v == null || v === '') return '—'
  return String(v).replace('T', ' ').replace(/\.\d+Z?$/, '')
}

// ==================== KPI（D1：真源 GET /platform/monitor/api-stats） ====================
const apiStats = ref<MonitorApiStats | null>(null)

/** 状态码分布 → 成功/失败请求数（服务端近 60 秒窗口的真实分布） */
function statusBuckets(codes: MonitorApiStats['statusCodes'] | undefined): { ok: number; bad: number } {
  let ok = 0
  let bad = 0
  for (const [key, value] of Object.entries(codes || {})) {
    const n = Number(value) || 0
    if (Number(key) >= 400) bad += n
    else ok += n
  }
  return { ok, bad }
}
const successRate = computed<number | null>(() => {
  const s = apiStats.value
  if (!s) return null
  const { ok, bad } = statusBuckets(s.statusCodes)
  const total = ok + bad
  if (!total) return null
  return Math.round((ok / total) * 10000) / 100
})
const kpi = computed(() => {
  const s = apiStats.value
  const { ok, bad } = statusBuckets(s?.statusCodes)
  return {
    requests: {
      value: s ? s.totalRequests : '—',
      sub: s
        ? `服务端追踪滚动窗口真实计数 · 2xx/3xx ${ok} · 4xx/5xx ${bad}（后端无环比字段）`
        : '未取到 api-stats',
    },
    successRate: {
      value: successRate.value == null ? '—' : `${successRate.value}%`,
      color: successRate.value == null ? '' : 'var(--color-success)',
      sub: s
        ? `均值响应 ${s.avgResponseTime}ms（后端无 P95 字段）· 后端错误率 ${s.errorRate}%（累计错误 ${s.errorCount} 例 / 追踪请求 ${s.totalRequests}）`
        : '—',
    },
    todayErrors: {
      value: s ? s.todayErrorCount : '—',
      color: s && s.todayErrorCount > 0 ? 'var(--color-danger)' : '',
      sub: '后端无 P0/P1/P2 分级告警字段；近 7 天错误数见下方「系统错误日志」',
    },
  }
})

// ==================== API 趋势（D2：无小时级真源 ⇒ 空态明文） ====================
const trend = ref<{ hour: string; requests: number; errRate: number }[]>([])
const hasTrend = computed(() => trend.value.length > 0)
const trendRef = ref<HTMLElement | null>(null)
let trendChart: echarts.ECharts | null = null

function renderTrend() {
  if (!trendRef.value || !hasTrend.value) return
  trendChart = trendChart || echarts.init(trendRef.value)
  trendChart.setOption({
    grid: { left: 36, right: 36, top: 16, bottom: 24 },
    tooltip: { trigger: 'axis' },
    legend: { show: false },
    xAxis: {
      type: 'category',
      data: trend.value.map((x) => x.hour),
      axisLine: { lineStyle: { color: COLOR.grid } },
      axisLabel: { color: COLOR.axis, fontSize: 9 },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: '请求量(万)',
        splitLine: { lineStyle: { color: COLOR.grid } },
        axisLabel: { color: COLOR.axis, fontSize: 9 },
      },
      {
        type: 'value',
        name: '错误率(‰)',
        splitLine: { show: false },
        axisLabel: { color: COLOR.axis, fontSize: 9 },
      },
    ],
    series: [
      {
        name: '请求量(万)',
        type: 'line',
        smooth: true,
        yAxisIndex: 0,
        symbolSize: 5,
        data: trend.value.map((x) => x.requests),
        lineStyle: { color: COLOR.primary, width: 2.5 },
        itemStyle: { color: COLOR.primary },
      },
      {
        name: '错误率(‰)',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        symbolSize: 4,
        data: trend.value.map((x) => x.errRate),
        lineStyle: { color: COLOR.danger, width: 1.5, type: 'dashed' },
        itemStyle: { color: COLOR.danger },
      },
    ],
  })
}

// ==================== 存储监控 TOP5 ====================
const storageRows = ref<StorageTopRow[]>([])
const storageNotes = ref<string[]>([])

/** 占用条分级着色取「阈值配置」真实值；未配置时不着色（不回落内置默认阈值） */
function storageTone(percent: number): string {
  const t = thresholds.value?.thresholds
  if (!t) return 'g'
  if (percent >= t.blockPercent) return 'r'
  if (percent >= t.warnPercent) return 'o'
  return 'g'
}
/** 使用率无载体（配额未配置）时显示 —，绝不用 0 冒充 */
function storageUsageText(r: StorageTopRow): string {
  const gb = r.usedGb == null ? '—' : `${r.usedGb} GB`
  if (r.usagePercent == null) return `${gb} · 使用率 —`
  return `${gb} · ${r.usagePercent}%`
}

// ==================== 各租户 API 调用量 ====================
const tenantApiRows = ref<TenantApiResult['records']>([])
const tenantApiMeta = ref<{ period: string; scanLimit: number; scanLimitReached: boolean; unavailable: { key: string; reason: string }[] } | null>(null)

// ==================== 监控阈值（读 + 写，整包） ====================
const thresholds = ref<MonitorThresholdsResult | null>(null)
const thresholdsConfigured = computed(() => !!thresholds.value?.thresholds)
const thVisible = ref(false)
const thSaving = ref(false)
const thForm = reactive({
  version: 1,
  // 数字输入框被清空时 v-model 会得到空串，故按 number | string | null 接收，保存前统一 Number()
  warnPercent: null as number | string | null,
  alertPercent: null as number | string | null,
  blockPercent: null as number | string | null,
  warnInApp: false,
  warnEmail: false,
  warnSms: false,
  alertEscalate: false,
  alertCsm: false,
  block429: false,
  blockQuota: false,
})
type ThresholdLevel = 'warn' | 'alert' | 'block'

const notifyGroups = computed(() => {
  const t = thresholds.value?.thresholds
  return [
    {
      level: 'warn' as ThresholdLevel,
      title: t ? `${t.warnPercent}% 预警` : '预警阈值（未配置）',
      items: [
        { key: 'inApp', label: '站内通知', enabled: !!t?.notify.warn.inApp },
        { key: 'email', label: '邮件提醒', enabled: !!t?.notify.warn.email },
        { key: 'sms', label: '短信（主联系人）', enabled: !!t?.notify.warn.sms },
      ],
    },
    {
      level: 'alert' as ThresholdLevel,
      title: t ? `${t.alertPercent}% 告警` : '告警阈值（未配置）',
      items: [
        { key: 'escalateTicket', label: '自动升级 P2 工单', enabled: !!t?.notify.alert.escalateTicket },
        { key: 'notifyCsm', label: '通知客户成功经理', enabled: !!t?.notify.alert.notifyCsm },
      ],
    },
    {
      level: 'block' as ThresholdLevel,
      title: t ? `${t.blockPercent}% 处置` : '处置阈值（未配置）',
      items: [
        { key: 'hardLimit429', label: '硬限流（HTTP 429）', enabled: !!t?.notify.block.hardLimit429 },
        { key: 'tempQuotaPlus20', label: '临时提额 +20% · 7 天', enabled: !!t?.notify.block.tempQuotaPlus20 },
      ],
    },
  ]
})
const thresholdStateText = computed(() => {
  const d = thresholds.value
  if (!d) return '监控阈值未取到：本页不展示任何内置默认阈值。'
  if (!d.thresholds) {
    return `监控阈值未配置（${d.note || '后端 thresholds=null'}）：本页不回落任何内置默认阈值，请点「阈值配置」完整填写后保存。`
  }
  return `阈值已配置（配置键 ${d.configKey}，版本 v${d.thresholds.version}，校验 ${d.valid === false ? '未通过' : '通过'}）：点击任一通知渠道按钮即整包保存。`
})
const thresholdTip = computed(() => {
  const t = thresholds.value?.thresholds
  if (!t) return '超额三档阈值未配置：本页不展示设计稿内置默认阈值，配置后此处显示真实阈值。'
  return `超额三档阈值（已配置）：${t.warnPercent}% 提醒 / ${t.alertPercent}% 预警 / ${t.blockPercent}% 硬拦截上传。`
})

function openThresholdCfg() {
  const t = thresholds.value?.thresholds
  thForm.version = t?.version ?? 1
  thForm.warnPercent = t?.warnPercent ?? null
  thForm.alertPercent = t?.alertPercent ?? null
  thForm.blockPercent = t?.blockPercent ?? null
  thForm.warnInApp = t?.notify.warn.inApp ?? false
  thForm.warnEmail = t?.notify.warn.email ?? false
  thForm.warnSms = t?.notify.warn.sms ?? false
  thForm.alertEscalate = t?.notify.alert.escalateTicket ?? false
  thForm.alertCsm = t?.notify.alert.notifyCsm ?? false
  thForm.block429 = t?.notify.block.hardLimit429 ?? false
  thForm.blockQuota = t?.notify.block.tempQuotaPlus20 ?? false
  thVisible.value = true
}

function cloneThresholds(t: MonitorThresholds): MonitorThresholds {
  return JSON.parse(JSON.stringify(t)) as MonitorThresholds
}

async function pushThresholds(payload: MonitorThresholds): Promise<boolean> {
  thSaving.value = true
  try {
    await updateMonitorThresholds(payload)
    ElMessage.success('监控阈值已保存（PUT /platform/monitor/thresholds，整包提交）')
    await loadThresholds([])
    return true
  } catch {
    /* 失败原因由请求层统一给出中文提示（如 400：三档必须 warn<alert<block） */
    return false
  } finally {
    thSaving.value = false
  }
}

async function submitThresholds() {
  const raw = [thForm.warnPercent, thForm.alertPercent, thForm.blockPercent]
  if (raw.some((v) => v === null || v === '')) {
    ElMessage.warning('请完整填写三档阈值（未配置时不回落内置默认值，后端也无法用空值整包保存）')
    return
  }
  const [warn, alert, block] = raw.map((v) => Number(v))
  if ([warn, alert, block].some((n) => !Number.isFinite(n))) {
    ElMessage.warning('三档阈值必须是数字')
    return
  }
  if (!(warn < alert && alert < block)) {
    ElMessage.warning('三档必须满足 warn < alert < block（后端同口径校验，不满足直接 400）')
    return
  }
  const ok = await pushThresholds({
    version: thForm.version || 1,
    warnPercent: warn,
    alertPercent: alert,
    blockPercent: block,
    notify: {
      warn: { inApp: thForm.warnInApp, email: thForm.warnEmail, sms: thForm.warnSms },
      alert: { escalateTicket: thForm.alertEscalate, notifyCsm: thForm.alertCsm },
      block: { hardLimit429: thForm.block429, tempQuotaPlus20: thForm.blockQuota },
    },
  })
  if (ok) thVisible.value = false
}

async function toggleNotify(level: ThresholdLevel, key: string) {
  const cur = thresholds.value?.thresholds
  if (!cur) {
    ElMessage.warning(UNSUPPORTED.THRESHOLDS)
    openThresholdCfg()
    return
  }
  const next = cloneThresholds(cur)
  if (level === 'warn' && (key === 'inApp' || key === 'email' || key === 'sms')) {
    next.notify.warn[key] = !next.notify.warn[key]
  } else if (level === 'alert' && (key === 'escalateTicket' || key === 'notifyCsm')) {
    next.notify.alert[key] = !next.notify.alert[key]
  } else if (level === 'block' && (key === 'hardLimit429' || key === 'tempQuotaPlus20')) {
    next.notify.block[key] = !next.notify.block[key]
  } else {
    return
  }
  await pushThresholds(next)
}

// ==================== 日志中心（异常接口 TOP / 日志 Tab） ====================
const logTabs = computed(() => [
  { key: 'errorApi', label: '异常接口 TOP', badge: 0 },
  { key: 'opLog', label: '管理员操作日志', badge: 0 },
  { key: 'loginLog', label: '租户登录日志', badge: 0 },
  { key: 'errLog', label: '系统错误日志', badge: 0 },
  // 徽标取后端真实 total（无数据即不显示），不写死数字
  { key: 'proxyLog', label: '代登录审计', badge: auditMeta.value?.total || 0 },
])
const activeLogTab = ref('errorApi')
const errLogs = ref<any[]>([])

interface LogCell {
  key: string
  label: string
  num?: boolean
}
interface LogRow {
  cells: Record<string, string>
  raw?: any
}

const LOG_COLUMNS: Record<string, LogCell[]> = {
  errorApi: [
    { key: 'api', label: '接口' },
    { key: 'service', label: '所属服务' },
    { key: 'calls', label: '调用量(今日)', num: true },
    { key: 'errRate', label: '错误率', num: true },
    { key: 'p95', label: 'P95耗时', num: true },
    { key: 'lastErrAt', label: '最近报错时间' },
    { key: 'summary', label: '最近错误摘要' },
  ],
  opLog: [
    { key: 'createdAt', label: '时间' },
    { key: 'actor', label: '操作人' },
    { key: 'module', label: '模块' },
    { key: 'action', label: '操作' },
    { key: 'result', label: '结果' },
    { key: 'ip', label: 'IP' },
  ],
  loginLog: [
    { key: 'createdAt', label: '时间' },
    { key: 'tenant', label: '租户' },
    { key: 'account', label: '账号' },
    { key: 'result', label: '结果' },
    { key: 'ip', label: 'IP' },
  ],
  errLog: [
    { key: 'createdAt', label: '时间' },
    { key: 'source', label: '来源' },
    { key: 'errorType', label: '错误类型' },
    { key: 'severity', label: '严重程度' },
    { key: 'requestUrl', label: '请求路径' },
    { key: 'message', label: '错误信息' },
  ],
  proxyLog: [
    { key: 'ticketNo', label: '工单号' },
    { key: 'operator', label: '操作人' },
    { key: 'tenant', label: '目标租户' },
    { key: 'enterAt', label: '进入时间' },
    { key: 'exitAt', label: '退出时间' },
    { key: 'duration', label: '时长', num: true },
    { key: 'actionSummary', label: '操作摘要' },
  ],
}
/** 无真源 Tab 的具名原因（不编造行、不用逐条错误冒充聚合视图） */
const LOG_NOTICE: Record<string, string> = {
  errorApi:
    '异常接口 TOP 无后端聚合端点（聚合视图属 S3-98，本批不做）：接口级「调用量 / 错误率 / P95 耗时」需按接口聚合统计，平台未提供该系统；' +
    'GET /api/platform/error-logs 是逐条错误日志，不能冒充聚合行，故本 Tab 留空。',
  opLog:
    '管理员操作日志本批未接入：GET /api/platform/audit-logs 的读路径引用了仓库 DDL 中不存在的列（type / description / user_agent，见 docs/migrations/080_平台管理员.sql:24-36，属存量缺陷），' +
    '接入会以错为准，故本 Tab 留空。',
  loginLog: '后端未提供平台级「租户登录日志」端点（本批无对应契约），本 Tab 无数据源，故留空。',
}
const logColumns = computed<LogCell[]>(() => LOG_COLUMNS[activeLogTab.value] || [])
const logNotice = computed(() => LOG_NOTICE[activeLogTab.value] || '')
const logEmptyText = computed(() => {
  if (activeLogTab.value === 'errLog') return '暂无错误日志（后端 platform/error-logs 返回 records 为空）'
  if (activeLogTab.value === 'proxyLog') return '暂无代登录审计记录（后端 monitor/proxy-audit 返回 records 为空）'
  return ''
})
const logRows = computed<LogRow[]>(() => {
  if (activeLogTab.value === 'errLog') {
    return errLogs.value.map((r: any) => ({
      raw: r,
      cells: {
        createdAt: fmtTime(r.createdAt),
        source: r.source || '—',
        errorType: r.errorType || '—',
        severity: r.severity || '—',
        requestUrl: r.requestUrl ? `${r.requestMethod ? r.requestMethod + ' ' : ''}${r.requestUrl}` : '—',
        message: r.message || '—',
      },
    }))
  }
  if (activeLogTab.value === 'proxyLog') {
    return auditRows.value.map((r) => ({
      raw: r,
      cells: {
        ticketNo: r.ticketNo || '—',
        operator: r.operator || '—',
        tenant: r.tenant || r.tenantCode || r.tenantId || '—',
        enterAt: fmtTime(r.enterAt),
        exitAt: auditOngoing(r) ? '会话进行中' : fmtTime(r.exitAt),
        duration: r.duration == null ? '—' : String(r.duration),
        actionSummary: r.actionSummary == null ? '—' : String(r.actionSummary),
      },
    }))
  }
  return []
})

/* 堆栈详情：直接用行内 stack（M02） */
const stackVisible = ref(false)
const stackRow = ref<any>(null)
function onStack(row: any) {
  stackRow.value = row || null
  stackVisible.value = true
}

// ==================== 孤儿文件扫描 ====================
const orphanVisible = ref(false)
const orphanLoading = ref(false)
const orphanError = ref('')
const orphanData = ref<OrphanScanResult | null>(null)
const ORPHAN_REASON_TEXT: Record<string, string> = {
  TENANT_MISSING: '租户不存在/已删除',
  NO_BIZ_LINK: '无业务关联',
}
function orphanReasonText(code: string): string {
  return ORPHAN_REASON_TEXT[code] || code
}
async function onOrphanScan() {
  orphanVisible.value = true
  orphanLoading.value = true
  orphanError.value = ''
  try {
    orphanData.value = unwrap(await scanOrphanFiles()) as OrphanScanResult | null
  } catch (e) {
    orphanData.value = null
    orphanError.value = errText(e)
  } finally {
    orphanLoading.value = false
  }
}

// ==================== 代登录审计 ====================
const auditRows = ref<ProxyAuditRow[]>([])
const auditMeta = ref<{ total: number; month: string; criteria: string; fieldNotes: { field: string; reason: string }[] } | null>(null)
const auditOperator = ref('')
const auditMonth = ref('')

/** 会话是否进行中：只认后端 ongoing===true；ongoing 为 null（无载体）时不判为进行中 */
function auditOngoing(r: { ongoing?: boolean | null }): boolean {
  return r?.ongoing === true
}

const reportVisible = ref(false)
const reportLoading = ref(false)
const reportError = ref('')
const reportData = ref<ProxyAuditReportResult | null>(null)
const SESSION_STATUS_TEXT: Record<string, string> = {
  ONGOING: '会话进行中',
  EXPIRED: '已过期',
  UNKNOWN: '状态未知',
}

async function onAuditReport(row: ProxyAuditRow) {
  if (row?.id == null) {
    ElMessage.warning('该行缺少审计 ID，无法查看审计报告')
    return
  }
  reportVisible.value = true
  reportLoading.value = true
  reportError.value = ''
  reportData.value = null
  try {
    reportData.value = unwrap(await getProxyAuditReport(row.id)) as ProxyAuditReportResult | null
  } catch (e) {
    reportError.value = errText(e)
  } finally {
    reportLoading.value = false
  }
}

async function onFilterAuditor() {
  try {
    const { value } = await ElMessageBox.prompt('按操作人筛选（留空 = 全部）', '代登录审计 · 操作人', {
      inputPlaceholder: '操作人姓名',
      inputValue: auditOperator.value,
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    })
    auditOperator.value = (value || '').trim()
    await loadAudit([])
  } catch {
    /* 用户取消：不改筛选条件 */
  }
}

async function onFilterMonth() {
  try {
    const { value } = await ElMessageBox.prompt('按月份筛选（YYYY-MM，留空 = 全部）', '代登录审计 · 月份', {
      inputPlaceholder: 'YYYY-MM',
      inputValue: auditMonth.value,
      inputValidator: (v: string) =>
        !v || !v.trim() || /^\d{4}-(0[1-9]|1[0-2])$/.test(v.trim()) || '格式需为 YYYY-MM',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    })
    auditMonth.value = (value || '').trim()
    await loadAudit([])
  } catch {
    /* 用户取消：不改筛选条件 */
  }
}

async function onExportAudit() {
  try {
    const res: any = await exportProxyAuditCsv({
      operator: auditOperator.value || undefined,
      month: auditMonth.value || undefined,
    })
    const rows = readExportRows(res)
    const filename = saveBlobResponse(res, `proxy-audit-${auditMonth.value || 'all'}.csv`)
    ElMessage.success(`审计已导出：${filename}${rows == null ? '' : `（${rows} 行）`}`)
  } catch {
    /* 失败原因由请求层统一给出中文提示 */
  }
}

async function onExportMonthly() {
  try {
    const res: any = await exportTenantApiCsv(tenantApiMeta.value?.period || undefined)
    const rows = readExportRows(res)
    const filename = saveBlobResponse(res, `tenant-api-${tenantApiMeta.value?.period || 'current'}.csv`)
    ElMessage.success(`租户 API 月报已导出：${filename}${rows == null ? '' : `（${rows} 行）`}`)
  } catch {
    /* 失败原因由请求层统一给出中文提示 */
  }
}

// ==================== 数据加载（每个模块独立，失败逐条具名） ====================
async function loadApiStats(failures: string[]) {
  try {
    const d = unwrap(await fetchMonitorApiStats())
    apiStats.value = (d || null) as MonitorApiStats | null
    const t = (d as { trend?: any[] } | null)?.trend
    trend.value = Array.isArray(t) ? t : []
  } catch (e) {
    apiStats.value = null
    trend.value = []
    failures.push(`运行统计（GET /platform/monitor/api-stats）：${errText(e)}`)
  }
}

async function loadStorageTop(failures: string[]) {
  try {
    const d = unwrap(await getStorageTop5()) as StorageTopResult | null
    storageRows.value = d?.records || []
    storageNotes.value = d?.notes || []
  } catch (e) {
    storageRows.value = []
    storageNotes.value = []
    failures.push(`存储占用（GET /platform/monitor/storage/top5）：${errText(e)}`)
  }
}

async function loadTenantApi(failures: string[]) {
  try {
    const d = unwrap(await getTenantApiUsage()) as TenantApiResult | null
    tenantApiRows.value = d?.records || []
    tenantApiMeta.value = d
      ? {
          period: d.period,
          scanLimit: d.scanLimit,
          scanLimitReached: d.scanLimitReached,
          unavailable: d.unavailable || [],
        }
      : null
  } catch (e) {
    tenantApiRows.value = []
    tenantApiMeta.value = null
    failures.push(`租户 API 调用量（GET /platform/monitor/tenant-api）：${errText(e)}`)
  }
}

async function loadErrorLogs(failures: string[]) {
  try {
    const d = unwrap(await getErrorLogs({ page: 1, pageSize: 50 }))
    errLogs.value = d?.records || []
  } catch (e) {
    errLogs.value = []
    failures.push(`错误日志（GET /platform/error-logs）：${errText(e)}`)
  }
}

async function loadAudit(failures: string[]) {
  try {
    const d = unwrap(
      await listProxyAudit({
        operator: auditOperator.value || undefined,
        month: auditMonth.value || undefined,
        page: 1,
        pageSize: 50,
      })
    ) as ProxyAuditListResult | null
    auditRows.value = d?.records || []
    auditMeta.value = d
      ? { total: d.total, month: d.month, criteria: d.criteria, fieldNotes: d.fieldNotes || [] }
      : null
  } catch (e) {
    auditRows.value = []
    auditMeta.value = null
    failures.push(`代登录审计（GET /platform/monitor/proxy-audit）：${errText(e)}`)
  }
}

async function loadThresholds(failures: string[]) {
  try {
    thresholds.value = unwrap(await getMonitorThresholds()) as MonitorThresholdsResult | null
  } catch (e) {
    thresholds.value = null
    failures.push(`监控阈值（GET /platform/monitor/thresholds）：${errText(e)}`)
  }
}

function resizeChart() {
  trendChart?.resize()
}

async function load() {
  loading.value = true
  error.value = ''
  const failures: string[] = []
  await Promise.all([
    loadApiStats(failures),
    loadStorageTop(failures),
    loadTenantApi(failures),
    loadErrorLogs(failures),
    loadAudit(failures),
    loadThresholds(failures),
  ])
  if (failures.length) {
    // A-11：写真实失败原因（端点 + 中文原因），不再用「接口未接入」式措辞掩盖故障
    error.value = `监控数据加载失败：${failures.join('；')}（其余模块已按接口真实返回渲染）`
  }
  loading.value = false
  await nextTick()
  renderTrend()
}

watch(hasTrend, async () => {
  await nextTick()
  renderTrend()
})

async function loadAll() {
  await load()
}

onMounted(() => {
  load()
  window.addEventListener('resize', resizeChart)
})
onUnmounted(() => {
  window.removeEventListener('resize', resizeChart)
  trendChart?.dispose()
})
</script>

<style scoped>
/* 页面级布局仅使用 design token 组合，不写死任何色值/字号/间距/圆角 */
.monitor-cols {
  grid-template-columns: 1.5fr 1fr;
}
.store-row > span {
  width: var(--qrow-label-w);
  flex: none;
}
.notify-row {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}
/* components.css 的 .btn-t / .btn 未定义禁用态，此处按 token 局部补齐：
   置灰沿用 .btn-t.gy 的 --g5，并屏蔽 hover 变色与指针手势 */
.btn-t.dis,
.btn-t.dis:hover,
.btn.dis,
.btn.dis:hover {
  color: var(--g5);
  cursor: not-allowed;
}
@media (max-width: 1180px) {
  .monitor-cols {
    grid-template-columns: 1fr;
  }
}
</style>
