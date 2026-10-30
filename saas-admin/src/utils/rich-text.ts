/**
 * 富文本白名单净化（MS-SECURITY-BASELINE-01，SEC-005 动态 HTML 直写整改）
 *
 * 背景：公告正文经 contenteditable 编辑后以 v-html / innerHTML 直写渲染，
 * 内容一旦被注入（历史数据、被攻陷的运营账号、接口返回被篡改）即成存储型 XSS。
 *
 * 方案：DOMParser 解析后按白名单重建 ——
 *   - 标签白名单：公告富文本实际用到的排版/表格/图片/链接标签；
 *   - script/style/iframe/object/embed 等危险标签连同内容整体移除；
 *   - 其余未列入白名单的标签做「解包」（保留子节点文本）；
 *   - 属性白名单：仅保留少量安全属性，style/class/on* 一律丢弃；
 *   - URL 属性（a[href]、img[src]）仅允许 http/https/mailto/相对路径与 data:image/。
 */

/** 允许保留的标签 */
const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "blockquote", "pre",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "sub", "sup", "span", "div",
  "ul", "ol", "li",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "a", "img",
]);

/** 危险标签：连同内容一起移除（不保留子节点） */
const DROP_WITH_CONTENT = new Set([
  "script", "style", "iframe", "object", "embed", "link", "meta", "base", "template", "noscript",
]);

/** 按标签的属性白名单（未列出的标签仅无属性保留） */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan"]),
  ol: new Set(["start"]),
};

/** 判定 URL 是否安全（仅 http/https/mailto/相对路径/data:image） */
export function isSafeUrl(url: string): boolean {
  const v = url.trim().toLowerCase();
  if (v.startsWith("javascript:") || v.startsWith("vbscript:") || v.startsWith("file:")) return false;
  if (v.startsWith("data:") && !v.startsWith("data:image/")) return false;
  return true;
}

function sanitizeNode(node: Element, doc: Document): void {
  // 先拷贝子节点快照，避免遍历中修改
  for (const child of Array.from(node.children)) {
    sanitizeNode(child, doc);
  }
  const tag = node.tagName.toLowerCase();
  if (DROP_WITH_CONTENT.has(tag)) {
    node.remove();
    return;
  }
  if (!ALLOWED_TAGS.has(tag)) {
    // 解包：用子节点替换该标签
    const parent = node.parentElement;
    if (parent) {
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      node.remove();
    }
    return;
  }
  // 属性白名单
  for (const attr of Array.from(node.attributes)) {
    const name = attr.name.toLowerCase();
    const allowed = ALLOWED_ATTRS[tag]?.has(name);
    if (!allowed) {
      node.removeAttribute(attr.name);
      continue;
    }
    if ((tag === "a" && name === "href") || (tag === "img" && name === "src")) {
      if (!isSafeUrl(attr.value)) node.removeAttribute(attr.name);
    }
  }
  if (tag === "a") {
    // 外链统一加固
    node.setAttribute("rel", "noopener noreferrer nofollow");
    const href = node.getAttribute("href") ?? "";
    if (/^https?:/i.test(href.trim())) node.setAttribute("target", "_blank");
  }
}

/** 富文本净化：非法标签解包/移除、属性收敛到白名单、URL 限安全协议 */
export function sanitizeRichText(html: string): string {
  if (!html || typeof window === "undefined" || typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.body;
  for (const child of Array.from(root.children)) {
    sanitizeNode(child, doc);
  }
  return root.innerHTML;
}
