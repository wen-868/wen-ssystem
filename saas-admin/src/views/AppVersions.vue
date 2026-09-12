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
              <td>{{ row.releaseNote || '-' }}</td>
              <td>
                <span v-if="row.grayTag" class="tag" :class="row.grayTagCls">{{ row.grayTag }}</span>
                {{ row.grayRange || '-' }}
              </td>
              <td>
                <div class="mbar">
                  <span class="bar" :class="row.barCls">
                    <i :style="{ width: (row.progress || 0) + '%' }"></i>
                  </span>
                  <em>{{ row.batchText || '' }}</em>
                </div>
              </td>
              <td class="num">{{ row.adoption || '-' }}</td>
              <td>
                <span class="tag" :class="releaseStatusView(row).cls">{{ releaseStatusView(row).text }}</span>
              </td>
              <td>{{ row.releaseWindow || '-' }}</td>
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { listAppVersions, publishAppVersion, deleteAppVersion } from "../api";

/* ── 列表状态（空数组渲染空态） ── */
const loading = ref(false);
const list = ref<any[]>([]);
const error = ref("");

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
    desc: "如：旗舰版全部 114 家先行体验",
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
    GRAYING: { cls: "tag-b", text: "灰度中" },
    FULL: { cls: "tag-g", text: "已全量" },
    PAUSED: { cls: "tag-o", text: "已暂停" },
    ROLLED_BACK: { cls: "tag-r", text: "已回滚" },
  };
  return map[row.releaseStatus] || { cls: "tag-gy", text: row.releaseStatus || "草稿" };
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
    list.value = statusIdx.value === 0
      ? arr
      : arr.filter((r: any) => releaseStatusView(r).text === statusCycle[statusIdx.value]);
  } catch (e: any) {
    error.value = "版本列表加载失败";
    ElMessage.error(e?.response?.data?.msg || e?.message || "加载失败");
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
function handleSwitchPanel() {
  // TODO: 待接入功能开关面板接口（建议 GET /padmin/feature-switches）
  ElMessage.info("功能开关面板：待接入功能开关接口");
}
async function saveDraft() {
  // TODO: 待接入发布草稿保存接口（建议 POST /padmin/app-versions/draft）
  ElMessage.info("存为草稿：待接入发布草稿接口");
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
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || e?.message || "发布失败");
  } finally {
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
      // TODO: 待接入对应操作接口（建议 POST /padmin/app-versions/:id/{action}）
      ElMessage.info(`「${labelOf(key)}」：待接入版本操作接口`);
      break;
    default:
      ElMessage.info("待接入版本操作接口");
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
    // TODO: 待接入回滚接口（建议 POST /padmin/app-versions/:id/rollback）
    ElMessage.info("回滚：待接入回滚接口");
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
</style>
