/** 下载文本文件（CSV 等） */
export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 将数组数据生成为 CSV 并下载 */
export function downloadRowsCsv(filename: string, rows: Array<Record<string, unknown>>, columns?: string[]) {
  if (!rows.length) return;
  const keys = columns || Object.keys(rows[0]);
  const header = keys.join(",");
  const body = rows.map((row) =>
    keys
      .map((k) => {
        const val = row[k] ?? "";
        const str = String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str.replace(/"/g, '""')}"` : str;
      })
      .join(",")
  );
  downloadTextFile(filename, "\uFEFF" + [header, ...body].join("\n"));
}
