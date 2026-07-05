<template>
  <div class="page">
    <PageCard title="标签分组管理">
      <template #extra>
        <el-button type="primary" @click="openGroupDialog()">新增分组</el-button>
        <el-button @click="loadAll">刷新</el-button>
      </template>

      <el-tabs v-model="activeTab" @tab-change="onTabChange" type="card" closable @tab-remove="handleTabRemove">
        <el-tab-pane v-for="g in tagGroups" :key="g.groupCode" :label="g.groupName" :name="g.groupCode" :closable="false">
          <div class="group-meta">
            <span class="meta-desc">{{ g.description || '暂无描述' }}</span>
            <div class="meta-actions">
              <el-button size="small" @click="openGroupDialog(g)">编辑分组</el-button>
              <el-button size="small" type="primary" @click="openTagDialog()">新增标签</el-button>
            </div>
          </div>
          <el-table :data="groupTags" v-loading="tagLoading" stripe>
            <el-table-column type="index" label="#" width="60" align="center" />
            <el-table-column prop="name" label="标签名称" min-width="160" />
            <el-table-column prop="sortNo" label="排序" width="80" align="center" />
            <el-table-column prop="status" label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'info'">
                  {{ row.status === 'active' ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
            <el-table-column prop="createdAt" label="创建时间" width="160">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openTagDialog(row)">编辑</el-button>
                <el-button size="small" link type="success" @click="toggleTagStatus(row)">
                  {{ row.status === 'active' ? '停用' : '启用' }}
                </el-button>
                <el-popconfirm title="确定删除？" @confirm="deleteTagItem(row.id)">
                  <template #reference>
                    <el-button size="small" link type="danger">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            class="pagination"
            v-model:current-page="tagPage"
            v-model:page-size="tagPageSize"
            :total="tagTotal"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="loadTags"
            @current-change="loadTags"
          />
        </el-tab-pane>
      </el-tabs>
    </PageCard>

    <!-- 标签弹窗 -->
    <el-dialog v-model="tagDialogVisible" :title="editingTag ? '编辑标签' : '新增标签'" width="480px">
      <el-form ref="tagFormRef" :model="tagForm" :rules="tagRules" label-width="90px">
        <el-form-item label="标签名称" prop="name" required>
          <el-input v-model="tagForm.name" placeholder="请输入标签名称" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="所属分组" prop="tagType" required>
          <el-select v-model="tagForm.tagType" :disabled="!!editingTag" style="width: 100%">
            <el-option v-for="g in tagGroups" :key="g.groupCode" :label="g.groupName" :value="g.groupCode" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="tagForm.sortNo" :min="0" :max="999" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="tagForm.status">
            <el-radio value="active">启用</el-radio>
            <el-radio value="inactive">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="tagForm.remark" type="textarea" :rows="3" maxlength="255" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tagDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="tagSubmitLoading" @click="handleTagSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 分组弹窗 -->
    <el-dialog v-model="groupDialogVisible" :title="editingGroup ? '编辑分组' : '新增标签分组'" width="480px">
      <el-form ref="groupFormRef" :model="groupForm" :rules="groupRules" label-width="90px">
        <el-form-item label="分组编码" prop="groupCode" required>
          <el-input v-model="groupForm.groupCode" placeholder="如: aroma" :disabled="!!editingGroup" />
        </el-form-item>
        <el-form-item label="分组名称" prop="groupName" required>
          <el-input v-model="groupForm.groupName" placeholder="如: 香型" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="groupForm.sortNo" :min="0" :max="999" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="groupForm.status">
            <el-radio value="active">启用</el-radio>
            <el-radio value="inactive">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="groupForm.description" type="textarea" :rows="3" maxlength="255" show-word-limit />
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
import {
  fetchProductTagGroups, createProductTagGroup, updateProductTagGroup, deleteProductTagGroup,
  fetchProductTags, createProductTag, updateProductTag, deleteProductTag
} from "../api";

const activeTab = ref("");
const tagLoading = ref(false);
const tagSubmitLoading = ref(false);
const groupSubmitLoading = ref(false);
const tagDialogVisible = ref(false);
const groupDialogVisible = ref(false);
const editingTag = ref<any>(null);
const editingGroup = ref<any>(null);
const tagGroups = ref<any[]>([]);
const groupTags = ref<any[]>([]);
const tagPage = ref(1);
const tagPageSize = ref(20);
const tagTotal = ref(0);

const tagForm = reactive({ name: "", tagType: "", sortNo: 0, status: "active", remark: "" });
const tagFormRef = ref();
const tagRules = {
  name: [{ required: true, message: '请输入标签名称', trigger: 'blur' }],
  tagType: [{ required: true, message: '请选择所属分组', trigger: 'change' }]
};
const groupForm = reactive({ groupCode: "", groupName: "", sortNo: 0, status: "active", description: "" });
const groupFormRef = ref();
const groupRules = {
  groupCode: [{ required: true, message: '请输入分组编码', trigger: 'blur' }],
  groupName: [{ required: true, message: '请输入分组名称', trigger: 'blur' }]
};

async function loadGroups() {
  try {
    const list = await fetchProductTagGroups() || [];
    tagGroups.value = list;
    if (!activeTab.value && list.length > 0) {
      activeTab.value = list[0].groupCode;
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载分组失败");
  }
}

async function loadTags() {
  if (!activeTab.value) return;
  tagLoading.value = true;
  try {
    const res: any = await fetchProductTags({
      tagType: activeTab.value, page: tagPage.value, pageSize: tagPageSize.value
    });
    if (res && res.records !== undefined) {
      groupTags.value = res.records;
      tagTotal.value = res.total;
    } else {
      groupTags.value = res || [];
      tagTotal.value = (res || []).length;
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载标签失败");
  } finally {
    tagLoading.value = false;
  }
}

async function loadAll() {
  await loadGroups();
  await loadTags();
}

function onTabChange() {
  tagPage.value = 1;
  loadTags();
}

function handleTabRemove() { /* closable false so not used */ }

function openTagDialog(row?: any) {
  editingTag.value = row || null;
  if (row) {
    tagForm.name = row.name;
    tagForm.tagType = row.tagType;
    tagForm.sortNo = row.sortNo || 0;
    tagForm.status = row.status || "active";
    tagForm.remark = row.remark || "";
  } else {
    tagForm.name = "";
    tagForm.tagType = activeTab.value;
    tagForm.sortNo = 0;
    tagForm.status = "active";
    tagForm.remark = "";
  }
  tagDialogVisible.value = true;
}

async function handleTagSubmit() {
  const valid = await tagFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  tagSubmitLoading.value = true;
  try {
    if (editingTag.value) {
      await updateProductTag(editingTag.value.id, {
        name: tagForm.name, tagType: tagForm.tagType, sortNo: tagForm.sortNo, remark: tagForm.remark
      });
      ElMessage.success("更新成功");
    } else {
      await createProductTag({
        name: tagForm.name, tagType: tagForm.tagType, sortNo: tagForm.sortNo, remark: tagForm.remark
      });
      ElMessage.success("创建成功");
    }
    tagDialogVisible.value = false;
    loadTags();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "保存失败");
  } finally {
    tagSubmitLoading.value = false;
  }
}

async function toggleTagStatus(row: any) {
  const nextStatus = row.status === "active" ? "inactive" : "active";
  try {
    await updateProductTag(row.id, { status: nextStatus } as any);
    ElMessage.success("操作成功");
    loadTags();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "操作失败");
  }
}

async function deleteTagItem(id: number) {
  try {
    await deleteProductTag(id);
    ElMessage.success("删除成功");
    loadTags();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "删除失败");
  }
}

function openGroupDialog(row?: any) {
  editingGroup.value = row || null;
  if (row) {
    groupForm.groupCode = row.groupCode;
    groupForm.groupName = row.groupName;
    groupForm.sortNo = row.sortNo || 0;
    groupForm.status = row.status || "active";
    groupForm.description = row.description || "";
  } else {
    groupForm.groupCode = "";
    groupForm.groupName = "";
    groupForm.sortNo = 0;
    groupForm.status = "active";
    groupForm.description = "";
  }
  groupDialogVisible.value = true;
}

async function handleGroupSubmit() {
  const valid = await groupFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  groupSubmitLoading.value = true;
  try {
    if (editingGroup.value) {
      await updateProductTagGroup(editingGroup.value.id, {
        groupName: groupForm.groupName, sortNo: groupForm.sortNo, status: groupForm.status, description: groupForm.description
      });
      ElMessage.success("更新成功");
    } else {
      await createProductTagGroup({
        groupCode: groupForm.groupCode, groupName: groupForm.groupName,
        sortNo: groupForm.sortNo, description: groupForm.description
      });
      ElMessage.success("创建成功");
    }
    groupDialogVisible.value = false;
    loadAll();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "保存失败");
  } finally {
    groupSubmitLoading.value = false;
  }
}

onMounted(() => { loadAll(); });
</script>

<style scoped>
.group-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 6px;
}
.meta-desc { color: #909399; font-size: 13px; }
.meta-actions { display: flex; gap: 8px; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>