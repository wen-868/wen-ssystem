/**
 * 效期扫描器
 * 每60秒检查一次，凌晨2点执行全量扫描
 */
import logger from "./logger";
import { runExpiryScan } from "../services/admin/inventory-batch.service";

let expiryScannerRunning = false;

/** 启动效期扫描器 */
export function startExpiryScanner() {
  logger.info("[效期扫描器] 已启动，每60秒检查一次（凌晨2点执行全量扫描）");

  const timer = setInterval(async () => {
    if (expiryScannerRunning) return;
    const now = new Date();
    const hour = now.getHours();
    if (hour !== 2) return;

    expiryScannerRunning = true;
    try {
      await runExpiryScan();
      logger.info("[效期扫描器] 扫描完成");
    } catch (error) {
      logger.error("[效期扫描器] 扫描失败:", error);
    } finally {
      expiryScannerRunning = false;
    }
  }, 60 * 1000);
  (timer as { unref: () => void }).unref();
}
