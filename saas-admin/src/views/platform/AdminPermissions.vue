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
          <span>邮箱（接收邀请）<i class="req">*</i></span>
          <input v-model="inviteForm.email" class="ipt" placeholder="name@zxql.com" />
        </span>
      </div>
      <span class="fld">
        <span>分配角色 <i class="req">*</i></span>
        <div class="role-chips">
          <span
            v-for="r in roles"
            :key="r.id"
            class="btn"
            :class="{ 'btn-p': inviteForm.role === r.id }"
            @click="inviteForm.role = r.id"
          >{{ r.name }}</span>
          <span v-if="roles.length === 0" class="muted small">暂无可选角色</span>
          <span class="btn" @click="onCreateRole">自定义角色 ▾</span>
        </div>
      </span>
      <span class="fld">
        <span>数据范围</span>
        <span class="sel" @click="cycleInviteScope">{{ scopeLabel(inviteForm.dataScope) }}</span>
      </span>
      <div class="tipbar">
        <span class="ic">i</span>
        <span>邀请邮件 72 小时内有效；首次登录强制改密（≥8 位，含大小写/数字/特殊字符至少三类）；密码策略与登录安全详见《非功能规划 6.1》。</span>
      </div>
    </div>
    <div class="m-ft">
      <span class="btn" @click="showInvite = false">取消</span>
      <span class="btn btn-p" @click="sendInvite">发送邀请</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  getPermissionCatalog,
  getPlatformAdmins,
  getPlatformRoles,
  getRolePermissions,
  replaceRolePermissions
} from '../../api'
import { pickBackendMessage } from '../../utils/http-error'

/* ───────────────────────────────────────────────────────────
   数据接线（R101-C6-3-0）：三处端点均已在 C6-1A / C6-2-T6 上线，本页改为真实调用：
     · 管理员列表   GET /api/platform/admins                （platform.routes.ts:25）
     · 角色列表     GET /api/platform/admins/roles           （platform-role.routes.ts:20）
     · 权限点目录   GET /api/platform/permissions/catalog    （platform-role.routes.ts:24）
     · 权限矩阵     GET|PUT /api/platform/roles/:id/permissions
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

/** 权限点目录（GET /api/platform/permissions/catalog）：矩阵行与数据范围 4 档**均由后端目录派生** */
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
      status: String(r?.status ?? '')
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

/** 选中角色 → 拉取其已保存的权限矩阵（GET /platform/roles/:id/permissions） */
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
   交互现状（2026-09-27 更新，事实逐条可核对）：
     · 本卡已接线：操作日志（GET /api/platform/audit-logs，跳转真实页面）
       + 管理员列表 / 角色列表 / 权限点目录 / 权限矩阵读写（C6-1A 与 C6-2-T6 端点）
     · 后端已上线但本页**未接线**（归属后续批次）：邀请建号 POST /api/platform/admins/invite
       —— 该端点要求 username + phone + role，而本页邀请表单只有「姓名 + 邮箱 + 角色」，
       字段口径不一致，接线需先裁定表单字段；
       重置密码 POST /api/platform/admins/:id/reset-password、启停 PUT /api/platform/admins/:id/status
       —— 端点已上线，本页按钮仍为提示态（未接线）。
     · 仍无后端能力：新建自定义角色 POST /api/platform/roles 已上线，但本页入口走的是
       「自定义角色」弹窗流程，未接线（同上，归属后续批次）。
   ─────────────────────────────────────────────────────────── */
const showInvite = ref(false)
const inviteForm = reactive({
  name: '',
  email: '',
  role: null as number | null,
  dataScope: ''
})

function sendInvite() {
  if (!inviteForm.name || !inviteForm.email) {
    ElMessage.warning('请填写姓名与邮箱')
    return
  }
  // 禁"假成功"：后端邀请端点已上线（POST /api/platform/admins/invite），但要求 username + phone + role，
  // 与本页表单（姓名 + 邮箱 + 角色）字段口径不一致 ⇒ 本页未接线，如实提示、绝不给出"已发送"的成功感
  ElMessage.warning('邀请未发送：后端邀请接口要求「账号 + 姓名 + 手机号 + 角色」，本页表单字段不匹配（接线待裁定）')
  showInvite.value = false
  inviteForm.name = ''
  inviteForm.email = ''
  inviteForm.role = null
  inviteForm.dataScope = ''
}
function cycleInviteScope() {
  const options = dataScopeOptions.value
  if (!options.length) return
  const idx = options.findIndex((o) => o.code === inviteForm.dataScope)
  inviteForm.dataScope = options[(idx + 1) % options.length].code
}
function openAuditLog() {
  // ① 类 #47 + ③-a #48 接线：后端已有 GET /api/platform/audit-logs（admin-platform-audit-log.routes.ts:8/12），
  // 前端既有页面 AuditLogs.vue（路由 '/audit-logs'）+ 封装 getAuditLogs（src/api.ts:296）⇒ 直接跳转真实页面
  router.push('/audit-logs')
}
function onCreateRole() {
  // 平台角色表与目录已就绪（C6-2-T6：POST /api/platform/roles），但本页只有入口、无建号表单 ⇒ 未接线
  ElMessage.warning('新建自定义角色未发起：后端接口已上线，本页缺建号表单（角色名 + 编码），接线待裁定')
}
function onResetPwd(a: any) {
  // 后端已上线（POST /api/platform/admins/:id/reset-password，按裁定 R6 一次性返回新口令、不发信）——
  // 本页按钮尚未接线（归属后续批次），此处如实提示，不假报成功
  ElMessage.warning(`重置密码：${a.realName || a.id}：后端接口已上线，本页尚未接线，未执行`)
}
function onToggleStatus(a: any) {
  // 后端已上线（PUT /api/platform/admins/:id/status）——本页按钮尚未接线（归属后续批次），不假报成功
  ElMessage.warning(`切换状态：${a.realName || a.id}：后端接口已上线，本页尚未接线，未执行`)
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
</style>
