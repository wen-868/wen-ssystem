<template>
  <div>
    <el-card style="margin-bottom: 16px;">
      <div class="page-title">
        <div>
          <h2 style="margin: 0; font-size: 18px;">AI 认知层管理</h2>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            长期记忆（档案/情节/归档）、自主学习回流、自主进化（门控审核）
          </div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <el-input v-model="tenantId" placeholder="租户 ID" style="width: 160px;" size="default" />
          <el-button type="primary" :loading="loading" @click="loadAll">加载</el-button>
          <el-button type="success" @click="dialogVisible = true">提出进化提案</el-button>
        </div>
      </div>
    </el-card>

    <el-card v-loading="loading">
      <el-tabs v-model="activeTab">
        <!-- 长期记忆 -->
        <el-tab-pane label="长期记忆" name="ltm">
          <el-row :gutter="12" style="margin-bottom: 12px;">
            <el-col :span="8">
              <el-statistic title="档案" :value="ltm.counts.profiles" />
            </el-col>
            <el-col :span="8">
              <el-statistic title="情节经验" :value="ltm.counts.episodes" />
            </el-col>
            <el-col :span="8">
              <el-statistic title="知识归档" :value="ltm.counts.archivals" />
            </el-col>
          </el-row>
          <h4>档案（稳定事实/偏好）</h4>
          <el-table :data="ltm.profiles" border stripe size="small">
            <el-table-column prop="k" label="键" min-width="160" />
            <el-table-column label="值" min-width="220">
              <template #default="{ row }">{{ JSON.stringify(row.v) }}</template>
            </el-table-column>
          </el-table>
          <h4>情节经验</h4>
          <el-table :data="ltm.episodes" border stripe size="small">
            <el-table-column prop="summary" label="摘要" min-width="260" show-overflow-tooltip />
            <el-table-column label="结果" width="90">
              <template #default="{ row }">
                <el-tag :type="row.outcome === 'good' ? 'success' : 'danger'" size="small">
                  {{ row.outcome === "good" ? "成功" : "失败" }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="时间" width="170" />
          </el-table>
          <h4>知识归档</h4>
          <el-table :data="ltm.archivals" border stripe size="small">
            <el-table-column prop="title" label="标题" min-width="200" />
            <el-table-column prop="source" label="来源" width="120" />
            <el-table-column prop="createdAt" label="时间" width="170" />
          </el-table>
        </el-tab-pane>

        <!-- 学习记录 -->
        <el-tab-pane label="学习记录" name="learning">
          <h4>回流提示</h4>
          <el-table :data="hintRows" border stripe size="small">
            <el-table-column prop="kind" label="类型" width="120" />
            <el-table-column prop="content" label="提示" min-width="300" />
          </el-table>
          <h4 style="margin-top: 16px;">采纳评估记录</h4>
          <el-table :data="learningLogs" border stripe size="small">
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column prop="hintKey" label="提示键" width="140" />
            <el-table-column label="效果" width="100">
              <template #default="{ row }">
                <el-tag :type="row.effect === 'positive' ? 'success' : 'info'" size="small">
                  {{ row.effect }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="note" label="备注" min-width="200" show-overflow-tooltip />
            <el-table-column prop="appliedAt" label="时间" width="170" />
          </el-table>
        </el-tab-pane>

        <!-- 进化版本 -->
        <el-tab-pane label="进化版本（门控）" name="evolution">
          <el-table :data="evolutions" border stripe size="small">
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column prop="target" label="对象" width="100" />
            <el-table-column prop="version" label="版本" width="70" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="rationale" label="依据" min-width="180" show-overflow-tooltip />
            <el-table-column prop="grayPercent" label="灰度%" width="80" />
            <el-table-column prop="proposedBy" label="提出人" width="100" />
            <el-table-column label="操作" width="260" fixed="right">
              <template #default="{ row }">
                <el-button v-if="row.status === 'proposed'" size="small" type="primary" text @click="handleApprove(row)">批准</el-button>
                <el-button v-if="row.status === 'proposed'" size="small" type="danger" text @click="handleReject(row)">驳回</el-button>
                <el-button v-if="row.status === 'gray'" size="small" type="success" text @click="handleRollout(row)">生效</el-button>
                <el-button v-if="row.status === 'rolled_out'" size="small" type="warning" text @click="handleRollback(row)">回滚</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 进化提案对话框 -->
    <el-dialog v-model="dialogVisible" title="提出进化提案" width="560px">
      <el-form :model="proposal" label-width="100px">
        <el-form-item label="目标">
          <el-select v-model="proposal.target" style="width: 100%;">
            <el-option label="Prompt（租户系统提示词）" value="prompt" />
            <el-option label="新工具（newtool，包装既有 API）" value="newtool" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="proposal.proposed" type="textarea" :rows="6"
            :placeholder="proposal.target === 'newtool' ? 'ApiRouteDef JSON（path 须 /api/ 开头，risk 不得为 low）' : '新的系统提示词文本'" />
        </el-form-item>
        <el-form-item label="依据">
          <el-input v-model="proposal.rationale" placeholder="如：该租户反馈/学习经验（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="proposing" @click="handlePropose">提交（进入审核）</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  getLtmOverview,
  getLearningLogs,
  getLearningHints,
  getEvolutionList,
  proposeEvolution,
  approveEvolution,
  rejectEvolution,
  rolloutEvolution,
  rollbackEvolution,
  type LtmOverview,
  type LearningLogItem,
  type LearningHints,
  type EvolutionItem,
} from "../../api/ai-config";

const tenantId = ref("default");
const loading = ref(false);
const activeTab = ref("ltm");
const ltm = reactive<LtmOverview>({
  tenantId: "default",
  profiles: [],
  episodes: [],
  archivals: [],
  counts: { profiles: 0, episodes: 0, archivals: 0 },
});
const learningLogs = ref<LearningLogItem[]>([]);
const hints = ref<LearningHints>({ toolSelect: [], routing: [] });
const evolutions = ref<EvolutionItem[]>([]);
const dialogVisible = ref(false);
const proposing = ref(false);
const proposal = reactive<{ target: string; proposed: string; rationale: string }>({
  target: "prompt",
  proposed: "",
  rationale: "",
});

const hintRows = computed(() => [
  ...hints.value.toolSelect.map((h) => ({ kind: "工具选择", content: `${h.tool}：${h.note}` })),
  ...hints.value.routing.map((h) => ({ kind: "路由", content: h.note })),
]);

async function loadAll() {
  loading.value = true;
  try {
    const tid = tenantId.value || "default";
    const [ltmData, logs, hintData, evos] = await Promise.all([
      getLtmOverview(tid),
      getLearningLogs(tid, 50),
      getLearningHints(tid),
      getEvolutionList(tid),
    ]);
    Object.assign(ltm, ltmData);
    learningLogs.value = logs;
    hints.value = hintData;
    evolutions.value = evos;
  } catch {
    // 错误提示已由请求拦截器统一处理
  } finally {
    loading.value = false;
  }
}

async function handlePropose() {
  if (!proposal.proposed.trim()) {
    ElMessage.warning("请填写进化内容");
    return;
  }
  proposing.value = true;
  try {
    await proposeEvolution({
      tenantId: tenantId.value || "default",
      target: proposal.target,
      proposed: proposal.proposed,
      rationale: proposal.rationale || undefined,
    });
    ElMessage.success("提案已提交，进入人工审核");
    dialogVisible.value = false;
    proposal.proposed = "";
    proposal.rationale = "";
    await loadAll();
  } catch {
    // 错误提示已由请求拦截器统一处理
  } finally {
    proposing.value = false;
  }
}

async function handleApprove(row: EvolutionItem) {
  await approveEvolution(row.id);
  ElMessage.success(`提案 #${row.id} 已批准（灰度）`);
  await loadAll();
}

async function handleReject(row: EvolutionItem) {
  try {
    const { value } = await ElMessageBox.prompt("驳回原因", "驳回进化提案", {
      confirmButtonText: "驳回",
      cancelButtonText: "取消",
      inputPlaceholder: "请输入驳回原因",
    });
    await rejectEvolution(row.id, value);
    ElMessage.info(`提案 #${row.id} 已驳回`);
    await loadAll();
  } catch {
    // 用户取消
  }
}

async function handleRollout(row: EvolutionItem) {
  await rolloutEvolution(row.id);
  ElMessage.success(`提案 #${row.id} 已正式生效`);
  await loadAll();
}

async function handleRollback(row: EvolutionItem) {
  try {
    await ElMessageBox.confirm(`确认回滚进化 #${row.id}？将还原到版本快照`, "回滚确认", {
      type: "warning",
    });
  } catch {
    return;
  }
  await rollbackEvolution(row.id);
  ElMessage.info(`进化 #${row.id} 已回滚`);
  await loadAll();
}

function statusType(status: string): "primary" | "success" | "warning" | "danger" | "info" {
  if (status === "rolled_out") return "success";
  if (status === "gray") return "warning";
  if (status === "rejected" || status === "rolled_back") return "danger";
  return "info";
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    proposed: "待审核",
    gray: "灰度中",
    rolled_out: "已生效",
    rejected: "已驳回",
    rolled_back: "已回滚",
  };
  return map[status] || status;
}

loadAll();
</script>

<style scoped>
.page-title {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
</style>
