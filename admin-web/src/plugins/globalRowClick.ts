/**
 * 全局表格整行点击直达明细
 * - 点击任意表格行的任意位置（排除按钮/输入/选择等交互控件与展开列），
 *   自动触发该行对应的"详情/查看"按钮，无需再点行尾按钮
 * - 已自带行点击（class="clickable-table"）的表格跳过，避免重复触发
 */
export function installGlobalRowClick() {
  window.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    if (!target || !(target instanceof Element)) return;

    // 排除交互控件：按钮/链接/输入/选择/开关/勾选/下拉/弹层/标签/展开箭头
    if (
      target.closest(
        "button, a, input, textarea, select, .el-checkbox, .el-switch, .el-radio, .el-select, .el-input-number, .el-link, .el-table__expand-icon, .el-dropdown, .el-popover, .el-tag"
      )
    ) {
      return;
    }

    const row = target.closest(".el-table__row") as HTMLElement | null;
    if (!row) return;
    // 已自带整行点击的表格跳过
    if (row.closest(".clickable-table")) return;

    const table = row.closest(".el-table");
    if (!table) return;

    const rect = row.getBoundingClientRect();
    const rowMid = rect.top + rect.height / 2;
    // 在主表与固定列（固定右列操作区）中，按行垂直带匹配"详情/查看"按钮
    const detailBtn = [...table.querySelectorAll<HTMLElement>(".el-button")].find((b) => {
      const text = (b.textContent || "").trim();
      if (text !== "详情" && text !== "查看") return false;
      const r = b.getBoundingClientRect();
      return r.top <= rowMid && r.bottom >= rowMid;
    });
    if (detailBtn) detailBtn.click();
  });
}
