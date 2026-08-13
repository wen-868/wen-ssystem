/**
 * Web 端（工作台/收银台）更新检查
 *
 * 启动时查询总台发布的当前版本；Web 端"更新"= 服务器重新部署后刷新页面，
 * 所以提示用户刷新即可。1 小时内非强制更新只提示一次，避免刷屏。
 */
import { ElMessageBox, ElNotification } from "element-plus";

// 与 admin-web/package.json 同步，发版时更新
const LOCAL_VERSION = "0.1.0";
const CHECK_KEY = "zx_web_update_check_v1";

interface LatestVersion {
  versionName: string;
  isForce: boolean;
  updateUrl: string;
  updateNote: string;
}

export async function checkWebUpdate(): Promise<void> {
  try {
    const res = await fetch("/api/app/version/admin_web", { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return;
    const json = (await res.json()) as { data?: LatestVersion | null };
    const latest = json.data;
    if (!latest || latest.versionName === LOCAL_VERSION) return;

    // 节流：非强制更新 1 小时内只提示一次
    const last = Number(localStorage.getItem(CHECK_KEY) || 0);
    if (!latest.isForce && Date.now() - last < 3600_000) return;
    localStorage.setItem(CHECK_KEY, String(Date.now()));

    const note = latest.updateNote ? `\n\n${latest.updateNote}` : "";
    if (latest.isForce) {
      await ElMessageBox.alert(
        `系统已升级到 v${latest.versionName}，请刷新页面使用最新功能。${note}`,
        "系统更新",
        { confirmButtonText: "立即刷新", type: "warning", closeOnClickModal: false, showClose: false }
      );
      window.location.reload();
    } else {
      ElNotification({
        title: "系统已更新",
        message: `新版本 v${latest.versionName}：${latest.updateNote || "点击刷新体验新功能"}`,
        type: "success",
        duration: 8000,
        onClick: () => window.location.reload(),
      });
    }
  } catch {
    // 检查失败静默，不影响使用
  }
}
