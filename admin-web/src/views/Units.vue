<template>
  <div class="page">
    <PageCard title="单位组管理">
      <template #extra>
        <el-button type="primary" @click="openCreateDialog">新增单位组</el-button>
        <el-button @click="loadGroups">刷新</el-button>
      </template>

      <el-empty v-if="!loading && groups.length === 0" description="暂无单位组，点击上方按钮创建" :image-size="80" />

      <div v-for="group in groups" :key="group.id" class="unit-group-card">
        <div class="group-header">
          <div class="group-title">
            <span class="group-name">{{ group.name }}</span>
            <el-tag :type="group.status === 1 ? 'success' : 'info'" size="small">
              {{ group.status === 1 ? '启用' : '停用' }}
            </el-tag>
          </div>
          <div class="group-actions">
            <el-button size="small" link type="primary" @click="openEditDialog(group)">编辑</el-button>
            <el-popconfirm title="确定删除该单位组？" @confirm="deleteGroup(group.id)">
              <template #reference><el-button size="small" link type="danger">删除</el-button></template>
            </el-popconfirm>
          </div>
        </div>

        <div class="unit-chain" v-if="group.items && group.items.length > 0">
          <div class="chain-items">
            <template v-for="(item, idx) in group.items" :key="item.id || idx">
              <div class="unit-node" :class="{ 'is-disabled': item.status === 0 }">
                <div class="unit-level-label">L{{ item.level }}</div>
                <div class="unit-name">{{ item.name }}</div>
                <el-switch
                  :model-value="item.status === 1"
                  size="small"
                  @change="(val: boolean) => toggleItemStatus(group, item, val)"
                />
              </div>
              <div class="unit-arrow" v-if="idx < group.items.length - 1">
                <span class="arrow-rate">×{{ item.conversionRate || 1 }}</span>
                <span class="arrow-icon">→</span>
              </div>
            </template>
          </div>
        </div>
        <div class="unit-chain-empty" v-else>
          <span style="color: #999; font-size: 13px;">暂无层级单位，点击编辑添加</span>
        </div>
      </div>
    </PageCard>

    <!-- 新增/编辑单位组弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingGroup ? '编辑单位组' : '新增单位组'"
      width="680px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" label-width="80px">
        <el-form-item label="组名称" prop="name" :rules="[{ required: true, message: '请输入单位组名称' }]">
          <el-input v-model="form.name" placeholder="例如：酒类通用单位组" />
        </el-form-item>

        <el-form-item label="单位层级">
          <div class="item-list">
            <div v-for="(item, idx) in form.items" :key="idx" class="item-row">
              <span class="item-level">L{{ idx }}</span>
              <el-input v-model="item.name" placeholder="单位名称" style="width: 100px" />
              <span class="sep" v-if="idx > 0">1{{ form.items[idx - 1].name || '上级' }} =</span>
              <el-input-number
                v-if="idx > 0"
                v-model="item.conversionRate"
                :min="1"
                :max="99999"
                :precision="0"
                style="width: 110px"
                placeholder="换算率"
              />
              <span class="sep" v-if="idx > 0">{{ item.name || '本级' }}</span>
              <el-switch v-model="item.status" :active-value="1" :inactive-value="0" size="small" />
              <el-button size="small" link type="danger" @click="removeItem(idx)" :disabled="form.items.length <= 1">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
          <el-button size="small" type="primary" plain @click="addItem" style="margin-top: 8px" :disabled="form.items.length >= 5">
            + 添加层级 ({{ form.items.length }}/5)
          </el-button>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { Delete } from "@element-plus/icons-vue";
import PageCard from "../components/PageCard.vue";
import { api } from "../api";

interface UnitItem {
  id?: number; name: string; level: number; conversionRate: number; status: number;
}
interface UnitGroup {
  id: number; name: string; status: number; items: UnitItem[];
}

const groups = ref<UnitGroup[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editingGroup = ref<UnitGroup | null>(null);
const formRef = ref();
const submitLoading = ref(false);

const form = reactive({
  name: "",
  items: [{ name: "", level: 0, conversionRate: 1, status: 1 }] as UnitItem[],
});

async function loadGroups() {
  loading.value = true;
  try {
    const { data } = await api.get("/admin/unit-groups");
    groups.value = (data.data || []) as UnitGroup[];
  } catch { ElMessage.error("加载单位组失败"); }
  finally { loading.value = false; }
}

function resetForm() {
  form.name = "";
  form.items = [{ name: "", level: 0, conversionRate: 1, status: 1 }];
}

function openCreateDialog() {
  editingGroup.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEditDialog(group: UnitGroup) {
  editingGroup.value = group;
  form.name = group.name;
  form.items = group.items.map((it, idx) => ({
    id: it.id,
    name: it.name,
    level: idx,
    conversionRate: it.conversionRate || 1,
    status: it.status,
  }));
  dialogVisible.value = true;
}

function addItem() {
  if (form.items.length >= 5) return;
  const idx = form.items.length;
  form.items.push({ name: "", level: idx, conversionRate: 1, status: 1 });
}

function removeItem(idx: number) {
  if (form.items.length <= 1) return;
  form.items.splice(idx, 1);
  // 重新编号 level
  form.items.forEach((it, i) => { it.level = i; });
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  // 校验单位名称
  for (const it of form.items) {
    if (!it.name.trim()) { ElMessage.warning("请填写所有单位名称"); return; }
  }

  submitLoading.value = true;
  try {
    const payload = {
      name: form.name,
      items: form.items.map((it, idx) => ({
        name: it.name.trim(),
        level: idx,
        conversionRate: it.conversionRate || 1,
        status: it.status,
      })),
    };

    if (editingGroup.value) {
      await api.put(`/admin/unit-groups/${editingGroup.value.id}`, payload);
      ElMessage.success("单位组更新成功");
    } else {
      await api.post("/admin/unit-groups", payload);
      ElMessage.success("单位组创建成功");
    }
    dialogVisible.value = false;
    await loadGroups();
  } catch { ElMessage.error("操作失败"); }
  finally { submitLoading.value = false; }
}

async function deleteGroup(id: number) {
  try { await api.delete(`/admin/unit-groups/${id}`); ElMessage.success("删除成功"); await loadGroups(); }
  catch { ElMessage.error("删除失败"); }
}

async function toggleItemStatus(group: UnitGroup, item: UnitItem, enabled: boolean) {
  const newItems = group.items.map(it => {
    if (it.id === item.id || it.name === item.name) {
      return { ...it, status: enabled ? 1 : 0 };
    }
    return it;
  });
  try {
    await api.put(`/admin/unit-groups/${group.id}`, { items: newItems.map(it => ({
      name: it.name, level: it.level, conversionRate: it.conversionRate, status: it.status,
    })) });
    item.status = enabled ? 1 : 0;
    ElMessage.success(enabled ? "已启用" : "已停用");
  } catch { ElMessage.error("操作失败"); }
}

onMounted(() => { loadGroups(); });
</script>

<style scoped>
.unit-group-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 16px;
  background: #fff;
}
.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.group-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.group-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.group-actions {
  display: flex;
  gap: 4px;
}
.unit-chain {
  background: #f5f7fa;
  border-radius: 6px;
  padding: 12px 16px;
}
.chain-items {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0;
}
.unit-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  min-width: 72px;
}
.unit-node.is-disabled {
  opacity: 0.5;
  background: #f0f0f0;
}
.unit-level-label {
  font-size: 11px;
  color: #909399;
  font-weight: 500;
}
.unit-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.unit-arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 10px;
  min-width: 60px;
}
.arrow-rate {
  font-size: 12px;
  color: #409eff;
  font-weight: 600;
}
.arrow-icon {
  font-size: 18px;
  color: #c0c4cc;
  line-height: 1;
}
.unit-chain-empty {
  text-align: center;
  padding: 20px;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.item-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.item-level {
  font-size: 12px;
  color: #909399;
  font-weight: 600;
  min-width: 28px;
}
.sep {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
}
</style>