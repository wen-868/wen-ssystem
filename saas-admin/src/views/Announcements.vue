<template>
  <div>
    <!-- ============ 页头（设计稿 sec-notice .pg-hd） ============ -->
    <div class="pg-hd">
      <div>
        <div class="pt4">公告管理</div>
        <p class="pd">
          草稿 {{ stats.draft }} · 定时 {{ stats.scheduled }} · 已发布 {{ stats.published }}
          · 已撤回 {{ stats.recalled }} · 公告模板 {{ stats.templates }} 个（催缴 / 升级引导 / 维护通知）
        </p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="handleTemplateCenter">公告模板</span>
        <span class="btn btn-p" @click="openCreate">+ 新建公告</span>
      </div>
    </div>

    <!-- 加载/错误态 -->
    <div v-if="error" class="tipbar r mt8">
      <span class="ic">!</span>
      <span>{{ error }}（接口待对接或异常，当前展示空态）</span>
    </div>

    <!-- ============ 公告列表面板（设计稿 .panel / .tblwrap） ============ -->
    <div class="panel">
      <div class="p-hd">
        <span class="pt">公告列表</span>
        <div class="frow">
          <span class="sel" @click="cycleStatus">{{ statusLabel }}<b class="caret">▾</b></span>
          <span class="sel" @click="cycleScope">{{ scopeLabel }}<b class="caret">▾</b></span>
          <input
            class="ipt search-ipt"
            v-model="searchForm.keyword"
            @keyup.enter="fetchList"
            placeholder="搜索标题"
          />
        </div>
      </div>

      <div class="tblwrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>标题</th>
              <th>类型</th>
              <th>推送范围</th>
              <th>渠道</th>
              <th>发布时间</th>
              <th class="num">触达 / 已读</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in list" :key="row.id">
              <td>
                <b>{{ row.title }}</b>
                <span v-if="row.subTitle" class="sub">{{ row.subTitle }}</span>
              </td>
              <td>
                <span class="tag" :class="typeView(row).cls">{{ typeView(row).text }}</span>
              </td>
              <td>{{ row.scope || '-' }}</td>
              <td>{{ row.channel || '-' }}</td>
              <td>{{ row.publishTime || '-' }}</td>
              <td class="num">{{ row.reach || '-' }}</td>
              <td>
                <span class="tag" :class="statusView(row).cls">{{ statusView(row).text }}</span>
              </td>
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
        暂无公告，点击「+ 新建公告」发布平台通知
      </div>

      <!-- 分页（设计稿结构补全） -->
      <div v-if="total > 0" class="pagebar">
        <span>共 {{ total }} 条 · 第 {{ page }} / {{ pageCount }} 页</span>
        <div class="pgbtns">
          <span :class="{ on: page === 1 }" @click="goPage(page - 1)">‹</span>
          <span
            v-for="p in pageNums"
            :key="p"
            :class="{ on: p === page }"
            @click="goPage(p)"
          >{{ p }}</span>
          <span :class="{ on: page === pageCount }" @click="goPage(page + 1)">›</span>
        </div>
      </div>
    </div>

    <!-- ============ 新建公告弹窗（设计稿 .ov + .modal） ============ -->
    <div v-if="modalVisible" class="ov" @click.self="closeModal">
      <div class="modal zx-scope">
        <div class="m-hd">
          <span class="pt">{{ editingId ? '编辑公告' : '新建公告' }}</span>
          <span class="d-x" @click="closeModal">✕</span>
        </div>

        <div class="m-bd">
          <!-- 公告标题 -->
          <div class="fld">
            <span>公告标题 <i class="req">*</i></span>
            <input class="ipt" v-model="form.title" placeholder="【维护通知】09-10 凌晨库存服务升级" />
          </div>

          <!-- 公告内容（富文本） -->
          <div class="fld">
            <span>公告内容（富文本）<i class="req">*</i></span>
            <div class="panel editor">
              <div class="rt-bar">
                <span class="btn-t rt-b">B</span>
                <span class="btn-t rt-i">I</span>
                <span class="btn-t rt-u">U</span>
                <span class="btn-t">H1</span>
                <span class="btn-t">H2</span>
                <span class="btn-t">• 列表</span>
                <span class="btn-t">1. 列表</span>
                <span class="btn-t">🔗 链接</span>
                <span class="btn-t">🖼 图片</span>
                <span class="btn-t">变量：{租户名} {到期日} {欠费额}</span>
              </div>
              <div class="rt-area" contenteditable="true" placeholder="请输入公告正文，支持插入变量占位符"></div>
            </div>
          </div>

          <!-- 公告类型 -->
          <div class="frow">
            <span class="fld grow">
              <span>公告类型 <i class="req">*</i></span>
              <div class="chips">
                <span
                  v-for="t in typeOptions"
                  :key="t"
                  class="btn"
                  :class="{ 'btn-p': form.type === t }"
                  @click="form.type = t"
                >{{ t }}</span>
                <span class="ver-tag">v1.5 新增</span>
              </div>
            </span>
          </div>

          <!-- 推送范围 -->
          <div class="frow">
            <span class="fld grow">
              <span>推送范围 <i class="req">*</i></span>
              <div class="chips">
                <span
                  v-for="s in scopeOptions"
                  :key="s"
                  class="btn"
                  :class="{ 'btn-p': form.scope === s }"
                  @click="form.scope = s"
                >{{ s }}</span>
              </div>
            </span>
            <span class="fld grow">
              <span>发送渠道</span>
              <div class="chips">
                <span
                  v-for="c in channelOptions"
                  :key="c"
                  class="btn"
                  :class="{ 'btn-p': form.channels.includes(c) }"
                  @click="toggleChannel(c)"
                >{{ c }}</span>
              </div>
            </span>
          </div>

          <!-- 发送方式 + 关联模板 -->
          <div class="frow">
            <span class="fld grow">
              <span>发送方式</span>
              <div class="chips">
                <span
                  v-for="m in sendModeOptions"
                  :key="m"
                  class="btn"
                  :class="{ 'btn-p': form.sendMode === m }"
                  @click="form.sendMode = m"
                >{{ m }}</span>
              </div>
            </span>
            <span class="fld grow">
              <span>关联公告模板</span>
              <span class="sel fill">选择公告模板</span>
            </span>
          </div>

          <!-- 守门提示 -->
          <div class="tipbar w">
            <span class="ic">!</span>
            <span>
              目标租户数较大时需发布前预览目标租户数与样例渲染并二次确认；发送后短时间内支持一键撤回。
            </span>
          </div>
        </div>

        <div class="m-ft">
          <span class="btn" style="margin-right: auto" @click="saveDraft">存为草稿</span>
          <span class="btn" @click="handlePreview">预览效果</span>
          <span class="btn btn-p" @click="submit">{{ editingId ? '保存' : '定时发布' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../api";

/* ── 列表状态（空数组渲染空态，不虚构示例公告） ── */
const loading = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const error = ref("");

/* ── 页头概览（接口未接入时用占位符，不写死具体数值） ── */
const stats = reactive({
  draft: "--",
  scheduled: "--",
  published: "--",
  recalled: "--",
  templates: "--",
});

/* ── 筛选器 ── */
const statusCycle = ["全部", "草稿", "定时发布", "已发布", "已撤回"];
const scopeCycle = ["全部", "全部租户", "指定租户", "按标签圈选", "按套餐圈选"];
const statusIdx = ref(0);
const scopeIdx = ref(0);
const statusLabel = computed(() => `状态：${statusCycle[statusIdx.value]} ▾`);
const scopeLabel = computed(() => `推送范围：${scopeCycle[scopeIdx.value]} ▾`);

const searchForm = reactive({ keyword: "" });

function cycleStatus() {
  statusIdx.value = (statusIdx.value + 1) % statusCycle.length;
  fetchList();
}
function cycleScope() {
  scopeIdx.value = (scopeIdx.value + 1) % scopeCycle.length;
  fetchList();
}

/* ── 弹窗状态 ── */
const modalVisible = ref(false);
const editingId = ref<number | null>(null);
const saving = ref(false);

const typeOptions = ["版本更新", "维护通知", "欠费提醒", "营销活动", "运营通知"];
const scopeOptions = ["全部租户", "指定租户", "按标签圈选", "按套餐圈选"];
const channelOptions = ["站内", "短信"];
const sendModeOptions = ["立即发送", "定时发送"];

const form = reactive({
  title: "",
  content: "",
  type: "维护通知",
  scope: "全部租户",
  channels: ["站内"] as string[],
  sendMode: "立即发送",
});

function toggleChannel(c: string) {
  const i = form.channels.indexOf(c);
  if (i >= 0) form.channels.splice(i, 1);
  else form.channels.push(c);
}

/* ── 类型 / 状态映射（与现有接口字段对齐） ── */
function typeView(row: any) {
  const map: Record<string, { cls: string; text: string }> = {
    版本更新: { cls: "tag-p", text: "版本更新" },
    维护通知: { cls: "tag-b", text: "维护通知" },
    欠费催缴: { cls: "tag-o", text: "欠费催缴" },
    营销活动: { cls: "tag-b", text: "营销活动" },
    运营通知: { cls: "tag-gy", text: "运营通知" },
  };
  return map[row.type] || { cls: "tag-gy", text: row.type || "运营通知" };
}
function statusView(row: any) {
  const map: Record<string, { cls: string; text: string }> = {
    DRAFT: { cls: "tag-gy", text: "草稿" },
    SCHEDULED: { cls: "tag-p", text: "定时发布" },
    PUBLISHED: { cls: "tag-g", text: "已发布" },
    RECALLED: { cls: "tag-r", text: "已撤回" },
  };
  return map[row.status] || { cls: "tag-gy", text: row.status || "草稿" };
}
function actionsFor(row: any) {
  const map: Record<string, { key: string; label: string; cls: string }[]> = {
    SCHEDULED: [
      { key: "preview", label: "预览", cls: "" },
      { key: "edit", label: "编辑", cls: "" },
      { key: "recall", label: "撤销定时", cls: "dgr" },
    ],
    PUBLISHED: [
      { key: "read", label: "已读明细", cls: "" },
      { key: "withdraw", label: "撤回", cls: "warn" },
    ],
    DRAFT: [
      { key: "edit", label: "编辑", cls: "" },
      { key: "delete", label: "删除", cls: "dgr" },
    ],
  };
  return map[row.status] || [{ key: "read", label: "已读明细", cls: "" }];
}

/* ── 分页计算 ── */
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const pageNums = computed(() => {
  const n = pageCount.value;
  const cur = page.value;
  const set = new Set<number>([1, n, cur, cur - 1, cur + 1].filter((x) => x >= 1 && x <= n));
  return Array.from(set).sort((a, b) => a - b);
});
function goPage(p: number) {
  if (p < 1 || p > pageCount.value || p === page.value) return;
  page.value = p;
  fetchList();
}

/* ── 列表加载：保留 getAnnouncements 调用（含 loading/空态/错误处理） ── */
async function fetchList() {
  loading.value = true;
  error.value = "";
  try {
    const res = await getAnnouncements({
      page: page.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword || undefined,
      status: statusIdx.value === 0 ? undefined : statusCycle[statusIdx.value],
    });
    const data = res?.data?.data || (res as any).data || res;
    list.value = data?.records || [];
    total.value = data?.total || 0;
  } catch (e: any) {
    error.value = "公告列表加载失败";
    ElMessage.error(e?.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

/* ── 弹窗操作 ── */
function openCreate() {
  editingId.value = null;
  Object.assign(form, {
    title: "",
    content: "",
    type: "维护通知",
    scope: "全部租户",
    channels: ["站内"],
    sendMode: "立即发送",
  });
  modalVisible.value = true;
}
function closeModal() {
  modalVisible.value = false;
}
function handlePreview() {
  // TODO: 待接入公告预览接口（建议 GET /platform/announcements/preview）
  ElMessage.info("预览效果：待接入公告预览接口");
}
function handleTemplateCenter() {
  // TODO: 待接入公告模板列表接口（建议 GET /platform/announcements/templates）
  ElMessage.info("公告模板：待接入公告模板接口");
}
async function saveDraft() {
  form.sendMode = "立即发送";
  await submit(true);
}
async function submit(isDraft = false) {
  if (!form.title.trim()) {
    ElMessage.warning("请输入公告标题");
    return;
  }
  saving.value = true;
  try {
    const payload = {
      title: form.title,
      content: form.content,
      type: form.type,
      status: isDraft ? "DRAFT" : form.sendMode === "定时发送" ? "SCHEDULED" : "PUBLISHED",
      startTime: "",
      endTime: "",
    };
    if (editingId.value) {
      await updateAnnouncement(editingId.value, payload);
      ElMessage.success("更新成功");
    } else {
      await createAnnouncement(payload);
      ElMessage.success(isDraft ? "已存为草稿" : "发布成功");
    }
    modalVisible.value = false;
    fetchList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "保存失败");
  } finally {
    saving.value = false;
  }
}

function onRowAction(key: string, row: any) {
  switch (key) {
    case "edit":
      editingId.value = row.id;
      Object.assign(form, {
        title: row.title || "",
        content: row.content || "",
        type: row.type || "维护通知",
        scope: row.scope || "全部租户",
        channels: row.channel ? String(row.channel).split(/[+＋]/).map((s: string) => s.trim()) : ["站内"],
        sendMode: "立即发送",
      });
      modalVisible.value = true;
      break;
    case "delete":
      handleDelete(row);
      break;
    case "recall":
      // TODO: 待接入撤销定时发布接口（建议 POST /platform/announcements/:id/recall）
      ElMessage.info("撤销定时：待接入撤销定时接口");
      break;
    case "withdraw":
      // TODO: 待接入撤回已发布接口（建议 POST /platform/announcements/:id/withdraw）
      ElMessage.info("撤回：待接入撤回接口");
      break;
    default:
      // preview / read 等：待接入详情接口（建议 GET /platform/announcements/:id）
      ElMessage.info("公告详情：待接入公告详情接口");
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm("确定要删除这条公告吗？", "确认删除", { type: "warning" });
  } catch {
    return;
  }
  try {
    await deleteAnnouncement(row.id);
    ElMessage.success("删除成功");
    fetchList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "删除失败");
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

/* 必填星标 */
.req {
  color: var(--color-danger);
  font-style: normal;
}
/* 下拉箭头（.sel 内联箭头，配合组件层 .sel::after 之外的补充） */
.caret {
  color: var(--g4);
  font-size: var(--ctrl-caret-size);
  font-style: normal;
  font-weight: var(--font-normal);
  margin-left: auto;
}
/* 搜索框宽度（复用顶部搜索令牌） */
.search-ipt {
  width: var(--sbox-width);
}
/* 弹窗内占位选择框占满 */
.fill {
  width: 100%;
}

/* 公告类型 / 范围 / 渠道 选项组 */
.chips {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  align-items: center;
}
.grow {
  flex: 1;
  min-width: 0;
}

/* 富文本编辑器 */
.editor {
  box-shadow: none;
  overflow: hidden;
  border-radius: var(--radius-md);
}
.rt-bar {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
  padding: var(--space-2) var(--space-3);
  background: var(--g0);
  border-bottom: 1px solid var(--g2);
}
.rt-b {
  font-weight: var(--font-bold);
}
.rt-i {
  font-style: italic;
}
.rt-u {
  text-decoration: underline;
}
.rt-area {
  padding: var(--space-3);
  font-size: var(--text-sm);
  color: var(--g6);
  min-height: calc(var(--space-6) + var(--space-10));
  outline: none;
}
.rt-area:empty::before {
  content: attr(placeholder);
  color: var(--g4);
}
</style>
