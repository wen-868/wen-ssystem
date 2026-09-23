<template>
  <!-- 模板中心内容片段（根节点即片段，不包裹 .pf-main，由 PlatformLayout 提供 .pf-main 作用域） -->
  <div>
    <!-- ============ 页头 ============ -->
    <div class="pg-hd">
      <div>
        <div class="pt4">模板中心</div>
        <p class="pd">
          初始化模板 4 套 · 公共打印模板 6 套 · 导入模板 4 个 + 导出模板 3 个（共 7 个）
          <span class="ver-tag">v1.5</span>
        </p>
      </div>
      <div class="pg-act">
        <span
          class="btn gy"
          title="开户套用初始化模板尚未开放（S3-81 规划中）"
          @click="handleApplyOpenAccount"
        >套用开户</span>
        <span class="btn btn-p" @click="openInitCreate">+ 新建初始化模板</span>
      </div>
    </div>

    <!-- ============ 初始化模板（套餐卡 g4） ============ -->
    <div v-if="errorInit" class="tipbar r mt8">
      <span class="ic">!</span>
      <span>{{ errorInit }}，请稍后重试（当前展示空态）</span>
    </div>
    <div class="g4">
      <div
        v-for="t in initTemplates"
        :key="t.id"
        class="plan"
        :class="{ hot: t.recommended }"
      >
        <div class="ph">
          <span class="pn">{{ t.name }}</span>
          <span class="tag" :class="t.recommended ? 'tag-b' : 'tag-gy'">
            {{ t.recommended ? "推荐" : t.freeAvailable ? "免费可用" : "未标记" }}
          </span>
        </div>
        <div class="pnum mt8">{{ t.applicable || "—" }}</div>
        <div class="pnum">{{ t.codeRule || "—" }}</div>
        <div class="pnum">{{ t.convertRule || "—" }}</div>
        <div class="pnum">
          被引用租户 <b>{{ t.refCount }}</b> · V{{ t.version }} · 更新 {{ t.updatedAt }}
        </div>
        <div class="pft">
          <span class="btn-t" @click="openInitEdit(t)">编辑</span>
          <span class="btn-t" @click="handlePreview(t)">预览</span>
          <span class="btn-t" @click="openVersions(t)">版本记录</span>
          <span
            class="btn-t gy"
            title="开户套用初始化模板尚未开放（S3-81 规划中）"
            @click="handleApplyOpenAccount"
          >套用开户</span>
        </div>
      </div>

      <!-- 新建初始化模板（结构化的四段式配置 CTA，非数据） -->
      <div class="plan plan-new" @click="openInitCreate">
        <div class="p-bd tpl-new-bd">
          <div>
            <span class="tpl-new-plus">+</span>
            <b class="tpl-new-t">新建初始化模板</b>
            <p class="small mt6">
              编号规则 / 换算规则 / 打印模板 /<br />默认仓库与账户体系，四段式配置
            </p>
          </div>
        </div>
      </div>
    </div>
    <div v-if="loadingInit" class="empty">加载中…</div>
    <div v-else-if="!initTemplates.length" class="empty">
      暂无初始化模板，点击「+ 新建初始化模板」创建
    </div>

    <!-- ============ 开户一键套用初始化模板（向导） ============ -->
    <div class="panel mt12">
      <div class="p-hd">
        <span class="pt">
          开户一键套用初始化模板 <span class="ver-tag">v1.5</span>
        </span>
        <span class="ph-s">
          新建租户时选择模板一键套用（清单 4.1）· 值复制而非引用 · 开户留痕记录所用模板与版本
        </span>
      </div>
      <div class="p-bd">
        <!-- 开户套用尚未开放（C2-0 裁定 §2.2 范围校准：转 S3-81）：置灰 + 一句说明，不做假入口 -->
        <div class="tipbar w">
          <span class="ic">!</span>
          <span>{{ APPLY_ACCOUNT_NOTICE }}</span>
        </div>
        <!-- 步骤条 -->
        <div class="steps">
          <span class="step done"><span class="sn">✓</span>① 新建租户（填基础信息）</span>
          <span class="step-line"></span>
          <span class="step on"><span class="sn">2</span>② 选择初始化模板</span>
          <span class="step-line"></span>
          <span class="step"><span class="sn">3</span>③ 预览将复制的配置</span>
          <span class="step-line"></span>
          <span class="step"><span class="sn">4</span>④ 确认开户 · 值复制生效</span>
        </div>

        <!-- 基础信息 -->
        <div class="frow">
          <span class="fld fld-grow-12">
            <span>租户名称 <i class="req">*</i></span>
            <span class="ipt" contenteditable="true" placeholder="请输入租户名称"></span>
          </span>
          <span class="fld fld-grow-1">
            <span>套餐 <i class="req">*</i></span>
            <span class="sel">请选择套餐</span>
          </span>
          <span class="fld fld-grow-1">
            <span>管理员手机号</span>
            <span class="ipt" contenteditable="true" placeholder="请输入管理员手机号"></span>
          </span>
        </div>

        <!-- 初始化模板选择 -->
        <div class="frow mt10">
          <span class="fld fld-grow-16">
            <span>初始化模板 <i class="req">*</i></span>
            <div class="tpl-pick">
              <span
                v-for="t in initTemplates"
                :key="t.id"
                class="btn"
                :class="{ 'btn-p': selectedTemplateId === t.id }"
                @click="selectedTemplateId = t.id"
              >
                <template v-if="selectedTemplateId === t.id">✓ </template>{{ t.name }} V{{ t.version }}{{ t.recommended ? '（推荐）' : '' }}
              </span>
              <span v-if="!initTemplates.length" class="empty-inline">暂无可选模板</span>
              <span class="btn gy" @click="selectedTemplateId = null">暂不套用</span>
            </div>
          </span>
        </div>

        <!-- 将复制的配置 -->
        <div class="copy-box mt10">
          <b class="copy-label">将复制的配置（值复制）：</b>
          <template v-if="selectedTemplateId !== null">
            <span
              v-for="(c, i) in selectedCopyConfigs"
              :key="i"
              class="tag"
              :class="c.public ? 'tag-b' : 'tag-gy'"
            >{{ c.label }}{{ c.public ? ' ✓' : '' }}</span>
            <span v-if="!selectedCopyConfigs.length" class="small">该模板未配置「将复制的配置」项</span>
          </template>
          <span v-else class="small">选择初始化模板后展示将复制的配置</span>
        </div>

        <!-- 提示条 -->
        <div class="tipbar w mt10">
          <span class="ic">!</span>
          <span>
            模板后续修改<b>不回写</b>已开户租户；套用即生成开户日志（操作人 / 模板 / 版本号 / 时间）；免费版租户仅可套用标记「免费可用」的模板。
          </span>
        </div>

        <!-- 底部操作 -->
        <div class="m-ft">
          <span class="btn gy" title="开户套用尚未开放（S3-81 规划中）" @click="handlePrevStep">上一步</span>
          <span
            class="btn gy"
            style="margin-right: auto"
            title="开户套用尚未开放（S3-81 规划中）"
            @click="handleSaveTenantOnly"
          >仅保存租户</span>
          <span
            class="btn gy"
            title="开户套用尚未开放（S3-81 规划中）"
            @click="handleApplyOpenAccount"
          >创建租户并套用模板</span>
        </div>
      </div>
    </div>

    <!-- ============ 公共打印模板 ============ -->
    <div class="panel mt12">
      <div class="p-hd">
        <span class="pt">公共打印模板</span>
        <div class="frow">
          <select
            class="ipt"
            v-model="printType"
            title="按单据类型筛选公共打印模板（全部 = 不筛选）"
            @change="onPrintTypeChange"
          >
            <option v-for="o in printTypeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <span class="btn btn-s" @click="openPrintUpload">+ 上传模板</span>
        </div>
      </div>
      <div class="p-bd" style="padding-top: var(--space-2)">
        <div v-if="errorPrint" class="tipbar r">
          <span class="ic">!</span>
          <span>{{ errorPrint }}，请稍后重试（当前展示空态）</span>
        </div>
        <div class="g6">
          <div
            v-for="p in printTemplates"
            :key="p.id"
            class="panel tpl-card"
          >
            <div class="tpl-thumb"></div>
            <div class="mt8 tpl-card-hd">
              <b class="tpl-name">{{ p.name }}</b>
              <span class="tag" :class="p.public ? 'tag-b' : 'tag-gy'">{{ p.public ? '公共' : '未设公共' }}</span>
            </div>
            <p class="small">
              {{ billTypeLabel(p.billType) }} · {{ paperTypeLabel(p.paperType)
              }}{{ p.spec ? " · " + p.spec : "" }}
            </p>
            <div class="pft">
              <span class="btn-t" @click="handlePreview(p)">预览</span>
              <span class="btn-t" @click="handleVarDesc(p)">变量说明</span>
              <span v-if="!p.public" class="btn-t warn" @click="handleSetPublic(p)">设为公共模板</span>
            </div>
          </div>
        </div>
        <div v-if="loadingPrint" class="empty">加载中…</div>
        <div v-else-if="!printTemplates.length" class="empty">暂无公共打印模板</div>
      </div>
    </div>

    <!-- ============ 数据导入 / 导出模板 ============ -->
    <div class="panel mt12">
      <div class="p-hd">
        <span class="pt">
          数据导入 / 导出模板 <span class="ver-tag">v1.5</span>
        </span>
        <span class="ph-s">
          导入侧统一维护字段模板 · 导出侧统一列结构与脱敏规则 · 旧格式解析兼容期 ≥2 个版本 · 含字段校验说明页签
        </span>
      </div>
      <div class="tblwrap">
        <div v-if="errorIo" class="tipbar r" style="margin: var(--space-2)">
          <span class="ic">!</span>
          <span>{{ errorIo }}，请稍后重试（当前展示空态）</span>
        </div>
        <table class="tbl">
          <thead>
            <tr>
              <th>模板名称</th>
              <th>方向</th>
              <th>版本</th>
              <th>更新时间</th>
              <th>字段数</th>
              <th>兼容说明</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="io in ioTemplates" :key="io.id">
              <td><b>{{ io.name }}</b></td>
              <td><span class="tag" :class="io.direction === 'IMPORT' ? 'tag-b' : 'tag-gy'">{{ io.direction === 'IMPORT' ? '导入' : '导出' }}</span></td>
              <td>{{ io.version }}</td>
              <td>{{ io.updatedAt }}</td>
              <td>{{ io.fieldCount }}</td>
              <td>{{ io.compat || "—" }}</td>
              <td>
                <span v-if="io.hasFile" class="btn-t" @click="handleDownload(io)">下载</span>
                <span v-else class="btn-t gy" title="该模板未上传文件内容，后端无可下载文件">未上传文件</span>
                <span class="btn-t" @click="handleFieldDesc(io)">字段说明</span>
              </td>
            </tr>
            <tr v-if="loadingIo">
              <td colspan="7" class="empty">加载中…</td>
            </tr>
            <tr v-else-if="!ioTemplates.length">
              <td colspan="7" class="empty">暂无导入 / 导出模板</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="small mt8">
        导出侧说明：导出模板由平台统一维护列结构与字段口径（清单 4.3），租户侧导出仅能套用本表模板；含敏感字段的导出需二次审批并记录至日志中心。
      </p>
    </div>

    <!-- ============ 初始化模板新建 / 编辑（POST /init、PUT /init/:id） ============ -->
    <div v-if="initDialogVisible" class="ov" @click.self="initDialogVisible = false">
      <div class="modal zx-scope">
        <div class="m-hd">
          <span class="pt">{{ editingInitId ? "编辑初始化模板" : "新建初始化模板" }}</span>
          <span class="d-x" @click="initDialogVisible = false">✕</span>
        </div>
        <div class="m-bd">
          <div class="frow">
            <span class="fld grow">
              <span>模板编码 <i class="req">*</i></span>
              <input class="ipt" v-model="initForm.code" placeholder="如 STANDARD_WHOLESALE_RETAIL" />
            </span>
            <span class="fld grow">
              <span>模板名称 <i class="req">*</i></span>
              <input class="ipt" v-model="initForm.name" placeholder="如 标准批零模板" />
            </span>
          </div>
          <div class="frow">
            <span class="fld grow">
              <span>适用范围</span>
              <input class="ipt" v-model="initForm.applicable" placeholder="如 批发 + 零售" />
            </span>
            <span class="fld grow">
              <span>编号规则</span>
              <input class="ipt" v-model="initForm.codeRule" placeholder="如 XS-{yyyyMMdd}-{序号4}" />
            </span>
          </div>
          <div class="frow">
            <span class="fld grow">
              <span>换算规则</span>
              <input class="ipt" v-model="initForm.convertRule" placeholder="如 1 箱 = 12 瓶" />
            </span>
            <span class="fld grow">
              <span>打印模板</span>
              <input class="ipt" v-model="initForm.printRef" placeholder="如 销售单·标准版" />
            </span>
          </div>
          <div class="frow">
            <span class="fld grow">
              <span>默认仓库与账户体系</span>
              <input class="ipt" v-model="initForm.defaultWhAccount" placeholder="如 一号仓 / 默认账户体系 A" />
            </span>
            <span class="fld"><span>免费可用</span><input type="checkbox" v-model="initForm.freeAvailable" /></span>
            <span class="fld"><span>推荐</span><input type="checkbox" v-model="initForm.recommended" /></span>
          </div>
          <div class="fld">
            <span>将复制的配置（每行一项，行尾 ✓ 表示公共配置）</span>
            <textarea
              class="ipt"
              rows="4"
              v-model="initForm.copyConfigsText"
              placeholder="编号规则 ✓ / 基础资料字段 / 打印模板 ✓"
            ></textarea>
          </div>
          <div class="fld">
            <span>变更说明（写入版本快照）</span>
            <input class="ipt" v-model="initForm.changeNote" placeholder="如 调整编号规则后缀" />
          </div>
          <p class="small">编码在平台内唯一（重复后端返回 409）；编辑提交后后端自动升版本并写入版本快照。</p>
        </div>
        <div class="m-ft">
          <span class="btn" style="margin-right: auto" @click="initDialogVisible = false">取消</span>
          <span class="btn btn-p" @click="submitInitForm">
            {{ initSaving ? "提交中…" : editingInitId ? "保存" : "创建" }}
          </span>
        </div>
      </div>
    </div>

    <!-- ============ 版本记录（GET /init/:id/versions） ============ -->
    <div v-if="versionsVisible" class="ov" @click.self="versionsVisible = false">
      <div class="modal zx-scope">
        <div class="m-hd">
          <span class="pt">{{ versionsTitle }}</span>
          <span class="d-x" @click="versionsVisible = false">✕</span>
        </div>
        <div class="m-bd">
          <div v-if="versionsError" class="tipbar r">
            <span class="ic">!</span>
            <span>{{ versionsError }}</span>
          </div>
          <p v-else-if="versionsLoading" class="small">加载中…</p>
          <template v-else-if="versions.length">
            <div v-for="v in versions" :key="v.id" class="frow">
              <span class="fld"><span>版本</span><span>V{{ v.version }}</span></span>
              <span class="fld grow"><span>变更说明</span><span>{{ v.changeNote || "—" }}</span></span>
              <span class="fld"><span>操作人</span><span>{{ v.createdBy || "—" }}</span></span>
              <span class="fld"><span>时间</span><span>{{ v.createdAt }}</span></span>
            </div>
          </template>
          <p v-else class="small">暂无版本记录</p>
        </div>
        <div class="m-ft">
          <span class="btn" @click="versionsVisible = false">关闭</span>
        </div>
      </div>
    </div>

    <!-- ============ 上传公共打印模板（POST /print/upload） ============ -->
    <div v-if="printDialogVisible" class="ov" @click.self="printDialogVisible = false">
      <div class="modal zx-scope">
        <div class="m-hd">
          <span class="pt">上传打印模板</span>
          <span class="d-x" @click="printDialogVisible = false">✕</span>
        </div>
        <div class="m-bd">
          <div class="frow">
            <span class="fld grow">
              <span>模板名称 <i class="req">*</i></span>
              <input class="ipt" v-model="printForm.name" placeholder="如 销售单·标准版" />
            </span>
            <span class="fld grow">
              <span>单据类型 <i class="req">*</i></span>
              <select class="ipt" v-model="printForm.billType">
                <option v-for="o in billTypeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </span>
          </div>
          <div class="frow">
            <span class="fld grow">
              <span>纸张类型</span>
              <select class="ipt" v-model="printForm.paperType">
                <option v-for="o in paperTypeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </span>
            <span class="fld grow">
              <span>规格说明</span>
              <input class="ipt" v-model="printForm.spec" placeholder="如 80mm 热敏" />
            </span>
          </div>
          <div class="fld">
            <span>模板内容 <i class="req">*</i></span>
            <textarea
              class="ipt"
              rows="6"
              v-model="printForm.content"
              placeholder="粘贴模板 JSON / HTML 内容"
            ></textarea>
          </div>
          <p class="small">上传即落库为公共模板（后端置 is_public=1），租户侧可选用。</p>
        </div>
        <div class="m-ft">
          <span class="btn" style="margin-right: auto" @click="printDialogVisible = false">取消</span>
          <span class="btn btn-p" @click="submitPrintUpload">{{ printSaving ? "上传中…" : "上传" }}</span>
        </div>
      </div>
    </div>

    <!-- ============ 预览 / 变量说明 / 字段说明（本地展示接口真实字段） ============ -->
    <div v-if="infoVisible" class="ov" @click.self="infoVisible = false">
      <div class="modal zx-scope">
        <div class="m-hd">
          <span class="pt">{{ infoTitle }}</span>
          <span class="d-x" @click="infoVisible = false">✕</span>
        </div>
        <div class="m-bd">
          <pre v-if="infoLines.length" class="info-body">{{ infoLines.join("\n") }}</pre>
          <p v-else class="small">{{ infoEmpty || "暂无数据" }}</p>
        </div>
        <div class="m-ft">
          <span class="btn" @click="infoVisible = false">关闭</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  listInitTemplatesApi,
  createInitTemplateApi,
  updateInitTemplateApi,
  listInitTemplateVersionsApi,
  listPrintTemplatesApi,
  uploadPrintTemplateApi,
  setPrintTemplatePublicApi,
  listIoTemplatesApi,
  downloadIoTemplateApi,
} from "../../api/platform-template";
import type {
  InitTemplateItem,
  InitTemplateVersionItem,
  PrintTemplateItem,
  IoTemplateItem,
} from "../../api/platform-template";

/**
 * 模板中心接口全部接 C2-0 已合并后端（prefix /api/platform/templates，封装见 src/api/platform-template.ts）：
 *   GET    /platform/templates/init                        初始化模板列表（四段式摘要 + copyConfigs）
 *   POST   /platform/templates/init                        新建初始化模板（后端写 version=1 快照）
 *   PUT    /platform/templates/init/:id                    编辑模板（后端 version+1 + 版本快照）
 *   GET    /platform/templates/init/:id/versions            版本记录
 *   GET    /platform/templates/print?billType=              公共打印模板列表（空串 = 全部）
 *   POST   /platform/templates/print/upload                 上传公共打印模板
 *   POST   /platform/templates/print/:id/public              设为公共模板（幂等）
 *   GET    /platform/templates/import-export?direction=      导入 / 导出模板清单
 *   GET    /platform/templates/import-export/:id/download    模板文件下载（blob）
 * 口径：空态诚实——无数据一律渲染空态，不内置示例模板；未交付的能力（开户套用）不做假入口。
 */
const loadingInit = ref(false);
const loadingPrint = ref(false);
const loadingIo = ref(false);
const errorInit = ref("");
const errorPrint = ref("");
const errorIo = ref("");

const initTemplates = ref<InitTemplateItem[]>([]);
const printTemplates = ref<PrintTemplateItem[]>([]);
const ioTemplates = ref<IoTemplateItem[]>([]);

/* 公共打印模板单据类型筛选：空串 ⇒ 全部（后端口径：空串或 ALL 视为全部，其它非法值 400） */
const billTypeOptions = [
  { value: "SALE_RECEIPT", label: "收银小票" },
  { value: "SALE_BILL", label: "销售单" },
  { value: "SALE_RETURN", label: "销售退货单" },
  { value: "PURCHASE_ORDER", label: "采购单" },
  { value: "REPORT", label: "报表" },
  { value: "LABEL", label: "商品标签" },
  { value: "SHIFT", label: "交接班小票" },
  { value: "DAILY_SETTLE", label: "日结单" },
];
const paperTypeOptions = [
  { value: "RECEIPT_58", label: "热敏小票 58mm" },
  { value: "RECEIPT_80", label: "热敏小票 80mm" },
  { value: "RECEIPT_110", label: "热敏小票 110mm" },
  { value: "A4", label: "A4 纸" },
  { value: "DOT_1UP", label: "针式连续纸（一等分）" },
  { value: "DOT_2UP", label: "针式连续纸（二等分）" },
  { value: "DOT_3UP", label: "针式连续纸（三等分）" },
  { value: "LABEL_60X40", label: "标签纸 60x40mm" },
  { value: "LABEL_CUSTOM", label: "标签纸（自定义尺寸）" },
];
const printTypeOptions = [{ value: "", label: "全部" }, ...billTypeOptions];
const printType = ref("");

function billTypeLabel(value: string) {
  return billTypeOptions.find((o) => o.value === value)?.label || value || "—";
}
function paperTypeLabel(value: string) {
  return paperTypeOptions.find((o) => o.value === value)?.label || value || "—";
}

/** 开户套用向导选中的初始化模板（开户套用能力见 handleApplyOpenAccount 说明） */
const selectedTemplateId = ref<number | null>(null);
/** 「将复制的配置」：取接口返回的真实 copyConfigs（无则空态） */
const selectedCopyConfigs = computed(
  () => initTemplates.value.find((t) => t.id === selectedTemplateId.value)?.copyConfigs || []
);

/** 统一解包响应信封 { code, msg, data, traceId }（业务码非 0 已由请求层拦截并给中文提示） */
function unwrap(res: any) {
  return res?.data ?? res ?? {};
}

/* ---- 三个列表的真实数据源 ---- */
async function fetchInitTemplates() {
  loadingInit.value = true;
  errorInit.value = "";
  try {
    const data = unwrap(await listInitTemplatesApi());
    initTemplates.value = data.records || [];
    if (
      selectedTemplateId.value !== null &&
      !initTemplates.value.some((t) => t.id === selectedTemplateId.value)
    ) {
      selectedTemplateId.value = null;
    }
  } catch {
    errorInit.value = "初始化模板加载失败";
  } finally {
    loadingInit.value = false;
  }
}
async function fetchPrintTemplates() {
  loadingPrint.value = true;
  errorPrint.value = "";
  try {
    const data = unwrap(await listPrintTemplatesApi({ billType: printType.value }));
    printTemplates.value = data.records || [];
  } catch {
    errorPrint.value = "公共打印模板加载失败";
  } finally {
    loadingPrint.value = false;
  }
}
async function fetchIoTemplates() {
  loadingIo.value = true;
  errorIo.value = "";
  try {
    const data = unwrap(await listIoTemplatesApi());
    ioTemplates.value = data.records || [];
  } catch {
    errorIo.value = "导入 / 导出模板加载失败";
  } finally {
    loadingIo.value = false;
  }
}
/** 单据类型筛选切换：按真实端点重新取列表（空串 ⇒ 全部） */
function onPrintTypeChange() {
  fetchPrintTemplates();
}

/* ---- 初始化模板：新建 / 编辑（四段式配置） ---- */
const initDialogVisible = ref(false);
const initSaving = ref(false);
const editingInitId = ref<number | null>(null);
const initForm = reactive({
  code: "",
  name: "",
  applicable: "",
  codeRule: "",
  convertRule: "",
  printRef: "",
  defaultWhAccount: "",
  freeAvailable: false,
  recommended: false,
  changeNote: "",
  copyConfigsText: "",
});

/** 「将复制的配置」文本 ⇄ configJson.copyConfigs：每行一项，行尾 ✓ 或 (公共) 记为公共配置 */
function parseCopyConfigs(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const isPublic = /(?:✓|√)\s*$/.test(line) || /[（(]公共[)）]\s*$/.test(line);
      const label = line
        .replace(/(?:✓|√)\s*$/, "")
        .replace(/[（(]公共[)）]\s*$/, "")
        .trim();
      return { label, public: isPublic };
    })
    .filter((item) => item.label);
}

function openInitCreate() {
  editingInitId.value = null;
  Object.assign(initForm, {
    code: "",
    name: "",
    applicable: "",
    codeRule: "",
    convertRule: "",
    printRef: "",
    defaultWhAccount: "",
    freeAvailable: false,
    recommended: false,
    changeNote: "",
    copyConfigsText: "",
  });
  initDialogVisible.value = true;
}
function openInitEdit(t: InitTemplateItem) {
  editingInitId.value = t.id;
  Object.assign(initForm, {
    code: t.code,
    name: t.name,
    applicable: t.applicable || "",
    codeRule: t.codeRule || "",
    convertRule: t.convertRule || "",
    printRef: t.printRef || "",
    defaultWhAccount: t.defaultWhAccount || "",
    freeAvailable: t.freeAvailable,
    recommended: t.recommended,
    changeNote: "",
    copyConfigsText: t.copyConfigs.map((c) => `${c.label}${c.public ? " ✓" : ""}`).join("\n"),
  });
  initDialogVisible.value = true;
}
async function submitInitForm() {
  if (!initForm.code.trim()) {
    ElMessage.warning("请输入模板编码");
    return;
  }
  if (!initForm.name.trim()) {
    ElMessage.warning("请输入模板名称");
    return;
  }
  const payload = {
    code: initForm.code.trim(),
    name: initForm.name.trim(),
    applicable: initForm.applicable.trim(),
    codeRule: initForm.codeRule.trim(),
    convertRule: initForm.convertRule.trim(),
    printRef: initForm.printRef.trim(),
    defaultWhAccount: initForm.defaultWhAccount.trim(),
    freeAvailable: initForm.freeAvailable,
    recommended: initForm.recommended,
    configJson: { copyConfigs: parseCopyConfigs(initForm.copyConfigsText) },
    changeNote: initForm.changeNote.trim() || undefined,
  };
  initSaving.value = true;
  try {
    if (editingInitId.value !== null) {
      await updateInitTemplateApi(editingInitId.value, payload);
      ElMessage.success("模板已更新（版本 +1）");
    } else {
      await createInitTemplateApi(payload);
      ElMessage.success("模板已创建（V1）");
    }
    initDialogVisible.value = false;
    await fetchInitTemplates();
  } catch {
    /* 错误提示由请求层统一处理，此处只做内容态 */
  } finally {
    initSaving.value = false;
  }
}

/* ---- 初始化模板版本记录 ---- */
const versionsVisible = ref(false);
const versionsLoading = ref(false);
const versionsError = ref("");
const versions = ref<InitTemplateVersionItem[]>([]);
const versionsTitle = ref("");
async function openVersions(t: InitTemplateItem) {
  versionsVisible.value = true;
  versionsLoading.value = true;
  versionsError.value = "";
  versions.value = [];
  versionsTitle.value = `${t.name}（当前 V${t.version}）版本记录`;
  try {
    const data = unwrap(await listInitTemplateVersionsApi(t.id));
    versions.value = data.records || [];
  } catch {
    versionsError.value = "版本记录加载失败";
  } finally {
    versionsLoading.value = false;
  }
}

/* ---- 开户套用向导 ----
 * 「开户套用初始化模板」能力后端本批未交付（C2-0 裁定 §2.2 范围校准：转 S3-81），
 * 因此不给假入口：按钮置灰 + 一句说明，不写死数据、不伪造开户流程。 */
const APPLY_ACCOUNT_NOTICE = "开户套用初始化模板尚未开放：后端开户链路未提供套用入参（S3-81 规划中）";
function handleApplyOpenAccount() {
  ElMessage.warning(APPLY_ACCOUNT_NOTICE);
}
function handlePrevStep() {
  ElMessage.info("开户套用向导尚未开放（S3-81 规划中），当前没有可回退的步骤状态");
}
function handleSaveTenantOnly() {
  ElMessage.warning(APPLY_ACCOUNT_NOTICE);
}

/* ---- 公共打印模板：上传 / 设为公共 ---- */
const printDialogVisible = ref(false);
const printSaving = ref(false);
const printForm = reactive({
  name: "",
  billType: "SALE_BILL",
  paperType: "RECEIPT_80",
  spec: "",
  content: "",
});
function openPrintUpload() {
  Object.assign(printForm, {
    name: "",
    billType: "SALE_BILL",
    paperType: "RECEIPT_80",
    spec: "",
    content: "",
  });
  printDialogVisible.value = true;
}
async function submitPrintUpload() {
  if (!printForm.name.trim()) {
    ElMessage.warning("请输入模板名称");
    return;
  }
  if (!printForm.content.trim()) {
    ElMessage.warning("请输入模板内容");
    return;
  }
  printSaving.value = true;
  try {
    await uploadPrintTemplateApi({
      name: printForm.name.trim(),
      billType: printForm.billType,
      paperType: printForm.paperType,
      spec: printForm.spec.trim() || undefined,
      content: printForm.content,
    });
    ElMessage.success("打印模板已上传（公共）");
    printDialogVisible.value = false;
    await fetchPrintTemplates();
  } catch {
    /* 错误提示由请求层统一处理，此处只做内容态 */
  } finally {
    printSaving.value = false;
  }
}
async function handleSetPublic(p: PrintTemplateItem) {
  try {
    await ElMessageBox.confirm(`确认将「${p.name}」设为公共模板？`, "设为公共模板", { type: "warning" });
  } catch {
    return;
  }
  try {
    await setPrintTemplatePublicApi(p.id);
    ElMessage.success("已设为公共模板");
    await fetchPrintTemplates();
  } catch {
    /* 错误提示由请求层统一处理，此处只做内容态 */
  }
}

/* ---- 信息弹窗：预览 / 变量说明 / 字段说明（全部取接口真实字段，无数据即空态） ---- */
const infoVisible = ref(false);
const infoTitle = ref("");
const infoLines = ref<string[]>([]);
const infoEmpty = ref("");
function openInfo(title: string, lines: string[], empty: string) {
  infoTitle.value = title;
  infoLines.value = lines;
  infoEmpty.value = empty;
  infoVisible.value = true;
}
/** 打印模板预览：本地渲染后端返回的模板正文（服务端无预览端点） */
function handlePrintPreview(p: PrintTemplateItem) {
  openInfo(`预览：${p.name}`, p.content ? [p.content] : [], "该模板未上传内容");
}
/** 变量说明：从模板正文实时提取 {变量} 占位符（本地推导，不编造变量清单） */
function handleVarDesc(p: PrintTemplateItem) {
  const vars = Array.from(new Set((p.content || "").match(/\{[^{}\s]{1,40}\}/g) || []));
  openInfo(`变量说明：${p.name}`, vars, "该模板正文未使用 {变量} 占位符");
}
/** 初始化模板预览：展示接口返回的四段式配置与「将复制的配置」 */
function handleInitPreview(t: InitTemplateItem) {
  openInfo(
    `预览：${t.name}`,
    [
      `模板编码：${t.code}`,
      `适用范围：${t.applicable || "—"}`,
      `编号规则：${t.codeRule || "—"}`,
      `换算规则：${t.convertRule || "—"}`,
      `打印模板：${t.printRef || "—"}`,
      `默认仓库账户：${t.defaultWhAccount || "—"}`,
      `免费可用：${t.freeAvailable ? "是" : "否"} · 推荐：${t.recommended ? "是" : "否"}`,
      `将复制的配置：${
        t.copyConfigs.length
          ? t.copyConfigs.map((c) => `${c.label}${c.public ? "✓" : ""}`).join("、")
          : "—"
      }`,
    ],
    ""
  );
}
/** 卡片「预览」：按记录类型分派（打印模板 / 初始化模板） */
function handlePreview(row: PrintTemplateItem | InitTemplateItem) {
  if (row && "billType" in row) handlePrintPreview(row as PrintTemplateItem);
  else handleInitPreview(row as InitTemplateItem);
}

/* ---- 导入 / 导出模板：下载 / 字段说明 ---- */
async function handleDownload(io: IoTemplateItem) {
  try {
    const blob = (await downloadIoTemplateApi(io.id)) as unknown as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = io.fileName || `${io.name}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    /* 模板无文件内容时后端返回 404，请求层已给中文提示 */
  }
}
/** 字段说明：取接口返回的 fieldDesc（未维护时如实空态，不编造字段清单） */
function handleFieldDesc(io: IoTemplateItem) {
  const lines = (io.fieldDesc || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  openInfo(`字段说明：${io.name}`, lines, "该模板未维护字段说明");
}

onMounted(() => {
  fetchInitTemplates();
  fetchPrintTemplates();
  fetchIoTemplates();
});
</script>

<style scoped>
/* 以下仅补充 components.css 未覆盖的局部结构，色值/尺寸一律引用 tokens.css */
.req {
  color: var(--color-danger);
  font-style: normal;
}

/* 新建初始化模板虚线卡（设计稿 border-style:dashed） */
.plan-new {
  border-style: dashed;
}
/* 缺少 token：虚线卡最小高度 150px（设计稿行 1436） */
.plan-new .p-bd {
  display: grid;
  place-items: center;
  text-align: center;
  min-height: var(--tpl-card-min-h);
}
.tpl-new-plus {
  font-size: var(--text-2xl);
  color: var(--color-primary);
}
.tpl-new-t {
  font-size: var(--text-sm);
  display: block;
  margin-top: var(--space-1);
}

/* 向导底部操作条（设计稿 .m-ft，components.css 未提供） */
.m-ft {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  align-items: center;
  padding: var(--space-2) 0 var(--space-1);
}

/* 表单栅格列宽（flex-grow 数值，非颜色/字号/间距字面量） */
.fld-grow-12 {
  flex: 1.2;
}
.fld-grow-16 {
  flex: 1.6;
}
.fld-grow-1 {
  flex: 1;
}

/* 初始化模板选择按钮组 */
.tpl-pick {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}
.empty-inline {
  font-size: var(--text-xs);
  color: var(--g4);
}

/* 将复制的配置提示条（设计稿蓝底蓝边圆角盒） */
.copy-box {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  align-items: center;
  background: var(--color-primary-bg);
  border: 1px solid var(--color-primary-soft);
  border-radius: var(--radius-lg);
  padding: var(--space-2) var(--space-3);
}
.copy-label {
  font-size: var(--text-xs);
  color: var(--color-primary-hover);
  font-weight: var(--font-semibold);
  flex: none;
}

/* 公共打印模板卡片（嵌套 panel，去投影） */
.tpl-card {
  box-shadow: none;
  padding: var(--space-1);
}
/* 缺少 token：缩略图最小高度 88px（设计稿行 1467~1472） */
.tpl-thumb {
  min-height: var(--tpl-thumb-min-h);
  border: 1px solid var(--g2);
  border-radius: var(--radius-md);
  background: var(--g0);
  padding: var(--space-1);
}
.tpl-card-hd {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.tpl-name {
  font-size: var(--text-xs);
}
.tpl-card .pft {
  margin-top: var(--space-1);
}

/* 弹窗外壳（与全站弹窗同款：tokens 取值，禁止字面量） */
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

/* 预览 / 变量说明 / 字段说明正文（保留换行的纯文本展示） */
.info-body {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--g6);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}
</style>
