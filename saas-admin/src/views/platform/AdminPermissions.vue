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
          <tr v-if="admins.length === 0">
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
        <div v-if="roles.length === 0" class="empty">暂无角色</div>
        <div
          v-for="r in roles"
          :key="r.id"
          class="role-row"
          :class="{ active: r.id === activeRoleId }"
          @click="activeRoleId = r.id"
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
              <tr v-for="m in PERMISSION_MODULES" :key="m.code">
                <td><b>{{ m.name }}</b></td>
                <td class="col-menu">
                  <span class="ck" :class="{ on: perm(m.code, 'menu') }" @click="toggle(m.code, 'menu')"></span>
                </td>
                <td class="col-pb">
                  <span class="ck" :class="{ on: perm(m.code, 'pageBtn') }" @click="toggle(m.code, 'pageBtn')"></span>
                </td>
                <td class="col-scope">
                  <span class="sel" @click="cycleScope(m.code)">{{ perm(m.code, 'dataScope') || '—' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
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
        <span class="sel" @click="cycleInviteScope">{{ inviteForm.dataScope }}</span>
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
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'

/* ───────────────────────────────────────────────────────────
   数据（均无对应接口，初始为空数组 → 空态；接入后端后填充）
   ─────────────────────────────────────────────────────────── */
// TODO: 待接入 GET /platform/admins —— 管理员账号列表
//   字段建议：id / realName / account / roleName / roleType / dataScope / lastLogin / status
const admins = ref<any[]>([])

// TODO: 待接入 GET /platform/admins/roles —— 角色列表
//   字段建议：id / name / type(builtin|custom) / domainCount
const roles = ref<any[]>([])
const activeRoleId = ref<number | null>(null)

const customRoleCount = computed(
  () => roles.value.filter((r) => r.type === 'custom').length
)
const builtinRoleCount = computed(
  () => roles.value.filter((r) => r.type === 'builtin').length
)

// 功能域权限目录（RBAC 树结构骨架，属平台功能域而非虚构业务数据）
// TODO: 待接入 GET /platform/permissions/catalog —— 返回功能域与三级权限点（菜单/操作/数据）
const PERMISSION_MODULES = [
  { code: 'tenant', name: '租户管理' },
  { code: 'billing', name: '套餐与计费' },
  { code: 'sysconfig', name: '全局系统配置' },
  { code: 'monitor', name: '运维监控 / 日志' },
  { code: 'ticket', name: '工单系统' },
  { code: 'marketing', name: '运营营销' },
  { code: 'ai', name: 'AI 能力管控' }
]

// 当前选中角色的权限状态：{ [moduleCode]: { menu, pageBtn, dataScope } }
// 空 = 未加载，矩阵渲染未勾选空态
const permissionState = ref<Record<string, { menu: boolean; pageBtn: boolean; dataScope: string }>>({})

// 数据范围可选项（系统枚举，非虚构记录）
const DATA_SCOPES = ['全部租户', '灰度组租户', '指定跟进组', '账单口径全部']

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
  const idx = DATA_SCOPES.indexOf(cur.dataScope)
  cur.dataScope = DATA_SCOPES[(idx + 1) % DATA_SCOPES.length]
  permissionState.value = { ...permissionState.value, [code]: cur }
}

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
   交互（均为演示态：结构还原，提交/跳转接口待接入）
   ─────────────────────────────────────────────────────────── */
const showInvite = ref(false)
const inviteForm = reactive({
  name: '',
  email: '',
  role: null as number | null,
  dataScope: '全部租户'
})

function sendInvite() {
  // TODO: 待接入 POST /platform/admins/invite { name, email, roleId, dataScope }
  if (!inviteForm.name || !inviteForm.email) {
    ElMessage.warning('请填写姓名与邮箱')
    return
  }
  ElMessage.success('邀请已发送（演示：接口待接入）')
  showInvite.value = false
  inviteForm.name = ''
  inviteForm.email = ''
  inviteForm.role = null
  inviteForm.dataScope = '全部租户'
}
function cycleInviteScope() {
  const idx = DATA_SCOPES.indexOf(inviteForm.dataScope)
  inviteForm.dataScope = DATA_SCOPES[(idx + 1) % DATA_SCOPES.length]
}
function openAuditLog() {
  // TODO: 待接入操作日志 —— 拉取 GET /platform/audit-logs 或跳转 /audit-logs
  ElMessage.info('操作日志（接口待接入）')
}
function onCreateRole() {
  // TODO: 待接入 POST /platform/admins/roles（自定义角色）
  ElMessage.info('新建自定义角色（接口待接入）')
}
function onResetPwd(a: any) {
  // TODO: 待接入 POST /platform/admins/{id}/reset-password
  ElMessage.info(`重置密码：${a.realName || a.id}（接口待接入）`)
}
function onToggleStatus(a: any) {
  // TODO: 待接入 PUT /platform/admins/{id}/status
  ElMessage.info(`切换状态：${a.realName || a.id}（接口待接入）`)
}
</script>

<style scoped>
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
