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
                  <span class="logo-badge">
                    <img v-if="config.logoUrl" :src="config.logoUrl" alt="平台 Logo" class="logo-img" />
                    <template v-else>{{ logoText }}</template>
                  </span>
                  <input
                    ref="logoInput"
                    class="logo-file"
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    @change="onLogoPicked"
                  />
                  <span class="btn" @click="onUploadLogo">{{ logoUploading ? '上传中…' : '重新上传' }}</span>
                  <span class="small">200×200 · PNG · 单文件 ≤5MB</span>
                </span>
              </span>
            </div>
            <div v-if="logoNotice" class="tipbar r">
              <span class="ic">!</span>
              <span>{{ logoNotice }}</span>
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
            <div v-if="!switchesConfigured" class="tipbar mt8">
              <span class="ic">i</span>
              <span>
                全局功能开关尚未配置：开关与「新租户默认值」均按「未配置」展示（系统不内置任何预设值），
                保存后生效；全平台启用统计依赖调用量统计接口，未接通前显示「—」。
              </span>
            </div>
            <div
              v-for="(s, i) in switchDefs"
              :key="s.key"
              class="switch-row"
              :class="{ 'is-last': i === switchDefs.length - 1 }"
            >
              <span
                class="tg"
                :class="{ off: !switches[s.key].enabled }"
                @click="toggleSwitchEnabled(s.key)"
              ></span>
              <div style="flex: 1; min-width: 0">
                <div class="b" style="font-size: var(--text-sm)">{{ s.name }}</div>
                <div class="small">
                  <template v-if="s.desc">{{ s.desc }} · </template>
                  新租户默认：<span class="lk" @click="cycleNewTenantDefault(s.key)">{{ newTenantDefaultText(s.key) }}</span>
                </div>
              </div>
              <span class="tag" :class="switches[s.key].enabled ? 'tag-g' : 'tag-gy'">
                {{ switchesConfigured ? switches[s.key].countLabel || '—' : '未配置' }}
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
              @click="switchDictTab(t.key)"
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
              <tbody>
                <tr v-for="item in dictItems" :key="item.itemCode">
                  <td>
                    <b>{{ item.itemName }}</b>
                    <span class="sub">{{ item.itemCode }}</span>
                    <span v-if="item.remark" class="sub">备注：{{ item.remark }}</span>
                  </td>
                  <!-- 下面三列在本批后端字典项模型里没有对应字段/数据源，按「无数据源显示 —」处理，不用别处数据顶替 -->
                  <td>—</td>
                  <td>—</td>
                  <td class="num">—</td>
                  <td>{{ item.sortNo }}</td>
                  <td>{{ item.status === 'ACTIVE' ? '启用' : item.status }}</td>
                  <td>
                    <span class="btn-t" @click="onEditDict(item)">编辑</span>
                    <span class="btn-t dgr" @click="onDeleteDict(item)">删除</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="dictError" class="tipbar r">
            <span class="ic">!</span>
            <span>{{ dictError }}</span>
          </div>
          <div v-if="!dictItems.length" class="empty">暂无字典项</div>
          <p class="small mt8">
            {{ dictTypeHint }}
          </p>
          <p class="small">
            本批字典项字段为 编码 / 名称 / 排序 / 状态 / 备注；「换算关系」「预置模板标记」「引用租户数」当前无对应字段与数据源，显示「—」。
          </p>
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
                  @click="toggleTenantKey('sms')"
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
                  @click="toggleTenantKey('smtp')"
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
            <span>字典项编码</span>
            <input class="ipt" v-model="dictForm.itemCode" placeholder="如：bottle / box / kg（同类型内唯一）" />
          </span>
          <span class="fld" style="flex: 1">
            <span>字典项名称</span>
            <input class="ipt" v-model="dictForm.itemName" placeholder="如：瓶 / 箱 / 件 / 千克" />
          </span>
        </div>
        <div class="frow mt10">
          <span class="fld" style="flex: 1">
            <span>排序</span>
            <input class="ipt" v-model="dictForm.sortNo" placeholder="数字越小越靠前" />
          </span>
          <span class="fld" style="flex: 1">
            <span>备注</span>
            <input class="ipt" v-model="dictForm.remark" placeholder="可空" />
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
import { computed, reactive, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import {
  getPlatformConfig,
  updatePlatformConfig,
  uploadPlatformLogo,
  listDataDictTypes,
  listDataDictItems,
  replaceDataDictItems,
} from '../api'
import { pickBackendMessage } from '../utils/http-error'

const loading = ref(false)
const error = ref('')
const saving = ref(false)

const logoText = ref('智')
const logoInput = ref<HTMLInputElement | null>(null)
const logoUploading = ref(false)
/** Logo 上传的业务提示（toast 由 api 拦截器统一弹，页面只做内容区提示） */
const logoNotice = ref('')

/** 与后端 multer 口径一致：单文件 ≤5MB，扩展名仅 jpg/jpeg/png/gif/webp */
const LOGO_MAX_BYTES = 5 * 1024 * 1024
const LOGO_ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

const config = reactive<any>({
  platformName: '',
  servicePhone: '',
  loginBanner: '',
  copyrightInfo: '',
  icpNumber: '',
})

/* 全局功能开关（§10.3）：每项含「全局开关」「新租户默认值」「全平台启用统计」，
 * 三项均以接口为准；缺省为「未配置」——禁止用前端默认值冒充已生效配置（护栏④）。 */
const switchDefs = [
  { key: 'multiWarehouse', name: '多仓库', desc: '' },
  { key: 'multiUnit', name: '多计量单位', desc: '' },
  { key: 'memberMarketing', name: '会员营销（储值/积分）', desc: '' },
  { key: 'miniProgram', name: '小程序商城', desc: '小程序主体/类目全局参数' },
  { key: 'openApi', name: '开放平台 API', desc: '计划随 P2 规模化期全量开放' },
  { key: 'reportCenter', name: '报表中心', desc: '' },
]
interface SwitchState {
  enabled: boolean
  /** 新租户默认值：undefined 表示「未配置」，与 false（已配置为关闭）语义不同，禁止混同 */
  newTenantDefault?: boolean
  countLabel: string
}
const switches = reactive<Record<string, SwitchState>>(
  Object.fromEntries(switchDefs.map((s) => [s.key, { enabled: false, countLabel: '' }]))
)
/** 该组配置是否已落库（后端 _unconfigured 不含 'switches'）；未落库前保存不回写、不冒充已配置 */
const switchesConfigured = ref(false)
/** 第三方通道（第三方密钥组）是否已落库；未落库前保存不回写前端默认对象（护栏④） */
const channelsConfigured = ref(false)

/** 切换「允许租户配置自有密钥」并标记该组已被触碰（触碰即视为配置意图，方可上送） */
function toggleTenantKey(ch: 'sms' | 'smtp') {
  channelsConfigured.value = true
  channels[ch].tenantKey = !channels[ch].tenantKey
}

/** 新租户默认值文案：未配置即明确提示，不回落「关闭」 */
function newTenantDefaultText(key: string): string {
  const v = switches[key]?.newTenantDefault
  if (v === undefined || v === null) return '未配置（点击配置）'
  return v ? '开启' : '关闭'
}
function markSwitchesTouched() {
  switchesConfigured.value = true
}
/** 点击循环：未配置 → 开启 → 关闭 → 未配置 */
function cycleNewTenantDefault(key: string) {
  markSwitchesTouched()
  const cur = switches[key]?.newTenantDefault
  const next = cur === undefined || cur === null ? true : cur === true ? false : undefined
  if (next === undefined) delete switches[key].newTenantDefault
  else switches[key].newTenantDefault = next
}
function toggleSwitchEnabled(key: string) {
  markSwitchesTouched()
  switches[key].enabled = !switches[key].enabled
}

/* 数据字典（R101-C6-3-1 接线：GET/PUT /api/platform/config/data-dict*，表 t_platform_dict(_item)，迁移 185）
 * 四类字典类型是**卡内逐字的代码常量**（unit / category_template / payment_channel / bill_type）；
 * 零预置：迁移与库内初始均无数据 ⇒ 接口读数即真值，页面不内置任何字典项、不兜假行。 */
const dictTabs = [
  { key: 'unit', label: '计量单位' },
  { key: 'category_template', label: '商品分类模板' },
  { key: 'payment_channel', label: '支付渠道' },
  { key: 'bill_type', label: '单据类型' },
]
const dictTab = ref('unit')
const dictItems = ref<any[]>([])
const dictTypeRows = ref<any[]>([])
const dictError = ref('')
const dictSaving = ref(false)

/**
 * 四类字典的**预置内容**（卡 §三B③ 硬口径：走代码常量，不写进迁移、不入库、不参与读取路径）。
 * 只登记卡内已明确给出的那一类内容（计量单位：瓶/箱/件/千克）；其余三类卡内未给口径，故保持空
 * —— 「批量导入」对无预置的类会如实提示，不替产品编造字典内容。
 */
const DICT_PRESETS: Record<string, Array<{ itemCode: string; itemName: string; sortNo: number }>> = {
  unit: [
    { itemCode: 'bottle', itemName: '瓶', sortNo: 1 },
    { itemCode: 'box', itemName: '箱', sortNo: 2 },
    { itemCode: 'piece', itemName: '件', sortNo: 3 },
    { itemCode: 'kg', itemName: '千克', sortNo: 4 },
  ],
  category_template: [],
  payment_channel: [],
  bill_type: [],
}

/** 当前类型的接口读数提示（来自 GET /platform/config/data-dict 的 itemCount/status；未落库即"未配置"） */
const dictTypeHint = computed(() => {
  const row = dictTypeRows.value.find((r: any) => r.dictType === dictTab.value)
  if (!row) return '本类型尚未落库（未配置）· 条目数 0'
  return `本类型状态：${row.status || '未配置'} · 条目数 ${row.itemCount ?? 0}`
})

/** 请求体：整包替换该类型字典项（字段名与后端 zod schema 逐字一致：items） */
function buildDictPayload(items: Array<Record<string, unknown>>) {
  const payload: Record<string, unknown> = {}
  payload.items = items.map((i) => ({
    itemCode: i.itemCode,
    itemName: i.itemName,
    sortNo: i.sortNo,
    status: i.status,
    remark: i.remark ?? null,
  }))
  return payload
}

/* 第三方对接：密钥/计数均来自接口，缺省展示脱敏占位 */
const channels = reactive({
  sms: { accessKey: '', sign: '', tplCount: '', todaySent: '', tenantKey: false },
  smtp: { server: '', authCode: '', rate: '', whitelist: '', tenantKey: false },
  cos: { secretId: '', bucket: '', used: '', lastRotate: '' },
  pay: { merchantWx: '', merchantAli: '', apiKey: '', lastRotate: '' },
})

/* 字典弹窗（字段对齐后端字典项模型：编码/名称/排序/备注；类型与状态由当前 tab 决定） */
const showDictDialog = ref(false)
const editingDict = ref<any>(null)
const dictForm = reactive({ itemCode: '', itemName: '', sortNo: '', remark: '' })

/** 读取字典类型列表（GET /platform/config/data-dict）——零预置 ⇒ 空表时保留"未配置"提示 */
async function loadDictTypes() {
  try {
    const res: any = await listDataDictTypes()
    const items = res?.data?.data?.items
    dictTypeRows.value = Array.isArray(items) ? items : []
  } catch {
    dictTypeRows.value = []
  }
}

/** 读取当前类型字典项（GET /platform/config/data-dict/:dictType/items）——空集即诚实空态 */
async function loadDictItems() {
  dictError.value = ''
  try {
    const res: any = await listDataDictItems(dictTab.value)
    const items = res?.data?.data?.items
    dictItems.value = Array.isArray(items) ? items : []
  } catch {
    dictItems.value = []
    dictError.value = '字典项加载失败（该类型尚未落库或接口异常，当前为空态）'
  }
}

function switchDictTab(key: string) {
  dictTab.value = key
  loadDictItems()
}

function onAddDict() {
  editingDict.value = null
  Object.assign(dictForm, { itemCode: '', itemName: '', sortNo: '', remark: '' })
  showDictDialog.value = true
}

function onEditDict(item: any) {
  editingDict.value = item
  Object.assign(dictForm, {
    itemCode: item.itemCode ?? '',
    itemName: item.itemName ?? '',
    sortNo: String(item.sortNo ?? ''),
    remark: item.remark ?? '',
  })
  showDictDialog.value = true
}

/** 整包替换入口（唯一写路径）：PUT /platform/config/data-dict/:dictType */
async function submitDictItems(next: Array<Record<string, unknown>>, successText: string) {
  if (dictSaving.value) return
  dictSaving.value = true
  try {
    await replaceDataDictItems(dictTab.value, buildDictPayload(next) as any)
    ElMessage.success(successText)
    await loadDictItems()
    await loadDictTypes()
  } catch {
    /* 错误文案由请求层统一处理（含 404 未知类型 / 400 编码重复） */
  } finally {
    dictSaving.value = false
  }
}

/**
 * 批量导入（原"待对接导入端点"占位已删除）：
 * 本模块**没有**导入专用端点 ⇒ 用既有 PUT 整包替换入口写入「代码常量预置模板」。
 * 注意：是"覆盖"该类型字典项（后端 PUT 语义为整包替换），不是增量合并。
 */
async function onImportDict() {
  const preset = DICT_PRESETS[dictTab.value] ?? []
  if (!preset.length) {
    ElMessage.warning('该类型没有代码常量预置模板（本批只预置「计量单位」），未提交任何变更')
    return
  }
  await submitDictItems(
    preset.map((p) => ({ ...p, status: 'ACTIVE', remark: null })),
    `已按预置模板写入 ${preset.length} 条（整包替换）`
  )
}

async function saveDict() {
  const itemCode = dictForm.itemCode.trim()
  const itemName = dictForm.itemName.trim()
  if (!itemCode || !itemName) {
    ElMessage.warning('请输入字典项编码与名称')
    return
  }
  const next = dictItems.value
    .filter((i: any) => i.itemCode !== itemCode && i.itemCode !== editingDict.value?.itemCode)
    .map((i: any) => ({
      itemCode: i.itemCode,
      itemName: i.itemName,
      sortNo: i.sortNo,
      status: i.status,
      remark: i.remark ?? null,
    }))
  next.push({
    itemCode,
    itemName,
    sortNo: Number(dictForm.sortNo) || 0,
    status: 'ACTIVE',
    remark: dictForm.remark.trim() === '' ? null : dictForm.remark.trim(),
  })
  await submitDictItems(next, editingDict.value ? '字典项已更新' : '字典项已新增')
  showDictDialog.value = false
}

/** 删除：把该编码从整包里剔除后整包替换（不提供单行删除端点） */
async function onDeleteDict(item: any) {
  const next = dictItems.value
    .filter((i: any) => i.itemCode !== item.itemCode)
    .map((i: any) => ({
      itemCode: i.itemCode,
      itemName: i.itemName,
      sortNo: i.sortNo,
      status: i.status,
      remark: i.remark ?? null,
    }))
  await submitDictItems(next, `已删除字典项 ${item.itemName}`)
}
function onUploadLogo() {
  if (logoUploading.value) return
  // 触发原生文件选择（按钮是设计稿入口，实际选择由隐藏 input 完成）
  logoInput.value?.click()
}

/**
 * Logo 上传（R101-C6-3-0 接线）
 * 两步：① POST /api/platform/config/logo —— 只落盘并返回 URL（响应 persisted:false）；
 *       ② 持久化走既有 PUT /api/platform/config/sys-config（整包 JSON，含 logoUrl），
 *          **不写 t_platform_config 的键值行**（该表是即时零售凭据表，凌舟裁定 §四 / R8）。
 */
async function onLogoPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  // 清空 value：允许同一个文件再次选择时仍触发 change
  input.value = ''
  if (!file) return
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (!LOGO_ALLOWED_EXT.includes(ext)) {
    ElMessage.warning('仅支持 jpg / jpeg / png / gif / webp 图片')
    return
  }
  if (file.size > LOGO_MAX_BYTES) {
    ElMessage.warning('Logo 文件不得超过 5MB')
    return
  }
  logoUploading.value = true
  logoNotice.value = ''
  try {
    const res: any = await uploadPlatformLogo(file)
    const url = res?.data?.data?.url
    if (!url) {
      logoNotice.value = 'Logo 上传未返回可访问地址，未保存'
      return
    }
    // 持久化：整包提交（后端 PUT 为整包覆盖，未配置的组不上送，守护栏④）
    const payload: Record<string, unknown> = { ...config, logoUrl: url }
    if (switchesConfigured.value) payload.switches = switches
    if (channelsConfigured.value) payload.channels = channels
    await updatePlatformConfig(payload)
    config.logoUrl = url
    ElMessage.success('Logo 已上传并保存')
  } catch (err: any) {
    logoNotice.value = pickBackendMessage(err?.response?.data) || 'Logo 上传失败（未保存）'
  } finally {
    logoUploading.value = false
  }
}

async function saveConfig() {
  saving.value = true
  try {
    /* 未配置的组一律不上送：避免把「未配置」固化成默认值（护栏④） */
    const payload: Record<string, unknown> = { ...config }
    if (switchesConfigured.value) payload.switches = switches
    if (channelsConfigured.value) payload.channels = channels
    await updatePlatformConfig(payload)
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
      const unconf: string[] = Array.isArray(d._unconfigured) ? d._unconfigured : []
      for (const [k, v] of Object.entries(d)) {
        if (k.startsWith('_') || k === 'switches' || k === 'channels') continue
        ;(config as any)[k] = v
      }
      /* 未配置语义（护栏④）：后端 _unconfigured 含 'switches' 即视为该组尚未落库 */
      switchesConfigured.value = !!d.switches && !unconf.includes('switches')
      if (d.switches && typeof d.switches === 'object') {
        for (const s of switchDefs) {
          const src = (d.switches as Record<string, any>)[s.key]
          if (!src || typeof src !== 'object') continue
          const next: SwitchState = {
            enabled: !!src.enabled,
            countLabel: typeof src.countLabel === 'string' ? src.countLabel : '',
          }
          if (Object.prototype.hasOwnProperty.call(src, 'newTenantDefault') && src.newTenantDefault !== null) {
            next.newTenantDefault = !!src.newTenantDefault
          }
          switches[s.key] = next
        }
      }
      if (d.channels && typeof d.channels === 'object') {
        channelsConfigured.value = true
        Object.assign(channels, d.channels)
      }
    }
  } catch {
    // 接口不可用时保持空态，不填充示例数据
    error.value = '系统配置加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await load()
  /* 字典域与系统配置是两套独立接口（不同表 / 不同端点），互不阻塞：一个失败不影响另一个的读取 */
  await loadDictTypes()
  await loadDictItems()
})
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
  overflow: hidden;
}
/* 已上传 Logo 的展示（等比缩放填充徽标区） */
.logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
/* 隐藏的原生文件选择：由「重新上传」按钮触发 */
.logo-file {
  display: none;
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
