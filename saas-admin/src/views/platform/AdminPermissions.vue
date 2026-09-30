<template>
  <!-- ════════ 页头 ════════ -->
  <div class="pg-hd">
    <div>
      <div class="pt4">管理员权限</div>
      <p class="pd">
        管理员 {{ admins.length }} 人 · 内置角色 {{ builtinRoleCount }} 个（不可删除）· 自定义角色 {{ customRoleCount }} 个 · 权限变更自动生成前后对比快照
      </p>
    </div>
    <div class="pg-act">
      <span class="btn" @click="openAuditLog">操作日志</span>
      <span class="btn btn-p" @click="showInvite = true">+ 邀请管理员</span>
    </div>
  </div>

  <!-- 加载失败提示（内容区，不与拦截器 toast 重复） -->
  <div v-if="loadNotice" class="tipbar r mt8">
    <span class="ic">!</span>
    <span>{{ loadNotice }}</span>
  </div>

  <!-- ════════ 管理员账号 ════════ -->
  <div class="panel">
    <div class="p-hd">
      <span class="pt">管理员账号</span>
      <span class="ph-s">连续 5 次登录失败锁定 15 分钟 · 首次登录强制改密 · 90 天改密提醒</span>
    </div>
    <div class="tblwrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>姓名</th>
            <th>账号</th>
            <th>角色</th>
            <th>数据范围</th>
            <th>最近登录</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="adminsLoading">
            <td colspan="7"><div class="empty">加载中…</div></td>
          </tr>
          <tr v-else-if="admins.length === 0">
            <td colspan="7"><div class="empty">暂无管理员账号</div></td>
          </tr>
          <tr v-for="a in admins" :key="a.id">
            <td><b>{{ a.realName }}</b></td>
            <td>{{ a.account }}</td>
            <td><span class="tag" :class="roleTagClass(a.roleType)">{{ a.roleName }}</span></td>
            <td>{{ a.dataScope }}</td>
            <td>{{ a.lastLogin || '-' }}</td>
            <td>
              <span class="tag" :class="a.status === 'DISABLED' ? 'tag-gy' : 'tag-g'">
                {{ a.status === 'DISABLED' ? '已停用' : '正常' }}
              </span>
            </td>
            <td>
              <span class="btn-t gy" @click="onResetPwd(a)">重置密码</span>
              <span class="btn-t gy" @click="onToggleStatus(a)">{{ a.status === 'DISABLED' ? '启用' : '停用' }}</span>
              <span class="btn-t" @click="openAuditLog">日志</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="small mt8">
      数据范围档位未落库（后端管理员表无该字段）⇒ 该列显示 —；档位取值与读写见下方权限矩阵「数据权限」列（4 档，来源于后端权限点目录 DATA 级）。
    </p>
  </div>

  <!-- ════════ 角色与权限配置（RBAC 权限树） ════════ -->
  <div class="panel mt12">
    <div class="p-hd">
      <span class="pt">角色与权限配置（RBAC 权限树）</span>
      <span class="ph-s">左侧选角色 · 右侧勾选三级权限 · 变更需超管二次确认</span>
    </div>
    <div class="p-bd rbac-grid">
      <!-- 左：角色列表 -->
      <div class="rbac-list">
        <div v-if="rolesLoading" class="empty">加载中…</div>
        <div v-else-if="roles.length === 0" class="empty">暂无角色</div>
        <div
          v-for="r in roles"
          :key="r.id"
          class="role-row"
          :class="{ active: r.id === activeRoleId }"
          @click="selectRole(r.id)"
        >
          <span class="tag" :class="roleTagClass(r.type)">{{ r.name }}</span>
          <span class="rr-spacer"></span>
          <em class="rr-cnt">{{ r.domainCount }} 域</em>
        </div>
        <button class="btn role-add" type="button" @click="onCreateRole">+ 新建自定义角色</button>
      </div>

      <!-- 右：三级权限矩阵 -->
      <div class="rbac-detail">
        <div v-if="activeRoleId === null" class="tipbar">
          <span class="ic">i</span>
          <span>请选择左侧角色查看并配置其「菜单 / 操作 / 数据」三类权限，变更需超级管理员二次确认。</span>
        </div>
        <div class="tblwrap">
          <table class="tbl tbl-perm">
            <thead>
              <tr>
                <th>功能域 / 菜单</th>
                <th class="col-menu">菜单</th>
                <th class="col-pb">页面 / 按钮</th>
                <th class="col-scope">数据权限（数据范围） <span class="v15-tag lt">v1.5</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!permissionModules.length">
                <td colspan="4"><div class="empty">权限点目录未加载（后端目录接口未返回数据）</div></td>
              </tr>
              <tr v-for="m in permissionModules" :key="m.code">
                <td><b>{{ m.name }}</b></td>
                <td class="col-menu">
                  <span class="ck" :class="{ on: perm(m.code, 'menu') }" @click="toggle(m.code, 'menu')"></span>
                </td>
                <td class="col-pb">
                  <span class="ck" :class="{ on: perm(m.code, 'pageBtn') }" @click="toggle(m.code, 'pageBtn')"></span>
                </td>
                <td class="col-scope">
                  <span class="sel" @click="cycleScope(m.code)">{{ scopeLabel(perm(m.code, 'dataScope')) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="activeRoleId !== null" class="matrix-act mt8">
          <span class="btn btn-p" @click="onSavePermissions">{{ savingMatrix ? '保存中…' : '保存权限矩阵' }}</span>
          <span class="small">整表替换；目录外的功能域 / 4 档外的数据范围由后端 400 拒绝（如实提示，不吞错）</span>
        </div>
        <div v-if="matrixNotice" class="tipbar r mt8">
          <span class="ic">!</span>
          <span>{{ matrixNotice }}</span>
        </div>
        <p class="small mt10">
          权限红线：财务与运营互不为对方上级；内置角色调整仅限超级管理员；每次保存生成「变更前后对比快照」自动归档。权限矩阵覆盖<b>菜单权限 / 操作权限 / 数据权限</b>三类维度——「菜单」列控制入口可见、「页面 / 按钮」列控制操作许可、「数据权限」列限定可见数据范围（全部租户 / 灰度组租户 / 指定跟进组），账号表「数据范围」列与之联动 <span class="v15-tag lt">v1.5</span>。
        </p>
      </div>
    </div>
  </div>

  <!-- ════════ 邀请管理员弹窗 ════════ -->
  <div v-if="showInvite" class="ov" @click.self="showInvite = false"></div>
  <div v-if="showInvite" class="modal">
    <div class="m-hd">
      <span class="pt">邀请管理员</span>
      <span class="d-x" @click="showInvite = false">✕</span>
    </div>
    <div class="m-bd">
      <div class="frow">
        <span class="fld fld-grow">
          <span>姓名 <i class="req">*</i></span>
          <input v-model="inviteForm.name" class="ipt" placeholder="请输入姓名" />
        </span>
        <span class="fld fld-wide">
          <span>登录账号 <i class="req">*</i></span>
          <input v-model="inviteForm.username" class="ipt" placeholder="4-50 位字母/数字" />
        </span>
      </div>
      <span class="fld">
        <span>手机号 <i class="req">*</i></span>
        <input v-model="inviteForm.phone" class="ipt" placeholder="11-20 位，用于账号核验" />
      </span>
      <div class="tipbar">
        <span class="ic">i</span>
        <span>不发邮件 / 短信：提交后由服务端生成 12 位初始口令，仅在弹窗展示一次，请立即复制转达本人；首次登录强制改密（≥8 位，含大小写 / 数字 / 特殊字符至少三类）。本单不绑定角色与数据范围（平台角色矩阵的绑定属下一档）。</span>
      </div>
      <div v-if="inviteNotice" class="tipbar r">
        <span class="ic">!</span>
        <span>{{ inviteNotice }}</span>
      </div>
    </div>
    <div class="m-ft">
      <span class="btn" @click="showInvite = false">取消</span>
      <span class="btn btn-p" @click="sendInvite">{{ inviting ? '提交中…' : '确认邀请' }}</span>
    </div>
  </div>

  <!-- ════════ 一次性口令弹窗（邀请建号 / 重置密码共用，关闭即不可再查看） ════════ -->
  <div v-if="pwdDialog.open" class="ov" @click.self="closePwdDialog"></div>
  <div v-if="pwdDialog.open" class="modal modal-sm">
    <div class="m-hd">
      <span class="pt">初始口令（只显示一次）</span>
      <span class="d-x" @click="closePwdDialog">✕</span>
    </div>
    <div class="m-bd">
      <div class="tipbar r">
        <span class="ic">!</span>
        <span>只显示一次：服务端只存 bcrypt 哈希，关闭本窗口后无法再查看，也不发邮件 / 短信、不写日志与审计明细。请立即复制并转达本人。</span>
      </div>
      <span class="fld">
        <span>{{ pwdDialog.title }}</span>
        <div class="pwd-row">
          <code class="pwd-code">{{ pwdDialog.password }}</code>
          <span class="btn" @click="copyPassword">复制</span>
        </div>
      </span>
    </div>
    <div class="m-ft">
      <span class="btn btn-p" @click="closePwdDialog">我已抄录，关闭</span>
    </div>
  </div>

  <!-- ════════ 新建自定义角色弹窗 ════════ -->
  <div v-if="showCreateRole" class="ov" @click.self="closeCreateRole"></div>
  <div v-if="showCreateRole" class="modal modal-sm">
    <div class="m-hd">
      <span class="pt">新建自定义角色</span>
      <span class="d-x" @click="closeCreateRole">✕</span>
    </div>
    <div class="m-bd">
      <span class="fld">
        <span>角色名称 <i class="req">*</i></span>
        <input v-model="roleForm.name" class="ipt" placeholder="如：区域运营" />
      </span>
      <span class="fld">
        <span>角色编码 <i class="req">*</i></span>
        <input v-model="roleForm.code" class="ipt" placeholder="小写字母开头，2-32 位小写字母 / 数字 / 下划线" />
      </span>
      <span class="fld">
        <span>备注</span>
        <input v-model="roleForm.remark" class="ipt" placeholder="选填" />
      </span>
      <div class="tipbar">
        <span class="ic">i</span>
        <span>接口创建的角色一律为「自定义」类型（内置角色不可经接口创建）；编码重复时按后端原文提示（409）。</span>
      </div>
      <div v-if="roleNotice" class="tipbar r">
        <span class="ic">!</span>
        <span>{{ roleNotice }}</span>
      </div>
    </div>
    <div class="m-ft">
      <span class="btn" @click="closeCreateRole">取消</span>
      <span class="btn btn-p" @click="submitCreateRole">{{ creatingRole ? '创建中…' : '创建' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createPlatformRole,
  getPermissionCatalog,
  getPlatformAdmins,
  getPlatformRoles,
  getRolePermissions,
  invitePlatformAdmin,
  resetPlatformAdminPassword,
  updatePlatformAdminStatus,
  replaceRolePermissions
} from '../../api'
import { pickBackendMessage } from '../../utils/http-error'

/* ───────────────────────────────────────────────────────────
   数据接线（R101-C6-3-0 + C6-3-0b）：本页所有请求都走 src/api.ts 的封装函数，
   页面内**不出现任何端点字面路径**（路径唯一出处＝api.ts，逐字对齐后端路由）：
     · 管理员列表 / 角色列表 / 权限点目录 / 权限矩阵读写 → getPlatformAdmins / getPlatformRoles
       / getPermissionCatalog / getRolePermissions / replaceRolePermissions
     · 启停 / 重置密码 / 新建角色 / 邀请建号 → updatePlatformAdminStatus / resetPlatformAdminPassword
       / createPlatformRole / invitePlatformAdmin
   零假数据：管理员/角色/目录/矩阵全部来自接口；取不到即空态，页面**不内置任何兜底清单**。
   ─────────────────────────────────────────────────────────── */
const router = useRouter()

/** 平台管理员角色枚举 → 中文（后端返回 role: SUPER_ADMIN|ADMIN|SUPPORT，无 roleName 字段） */
const ADMIN_ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: '超级管理员',
  ADMIN: '管理员',
  SUPPORT: '客服'
}

const admins = ref<any[]>([])
const adminsLoading = ref(false)
const roles = ref<any[]>([])
const rolesLoading = ref(false)
const activeRoleId = ref<number | null>(null)
/** 内容区失败提示（toast 由 api 拦截器统一弹，页面只做内容区提示） */
const loadNotice = ref('')

const customRoleCount = computed(
  () => roles.value.filter((r) => r.type === 'custom').length
)
const builtinRoleCount = computed(
  () => roles.value.filter((r) => r.type === 'builtin').length
)

/** 权限点目录（api.ts getPermissionCatalog）：矩阵行与数据范围 4 档**均由后端目录派生** */
const permissionModules = ref<Array<{ code: string; name: string }>>([])
const dataScopeOptions = ref<Array<{ code: string; name: string }>>([])

// 当前选中角色的权限状态：{ [moduleCode]: { menu, pageBtn, dataScope } }
// 空 = 未加载，矩阵渲染未勾选空态
const permissionState = ref<Record<string, { menu: boolean; pageBtn: boolean; dataScope: string }>>({})
const savingMatrix = ref(false)
const matrixNotice = ref('')

type PermKey = 'menu' | 'pageBtn' | 'dataScope'
function perm(code: string, key: PermKey): any {
  const cur = permissionState.value[code]
  if (!cur) return key === 'dataScope' ? '' : false
  return cur[key]
}
function toggle(code: string, key: 'menu' | 'pageBtn') {
  const cur = permissionState.value[code] || { menu: false, pageBtn: false, dataScope: '' }
  cur[key] = !cur[key]
  permissionState.value = { ...permissionState.value, [code]: cur }
}
function cycleScope(code: string) {
  const cur = permissionState.value[code] || { menu: false, pageBtn: false, dataScope: '' }
  const options = dataScopeOptions.value
  if (!options.length) return
  const idx = options.findIndex((o) => o.code === cur.dataScope)
  cur.dataScope = options[(idx + 1) % options.length].code
  permissionState.value = { ...permissionState.value, [code]: cur }
}
/** 落库值 = 目录里的 permCode（scope:all 等）⇒ 展示其中文档位名；空值显示 — */
function scopeLabel(code: string): string {
  if (!code) return '—'
  return dataScopeOptions.value.find((o) => o.code === code)?.name ?? code
}

/** 管理员列表：字段全部取自接口；数据范围档位后端无该字段 ⇒ 固定 —（不臆造） */
async function loadAdmins() {
  adminsLoading.value = true
  try {
    const res: any = await getPlatformAdmins({ page: 1, pageSize: 50 })
    const records = res?.data?.data?.records
    admins.value = (Array.isArray(records) ? records : []).map((r: any) => ({
      id: r?.id,
      realName: r?.realName ?? r?.username ?? '—',
      account: r?.username ?? '—',
      roleName: ADMIN_ROLE_LABELS[String(r?.role ?? '')] ?? String(r?.role ?? '—'),
      roleType: String(r?.role ?? '').toLowerCase(),
      dataScope: '—',
      lastLogin: r?.lastLoginAt ? String(r.lastLoginAt).replace('T', ' ').slice(0, 16) : '',
      // 列表接口的 status 是 TINYINT（1=启用/0=禁用），启停接口返回的是 "ACTIVE"/"DISABLED" 字符串。
      // 必须归一化：否则整列恒显示「正常」、启停按钮文案也不翻转，R4「以服务端返回为准刷新该行」无从体现。
      status:
        r?.status === 0 || r?.status === '0' || r?.status === 'DISABLED'
          ? 'DISABLED'
          : 'ACTIVE'
    }))
    loadNotice.value = ''
  } catch {
    admins.value = []
    loadNotice.value = '管理员列表加载失败（未取到管理员数据）'
  } finally {
    adminsLoading.value = false
  }
}

/** 角色列表：空表 ⇒ roles: []（空态），不内置内置角色兜底 */
async function loadRoles() {
  rolesLoading.value = true
  try {
    const res: any = await getPlatformRoles()
    const list = res?.data?.data?.roles
    roles.value = Array.isArray(list) ? list : []
    if (activeRoleId.value !== null && !roles.value.some((r) => r.id === activeRoleId.value)) {
      activeRoleId.value = null
      permissionState.value = {}
    }
  } catch {
    roles.value = []
  } finally {
    rolesLoading.value = false
  }
}

/** 权限点目录：矩阵行 = 含 MENU 级权限的功能域；数据范围 4 档 = DATA 级权限点 */
async function loadCatalog() {
  try {
    const res: any = await getPermissionCatalog()
    const modules = res?.data?.data?.modules
    const list: any[] = Array.isArray(modules) ? modules : []
    permissionModules.value = list
      .filter((m) => Array.isArray(m?.permissions) && m.permissions.some((p: any) => p?.permLevel === 'MENU'))
      .map((m) => ({ code: String(m.moduleCode), name: String(m.moduleName ?? m.moduleCode) }))
    dataScopeOptions.value = list
      .flatMap((m) => (Array.isArray(m?.permissions) ? m.permissions : []))
      .filter((p: any) => p?.permLevel === 'DATA')
      .map((p: any) => ({ code: String(p.permCode), name: String(p.permName ?? p.permCode) }))
  } catch {
    permissionModules.value = []
    dataScopeOptions.value = []
  }
}

/** 选中角色 → 拉取其已保存的权限矩阵（api.ts getRolePermissions） */
async function selectRole(id: number) {
  activeRoleId.value = id
  permissionState.value = {}
  matrixNotice.value = ''
  try {
    const res: any = await getRolePermissions(id)
    const matrix = res?.data?.data?.matrix
    const next: Record<string, { menu: boolean; pageBtn: boolean; dataScope: string }> = {}
    for (const cell of Array.isArray(matrix) ? matrix : []) {
      next[String(cell?.moduleCode)] = {
        menu: !!cell?.canMenu,
        pageBtn: !!cell?.canPageBtn,
        dataScope: cell?.dataScope ? String(cell.dataScope) : ''
      }
    }
    permissionState.value = next
  } catch {
    permissionState.value = {}
    matrixNotice.value = '该角色权限矩阵加载失败（未取到矩阵数据）'
  }
}

/** 保存矩阵：PUT 整表替换；目录外的域 / 4 档外的档位由后端 400 拒绝 ⇒ 原样提示，不吞错 */
async function onSavePermissions() {
  const id = activeRoleId.value
  if (id === null || savingMatrix.value) return
  savingMatrix.value = true
  matrixNotice.value = ''
  try {
    const matrix = permissionModules.value.map((m) => {
      const cell = permissionState.value[m.code] || { menu: false, pageBtn: false, dataScope: '' }
      return {
        moduleCode: m.code,
        canMenu: !!cell.menu,
        canPageBtn: !!cell.pageBtn,
        dataScope: cell.dataScope || null
      }
    })
    const res: any = await replaceRolePermissions(id, matrix)
    const saved = res?.data?.data?.saved
    ElMessage.success(`权限矩阵已保存（${saved ?? matrix.length} 个功能域）`)
    await loadRoles() // domainCount 随之变化，刷新左侧列表
  } catch (e: any) {
    matrixNotice.value = pickBackendMessage(e?.response?.data) || '权限矩阵保存失败'
  } finally {
    savingMatrix.value = false
  }
}

onMounted(() => {
  loadAdmins()
  loadCatalog()
  loadRoles()
})

// 角色类型 → 标签色（与 .tag-* 对应，非硬编码名称）
function roleTagClass(type: string): string {
  const map: Record<string, string> = {
    super: 'tag-r',
    ops: 'tag-b',
    fin: 'tag-p',
    cs: 'tag-o',
    custom: 'tag-gy'
  }
  return map[type] || 'tag-gy'
}

/* ───────────────────────────────────────────────────────────
   C6-3-0b 接线（2026-10-01 阿坚，事实逐条可核对）：
     · 本页已接线：操作日志跳转 + 管理员列表 / 角色列表 / 权限点目录 / 权限矩阵读写
       + **管理员启停 / 重置密码 / 新建角色 / 邀请建号** 4 个动作；
       4 条字面路径只在 src/api.ts 出现，本页不散落任何端点字面量。
     · 一次性口令（邀请 / 重置）：明文只出现在该次响应体，仅存于本页内存变量 pwdDialog.password，
       关闭弹窗立即清空；不写浏览器本地存储、不写 URL、不打任何日志、不进审计明细。
   ─────────────────────────────────────────────────────────── */
const showInvite = ref(false)
const inviting = ref(false)
const inviteNotice = ref('')
const inviteForm = reactive({
  username: '',
  name: '',
  phone: ''
})

/** 一次性口令弹窗（邀请建号 / 重置密码共用）：口令只存内存，关闭即清空 */
const pwdDialog = reactive({
  open: false,
  title: '',
  password: ''
})

/**
 * 动作失败文案：优先后端中文原文（HTTP 4xx/5xx 走 e.response.data，业务码非 0 走 e.message），
 * 取不到才用兜底。页面不再弹 toast（api 拦截器已弹过一次），只把原文写进内容区/弹窗错误态。
 */
function actionErrorText(e: any, fallback: string): string {
  const fromBody = pickBackendMessage(e?.response?.data)
  if (fromBody) return fromBody
  const message = typeof e?.message === 'string' ? e.message : ''
  if (/[\u4e00-\u9fa5]/.test(message)) return message
  return fallback
}

function showPasswordOnce(title: string, password: string) {
  pwdDialog.title = title
  pwdDialog.password = password
  pwdDialog.open = true
}
function closePwdDialog() {
  pwdDialog.open = false
  pwdDialog.password = ''
  pwdDialog.title = ''
}
function copyPassword() {
  const text = pwdDialog.password
  if (!text) return
  navigator.clipboard?.writeText(text).then(
    () => ElMessage.success('已复制初始口令'),
    () => ElMessage.warning('复制失败，请手动选中后复制')
  )
}

/** 邀请建号（api.ts invitePlatformAdmin）：不发邮件/短信；服务端生成 12 位初始口令，仅响应体一次 */
async function sendInvite() {
  if (inviting.value) return
  if (!inviteForm.name.trim()) {
    ElMessage.warning('请填写姓名')
    return
  }
  if (!inviteForm.username.trim()) {
    ElMessage.warning('请填写登录账号')
    return
  }
  if (!inviteForm.phone.trim()) {
    ElMessage.warning('请填写手机号')
    return
  }
  inviting.value = true
  inviteNotice.value = ''
  try {
    const res: any = await invitePlatformAdmin({
      username: inviteForm.username.trim(),
      name: inviteForm.name.trim(),
      phone: inviteForm.phone.trim()
    })
    const data = res?.data?.data ?? {}
    const createdUsername = String(data.username ?? inviteForm.username)
    showInvite.value = false
    resetInviteForm()
    await loadAdmins() // 新账号进列表
    showPasswordOnce(`管理员 ${createdUsername} 的初始口令`, String(data.initialPassword ?? ''))
  } catch (e: any) {
    // 拦截器已弹一次中文提示，这里只补内容区错误态：不吞错、不重复弹 toast
    inviteNotice.value = actionErrorText(e, '邀请建号失败，请稍后重试')
  } finally {
    inviting.value = false
  }
}
function resetInviteForm() {
  inviteForm.username = ''
  inviteForm.name = ''
  inviteForm.phone = ''
}
function openAuditLog() {
  // ① 类 #47 + ③-a #48 接线：后端已有审计日志端点（admin-platform-audit-log.routes.ts:8/12），
  // 前端既有页面 AuditLogs.vue（路由 '/audit-logs'）+ 封装 getAuditLogs（src/api.ts:296）⇒ 直接跳转真实页面
  router.push('/audit-logs')
}

/** 新建自定义角色（api.ts createPlatformRole）：成功后就地刷新角色列表，409 原样展示后端文案（R5） */
const showCreateRole = ref(false)
const creatingRole = ref(false)
const roleNotice = ref('')
const roleForm = reactive({ name: '', code: '', remark: '' })

function onCreateRole() {
  roleForm.name = ''
  roleForm.code = ''
  roleForm.remark = ''
  roleNotice.value = ''
  showCreateRole.value = true
}
function closeCreateRole() {
  showCreateRole.value = false
  roleNotice.value = ''
}
async function submitCreateRole() {
  if (creatingRole.value) return
  const name = roleForm.name.trim()
  const code = roleForm.code.trim()
  if (!name) {
    ElMessage.warning('请填写角色名称')
    return
  }
  // 与后端 codeSchema 同口径（小写字母开头，2-32 位小写字母/数字/下划线）
  if (!/^[a-z][a-z0-9_]{1,31}$/.test(code)) {
    ElMessage.warning('角色编码须为小写字母开头、2-32 位小写字母/数字/下划线')
    return
  }
  creatingRole.value = true
  roleNotice.value = ''
  try {
    await createPlatformRole({ name, code, remark: roleForm.remark.trim() || undefined })
    showCreateRole.value = false
    ElMessage.success(`自定义角色已创建（${name}）`)
    await loadRoles()
  } catch (e: any) {
    // 编码重复 ⇒ 后端 409，原文照登（不自行改写成「创建失败」）
    roleNotice.value = actionErrorText(e, '新建角色失败，请稍后重试')
  } finally {
    creatingRole.value = false
  }
}

/** 重置密码：先二次确认（文案写明旧口令立即失效），成功后一次性展示新口令（R3） */
async function onResetPwd(a: any) {
  try {
    await ElMessageBox.confirm(
      `确认重置「${a.realName || a.account}」的登录口令？重置后旧口令立即失效，新口令只在提交后展示一次。`,
      '重置密码',
      { confirmButtonText: '确认重置', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  loadNotice.value = ''
  try {
    const res: any = await resetPlatformAdminPassword(Number(a.id))
    const data = res?.data?.data ?? {}
    showPasswordOnce(`管理员 ${String(data.username ?? a.account)} 的新口令`, String(data.initialPassword ?? ''))
  } catch (e: any) {
    loadNotice.value = actionErrorText(e, '重置密码失败，请稍后重试')
  }
}

/** 启停：前端不自行拦截（含停用自己 / 最后一个 SUPER_ADMIN），一律以后端返回为准刷新该行（R4） */
async function onToggleStatus(a: any) {
  const next = a.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED'
  loadNotice.value = ''
  try {
    const res: any = await updatePlatformAdminStatus(Number(a.id), next)
    const applied = res?.data?.data?.status
    if (applied === 'ACTIVE' || applied === 'DISABLED') a.status = applied
    else await loadAdmins()
    ElMessage.success(applied === 'DISABLED' ? '已停用该管理员' : '已启用该管理员')
  } catch (e: any) {
    // 后端拒绝时原文上屏（不掩盖、不自行判定）
    loadNotice.value = actionErrorText(e, '启停失败，请稍后重试')
  }
}
</script>

<style scoped>
/* 权限矩阵保存区（仅用 token 组合） */
.matrix-act {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
/* ───── RBAC 双栏布局（设计稿 p-bd grid 200px 1fr，components.css 未移植，按令牌实现） ───── */
.rbac-grid {
  display: grid;
  grid-template-columns: var(--rbac-side-w) 1fr;
  gap: 0;
  padding: 0;
}
.rbac-list {
  border-right: 1px solid var(--g1);
  padding: var(--space-2);
}
.rbac-detail {
  padding: var(--space-3) var(--panel-body-padding);
}

/* 角色行（设计稿 .qrow 变体） */
.role-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: var(--space-1) 0;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  cursor: pointer;
}
.role-row.active {
  background: var(--color-primary-bg);
}
.rr-spacer {
  flex: 1;
}
.rr-cnt {
  font-style: normal;
  color: var(--g5);
  font-size: var(--text-xs);
  white-space: nowrap;
}

/* 新建自定义角色按钮（设计稿 border-style:dashed） */
.role-add {
  width: 100%;
  justify-content: center;
  margin-top: var(--space-2);
  border-style: dashed;
}

/* 权限矩阵列宽（设计稿 角色列 88px / 模块列 150px） */
.tbl-perm .col-menu {
  width: var(--rbac-role-col-w);
}
.tbl-perm .col-pb {
  width: var(--rbac-perm-col-w);
}
.tbl-perm .col-scope {
  width: var(--rbac-perm-col-w);
}

/* 弹窗表单辅助类 */
.fld-grow {
  flex: 1;
}
.fld-wide {
  flex: 1.4;
}
.role-chips {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
  align-items: center;
}
.req {
  color: var(--color-danger);
  font-style: normal;
}

/* v1.5 修订标注（设计稿 .v15-tag，components.css 未移植，按令牌实现） */
.v15-tag {
  display: inline-flex;
  align-items: center;
  font-size: var(--text-xs);
  line-height: 1;
  padding: var(--tag-padding);
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--text-inverse);
  font-weight: var(--font-semibold);
  letter-spacing: var(--ver-tag-tracking);
  vertical-align: var(--ver-tag-valign);
  white-space: nowrap;
}
.v15-tag.lt {
  background: var(--color-primary-bg);
  color: var(--color-primary-hover);
  border: 1px solid var(--color-primary-soft);
}

/* 邀请管理员弹窗（设计稿 .ov / .modal / .m-hd / .m-bd / .m-ft / .d-x，components.css 未移植，按令牌实现） */
.ov {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  z-index: 30;
}
.modal {
  position: fixed;
  z-index: 31;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: var(--modal-width);
  max-width: 92%;
  max-height: 88%;
  background: var(--bg-card);
  border-radius: var(--radius-2xl);
  box-shadow: var(--modal-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.m-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--g2);
  flex: none;
}
.m-hd .pt {
  font-size: var(--text-md);
  font-weight: var(--font-bold);
}
.d-x {
  color: var(--g4);
  font-size: var(--text-lg);
  line-height: 1;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.d-x:hover {
  background: var(--g0);
  color: var(--g6);
}
.m-bd {
  padding: var(--space-4);
  overflow-y: auto;
  display: grid;
  gap: var(--space-3);
}
.m-ft {
  border-top: 1px solid var(--g2);
  padding: var(--space-3) var(--space-4);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  background: var(--g0);
  flex: none;
}

/* 一次性口令 / 新建角色弹窗（窄版）+ 口令展示行 */
.modal-sm {
  width: var(--modal-width-sm);
}
.pwd-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
}
.pwd-code {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--g2);
  border-radius: var(--radius-md);
  background: var(--g0);
  font-family: var(--font-mono, monospace);
  font-size: var(--text-md);
  letter-spacing: var(--ver-tag-tracking, 0.04em);
  word-break: break-all;
}
</style>
