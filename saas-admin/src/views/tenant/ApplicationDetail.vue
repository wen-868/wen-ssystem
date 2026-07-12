<template>
  <div class="application-detail">
    <div class="page-header">
      <el-button text @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <h2>租户注册申请详情</h2>
    </div>

    <el-card v-loading="loading">
      <div v-if="application" class="detail-content">
        <div class="status-bar">
          <el-tag :type="getStatusTagType(application.status)" size="large">
            {{ getStatusText(application.status) }}
          </el-tag>
          <span v-if="application.reject_reason" class="reject-reason">
            驳回原因：{{ application.reject_reason }}
          </span>
        </div>

        <el-divider content-position="left">公司信息</el-divider>

        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="公司名称">
              <span class="form-value">{{ application.company_name }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="公司简称">
              <span class="form-value">{{ application.company_short_name || '-' }}</span>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="联系人">
              <span class="form-value">{{ application.contact_person }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <span class="form-value">{{ application.contact_mobile }}</span>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="联系邮箱">
              <span class="form-value">{{ application.contact_email || '-' }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="法人代表">
              <span class="form-value">{{ application.legal_person || '-' }}</span>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="24">
          <el-col :span="8">
            <el-form-item label="省份">
              <span class="form-value">{{ application.province || '-' }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="城市">
              <span class="form-value">{{ application.city || '-' }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="区县">
              <span class="form-value">{{ application.district || '-' }}</span>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="详细地址">
          <span class="form-value">{{ application.address || '-' }}</span>
        </el-form-item>

        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="营业执照号">
              <span class="form-value">{{ application.business_license || '-' }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属行业">
              <span class="form-value">{{ getIndustryText(application.industry) }}</span>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="公司规模">
              <span class="form-value">{{ getCompanyScaleText(application.company_scale) }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="申请时间">
              <span class="form-value">{{ formatDate(application.created_at) }}</span>
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">管理员账号</el-divider>

        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="登录账号">
              <span class="form-value">{{ application.admin_username }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="真实姓名">
              <span class="form-value">{{ application.admin_real_name }}</span>
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">审核信息</el-divider>

        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="审核时间">
              <span class="form-value">{{ application.reviewed_at ? formatDate(application.reviewed_at) : '-' }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="审核人">
              <span class="form-value">{{ application.reviewed_by || '-' }}</span>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 审核操作区域 -->
        <div v-if="application.status === 'PENDING'" class="audit-actions">
          <el-divider content-position="left">审核操作</el-divider>
          
          <el-form ref="auditFormRef" :model="auditForm" :rules="auditRules">
            <el-form-item label="审核意见" prop="remark">
              <el-input v-model="auditForm.remark" type="textarea" placeholder="请输入审核意见（选填）" rows="3" />
            </el-form-item>

            <div class="action-buttons">
              <el-button type="danger" :loading="rejectLoading" @click="handleReject">
                驳回申请
              </el-button>
              <el-button type="primary" :loading="approveLoading" @click="handleApprove">
                通过申请
              </el-button>
            </div>
          </el-form>
        </div>

        <!-- 驳回原因弹窗 -->
        <el-dialog v-model="showRejectDialog" title="驳回申请" width="480px">
          <el-form ref="rejectFormRef" :model="rejectForm" :rules="rejectRules">
            <el-form-item label="驳回原因" prop="rejectReason">
              <el-input v-model="rejectForm.rejectReason" type="textarea" placeholder="请输入驳回原因（必填）" rows="4" />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="showRejectDialog = false">取消</el-button>
            <el-button type="danger" :loading="rejectLoading" @click="confirmReject">确认驳回</el-button>
          </template>
        </el-dialog>
      </div>

      <div v-else class="empty-state">
        <el-icon :size="48" class="empty-icon"><InfoFilled /></el-icon>
        <p>申请信息不存在</p>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { ArrowLeft, InfoFilled } from '@element-plus/icons-vue'
import { getApplication, approveApplication, rejectApplication, type TenantApplication } from '../../api/tenant-application'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const approveLoading = ref(false)
const rejectLoading = ref(false)
const showRejectDialog = ref(false)
const application = ref<TenantApplication | null>(null)

const auditFormRef = ref<FormInstance>()
const rejectFormRef = ref<FormInstance>()

const auditForm = reactive({
  remark: ''
})

const rejectForm = reactive({
  rejectReason: ''
})

const auditRules: FormRules = {}

const rejectRules: FormRules = {
  rejectReason: [{ required: true, message: '请输入驳回原因', trigger: 'blur' }]
}

const industryMap: Record<string, string> = {
  'liquor_wholesale': '酒水批发',
  'liquor_retail': '酒水零售',
  'catering': '餐饮',
  'supermarket': '商超',
  'other': '其他'
}

const companyScaleMap: Record<string, string> = {
  'small': '1-10人',
  'medium': '10-50人',
  'large': '50-200人',
  'enterprise': '200人以上'
}

async function loadData() {
  const id = Number(route.params.id)
  if (!id) return
  
  loading.value = true
  try {
    const res = await getApplication(id)
    application.value = res.data
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '获取申请详情失败')
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/applications')
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PENDING: '待审核',
    APPROVED: '已通过',
    REJECTED: '已驳回'
  }
  return map[status] || status
}

function getStatusTagType(status: string) {
  const map: Record<string, string> = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger'
  }
  return map[status] || 'info'
}

function getIndustryText(industry: string) {
  return industryMap[industry] || industry || '-'
}

function getCompanyScaleText(scale: string) {
  return companyScaleMap[scale] || scale || '-'
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

function handleApprove() {
  ElMessageBox.confirm(
    '确定要通过该申请吗？通过后将自动创建租户和管理员账号。',
    '确认通过',
    {
      confirmButtonText: '确定通过',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    approveLoading.value = true
    try {
      await approveApplication(Number(route.params.id))
      ElMessage.success('审核通过')
      goBack()
    } catch (e: any) {
      ElMessage.error(e?.response?.data?.msg || '审核失败')
    } finally {
      approveLoading.value = false
    }
  })
}

function handleReject() {
  rejectForm.rejectReason = ''
  showRejectDialog.value = true
}

async function confirmReject() {
  try {
    await rejectFormRef.value?.validate()
  } catch {
    return
  }

  rejectLoading.value = true
  try {
    await rejectApplication(Number(route.params.id), rejectForm.rejectReason)
    ElMessage.success('已驳回申请')
    showRejectDialog.value = false
    goBack()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '驳回失败')
  } finally {
    rejectLoading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.application-detail { padding: 20px; }
.page-header { margin-bottom: 20px; display: flex; align-items: center; gap: 12px; }
.page-header h2 { margin: 0; font-size: 18px; font-weight: 600; }
.detail-content { padding: 8px 0; }
.status-bar { margin-bottom: 20px; display: flex; align-items: center; gap: 16px; }
.reject-reason { color: #F56C6C; font-size: 14px; }
.form-value { color: #303133; font-size: 14px; }
.audit-actions { margin-top: 16px; padding-top: 16px; border-top: 1px solid #EBEEF5; }
.action-buttons { margin-top: 16px; display: flex; gap: 12px; }
.empty-state { text-align: center; padding: 40px 0; }
.empty-icon { color: #C0C4CC; margin-bottom: 12px; }
.empty-state p { color: #909399; }
</style>
