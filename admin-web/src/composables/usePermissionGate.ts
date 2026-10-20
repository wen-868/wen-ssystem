/**
 * 按钮级权限门 composable（S3-240 · D4）
 *
 * 用途：页面按钮按**注册表里的门 id**决定显隐 ——
 *   `<el-button v-if="canGate('goods-brand-delete')">删除</el-button>`
 *
 * 判据源：`stores/app.ts` 的 `permissions`（登录响应 / `/admin/auth/me` 下发的
 * `t_sys_role.permissions` 合并串），与手机端 `app-mobile` 的入口门**同源同口径**；
 * 匹配实现集中在 `config/permission-gates.ts`（后端 `matchPermission` 的逐条镜像）。
 *
 * 口径：
 *   · `permissions` 为 null/undefined ⇒ 尚未取到权限码 ⇒ **不显示**（失败关闭，同 S3-231 F3 裁定 5）；
 *   · `permissions` 为空数组           ⇒ 确实无任何码 ⇒ **不显示**；
 *   · 门码数组为空（注册表 `status='registered'`）⇒ **放行**（该按钮不设门，理由见注册表 `note`）；
 *   · 门 id 未在注册表登记             ⇒ **不显示**（失败关闭）＋ 控制台报出，避免静默放行。
 *
 * 为什么不用「角色名单」判定：不变量 I1' 约束的是**权限码**（后端 `requirePermission(码)`）；
 * 角色与码会各自漂移（`STORE_ADMIN` / `SALESMAN` 是旧词表角色，菜单授予 ≠ 持码）。
 */
import { computed } from "vue";
import { useAppStore } from "../stores/app";
import { codesOfGate } from "../config/permission-gates";

export function usePermissionGate() {
  const appStore = useAppStore();

  /** 当前用户权限码（null/undefined = 未取到） */
  const permissions = computed<string[] | null | undefined>(() => appStore.permissions);

  /** 是否已取到权限码（供"暂缓判定"类展示；一般页面不需要） */
  const permissionsLoaded = computed(() => Array.isArray(permissions.value));

  /** 按注册表门 id 判定按钮显隐（**推荐**：按钮与码的对应关系只写在注册表里） */
  function canGate(gateId: string): boolean {
    const codes = codesOfGate(gateId);
    if (codes === undefined) {
      // 未登记 = 代码与注册表脱节（本单断言会拦下）⇒ 失败关闭，不把"看得到但点不了"的按钮露出去
      // eslint-disable-next-line no-console -- 开发期必须显性报出"页面引用了没登记的门 id"，否则会静默少一个门
      console.warn(`[permission-gate] 未登记的门 id：${gateId}（按失败关闭处理）`);
      return false;
    }
    // 判定统一走 store（唯一判据点）；门码为空 ⇒ store 侧放行（注册表 status='registered'）
    return appStore.hasPermissionCodes(codes);
  }

  /** 直接按码判定（页面内零散动作；码数组 = 全部持有才通过） */
  function can(codes: readonly string[] | string | null | undefined): boolean {
    if (codes === null || codes === undefined) return true;
    const list = typeof codes === "string" ? [codes] : codes;
    return appStore.hasPermissionCodes(list);
  }

  return { permissions, permissionsLoaded, canGate, can };
}
