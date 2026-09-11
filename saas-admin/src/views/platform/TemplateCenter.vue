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
        <span class="btn" @click="handleApplyOpenAccount">套用开户</span>
        <span class="btn btn-p" @click="handleNewInitTemplate">+ 新建初始化模板</span>
      </div>
    </div>

    <!-- ============ 初始化模板（套餐卡 g4） ============ -->
    <div class="g4">
      <div
        v-for="t in initTemplates"
        :key="t.id"
        class="plan"
        :class="{ hot: t.recommended }"
      >
        <div class="ph">
          <span class="pn">{{ t.name }}</span>
          <span class="tag" :class="t.tagClass || 'tag-b'">{{ t.tagText || '推荐' }}</span>
        </div>
        <div class="pnum mt8">{{ t.applicable }}</div>
        <div class="pnum">{{ t.codeRule }}</div>
        <div class="pnum">{{ t.convert }}</div>
        <div class="pnum">
          被引用租户 <b>{{ t.refCount }}</b> · V{{ t.version }} · 更新 {{ t.updatedAt }}
        </div>
        <div class="pft">
          <span class="btn-t" @click="handleEdit(t)">编辑</span>
          <span class="btn-t" @click="handlePreview(t)">预览</span>
          <span class="btn-t" @click="handleVersionLog(t)">版本记录</span>
          <span class="btn-t" @click="handleApplyOpenAccount">套用开户</span>
        </div>
      </div>

      <!-- 新建初始化模板（结构化的四段式配置 CTA，非数据） -->
      <div class="plan plan-new">
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
    <div v-if="!initTemplates.length" class="empty">
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
          <span class="btn" @click="handlePrevStep">上一步</span>
          <span class="btn" style="margin-right: auto" @click="handleSaveTenantOnly">仅保存租户</span>
          <span class="btn btn-p" @click="handleApplyOpenAccount">创建租户并套用模板</span>
        </div>
      </div>
    </div>

    <!-- ============ 公共打印模板 ============ -->
    <div class="panel mt12">
      <div class="p-hd">
        <span class="pt">公共打印模板</span>
        <div class="frow">
          <span class="sel">单据类型：{{ printType }}</span>
          <span class="btn btn-s" @click="handleUploadPrint">+ 上传模板</span>
        </div>
      </div>
      <div class="p-bd" style="padding-top: var(--space-2)">
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
            <p class="small">{{ p.spec }}</p>
            <div class="pft">
              <span class="btn-t" @click="handlePreview(p)">预览</span>
              <span class="btn-t" @click="handleVarDesc(p)">变量说明</span>
              <span v-if="!p.public" class="btn-t warn" @click="handleSetPublic(p)">设为公共模板</span>
            </div>
          </div>
        </div>
        <div v-if="!printTemplates.length" class="empty">暂无公共打印模板</div>
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
              <td>{{ io.compat }}</td>
              <td>
                <span class="btn-t" @click="handleDownload(io)">下载</span>
                <span class="btn-t" @click="handleFieldDesc(io)">字段说明</span>
              </td>
            </tr>
            <tr v-if="!ioTemplates.length">
              <td colspan="7" class="empty">暂无导入 / 导出模板</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="small mt8">
        导出侧说明：导出模板由平台统一维护列结构与字段口径（清单 4.3），租户侧导出仅能套用本表模板；含敏感字段的导出需二次审批并记录至日志中心。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";

/**
 * 模板中心数据均为空态。
 * src/api 目前未提供任何模板相关接口，故以下数据以空数组渲染空态并保留完整结构。
 *
 * TODO: 待接入以下建议接口（不要修改 api.ts / tokens.css / components.css / router）：
 *   GET  /platform/templates/init            初始化模板列表（含 applicable/codeRule/convert/refCount/version/recommended）
 *   POST /platform/templates/init            新建初始化模板（编号规则 / 换算规则 / 打印模板 / 默认仓库账户，四段式）
 *   GET  /platform/templates/print?type=     公共打印模板（按单据类型筛选，含 name/public/spec）
 *   POST /platform/templates/print/upload     上传打印模板
 *   GET  /platform/templates/import-export    导入 / 导出模板（含 direction/version/fieldCount/compat）
 *   开户套用：复用 src/api.ts 的 createTenant，需补充 templateCode 字段后提交
 */
const loadingInit = ref(false);
const loadingPrint = ref(false);
const loadingIo = ref(false);

const initTemplates = ref<any[]>([]);
const printTemplates = ref<any[]>([]);
const ioTemplates = ref<any[]>([]);

const printType = ref("全部");
const selectedTemplateId = ref<number | null>(null);

/** 选中模板后展示的「将复制的配置」项（由接口返回，当前空） */
const selectedCopyConfigs = ref<{ label: string; public: boolean }[]>([]);

function fetchTemplates() {
  // TODO: 待接入 GET /platform/templates/* 接口；当前仅清空 loading，渲染空态
  loadingInit.value = true;
  loadingPrint.value = true;
  loadingIo.value = true;
  Promise.resolve().finally(() => {
    loadingInit.value = false;
    loadingPrint.value = false;
    loadingIo.value = false;
  });
}

/* ---- 初始化模板卡片操作 ---- */
function handleNewInitTemplate() {
  // TODO: 待接入 POST /platform/templates/init（打开四段式配置弹窗）
  ElMessage.info("新建初始化模板：待接入模板配置弹窗");
}
function handleEdit(t: any) {
  ElMessage.info("编辑模板：待接入");
}
function handleVersionLog(t: any) {
  ElMessage.info("版本记录：待接入");
}

/* ---- 开户套用向导 ---- */
function handleApplyOpenAccount() {
  // TODO: 开户套用复用 src/api.ts 的 createTenant，需补齐 templateCode / templateVersion
  ElMessage.info("套用开户：待接入开户套用接口（复用 createTenant）");
}
function handlePrevStep() {
  ElMessage.info("上一步：待接入向导状态");
}
function handleSaveTenantOnly() {
  // TODO: 仅保存租户复用 createTenant（不含 templateCode）
  ElMessage.info("仅保存租户：待接入开户接口");
}

/* ---- 公共打印模板 ---- */
function handleUploadPrint() {
  // TODO: 待接入 POST /platform/templates/print/upload
  ElMessage.info("上传打印模板：待接入上传接口");
}
function handlePreview(row?: any) {
  ElMessage.info("预览：待接入模板预览");
}
function handleVarDesc(row?: any) {
  ElMessage.info("变量说明：待接入");
}
function handleSetPublic(row?: any) {
  // TODO: 待接入「设为公共模板」接口
  ElMessage.info("设为公共模板：待接入");
}

/* ---- 导入 / 导出模板 ---- */
function handleDownload(row?: any) {
  // TODO: 待接入模板文件下载
  ElMessage.info("下载：待接入模板下载");
}
function handleFieldDesc(row?: any) {
  ElMessage.info("字段说明：待接入");
}

onMounted(fetchTemplates);
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
</style>
