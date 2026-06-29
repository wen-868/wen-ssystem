<template>
  <div class="page">
    <PageCard title="标签分组管理">
      <template #extra>
        <el-button type="primary" @click="openTagGroupDialog()">新增标签分组</el-button>
        <el-button @click="loadData">刷新</el-button>
      </template>

      <el-tabs v-model="activeTab" @tab-change="onTabChange">
        <el-tab-pane v-for="group in tagGroups" :key="group.value" :label="group.label" :name="group.value">
          <div class="group-header">
            <span class="group-desc">共 {{ groupTags.length }} 个标签</span>
            <el-button type="primary" size="small" @click="openTagDialog()">新增标签</el-button>
          </div>
          <el-table :data="groupTags" v-loading="tagLoading" stripe>
            <el-table-column prop="name" label="标签名称" min-width="160" />
            <el-table-column prop="sortNo" label="排序" width="80" align="center" />
            <el-table-column prop="status" label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'info'">
                  {{ row.status === 'active' ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="160">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="140" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openTagDialog(row)">编辑</el-button>
                <el-popconfirm title="确定删除？" @confirm="deleteTagItem(row.id)">
                  <template #reference>
                    <el-button size="small" link type="danger">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </PageCard>

    <!-- 标签弹窗 -->
    <el-dialog v-model="tagDialogVisible" :title="editingTag ? '编辑标签' : '新增标签'" width="450px">
      <el-form ref="tagFormRef" :model="tagForm" label-width="80px">
        <el-form-item label="标签名称" prop="name">
          <el-input v-model="tagForm.name" placeholder="请输入标签名称" />
        </el-form-item>
        <el-form-item label="标签类型" prop="tagType">
          <el-select v-model="tagForm.tagType" :disabled="!!editingTag" style="width: 100%">
            <el-option v-for="g in tagGroups" :key="g.value" :label="g.label" :value="g.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="tagForm.sortNo" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="tagForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tagDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="tagSubmitLoading" @click="handleTagSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 标签分组弹窗（管理 tag_type 元数据） -->
    <el-dialog v-model="groupDialogVisible" :title="editingGroup ? '编辑分组' : '新增标签分组'" width="420px">
      <el-form ref="groupFormRef" :model="groupForm" label-width="80px">
        <el-form-item label="分组标识" prop="value">
          <el-input v-model="groupForm.value" placeholder="如: aroma" :disabled="!!editingGroup" />
        </el-form-item>
        <el-form-item label="分组名称" prop="label">
          <el-input v-model="groupForm.label" placeholder="如: 香型" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="groupDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="groupSubmitLoading" @click="handleGroupSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import PageCard from "../components/PageCard.vue";
import { formatDate } from "../utils/format";
import { api } from "../api";

const activeTab = ref("");
const tagLoading = ref(false);
const tagSubmitLoading = ref(false);
const groupSubmitLoading = ref(false);
const tagDialogVisible = ref(false);
const groupDialogVisible = ref(false);
const editingTag = ref<any>(null);
const editingGroup = ref<any>(null);
const allTags = ref<any[]>([]);

const TAG_TYPE_LABELS: Record<string, string> = {
  aroma: "香型", alcohol_level: "度数段", region: "产区", scene: "场景", vintage: "年份"
};

const tagGroups = ref<{ value: string; label: string }[]>([
  { value: "aroma", label: "香型" },
  { value: "alcohol_level", label: "度数段" },
  { value: "region", label: "产区" },
  { value: "scene", label: "场景" },
  { value: "vintage", label: "年份" }
]);

const tagForm = reactive({ name: "", tagType: "", sortNo: 0, remark: "" });
const groupForm = reactive({ value: "", label: "" });

const groupTags = ref<any[]>([]);

async function loadData() {
  tagLoading.value = true;
  try {
    const { data } = await api.get("/admin/product-tags", { params: { pageSize: 999 } });
    allTags.value = (data.data?.records || data.data || []);
    if (!activeTab.value && tagGroups.value.length > 0) {
      activeTab.value = tagGroups.value[0].value;
    }
    filterTags();
  } catch {
    ElMessage.error("加载标签失败");
  } finally {
    tagLoading.value = false;
  }
}

function filterTags() {
  groupTags.value = allTags.value.filter((t: any) => t.tagType === activeTab.value);
}

function onTabChange() { filterTags(); }

function openTagDialog(row?: any) {
  editingTag.value = row || null;
  if (row) {
    tagForm.name = row.name;
    tagForm.tagType = row.tagType;
    tagForm.sortNo = row.sortNo || 0;
    tagForm.remark = row.remark || "";
  } else {
    tagForm.name = "";
    tagForm.tagType = activeTab.value;
    tagForm.sortNo = 0;
    tagForm.remark = "";
  }
  tagDialogVisible.value = true;
}

async function handleTagSubmit() {
  if (!tagForm.name || !tagForm.tagType) {
    ElMessage.warning("标签名称和类型不能为空");
    return;
  }
  tagSubmitLoading.value = true;
  try {
    if (editingTag.value) {
      await api.put(`/admin/product-tags/${editingTag.value.id}`, {
        name: tagForm.name, tagType: tagForm.tagType, sortNo: tagForm.sortNo, remark: tagForm.remark
      });
      ElMessage.success("更新成功");
    } else {
      await api.post("/admin/product-tags", {
        name: tagForm.name, tagType: tagForm.tagType, sortNo: tagForm.sortNo, remark: tagForm.remark
      });
      ElMessage.success("创建成功");
    }
    tagDialogVisible.value = false;
    loadData();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "保存失败");
  } finally {
    tagSubmitLoading.value = false;
  }
}

async function deleteTagItem(id: number) {
  try {
    await api.delete(`/admin/product-tags/${id}`);
    ElMessage.success("删除成功");
    loadData();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "删除失败");
  }
}

function openTagGroupDialog(row?: any) {
  editingGroup.value = row || null;
  if (row) {
    groupForm.value = row.value;
    groupForm.label = row.label;
  } else {
    groupForm.value = "";
    groupForm.label = "";
  }
  groupDialogVisible.value = true;
}

async function handleGroupSubmit() {
  if (!groupForm.value || !groupForm.label) {
    ElMessage.warning("分组标识和名称不能为空");
    return;
  }
  groupSubmitLoading.value = true;
  try {
    if (editingGroup.value) {
      const idx = tagGroups.value.findIndex(g => g.value === editingGroup.value.value);
      if (idx >= 0) {
        tagGroups.value[idx] = { ...groupForm };
      }
    } else {
      tagGroups.value.push({ ...groupForm });
    }
    ElMessage.success("保存成功");
    groupDialogVisible.value = false;
  } finally {
    groupSubmitLoading.value = false;
  }
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.group-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.group-desc { color: #909399; font-size: 13px; }
</style>