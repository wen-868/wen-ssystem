<template>
  <div>
    <!-- ============ 页头（设计稿 sec-notice .pg-hd） ============ -->
    <div class="pg-hd">
      <div>
        <div class="pt4">公告管理</div>
        <p class="pd">
          草稿 {{ stats.draft }} · 已发布 {{ stats.published }} · 公告模板 {{ stats.templates }} 个
          · 定时发布 / 已撤回为预留能力，当前不支持（S3-32）
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
      <span>{{ error }}，请稍后重试（当前展示空态）</span>
    </div>

    <!-- ============ 公告列表面板（设计稿 .panel / .tblwrap） ============ -->
    <div class="panel">
      <div class="p-hd">
        <span class="pt">公告列表</span>
        <div class="frow">
          <span class="sel" @click="cycleStatus">{{ statusLabel }}<b class="caret">▾</b></span>
          <span class="sel" @click="cycleScope">{{ scopeLabel }}<b class="caret">▾</b></span>
          <span v-if="scopeHint" class="small">{{ scopeHint }}</span>
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
              <td>{{ row.publishAt || '-' }}</td>
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
              <div
                class="rt-area"
                contenteditable="true"
                ref="editorRef"
                @input="onContentInput"
                placeholder="请输入公告正文，支持插入变量占位符"
              ></div>
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
              <select class="ipt fill" v-model="selectedTemplateCode" @change="applySelectedTemplate">
                <option value="">选择公告模板</option>
                <option v-for="t in templateOptions" :key="t.code" :value="t.code">{{ t.name }}</option>
              </select>
              <span v-if="templateError" class="small">{{ templateError }}</span>
            </span>
          </div>

          <!-- 守门提示 -->
          <div class="tipbar w">
            <span class="ic">!</span>
            <span>
              预览为前端本地渲染（后端无预览端点，变量占位符按原文展示）；定时发布与撤回为预留能力，
              当前不支持（S3-32）；推送范围与渠道暂无落库列（S3-82）。
            </span>
          </div>
        </div>

        <div class="m-ft">
          <span class="btn" style="margin-right: auto" @click="saveDraft">存为草稿</span>
          <span class="btn" @click="handlePreview">预览效果</span>
          <span class="btn btn-p" @click="() => submit()">{{ editingId ? '保存' : '立即发布' }}</span>
        </div>
      </div>
    </div>

    <!-- ============ 预览效果（前端本地渲染：后端无预览端点，见 C2-0 裁定 §2.3） ============ -->
    <div v-if="previewVisible" class="ov" @click.self="previewVisible = false">
      <div class="modal zx-scope">
        <div class="m-hd">
          <span class="pt">预览效果（本地渲染）</span>
          <span class="d-x" @click="previewVisible = false">✕</span>
        </div>
        <div class="m-bd">
          <div class="panel pv-card">
            <b class="pv-title">{{ form.title || "（未填写标题）" }}</b>
            <p class="small mt6">
              类型：{{ typeView(form).text }} · 范围：{{ form.scope }} · 渠道：
              {{ form.channels.join(" + ") || "—" }}
            </p>
            <!-- 正文为平台运营在本地富文本编辑器录入的内容（非外部输入），此处按原样渲染 -->
            <div class="pv-body" v-html="form.content"></div>
            <p v-if="!form.content" class="small">（正文为空）</p>
          </div>
          <p class="small">
            预览由前端本地渲染：不含目标租户数预估与样例变量替换（变量占位符按原文展示，S3-82 登记）。
          </p>
        </div>
        <div class="m-ft">
          <span class="btn" @click="previewVisible = false">关闭</span>
        </div>
      </div>
    </div>

    <!-- ============ 公告详情（GET /platform/announcements/:id） ============ -->
    <div v-if="detailVisible" class="ov" @click.self="detailVisible = false">
      <div class="modal zx-scope">
        <div class="m-hd">
          <span class="pt">公告详情</span>
          <span class="d-x" @click="detailVisible = false">✕</span>
        </div>
        <div class="m-bd">
          <div v-if="detailError" class="tipbar r">
            <span class="ic">!</span>
            <span>{{ detailError }}</span>
          </div>
          <p v-else-if="detailLoading" class="small">加载中…</p>
          <template v-else-if="detail">
            <div class="frow">
              <span class="fld grow"><span>标题</span><span>{{ detail.title }}</span></span>
              <span class="fld grow"><span>类型</span><span>{{ typeView(detail).text }}</span></span>
            </div>
            <div class="frow">
              <span class="fld grow"><span>状态</span><span>{{ statusView(detail).text }}</span></span>
              <span class="fld grow"><span>发布时间</span><span>{{ detail.publishAt || "—" }}</span></span>
            </div>
            <div class="frow">
              <span class="fld grow"><span>创建人</span><span>{{ detail.createdBy || "—" }}</span></span>
              <span class="fld grow"><span>更新时间</span><span>{{ detail.updatedAt || "—" }}</span></span>
            </div>
            <div class="fld">
              <span>正文</span>
              <div class="pv-body" v-html="detail.content"></div>
            </div>
            <p class="small">触达 / 已读明细暂无数据源（后端无已读统计表，S3-82 登记）。</p>
          </template>
          <p v-else class="small">暂无详情数据</p>
        </div>
        <div class="m-ft">
          <span class="btn" @click="detailVisible = false">关闭</span>
        </div>
      </div>
    </div>

    <!-- ============ 公告模板（GET/PUT /platform/announcements/templates，整包覆盖） ============ -->
    <div v-if="tplVisible" class="ov" @click.self="tplVisible = false">
      <div class="modal zx-scope">
        <div class="m-hd">
          <span class="pt">公告模板</span>
          <span class="d-x" @click="tplVisible = false">✕</span>
        </div>
        <div class="m-bd">
          <div v-if="tplError" class="tipbar r">
            <span class="ic">!</span>
            <span>{{ tplError }}</span>
          </div>
          <div v-for="(t, i) in tplRecords" :key="i" class="frow tpl-row">
            <span class="fld"><span>编码</span><input class="ipt" v-model="t.code" placeholder="如 ARREARS_REMIND" /></span>
            <span class="fld"><span>名称</span><input class="ipt" v-model="t.name" placeholder="如 欠费催缴" /></span>
            <span class="fld grow">
              <span>正文</span>
              <input class="ipt" v-model="t.content" placeholder="模板正文（可含 {租户名} 等变量）" />
            </span>
            <span class="btn-t dgr" @click="removeTemplateRow(i)">删除</span>
          </div>
          <p v-if="!tplRecords.length" class="small">
            暂无公告模板（后端未配置时返回空清单，不提供内置默认模板）
          </p>
          <p class="small">
            保存为整包覆盖（PUT）：新增 / 修改 / 删除后点「保存」一次性提交；提交空清单等价于清空。
          </p>
        </div>
        <div class="m-ft">
          <span class="btn" style="margin-right: auto" @click="addTemplateRow">+ 新增模板</span>
          <span class="btn" @click="tplVisible = false">取消</span>
          <span class="btn btn-p" @click="saveTemplates">{{ tplSaving ? "保存中…" : "保存" }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  createAnnouncementApi,
  deleteAnnouncementApi,
  getAnnouncementApi,
  listAnnouncementTemplatesApi,
  listAnnouncementsApi,
  saveAnnouncementTemplatesApi,
  togglePublishAnnouncementApi,
  updateAnnouncementApi,
} from "../api/announcement";
import type { AnnouncementItem, AnnouncementTemplateItem } from "../api/announcement";

/** 统一解包响应信封 { code, msg, data, traceId }（业务码非 0 已由请求层拦截并给中文提示） */
function unwrap(res: any) {
  return res?.data ?? res ?? {};
}

/* ── 列表状态（空数组渲染空态，不虚构示例公告） ── */
const loading = ref(false);
const list = ref<AnnouncementItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const error = ref("");

/* ── 页头概览：草稿 / 已发布 / 公告模板取真实计数；取不到时显示「—」，不写死数值 ── */
const stats = reactive({
  draft: "--",
  published: "--",
  templates: "--",
});

/* ── 筛选器 ── */
const statusCycle = ["全部", "草稿", "已发布"];
const statusValues: (undefined | "DRAFT" | "PUBLISHED")[] = [undefined, "DRAFT", "PUBLISHED"];
const scopeCycle = ["全部", "全部租户", "指定租户", "按标签圈选", "按套餐圈选"];
const statusIdx = ref(0);
const scopeIdx = ref(0);
const statusLabel = computed(() => `状态：${statusCycle[statusIdx.value]} ▾`);
const scopeLabel = computed(() => `推送范围：${scopeCycle[scopeIdx.value]} ▾`);
/** 推送范围为后端未落库维度（S3-82）：选了非「全部」时如实提示，避免被读成已生效筛选 */
const scopeHint = computed(() =>
  scopeIdx.value === 0 ? "" : "（推送范围筛选暂不支持：后端暂无范围列，S3-82）"
);

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
const sendModeOptions = ["立即发送"];

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
    欠费提醒: { cls: "tag-o", text: "欠费催缴" },
    营销活动: { cls: "tag-b", text: "营销活动" },
    运营通知: { cls: "tag-gy", text: "运营通知" },
  };
  return map[row.type] || { cls: "tag-gy", text: row.type || "运营通知" };
}
function statusView(row: any) {
  const map: Record<string, { cls: string; text: string }> = {
    DRAFT: { cls: "tag-gy", text: "草稿" },
    SCHEDULED: { cls: "tag-p", text: "定时发布" }, // 预留：后端暂不支持（S3-32）
    PUBLISHED: { cls: "tag-g", text: "已发布" },
    RECALLED: { cls: "tag-r", text: "已撤回" },
  };
  return map[row.status] || { cls: "tag-gy", text: row.status || "草稿" };
}
function actionsFor(row: any) {
  const map: Record<string, { key: string; label: string; cls: string }[]> = {
    DRAFT: [
      { key: "edit", label: "编辑", cls: "" },
      { key: "publish", label: "发布", cls: "" },
      { key: "delete", label: "删除", cls: "dgr" },
    ],
    PUBLISHED: [
      { key: "detail", label: "已读明细", cls: "" },
      { key: "unpublish", label: "取消发布", cls: "warn" },
    ],
  };
  // 定时发布 / 撤回已发布为预留能力，后端当前不支持（S3-32）⇒ 不呈现对应入口
  return map[row.status] || [{ key: "detail", label: "已读明细", cls: "" }];
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

/* ── 列表加载：接真实端点（含 loading / 空态 / 错误态；无数据不造数） ── */
async function fetchList() {
  loading.value = true;
  error.value = "";
  try {
    const data = unwrap(
      await listAnnouncementsApi({
        page: page.value,
        pageSize: pageSize.value,
        keyword: searchForm.keyword || undefined,
        status: statusValues[statusIdx.value],
      })
    );
    list.value = data.records || [];
    total.value = Number(data.total || 0);
  } catch {
    error.value = "公告列表加载失败";
  } finally {
    loading.value = false;
  }
}

/**
 * 页头概览补数：草稿 / 已发布各取一次轻量列表查询（pageSize=1，只为取 total），
 * 公告模板数取模板清单 total；任一取不到显示「—」，不用推算值冒充真实计数。
 */
async function fetchStats() {
  const [draftRes, publishedRes, templatesRes] = await Promise.allSettled([
    listAnnouncementsApi({ page: 1, pageSize: 1, status: "DRAFT" }),
    listAnnouncementsApi({ page: 1, pageSize: 1, status: "PUBLISHED" }),
    listAnnouncementTemplatesApi(),
  ]);
  stats.draft = draftRes.status === "fulfilled" ? String(unwrap(draftRes.value).total ?? 0) : "—";
  stats.published = publishedRes.status === "fulfilled" ? String(unwrap(publishedRes.value).total ?? 0) : "—";
  stats.templates = templatesRes.status === "fulfilled" ? String(unwrap(templatesRes.value).total ?? 0) : "—";
}

/* ── 弹窗与正文编辑 ── */
const editorRef = ref<HTMLElement | null>(null);

/** 富文本区与 form.content 同步：输入取 innerHTML，打开弹窗时回填已存正文 */
function onContentInput() {
  form.content = editorRef.value?.innerHTML ?? "";
}
function syncEditor() {
  nextTick(() => {
    if (editorRef.value) editorRef.value.innerHTML = form.content;
  });
}

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
  selectedTemplateCode.value = "";
  modalVisible.value = true;
  syncEditor();
}
function openEdit(row: any) {
  editingId.value = row.id;
  Object.assign(form, {
    title: row.title || "",
    content: row.content || "",
    type: row.type || "维护通知",
    scope: row.scope || "全部租户",
    channels: row.channel
      ? String(row.channel)
          .split(/[+＋]/)
          .map((s: string) => s.trim())
      : ["站内"],
    sendMode: "立即发送",
  });
  selectedTemplateCode.value = "";
  modalVisible.value = true;
  syncEditor();
}
function closeModal() {
  modalVisible.value = false;
}

/* ── 预览：前端本地渲染（后端不提供预览端点，见 C2-0 裁定 §2.3） ── */
const previewVisible = ref(false);
function handlePreview() {
  if (!form.title.trim() && !form.content.trim()) {
    ElMessage.warning("请先填写公告标题与正文");
    return;
  }
  previewVisible.value = true;
}

/* ── 公告模板清单：GET / PUT /platform/announcements/templates ── */
const templateOptions = ref<AnnouncementTemplateItem[]>([]);
const templateError = ref("");
const selectedTemplateCode = ref("");

async function fetchTemplates() {
  try {
    const data = unwrap(await listAnnouncementTemplatesApi());
    templateOptions.value = data.records || [];
    templateError.value = "";
  } catch {
    templateOptions.value = [];
    templateError.value = "公告模板加载失败";
  }
}

/** 选用模板：把模板正文写入正文区（模板内容为后端真实存储值，不做变量插值、不代为填写标题） */
function applySelectedTemplate() {
  const tpl = templateOptions.value.find((t) => t.code === selectedTemplateCode.value);
  if (!tpl) return;
  form.content = tpl.content;
  syncEditor();
}

const tplVisible = ref(false);
const tplSaving = ref(false);
const tplError = ref("");
const tplRecords = ref<AnnouncementTemplateItem[]>([]);

function handleTemplateCenter() {
  tplVisible.value = true;
  tplError.value = "";
  tplRecords.value = templateOptions.value.map((t) => ({ ...t }));
}
function addTemplateRow() {
  tplRecords.value.push({ code: "", name: "", content: "" });
}
function removeTemplateRow(index: number) {
  tplRecords.value.splice(index, 1);
}
/** 保存为整包覆盖（PUT）：新增 / 修改 / 删除一次性提交；空清单即清空 */
async function saveTemplates() {
  const records = tplRecords.value.map((r) => ({
    code: r.code.trim(),
    name: r.name.trim(),
    content: r.content.trim(),
  }));
  const incomplete = records.findIndex((r) => !r.code || !r.name || !r.content);
  if (incomplete >= 0) {
    ElMessage.warning(`第 ${incomplete + 1} 行：模板编码 / 名称 / 正文均为必填`);
    return;
  }
  const dupIndex = records.findIndex((r, i) => records.findIndex((x) => x.code === r.code) !== i);
  if (dupIndex >= 0) {
    ElMessage.warning(`模板编码重复：${records[dupIndex].code}`);
    return;
  }
  tplSaving.value = true;
  try {
    await saveAnnouncementTemplatesApi(records);
    ElMessage.success("公告模板已保存");
    tplVisible.value = false;
    await fetchTemplates();
    await fetchStats();
  } catch {
    /* 错误提示由请求层统一处理，此处只做内容态 */
  } finally {
    tplSaving.value = false;
  }
}

/* ── 公告详情（GET /platform/announcements/:id） ── */
const detailVisible = ref(false);
const detailLoading = ref(false);
const detailError = ref("");
const detail = ref<AnnouncementItem | null>(null);
async function openDetail(row: any) {
  detailVisible.value = true;
  detailLoading.value = true;
  detailError.value = "";
  detail.value = null;
  try {
    detail.value = unwrap(await getAnnouncementApi(row.id)) as AnnouncementItem;
  } catch {
    detailError.value = "公告详情加载失败";
  } finally {
    detailLoading.value = false;
  }
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
  if (!form.content.trim()) {
    ElMessage.warning("请输入公告内容");
    return;
  }
  saving.value = true;
  try {
    const payload = {
      title: form.title.trim(),
      content: form.content,
      type: form.type,
      isTop: 0,
      status: (isDraft ? "DRAFT" : "PUBLISHED") as "DRAFT" | "PUBLISHED",
    };
    if (editingId.value) {
      await updateAnnouncementApi(editingId.value, payload);
      ElMessage.success("更新成功");
    } else {
      await createAnnouncementApi(payload);
      ElMessage.success(isDraft ? "已存为草稿" : "发布成功");
    }
    modalVisible.value = false;
    fetchList();
    fetchStats();
  } catch { /* 错误提示由请求层统一处理，此处只做内容态 */ } finally {
    saving.value = false;
  }
}

/** 发布 / 取消发布：后端为单一开关端点 POST /platform/announcements/:id/publish */
async function handleTogglePublish(row: any) {
  const toPublish = row.status !== "PUBLISHED";
  try {
    await ElMessageBox.confirm(
      toPublish ? `确认发布公告「${row.title}」？` : `确认取消发布公告「${row.title}」？`,
      toPublish ? "确认发布" : "确认取消发布",
      { type: "warning" }
    );
  } catch {
    return;
  }
  try {
    await togglePublishAnnouncementApi(row.id);
    ElMessage.success(toPublish ? "发布成功" : "已取消发布");
    await fetchList();
    await fetchStats();
  } catch { /* 错误提示由请求层统一处理，此处只做内容态 */ }
}

async function onRowAction(key: string, row: any) {
  switch (key) {
    case "edit":
      openEdit(row);
      break;
    case "publish":
    case "unpublish":
      await handleTogglePublish(row);
      break;
    case "delete":
      await handleDelete(row);
      break;
    case "detail":
      await openDetail(row);
      break;
    default:
      break;
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm("确定要删除这条公告吗？", "确认删除", { type: "warning" });
  } catch {
    return;
  }
  try {
    await deleteAnnouncementApi(row.id);
    ElMessage.success("删除成功");
    fetchList();
    fetchStats();
  } catch { /* 错误提示由请求层统一处理，此处只做内容态 */ }
}

onMounted(() => {
  fetchList();
  fetchStats();
  fetchTemplates();
});
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

/* 预览 / 详情正文（前端本地渲染） */
.pv-card {
  box-shadow: none;
}
.pv-title {
  font-size: var(--text-md);
}
.pv-body {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--g6);
  white-space: pre-wrap;
  word-break: break-word;
}

/* 公告模板清单行（编码 / 名称 / 正文 / 删除） */
.tpl-row {
  align-items: flex-end;
}
</style>
