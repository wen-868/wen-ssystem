<template>
  <div>
    <h2 style="margin-bottom: 24px;">
      商品审核
      <el-tag size="default" style="margin-left: 12px;" type="warning" effect="light">
        待审核 {{ total }} 条
      </el-tag>
    </h2>

    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索 SPU 名称"
          clearable
          style="width: 220px;"
          @change="handleSearch"
        />
        <el-input
          v-model="searchForm.barcode"
          placeholder="搜索条码"
          clearable
          style="width: 220px;"
          @change="handleSearch"
        />
        <el-select
          v-model="searchForm.brandId"
          placeholder="品牌"
          clearable
          filterable
          style="width: 160px;"
          @change="handleSearch"
        >
          <el-option
            v-for="b in brandOptions"
            :key="b.id"
            :label="b.name"
            :value="b.id"
          />
        </el-select>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="success" @click="batchApprove">批量通过全部(本页)</el-button>
      </div>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%;">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="spuCode" label="SPU 编码" width="150" />
        <el-table-column prop="name" label="SPU 名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="brandName" label="品牌" width="120" />
        <el-table-column prop="specs" label="规格" width="120" show-overflow-tooltip />
        <el-table-column prop="unit" label="单位" width="70" />
        <el-table-column label="SKU 数" width="80" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.skuCount || 0 }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="80">
          <template #default="{ row }">
            <el-tag size="small">{{ sourceLabel(row.source) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="160">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="审核操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="success" size="small" @click="handleApprove(row)">
              <el-icon style="margin-right: 2px;"><CircleCheck /></el-icon>通过
            </el-button>
            <el-button type="warning" size="small" @click="openReject(row)">
              <el-icon style="margin-right: 2px;"><CircleClose /></el-icon>拒绝
            </el-button>
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

    <!-- 拒绝原因对话框 -->
    <el-dialog v-model="rejectVisible" title="拒绝审核" width="500px" :close-on-click-modal="false">
      <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 16px;">
        拒绝审核后，该 SPU 将标记为『已拒绝』，商户端扫码不再命中
      </el-alert>
      <div style="margin-bottom: 12px;">
        <span style="color: #303133; font-weight: 600;">待审核：</span>
        <span style="color: #606266;">{{ rejectingRow?.name }} ({{ rejectingRow?.spuCode }})</span>
      </div>
      <el-form :model="rejectForm" label-width="80px">
        <el-form-item label="拒绝原因">
          <el-input
            v-model="rejectForm.reason"
            type="textarea"
            :rows="5"
            placeholder="详细说明拒绝原因，如：条码无效、规格错误、品牌不一致、图片不清晰等"
            maxlength="300"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="快捷原因">
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <el-tag
              v-for="t in quickReasons"
              :key="t"
              size="small"
              effect="plain"
              style="cursor: pointer; padding: 4px 10px;"
              @click="appendQuickReason(t)"
            >{{ t }}</el-tag>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="warning" :loading="saving" @click="confirmReject">提交拒绝</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheck, CircleClose } from '@element-plus/icons-vue'
import {
  listSpusApi, approveSpuApi, rejectSpuApi, listBrandOptionsApi,
  type SpuListItem,
} from '../../api/library'

const loading = ref(false)
const saving = ref(false)
const list = ref<SpuListItem[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const brandOptions = ref<{ id: number; name: string }[]>([])

const searchForm = reactive({
  keyword: '',
  barcode: '',
  brandId: null as number | null,
})

const rejectVisible = ref(false)
const rejectingRow = ref<SpuListItem | null>(null)
const rejectForm = reactive({ reason: '' })

const quickReasons = [
  '条码无效或重复',
  '规格填写不完整',
  '品牌信息不一致',
  '商品名称不规范',
  '图片不清晰/缺少主图',
  '酒精度/产地/香型信息缺失',
]

function sourceLabel(s: string) {
  return ({ MANUAL: '手动', IMPORT: '导入', OPEN_API: 'API' } as Record<string, string>)[s] || s || '-'
}
function formatTime(t: string) {
  return t ? t.replace('T', ' ').substring(0, 19) : '-'
}

async function fetchList() {
  loading.value = true
  try {
    const res: any = await listSpusApi({
      page: page.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword || undefined,
      barcode: searchForm.barcode || undefined,
      brandId: searchForm.brandId || undefined,
      status: 'PENDING',
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

async function fetchBrands() {
  try {
    const res: any = await listBrandOptionsApi()
    const data = res.data || res
    brandOptions.value = (data.records || data.list || []).map((b: any) => ({ id: b.id, name: b.name }))
  } catch { /* ignore */ }
}

function handleSearch() {
  page.value = 1
  fetchList()
}
function handleReset() {
  searchForm.keyword = ''
  searchForm.barcode = ''
  searchForm.brandId = null
  page.value = 1
  fetchList()
}

async function handleApprove(row: SpuListItem) {
  try {
    await ElMessageBox.confirm(`确定通过『${row.name}』的审核？`, '确认通过', { type: 'success' })
  } catch { return }
  saving.value = true
  try {
    await approveSpuApi(row.id)
    ElMessage.success('已通过审核')
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  } finally {
    saving.value = false
  }
}

async function batchApprove() {
  if (list.value.length === 0) {
    ElMessage.info('当前页无可审核的 SPU')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定批量通过当前页的 ${list.value.length} 条 SPU 审核吗？此操作不可撤销。`,
      '批量确认通过',
      { type: 'warning', confirmButtonText: '全部通过' },
    )
  } catch { return }
  saving.value = true
  let success = 0
  let failed = 0
  for (const row of list.value) {
    try {
      await approveSpuApi(row.id)
      success++
    } catch {
      failed++
    }
  }
  saving.value = false
  ElMessage.success(`批量通过完成：成功 ${success} 条，失败 ${failed} 条`)
  fetchList()
}

function openReject(row: SpuListItem) {
  rejectingRow.value = row
  rejectForm.reason = ''
  rejectVisible.value = true
}
function appendQuickReason(t: string) {
  const prefix = rejectForm.reason ? rejectForm.reason + '；' : ''
  rejectForm.reason = prefix + t
}
async function confirmReject() {
  if (!rejectForm.reason.trim()) {
    ElMessage.warning('请填写或选择拒绝原因')
    return
  }
  if (!rejectingRow.value) return
  saving.value = true
  try {
    await rejectSpuApi(rejectingRow.value.id, { reason: rejectForm.reason })
    ElMessage.success('已提交拒绝')
    rejectVisible.value = false
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchBrands()
  fetchList()
})
</script>
