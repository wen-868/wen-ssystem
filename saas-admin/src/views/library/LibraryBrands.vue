<template>
  <div>
    <h2 style="margin-bottom: 24px;">品牌管理</h2>

    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索品牌名称/产地"
          clearable
          style="width: 260px;"
          @change="handleSearch"
        />
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="success" @click="showCreateDialog">新增品牌</el-button>
      </div>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%;">
        <el-table-column prop="id" label="ID" width="70" align="center" />
        <el-table-column prop="name" label="品牌名称" width="180" />
        <el-table-column label="Logo" width="80" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.logo"
              :src="row.logo"
              :preview-src-list="[row.logo]"
              style="width: 40px; height: 40px; border-radius: 6px;"
              fit="cover"
            />
            <span v-else style="color: #c0c4cc;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="originCountry" label="产地(国家/地区)" width="160" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="spuCount" label="关联 SPU 数" width="120" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.spuCount || 0 }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sortNo" label="排序" width="80" align="center" />
        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              :active-value="1"
              :inactive-value="0"
              active-text="启用"
              inactive-text="停用"
              inline-prompt
              @change="(val: number) => handleToggle(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑品牌' : '新增品牌'"
      width="560px"
      :close-on-click-modal="false"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="品牌名称" prop="name">
          <el-input v-model="form.name" placeholder="如：茅台、五粮液" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="Logo URL" prop="logo">
          <el-input v-model="form.logo" placeholder="https://.../logo.png" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="16">
            <el-form-item label="产地" prop="originCountry">
              <el-input v-model="form.originCountry" placeholder="如：贵州、四川宜宾、法国波尔多" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="排序号" prop="sortNo">
              <el-input-number v-model="form.sortNo" :min="0" :max="9999" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="状态" v-if="editingId">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="品牌描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="4" placeholder="品牌故事/特色介绍" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  listBrandsApi, createBrandApi, updateBrandApi, deleteBrandApi, toggleBrandStatusApi,
  type BrandItem,
} from '../../api/library'

const loading = ref(false)
const list = ref<BrandItem[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const searchForm = reactive({ keyword: '' })
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({
  name: '',
  logo: '',
  originCountry: '',
  sortNo: 0,
  description: '',
  status: 1,
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入品牌名称', trigger: 'blur' }],
}

function formatTime(t: string): string {
  if (!t) return '-'
  return t.replace('T', ' ').substring(0, 19)
}

async function fetchList() {
  loading.value = true
  try {
    const res: any = await listBrandsApi({
      page: page.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword || undefined,
    })
    const data = res.data || res
    list.value = data.records || data.list || []
    total.value = data.total || 0
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  fetchList()
}
function handleReset() {
  searchForm.keyword = ''
  page.value = 1
  fetchList()
}

function showCreateDialog() {
  editingId.value = null
  Object.assign(form, { name: '', logo: '', originCountry: '', sortNo: 0, description: '', status: 1 })
  dialogVisible.value = true
}

function handleEdit(row: BrandItem) {
  editingId.value = row.id
  Object.assign(form, {
    name: row.name,
    logo: row.logo || '',
    originCountry: row.originCountry || '',
    sortNo: row.sortNo || 0,
    description: row.description || '',
    status: row.status,
  })
  dialogVisible.value = true
}

async function handleSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await updateBrandApi(editingId.value, { ...form })
      ElMessage.success('更新品牌成功')
    } else {
      await createBrandApi({ ...form })
      ElMessage.success('创建品牌成功')
    }
    dialogVisible.value = false
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleToggle(row: BrandItem, val: number) {
  const act = val === 1 ? '启用' : '停用'
  try {
    await toggleBrandStatusApi(row.id, val)
    ElMessage.success(`已${act}品牌：${row.name}`)
  } catch (e: any) {
    // 失败回滚
    row.status = val === 1 ? 0 : 1
    ElMessage.error(e?.message || `${act}失败`)
  }
}

async function handleDelete(row: BrandItem) {
  try {
    await ElMessageBox.confirm(
      `确定删除品牌『${row.name}』吗？有关联 SPU 时将无法删除。`,
      '确认删除',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    await deleteBrandApi(row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(fetchList)
</script>
