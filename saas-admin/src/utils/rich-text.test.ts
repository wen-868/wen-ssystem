/**
 * 富文本白名单净化测试（MS-SECURITY-BASELINE-01，SEC-005 动态 HTML 直写整改）
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { sanitizeRichText, isSafeUrl } from "./rich-text";

describe("isSafeUrl", () => {
  it("放行 http/https/mailto/相对路径/data:image", () => {
    expect(isSafeUrl("https://example.com/a")).toBe(true);
    expect(isSafeUrl("http://example.com")).toBe(true);
    expect(isSafeUrl("mailto:a@b.com")).toBe(true);
    expect(isSafeUrl("/relative/path")).toBe(true);
    expect(isSafeUrl("data:image/png;base64,AAAA")).toBe(true);
  });

  it("拦截 javascript:/vbscript:/file:/非图片 data:", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("JAVASCRIPT:alert(1)")).toBe(false);
    expect(isSafeUrl("vbscript:x")).toBe(false);
    expect(isSafeUrl("file:///c:/win.ini")).toBe(false);
    expect(isSafeUrl("data:text/html;base64,AAAA")).toBe(false);
  });
});

describe("sanitizeRichText", () => {
  it("保留白名单标签与文本", () => {
    const html = "<p>你好 <strong>世界</strong></p><ul><li>条目</li></ul>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("移除 script/iframe/style 等危险标签及其内容", () => {
    const out = sanitizeRichText('<p>a</p><script>alert(1)</script><iframe src="x"></iframe><style>p{}</style>');
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert(1)");
    expect(out).not.toContain("iframe");
    expect(out).not.toContain("style");
    expect(out).toContain("a");
  });

  it("未列入白名单的标签解包保留文本", () => {
    const out = sanitizeRichText("<p><video src='x'>占位文本</video>后缀</p>");
    expect(out).not.toContain("video");
    expect(out).toContain("占位文本");
    expect(out).toContain("后缀");
  });

  it("丢弃 on* 事件属性与 style/class", () => {
    const out = sanitizeRichText('<p onclick="alert(1)" onmouseover="x" style="position:fixed" class="evil">文本</p>');
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onmouseover");
    expect(out).not.toContain("style");
    expect(out).not.toContain("class");
    expect(out).toContain("文本");
  });

  it("img 仅保留安全 src 与白名单属性", () => {
    const ok = sanitizeRichText('<img src="https://cdn.example.com/a.png" alt="图" width="10" data-x="y">');
    expect(ok).toContain('src="https://cdn.example.com/a.png"');
    expect(ok).toContain('alt="图"');
    expect(ok).not.toContain("data-x");

    const bad = sanitizeRichText('<img src="javascript:alert(1)">');
    expect(bad).not.toContain("javascript:");
  });

  it("a 链接拦截 javascript: 并统一加 rel", () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">点我</a>');
    expect(out).not.toContain("javascript:");
    expect(out).toContain("点我");

    const good = sanitizeRichText('<a href="https://example.com">官网</a>');
    expect(good).toContain('href="https://example.com"');
    expect(good).toContain("rel=");
    expect(good).toContain("noopener");
  });

  it("空串/纯文本原样返回", () => {
    expect(sanitizeRichText("")).toBe("");
    expect(sanitizeRichText("纯文本")).toBe("纯文本");
  });
});
