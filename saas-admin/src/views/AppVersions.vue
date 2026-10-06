<template>
  <div>
    <!-- ============ 页头（设计稿 sec-release .pg-hd） ============ -->
    <div class="pg-hd">
      <div>
        <div class="pt4">版本发布</div>
        <p class="pd">
          当前全量版本 {{ currentVersion }}（{{ currentDate }}）· 灰度中 {{ grayscaleCount }} 个
          · 功能开关 {{ switchCount }} 个在线
        </p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="handleSwitchPanel">功能开关面板</span>
        <span class="btn btn-p" @click="openWizard">+ 新建发布</span>
      </div>
    </div>

    <!-- 加载/错误态 -->
    <div v-if="error" class="tipbar r mt8">
      <span class="ic">!</span>
      <span>{{ error }}（接口待对接或异常，当前展示空态）</span>
    </div>

    <!-- S3-24：接线自检——后端返回的字段与本页契约不匹配时显式报警，不静默显示 '-' -->
    <div v-if="wireNotice" class="tipbar r mt8">
      <span class="ic">!</span>
      <span>{{ wireNotice }}</span>
    </div>

    <!-- ============ 版本列表面板（设计稿 .panel / .tblwrap） ============ -->
    <div class="panel">
      <div class="p-hd">
        <span class="pt">版本列表</span>
        <div class="frow">
          <span class="sel" @click="cycleStatus">{{ statusLabel }}</span>
        </div>
      </div>

      <div class="tblwrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>版本号</th>
              <th>发布说明</th>
              <th>灰度范围</th>
              <th>批次进度</th>
              <th class="num">采纳率 / 错误率</th>
              <th>发布状态</th>
              <th>发布窗口</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in list" :key="row.id">
              <td>
                <b>{{ row.versionName }}</b>
                <span v-if="row.subTitle" class="sub">{{ row.subTitle }}</span>
              </td>
              <td>{{ row.updateNote || '-' }}</td>
              <td>
                <span v-if="row.grayTag" class="tag" :class="row.grayTagCls">{{ row.grayTag }}</span>
                {{ row.grayRange ?? '—' }}
              </td>
              <td>
                <div class="mbar">
                  <span v-if="row.progress !== null" class="bar" :class="row.barCls">
                    <i :style="{ width: (row.progress || 0) + '%' }"></i>
                  </span>
                  <span v-else class="bar is-unknown" title="无放量比例载体，不画 0% 进度条"></span>
                  <em>{{ row.batchText ?? '—' }}</em>
                </div>
              </td>
              <td class="num">{{ row.adoption ?? '—' }}</td>
              <td>
                <span class="tag" :class="releaseStatusView(row).cls">{{ releaseStatusView(row).text }}</span>
              </td>
              <td>{{ row.releaseWindow ?? '—' }}</td>
              <td>
                <span
                  v-for="a in actionsFor(row)"
                  :key="a.key"
                  class="btn-t"
                  :class="a.cls"
                  @click="onRowAction(a.key, row)"
                >{{ a.label }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 空态：表格之后，非 colspan 行 -->
      <div v-if="!list.length" class="empty">
        暂无版本发布记录，点击「+ 新建发布」发起灰度发布
      </div>

      <!-- 放量守门规则（设计稿静态说明） -->
      <p class="small mt8 rule-note">
        放量守门规则：内测标签租户（含自家门店）先行运行 ≥48h 且无 P0/P1 告警 → 旗舰等指定租户
        → 按比例放量；任一批次错误率超阈值自动暂停并告警；回滚为上一版本，秒级生效。重大操作习惯变更需全量前 3 天推送预告公告。
      </p>
      <p class="small mt8 rule-note">
        字段口径（S3-24）：灰度范围 / 批次进度取自后端 <b>status</b> 与 <b>gray_ratio</b>（178 迁移已入库）；
        采纳率 / 发布窗口 / 批次文案在 <b>t_app_version 无对应列</b>，按「—」如实展示（不造数，待后端加列后接入）。
      </p>

      <!-- 分页（设计稿结构补全） -->
      <div v-if="list.length" class="pagebar">
        <span>共 {{ list.length }} 条</span>
        <div class="pgbtns">
          <span class="on">1</span>
        </div>
      </div>
    </div>

    <!-- ============ 新建发布向导弹窗（设计稿 .ov + .modal + .steps） ============ -->
    <div v-if="wizardVisible" class="ov" @click.self="closeWizard">
      <div class="modal zx-scope">
        <div class="m-hd">
          <span class="pt">新建发布向导</span>
          <span class="d-x" @click="closeWizard">✕</span>
        </div>

        <div class="m-bd">
          <!-- 步骤条 -->
          <div class="steps">
            <span class="step" :class="stepCls(1)">
              <span class="sn">{{ step === 1 ? '1' : '✓' }}</span>版本信息
            </span>
            <span class="step-line"></span>
            <span class="step" :class="stepCls(2)">
              <span class="sn">{{ step === 2 ? '2' : (step > 2 ? '✓' : '2') }}</span>灰度范围
            </span>
            <span class="step-line"></span>
            <span class="step" :class="stepCls(3)">
              <span class="sn">3</span>发布窗口与公告
            </span>
          </div>

          <!-- 步骤一：版本信息 -->
          <template v-if="step === 1">
            <div class="fld">
              <span>版本号 <i class="req">*</i></span>
              <input class="ipt" v-model="form.versionName" placeholder="如 v2.4.2" />
            </div>
            <div class="fld">
              <span>发布说明 <i class="req">*</i></span>
              <textarea
                class="ipt area"
                v-model="form.releaseNote"
                rows="4"
                placeholder="本次更新内容，如：修复调拨单并发死锁；报表服务查询提速"
              ></textarea>
            </div>
          </template>

          <!-- 步骤二：灰度范围 -->
          <template v-else-if="step === 2">
            <div class="fld">
              <span>灰度策略 <i class="req">*</i></span>
              <div class="opt-list">
                <div
                  v-for="opt in grayOptions"
                  :key="opt.key"
                  class="opt-card"
                  :class="{ on: form.grayStrategy === opt.key }"
                  @click="form.grayStrategy = opt.key"
                >
                  <span class="rd" :class="{ on: form.grayStrategy === opt.key }"></span>
                  <div class="oc-bd">
                    <b class="b">{{ opt.title }}</b>
                    <p class="small">{{ opt.desc }}</p>
                  </div>
                  <span v-if="opt.tag" class="tag" :class="opt.tagCls">{{ opt.tag }}</span>
                  <span v-if="opt.link" class="btn-t">{{ opt.link }}</span>
                </div>
              </div>
            </div>

            <div class="frow mt12">
              <span class="fld grow">
                <span>发布窗口</span>
                <span class="sel fill">选择发布窗口</span>
              </span>
              <span class="fld grow">
                <span>更新公告联动</span>
                <div class="chips">
                  <span
                    class="btn"
                    :class="{ 'btn-p': form.autoAnnounce }"
                    @click="form.autoAnnounce = !form.autoAnnounce"
                  >{{ form.autoAnnounce ? '✓ ' : '' }}自动生成公告</span>
                  <span class="btn" @click="form.guideFloat = !form.guideFloat">
                    {{ form.guideFloat ? '✓ ' : '' }}新功能引导浮层
                  </span>
                </div>
              </span>
            </div>

            <p class="small mt10">
              功能开关不是删除：新功能以租户级开关形式上线，支持按租户 / 按套餐实时开关，用于灰度与线上故障一键降级。
            </p>
          </template>

          <!-- 步骤三：发布窗口与公告 -->
          <template v-else>
            <div class="fld">
              <span>发布窗口</span>
              <span class="sel fill">选择发布窗口<b class="caret">▾</b></span>
            </div>
            <div class="fld">
              <span>关联公告（自动生成预览）</span>
              <span class="sel fill">选择关联公告<b class="caret">▾</b></span>
            </div>
            <div class="tipbar w mt10">
              <span class="ic">!</span>
              <span>
                确认发布后将按灰度策略放量；任一批次错误率超阈值自动暂停并告警，可一键回滚至上一版本。
              </span>
            </div>
          </template>
        </div>

        <div class="m-ft">
          <span v-if="step > 1" class="btn" @click="step--">上一步</span>
          <span class="btn" style="margin-right: auto" @click="saveDraft">存为草稿</span>
          <span v-if="step < 3" class="btn btn-p" @click="step++">下一步：确认发布</span>
          <span v-else class="btn btn-p" @click="confirmPublish">确认发布</span>
        </div>
      </div>
    </div>

    <!-- ============ 功能开关面板（R101-C6-3-1：真实端点 GET/PUT /api/platform/config/feature-switches） ============ -->
    <!-- 分层口径：本面板＝平台"能不能开"；某租户是否已开通由套餐矩阵（t_subscription_plan）决定，本页不涉及 -->
    <div v-if="switchPanelVisible" class="ov" @click.self="closeSwitchPanel">
      <div class="modal zx-scope">
        <div class="m-hd">
          <span class="pt">功能开关面板</span>
          <span class="d-x" @click="closeSwitchPanel">✕</span>
        </div>

        <div class="m-bd">
          <p class="small">
            平台级启停：决定该能力<b>能不能开</b>（平台总开关）；「新租户默认」决定新租户初始化时该项的默认值。
            请求体只提交本次发生变化的字段。
          </p>

          <div v-if="switchError" class="tipbar r">
            <span class="ic">!</span>
            <span>{{ switchError }}</span>
          </div>

          <!-- 诚实空态：空表不内置任何功能清单（不造假数据） -->
          <div v-if="!switchLoading && !switchRows.length" class="empty">
            尚未登记功能开关 · 该表为空，需先登记功能编码与名称后此处才能启停（本页不内置预设清单）
          </div>

          <div v-else class="tblwrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>功能编码 / 名称</th>
                  <th>全局启停</th>
                  <th>新租户默认</th>
                  <th>备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in switchRows" :key="row.featureCode">
                  <td>
                    <b>{{ row.featureName }}</b>
                    <span class="sub">{{ row.featureCode }}</span>
                  </td>
                  <td>
                    <span
                      class="tg"
                      :class="{ off: !row.enabled }"
                      @click="row.enabled = !row.enabled"
                    ></span>
                    {{ row.enabled ? '启用' : '停用' }}
                  </td>
                  <td>
                    <span
                      class="tg"
                      :class="{ off: !row.defaultForNewTenant }"
                      @click="row.defaultForNewTenant = !row.defaultForNewTenant"
                    ></span>
                    {{ row.defaultForNewTenant ? '默认启用' : '默认停用' }}
                  </td>
                  <td>
                    <input class="ipt" v-model="row.remark" placeholder="备注（可空）" />
                  </td>
                  <td>
                    <span class="btn-t" :class="{ gy: !rowDirty(row) }" @click="saveSwitchRow(row)">
                      保存
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="small">
            无变更时不提交（后端对"提交值与现值一致"返回 400 + 中文说明，不做静默成功）。
          </p>
        </div>

        <div class="m-ft">
          <span class="btn" style="margin-right: auto" @click="loadSwitches">刷新</span>
          <span class="btn btn-p" @click="closeSwitchPanel">关闭</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  listAppVersions,
  publishAppVersion,
  deleteAppVersion,
  listFeatureSwitches,
  updateFeatureSwitch,
} from "../api";

/* ── 列表状态（空数组渲染空态） ── */
const loading = ref(false);
const list = ref<any[]>([]);
const error = ref("");
/** S3-24 接线自检：后端字段与前端契约不匹配时的显式提示（空串＝无异常） */
const wireNotice = ref("");

/* ── 页头概览占位（接口未接入时用占位符） ── */
const currentVersion = ref("--");
const currentDate = ref("--");
const grayscaleCount = ref("--");
const switchCount = ref("--");

/* ── 筛选器 ── */
const statusCycle = ["全部", "灰度中", "已全量", "已暂停"];
const statusIdx = ref(0);
const statusLabel = computed(() => `状态：${statusCycle[statusIdx.value]} ▾`);
function cycleStatus() {
  statusIdx.value = (statusIdx.value + 1) % statusCycle.length;
  fetchList();
}

/* ── 向导状态 ── */
const wizardVisible = ref(false);
const step = ref(1);
const saving = ref(false);

const grayOptions = [
  {
    key: "inner",
    title: "按租户标签 · 内测组",
    desc: "先行批次必须为内测标签租户（含自家门店），运行 ≥48h 无 P0/P1 告警方可进入下一批",
    tag: "32 租户",
    tagCls: "tag-b",
    link: "",
  },
  {
    key: "spec",
    title: "指定租户 / 按套餐",
    desc: "如：指定套餐的租户先行体验",
    tag: "",
    tagCls: "",
    link: "选择 ›",
  },
  {
    key: "percent",
    title: "按百分比放量",
    desc: "5% → 20% → 100%，每批次间隔 ≥24h，错误率超阈值自动暂停",
    tag: "",
    tagCls: "",
    link: "",
  },
];

const form = reactive({
  versionName: "",
  releaseNote: "",
  grayStrategy: "inner",
  autoAnnounce: true,
  guideFloat: false,
});

/* ── 状态映射 ── */
function releaseStatusView(row: any) {
  const map: Record<string, { cls: string; text: string }> = {
    DRAFT: { cls: "tag-gy", text: "草稿" },
    GRAYING: { cls: "tag-b", text: "灰度中" },
    FULL: { cls: "tag-g", text: "已全量" },
    PAUSED: { cls: "tag-o", text: "已暂停" },
    ARCHIVED: { cls: "tag-gy", text: "已归档" },
  };
  // 状态未知/缺失时如实展示「未知」，**不回落成「草稿」**（回落会把未接线读成真实业务态）
  return map[row.releaseStatus] || { cls: "tag-gy", text: "未知（后端未给状态）" };
}

/**
 * S3-24：把后端行（status / gray_ratio 已入库）归一成表格展示字段。
 * - 有载体的：灰度范围/批次进度/发布状态由 status + gray_ratio 真实派生；
 * - 无载体的（采纳率/发布窗口/批次文案）：显式 null → 模板展示「—」，不造数；
 * - 契约不符（status / grayRatio 键缺失＝接线断开）：置 wireMissing，页面显式报警，不静默成 '-'。
 */
const PLATFORM_LABEL: Record<string, string> = {
  admin_web: "工作台",
  app_mobile: "移动端",
  print_agent: "打印助手",
};

function toVersionRow(raw: any) {
  const hasStatus = raw != null && Object.prototype.hasOwnProperty.call(raw, "status");
  const hasGray = raw != null && Object.prototype.hasOwnProperty.call(raw, "grayRatio");
  const status = String(raw?.status ?? "").trim().toUpperCase();
  const ratioNum = hasGray && raw.grayRatio !== null && raw.grayRatio !== "" ? Number(raw.grayRatio) : null;
  const ratio = ratioNum !== null && Number.isFinite(ratioNum) ? ratioNum : null;
  const rangeText = ratio === null ? null : `${ratio}%`;

  let releaseStatus = "";
  let grayTag: string | null = null;
  let grayTagCls = "tag-gy";
  let barCls = "";
  if (status === "DRAFT") {
    releaseStatus = "DRAFT";
    grayTag = "草稿";
  } else if (status === "PAUSED") {
    releaseStatus = "PAUSED";
    grayTag = "已暂停";
    grayTagCls = "tag-o";
    barCls = "o";
  } else if (status === "ARCHIVED") {
    releaseStatus = "ARCHIVED";
    grayTag = "已归档";
  } else if (status === "PUBLISHED") {
    // 全量判据＝放量比例 100%；未达 100%（含 0）均为灰度中，比例原样展示
    if (ratio !== null && ratio >= 100) {
      releaseStatus = "FULL";
      grayTag = "全量";
      grayTagCls = "tag-g";
      barCls = "g";
    } else {
      releaseStatus = "GRAYING";
      grayTag = "灰度中";
      grayTagCls = "tag-b";
    }
  } else if (status) {
    grayTag = `未知(${status})`;
  }

  const platform = String(raw?.platform ?? "");
  return {
    // 透传后端原始字段（id / versionName / updateNote 等直接使用，不改名）
    ...(raw ?? {}),
    // 副标题＝端别（后端真实字段 platform 的中文名；无该字段则留空，不编造）
    subTitle: PLATFORM_LABEL[platform] ?? platform,
    releaseStatus,
    grayTag,
    grayTagCls,
    // gray_ratio 已入库：必须展示；为 null 时如实说「未设置放量比例」
    grayRange: hasGray ? rangeText ?? "未设置放量比例" : null,
    barCls,
    progress: hasGray ? ratio : null,
    // 无载体字段（t_app_version 无对应列）——显式 null
    batchText: null,
    adoption: null,
    releaseWindow: null,
    wireMissing: !hasStatus || !hasGray,
  };
}
function actionsFor(row: any) {
  const map: Record<string, { key: string; label: string; cls: string }[]> = {
    GRAYING: [
      { key: "pause", label: "暂停放量", cls: "" },
      { key: "health", label: "健康看板", cls: "" },
      { key: "rollback", label: "回滚", cls: "dgr" },
    ],
    FULL: [
      { key: "announce", label: "发布公告", cls: "" },
      { key: "archive", label: "归档", cls: "" },
    ],
    PAUSED: [
      { key: "resume", label: "继续放量", cls: "" },
      { key: "rollback", label: "回滚", cls: "dgr" },
    ],
  };
  return map[row.releaseStatus] || [{ key: "health", label: "健康看板", cls: "" }];
}

function stepCls(n: number) {
  if (n < step.value) return "done";
  if (n === step.value) return "on";
  return "";
}

/* ── 列表加载：保留 listAppVersions 调用（含 loading/空态/错误处理） ── */
async function fetchList() {
  loading.value = true;
  error.value = "";
  try {
    const res = await listAppVersions({ platform: "admin_web" });
    const data = res?.data?.data || (res as any).data || res;
    const arr = Array.isArray(data) ? data : [];
    const rows = arr.map(toVersionRow);
    // 接线自检：任一行的 status / grayRatio 缺失 ⇒ 显式报警（不静默显示 '-'）
    const missing = rows.filter((r: any) => r.wireMissing).length;
    wireNotice.value = missing
      ? `后端返回的版本数据缺少 status / grayRatio 字段（${missing} 行）——前端接线可能已失效，灰度范围/批次进度不可信，请检查接口契约`
      : "";
    list.value = statusIdx.value === 0
      ? rows
      : rows.filter((r: any) => releaseStatusView(r).text === statusCycle[statusIdx.value]);
  } catch {
    error.value = "版本列表加载失败";
    wireNotice.value = "";
  } finally {
    loading.value = false;
  }
}

/* ── 向导操作 ── */
function openWizard() {
  step.value = 1;
  Object.assign(form, {
    versionName: "",
    releaseNote: "",
    grayStrategy: "inner",
    autoAnnounce: true,
    guideFloat: false,
  });
  wizardVisible.value = true;
}
function closeWizard() {
  wizardVisible.value = false;
}

/* ── 功能开关面板（R101-C6-3-1 接线：平台级启停 + 新租户默认项） ──────────────
 * 数据源：GET/PUT /api/platform/config/feature-switches（表 t_platform_feature_switch，迁移 184）。
 * 硬口径：空表 ⇒ 诚实空态（不内置功能清单）；保存只提交变化字段；无变更不提交也不假装成功。
 * 明确不做：灰度矩阵（按比例放量）不在本单——t_app_version.gray_ratio 的生效点属版本域另立卡。 */
const switchPanelVisible = ref(false);
const switchLoading = ref(false);
const switchError = ref("");
const switchRows = ref<any[]>([]);
/** 载入时的快照（按 featureCode 记录），用于计算 changedFields 与"是否有变更" */
const switchOriginals = reactive<Record<string, { enabled: boolean; defaultForNewTenant: boolean; remark: string }>>({});

function snapshotKey(row: any) {
  return String(row.featureCode);
}

/** 归一 remark：null 与空串都视为"未填写"，避免把未填写冒充成有值 */
function normalizeRemark(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** 该行相对载入快照是否有变更（决定「保存」是否高亮、是否真的发请求） */
function rowDirty(row: any): boolean {
  const base = switchOriginals[snapshotKey(row)];
  if (!base) return false;
  return (
    Boolean(row.enabled) !== base.enabled ||
    Boolean(row.defaultForNewTenant) !== base.defaultForNewTenant ||
    normalizeRemark(row.remark) !== base.remark
  );
}

/** 请求体：只放变化字段（字段名与后端 zod schema 逐字一致：enabled/defaultForNewTenant/remark） */
function buildSwitchPayload(row: any) {
  const base = switchOriginals[snapshotKey(row)];
  const payload: Record<string, unknown> = {};
  if (!base) return payload;
  if (Boolean(row.enabled) !== base.enabled) payload.enabled = Boolean(row.enabled);
  if (Boolean(row.defaultForNewTenant) !== base.defaultForNewTenant) {
    payload.defaultForNewTenant = Boolean(row.defaultForNewTenant);
  }
  if (normalizeRemark(row.remark) !== base.remark) {
    payload.remark = normalizeRemark(row.remark) === "" ? null : normalizeRemark(row.remark);
  }
  return payload;
}

async function loadSwitches() {
  switchLoading.value = true;
  switchError.value = "";
  try {
    const res: any = await listFeatureSwitches();
    const items = res?.data?.data?.items;
    const arr = Array.isArray(items) ? items : [];
    switchRows.value = arr.map((r: any) => ({
      featureCode: String(r.featureCode ?? ""),
      featureName: String(r.featureName ?? ""),
      enabled: Boolean(r.enabled),
      defaultForNewTenant: Boolean(r.defaultForNewTenant),
      remark: typeof r.remark === "string" ? r.remark : "",
    }));
    for (const key of Object.keys(switchOriginals)) delete switchOriginals[key];
    for (const row of switchRows.value) {
      switchOriginals[snapshotKey(row)] = {
        enabled: row.enabled,
        defaultForNewTenant: row.defaultForNewTenant,
        remark: normalizeRemark(row.remark),
      };
    }
  } catch {
    // 接口异常：保持空态 + 明确报错，不填充假数据（错误文案由请求层拦截器统一弹出）
    switchRows.value = [];
    switchError.value = "功能开关加载失败（空表或接口异常，当前不展示任何开关行）";
  } finally {
    switchLoading.value = false;
  }
}

async function saveSwitchRow(row: any) {
  const payload = buildSwitchPayload(row);
  if (Object.keys(payload).length === 0) {
    ElMessage.info("该行没有字段变更，未提交");
    return;
  }
  try {
    const res: any = await updateFeatureSwitch(snapshotKey(row), payload as any);
    const changed: string[] = res?.data?.data?.changedFields ?? [];
    // 保存成功后把快照推进到当前值（后续再改只提交新的差异）
    switchOriginals[snapshotKey(row)] = {
      enabled: Boolean(row.enabled),
      defaultForNewTenant: Boolean(row.defaultForNewTenant),
      remark: normalizeRemark(row.remark),
    };
    ElMessage.success(`已保存 ${row.featureName}（${changed.join("、") || "无"}）`);
  } catch {
    /* 错误提示由请求层统一处理（含 404 未知编码 / 400 无变更的中文文案），此处只保留行内状态 */
  }
}

function handleSwitchPanel() {
  switchPanelVisible.value = true;
  loadSwitches();
}

function closeSwitchPanel() {
  switchPanelVisible.value = false;
}

async function saveDraft() {
  // ③-b #35：草稿保存依赖 C2 加列（t_app_version.status，属 C6-1A ② 类；未落地前不假装成功）
  ElMessage.warning("存为草稿：待 C2 加列后接入（当前不保存草稿）");
  closeWizard();
}
async function confirmPublish() {
  if (!form.versionName.trim()) {
    ElMessage.warning("请输入版本号");
    return;
  }
  saving.value = true;
  try {
    await publishAppVersion({
      platform: "admin_web",
      versionCode: 1,
      versionName: form.versionName,
      updateNote: form.releaseNote,
      isForce: false,
      enabled: false,
    });
    ElMessage.success("已发起发布");
    closeWizard();
    fetchList();
  } catch { /* 错误提示由请求层统一处理，此处只做内容态 */ } finally {
    saving.value = false;
  }
}

function onRowAction(key: string, row: any) {
  switch (key) {
    case "rollback":
      handleRollback(row);
      break;
    case "announce":
    case "health":
    case "pause":
    case "resume":
    case "archive":
      // ③-b #37（逐 action 分口径）：health 待裁定不做（R5①）；announce 复用公告端点需产品定义
      // 公告标题/正文与 type 取值，本卡不自拟业务文案；pause/resume/archive 依赖 C2 加列（status/gray_ratio/archived_at）
      ElMessage.warning(
        key === "health"
          ? "「健康看板」：跨模块口径未定，本批不做（R5①）"
          : `「${labelOf(key)}」：待 C2 加列 / 公告口径确认后接入（当前不执行任何变更）`,
      );
      break;
    default:
      // ③-b #38：兜底文案
      ElMessage.warning("该操作待立项（当前不执行任何变更）");
  }
}
function labelOf(key: string) {
  const m: Record<string, string> = {
    rollback: "回滚",
    announce: "发布公告",
    health: "健康看板",
    pause: "暂停放量",
    resume: "继续放量",
    archive: "归档",
  };
  return m[key] || key;
}
async function handleRollback(row: any) {
  try {
    await ElMessageBox.confirm(`确定回滚至上一版本（${row.versionName}）？`, "回滚确认", {
      type: "warning",
    });
  } catch {
    return;
  }
  try {
    // ③-b #40：回滚端点属 C6-1A ② 类（零 DDL，未落地前不假装成功）
    // 回滚口径已由 R5② 定为"上一个已发布版本（status=PUBLISHED 且 version_code 更小者）"
    ElMessage.warning("回滚：待后端回滚接口（C6-1A #39）落地后接入（当前不执行任何变更）");
  } catch {
    /* noop */
  }
}

onMounted(fetchList);
</script>

<style scoped>
/* 弹窗外壳（design tokens，禁止写死字面量） */
.ov {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}
.modal {
  width: var(--modal-width);
  max-width: 100%;
  max-height: 88vh;
  background: var(--bg-card);
  border-radius: var(--container-radius);
  box-shadow: var(--modal-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.m-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--panel-header-padding);
  border-bottom: 1px solid var(--g1);
  flex: none;
}
.m-hd .pt {
  font-size: var(--panel-title-size);
  font-weight: var(--font-semibold);
}
.d-x {
  color: var(--g4);
  font-size: var(--text-lg);
  line-height: 1;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.d-x:hover {
  background: var(--g0);
  color: var(--g6);
}
.m-bd {
  padding: var(--panel-body-padding);
  overflow-y: auto;
  display: grid;
  gap: var(--space-3);
}
.m-ft {
  border-top: 1px solid var(--g1);
  padding: var(--panel-header-padding);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  background: var(--g0);
  flex: none;
}

.req {
  color: var(--color-danger);
  font-style: normal;
}
.caret {
  color: var(--g4);
  font-size: var(--ctrl-caret-size);
  font-style: normal;
  font-weight: var(--font-normal);
  margin-left: auto;
}
.fill {
  width: 100%;
}
.grow {
  flex: 1;
  min-width: 0;
}
.area {
  width: 100%;
  resize: vertical;
  font-family: inherit;
  line-height: var(--leading-normal);
}
.mt10 {
  margin-top: var(--space-3);
}
.mt12 {
  margin-top: var(--space-3);
}

/* 灰度策略选项卡 */
.opt-list {
  display: grid;
  gap: var(--space-2);
}
.opt-card {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  border: 1px solid var(--g3);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
}
.opt-card.on {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
}
.oc-bd {
  flex: 1;
}
.oc-bd .b {
  font-size: var(--text-sm);
}
.chips {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  align-items: center;
}
.rule-note {
  padding: 0 var(--space-3) var(--space-3);
}
/* 无放量比例载体：不画实心进度条（避免被读成 0% 放量） */
.bar.is-unknown {
  background: transparent;
  border: 1px dashed var(--g2);
  width: 110px;
}
</style>
