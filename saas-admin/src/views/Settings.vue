<template>
  <div>
    <!-- ① 页头（设计稿 sec-config .pg-hd） -->
    <div class="pg-hd">
      <div>
        <div class="pt4">系统配置</div>
        <p class="pd">所有变更记录前后值快照 · 敏感项（支付/AI/短信密钥）变更需双因子验证</p>
      </div>
      <div class="pg-act">
        <span class="btn btn-p" @click="saveConfig">
          <el-icon v-if="saving"><Loading /></el-icon>
          <span>{{ saving ? '保存中…' : '保存全部' }}</span>
        </span>
      </div>
    </div>

    <!-- 加载 / 错误态 -->
    <div v-if="error" class="tipbar r mt8">
      <span class="ic">!</span>
      <span>{{ error }}（接口待对接，当前展示空态）</span>
    </div>
    <div v-else-if="loading" class="empty">加载中…</div>

    <template v-else>
      <!-- ② 平台基础信息 + 全局功能开关 -->
      <div class="g2">
        <!-- 平台基础信息 -->
        <div class="panel">
          <div class="p-hd"><span class="pt">平台基础信息</span></div>
          <div class="p-bd" style="display: grid; gap: var(--space-3)">
            <div class="frow">
              <span class="fld" style="flex: 1.3">
                <span>平台名称</span>
                <input class="ipt" v-model="config.platformName" placeholder="如：智享全链" />
              </span>
              <span class="fld" style="flex: 1">
                <span>客服电话</span>
                <input class="ipt" v-model="config.servicePhone" placeholder="如：400-XXX-XXXX" />
              </span>
            </div>
            <div class="frow" style="align-items: center">
              <span class="fld" style="flex: 1">
                <span>平台 Logo</span>
                <span class="logo-line">
                  <span class="logo-badge">{{ logoText }}</span>
                  <span class="btn" @click="onUploadLogo">重新上传</span>
                  <span class="small">200×200 · PNG</span>
                </span>
              </span>
            </div>
            <div class="fld">
              <span>登录页横幅文案</span>
              <input class="ipt" v-model="config.loginBanner" placeholder="如：让批零生意，全链路智能运转" />
            </div>
            <div class="frow">
              <span class="fld" style="flex: 1">
                <span>版权信息</span>
                <input class="ipt" v-model="config.copyrightInfo" placeholder="如：© 2026 智享全链" />
              </span>
              <span class="fld" style="flex: 1">
                <span>备案号</span>
                <input class="ipt" v-model="config.icpNumber" placeholder="如：京ICP备XXXXXXXX号" />
              </span>
            </div>
          </div>
        </div>

        <!-- 全局功能开关 -->
        <div class="panel">
          <div class="p-hd">
            <span class="pt">全局功能开关</span>
            <span class="ph-s">关闭仅隐藏入口与逻辑分支，不做数据清理；对存量租户仅告警不强制切断</span>
          </div>
          <div class="p-bd">
            <div
              v-for="(s, i) in switchDefs"
              :key="s.key"
              class="switch-row"
              :class="{ 'is-last': i === switchDefs.length - 1 }"
            >
              <span
                class="tg"
                :class="{ off: !switches[s.key].enabled }"
                @click="switches[s.key].enabled = !switches[s.key].enabled"
              ></span>
              <div style="flex: 1; min-width: 0">
                <div class="b" style="font-size: var(--text-sm)">{{ s.name }}</div>
                <div class="small">{{ s.desc }}</div>
              </div>
              <span class="tag" :class="switches[s.key].enabled ? 'tag-g' : 'tag-gy'">
                {{ switches[s.key].countLabel || '—' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ③ 数据字典管理 -->
      <div class="panel mt12">
        <div class="p-hd">
          <span class="pt">数据字典管理</span>
          <div class="frow">
            <span class="btn btn-s" @click="onAddDict">+ 新增字典项</span>
            <span class="btn" @click="onImportDict">批量导入</span>
          </div>
        </div>
        <div class="p-bd" style="padding-top: var(--space-2)">
          <div class="tabs" style="border: none; padding: 0; margin-bottom: var(--space-2)">
            <span
              v-for="t in dictTabs"
              :key="t.key"
              class="tab"
              :class="{ on: dictTab === t.key }"
              @click="dictTab = t.key"
              >{{ t.label }}</span
            >
          </div>
          <div class="tblwrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>字典项</th>
                  <th>换算关系</th>
                  <th>预置模板标记</th>
                  <th class="num">引用租户数</th>
                  <th>排序</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
          <div v-if="!dictItems.length" class="empty">暂无字典项 · 数据字典接口待对接</div>
          <p class="small mt8">字典快照原则：修改仅影响新增数据，租户已生成单据上的历史值不受影响。</p>
        </div>
      </div>

      <!-- ④ 第三方对接 -->
      <div class="panel mt12">
        <div class="p-hd">
          <span class="pt">第三方对接</span>
          <span class="ph-s">密钥脱敏展示 · 变更需密码 + 验证码双因子 · 禁止明文导出</span>
        </div>
        <div class="p-bd g2" style="padding-top: var(--space-2)">
          <!-- 短信通道 -->
          <div class="panel">
            <div class="p-bd">
              <div class="chan-hd">
                <b style="font-size: var(--text-sm)">短信通道 · 阿里云短信</b>
                <span class="tag tag-g">已连通</span>
              </div>
              <div class="qrow mt8">
                <span>AccessKey</span><span style="flex: 1"></span>
                <em class="val-auto"><span class="mask">{{ channels.sms.accessKey || '••••••••' }}</span></em>
              </div>
              <div class="qrow">
                <span>签名</span><span style="flex: 1"></span>
                <em class="val-auto">{{ channels.sms.sign || '—' }}</em>
              </div>
              <p class="small mt8">
                模板 {{ channels.sms.tplCount || '—' }} 个 · 今日发送 {{ channels.sms.todaySent || '—' }} 条
                <span class="lk" style="float: right">配置 ›</span>
              </p>
              <div class="tenant-key-row">
                <span
                  class="tg"
                  :class="{ off: !channels.sms.tenantKey }"
                  @click="channels.sms.tenantKey = !channels.sms.tenantKey"
                ></span>
                <div style="flex: 1; min-width: 0">
                  <div class="b" style="font-size: var(--text-xs)">
                    允许租户配置自有短信密钥 <span class="ver-tag">v1.5</span>
                  </div>
                  <div class="small">开启后租户可在商家后台上传自有签名 / 模板密钥（平台加密托管），未配置租户回落全局通道计费</div>
                </div>
                <span class="tag" :class="channels.sms.tenantKey ? 'tag-g' : 'tag-gy'">
                  {{ channels.sms.tenantKey ? '已开启' : '未开启' }}
                </span>
              </div>
            </div>
          </div>

          <!-- 邮件通道 -->
          <div class="panel">
            <div class="p-bd">
              <div class="chan-hd">
                <b style="font-size: var(--text-sm)">邮件通道 · SMTP</b>
                <span class="tag tag-g">已连通</span>
              </div>
              <div class="qrow mt8">
                <span>服务器</span><span style="flex: 1"></span>
                <em class="val-auto">{{ channels.smtp.server || '—' }}</em>
              </div>
              <div class="qrow">
                <span>授权码</span><span style="flex: 1"></span>
                <em class="val-auto"><span class="mask">{{ channels.smtp.authCode || '••••••••' }}</span></em>
              </div>
              <p class="small mt8">
                发信频率 {{ channels.smtp.rate || '—' }} · 白名单 {{ channels.smtp.whitelist || '—' }} 域
                <span class="lk" style="float: right">配置 ›</span>
              </p>
              <div class="tenant-key-row">
                <span
                  class="tg"
                  :class="{ off: !channels.smtp.tenantKey }"
                  @click="channels.smtp.tenantKey = !channels.smtp.tenantKey"
                ></span>
                <div style="flex: 1; min-width: 0">
                  <div class="b" style="font-size: var(--text-xs)">
                    允许租户配置自有 SMTP 账号 <span class="ver-tag">v1.5</span>
                  </div>
                  <div class="small">默认关闭：租户统一走平台 SMTP；开启后租户自有账号需通过连通性校验并留痕</div>
                </div>
                <span class="tag" :class="channels.smtp.tenantKey ? 'tag-g' : 'tag-gy'">
                  {{ channels.smtp.tenantKey ? '已开启' : '未开启' }}
                </span>
              </div>
            </div>
          </div>

          <!-- 对象存储 -->
          <div class="panel">
            <div class="p-bd">
              <div class="chan-hd">
                <b style="font-size: var(--text-sm)">对象存储 · 腾讯云 COS</b>
                <span class="tag tag-g">已连通</span>
              </div>
              <div class="qrow mt8">
                <span>SecretId</span><span style="flex: 1"></span>
                <em class="val-auto"><span class="mask">{{ channels.cos.secretId || '••••••••' }}</span></em>
              </div>
              <div class="qrow">
                <span>桶</span><span style="flex: 1"></span>
                <em class="val-auto">{{ channels.cos.bucket || '—' }}</em>
              </div>
              <p class="small mt8">
                已用 {{ channels.cos.used || '—' }} · 超额策略：硬拦截 + 扩容引导
                <span class="lk" style="float: right">配置 ›</span>
              </p>
              <div class="tenant-key-row" style="border-top: 1px dashed var(--g2); margin-top: var(--space-2); padding-top: var(--space-2)">
                <div style="flex: 1; min-width: 0">
                  <div class="b" style="font-size: var(--text-xs)">
                    租户存储上限与超额预警 <span class="ver-tag">v1.5</span>
                  </div>
                  <p class="small mt6">
                    单租户上限按套餐配额执行（免费 1GB / 基础 5GB / 标准 20GB / 旗舰 100GB，租户级可单独调整并留痕）；
                    <b>80% 提醒 / 95% 预警 / 100% 硬拦截上传</b>三档超额预警，用量明细见「运维 · 存储监控」
                    <span class="lk" style="float: right">租户上限批量设置 ›</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- 支付网关 -->
          <div class="panel">
            <div class="p-bd">
              <div class="chan-hd">
                <b style="font-size: var(--text-sm)">支付网关 · 微信 + 支付宝 + 聚合</b>
                <span class="tag tag-g">3/3 正常</span>
              </div>
              <div class="qrow mt8">
                <span>商户号</span><span style="flex: 1"></span>
                <em class="val-auto">
                  <span class="mask">{{ channels.pay.merchantWx || '••••••••' }}</span>
                  /
                  <span class="mask">{{ channels.pay.merchantAli || '••••••••' }}</span>
                </em>
              </div>
              <div class="qrow">
                <span>API 密钥</span><span style="flex: 1"></span>
                <em class="val-auto"><span class="mask">{{ channels.pay.apiKey || '••••••••' }}</span></em>
              </div>
              <p class="small mt8">
                密钥轮询变更生效留痕 · 上次轮换 {{ channels.pay.lastRotate || '—' }}
                <span class="lk" style="float: right">配置 ›</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 配置编辑弹窗（结构占位，内容包一层 zx-scope 复用组件类） -->
    <el-dialog v-model="showDictDialog" :title="editingDict ? '编辑字典项' : '新增字典项'" :width="'var(--modal-width)'" :close-on-click-modal="false">
      <div class="zx-scope">
        <div class="frow">
          <span class="fld" style="flex: 1">
            <span>字典项名称</span>
            <input class="ipt" v-model="dictForm.name" placeholder="如：件 / 箱 / kg" />
          </span>
          <span class="fld" style="flex: 1">
            <span>换算关系</span>
            <input class="ipt" v-model="dictForm.relation" placeholder="如：1 箱 = 24 件" />
          </span>
        </div>
        <div class="frow mt10">
          <span class="fld" style="flex: 1">
            <span>预置模板标记</span>
            <span class="sel" @click="dictForm.preset = !dictForm.preset">{{ dictForm.preset ? '预置' : '非预置' }} ▾</span>
          </span>
          <span class="fld" style="flex: 1">
            <span>排序</span>
            <input class="ipt" v-model="dictForm.sort" placeholder="数字越小越靠前" />
          </span>
        </div>
      </div>
      <template #footer>
        <el-button @click="showDictDialog = false">取消</el-button>
        <el-button type="primary" @click="saveDict">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { getPlatformConfig, updatePlatformConfig } from '../api'

const loading = ref(false)
const error = ref('')
const saving = ref(false)

const logoText = ref('智')

const config = reactive<any>({
  platformName: '',
  servicePhone: '',
  loginBanner: '',
  copyrightInfo: '',
  icpNumber: '',
})

/* 全局功能开关：结构来自设计稿；开关状态与租户计数均来自接口，缺省为空态 */
const switchDefs = [
  { key: 'multiWarehouse', name: '多仓库', desc: '新租户默认：关闭' },
  { key: 'multiUnit', name: '多计量单位', desc: '新租户默认：开启' },
  { key: 'memberMarketing', name: '会员营销（储值/积分）', desc: '新租户默认：关闭' },
  { key: 'miniProgram', name: '小程序商城', desc: '小程序主体/类目全局参数' },
  { key: 'openApi', name: '开放平台 API', desc: '计划随 P2 规模化期全量开放' },
  { key: 'reportCenter', name: '报表中心', desc: '新租户默认：开启' },
]
const switches = reactive<Record<string, { enabled: boolean; countLabel: string }>>(
  Object.fromEntries(switchDefs.map((s) => [s.key, { enabled: false, countLabel: '' }]))
)

/* 数据字典 */
const dictTabs = [
  { key: 'unit', label: '计量单位' },
  { key: 'category', label: '商品分类模板' },
  { key: 'pay', label: '支付渠道' },
  { key: 'doc', label: '单据类型' },
]
const dictTab = ref('unit')
const dictItems = ref<any[]>([])

/* 第三方对接：密钥/计数均来自接口，缺省展示脱敏占位 */
const channels = reactive({
  sms: { accessKey: '', sign: '', tplCount: '', todaySent: '', tenantKey: false },
  smtp: { server: '', authCode: '', rate: '', whitelist: '', tenantKey: false },
  cos: { secretId: '', bucket: '', used: '', lastRotate: '' },
  pay: { merchantWx: '', merchantAli: '', apiKey: '', lastRotate: '' },
})

/* 字典弹窗 */
const showDictDialog = ref(false)
const editingDict = ref<any>(null)
const dictForm = reactive({ name: '', relation: '', preset: true, sort: '' })

function onAddDict() {
  editingDict.value = null
  Object.assign(dictForm, { name: '', relation: '', preset: true, sort: '' })
  showDictDialog.value = true
}
function onImportDict() {
  // TODO: 待接入字典批量导入（建议 POST /platform/config/data-dict/import）
  ElMessage.info('字典批量导入接口待对接（POST /platform/config/data-dict/import）')
}
function saveDict() {
  if (!dictForm.name) {
    ElMessage.warning('请输入字典项名称')
    return
  }
  // TODO: 待接入字典保存（建议 PUT /platform/config/data-dict）；当前仅关闭弹窗占位
  ElMessage.info('字典项保存接口待对接（PUT /platform/config/data-dict）')
  showDictDialog.value = false
}
function onUploadLogo() {
  // TODO: 待接入 Logo 上传（建议 POST /platform/config/logo）
  ElMessage.info('Logo 上传接口待对接（POST /platform/config/logo）')
}

async function saveConfig() {
  saving.value = true
  try {
    await updatePlatformConfig({
      ...config,
      switches,
      channels,
    })
    ElMessage.success('保存成功')
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    // 现有接口保留调用
    const res: any = await getPlatformConfig()
    const d = res?.data?.data || res?.data || {}
    if (d && typeof d === 'object') {
      Object.assign(config, d)
      if (d.switches) Object.assign(switches, d.switches)
      if (d.channels) Object.assign(channels, d.channels)
    }
  } catch {
    // 接口不可用时保持空态，不填充示例数据
    error.value = '系统配置加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
/* 页面级布局仅使用 design token 组合，不写死任何色值/字号/间距/圆角 */
.logo-line {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.logo-badge {
  width: var(--brand-logo-size);
  height: var(--brand-logo-size);
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-active));
  color: var(--text-inverse);
  display: grid;
  place-items: center;
  font-weight: var(--font-bold);
  flex: none;
}
.switch-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--g1);
}
.switch-row.is-last {
  border-bottom: none;
}
.chan-hd {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.tenant-key-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  border-top: 1px dashed var(--g2);
  margin-top: var(--space-2);
  padding-top: var(--space-2);
}
.qrow em.val-auto {
  width: auto;
}
</style>
