/**
 * AI 会话真源浏览器烟测。
 *
 * 覆盖：
 * 1. SSE 里的 tool_start/tool_result 不产生“工具调用时间线”；
 * 2. 点击数字员工后，对话主体栏显示真实姓名/岗位/可协同员工；
 * 3. “对话”页签 + 号立即切换到新会话；
 * 4. “员工”页签 + 号打开新增员工表单并发出真实 POST 请求。
 *
 * 运行：BASE_URL=http://127.0.0.1:5174 node tests/ai-session-truth.smoke.mjs
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:5174";
const shotDir = process.env.SHOT_DIR || "";
if (shotDir) mkdirSync(shotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
let createEmployeeBody = null;

page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

const employees = [
  {
    id: 101,
    employeeUid: "emp_manager",
    name: "周采购",
    post: "采购主管",
    department: "采购部",
    dispatchUids: ["emp_buyer"],
    status: "管理岗",
  },
  {
    id: 102,
    employeeUid: "emp_buyer",
    name: "小采",
    post: "采购专员",
    department: "采购部",
    dispatchUids: [],
    status: "就绪",
  },
];

await page.addInitScript(() => {
  localStorage.setItem(
    "admin_auth",
    JSON.stringify({
      token: "smoke-token",
      user: {
        id: 1,
        username: "admin",
        realName: "验收管理员",
        roles: ["SUPER_ADMIN"],
        tenantId: 1,
      },
    }),
  );
  localStorage.setItem("wb.shell.v2", "1");
});

await page.route("**/*", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;

  if (path.endsWith("/api/chat")) {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body:
        'data: {"type":"text","content":"已查询到库存结果。"}\n\n' +
        'data: {"type":"tool_start","tool":"checkInventory"}\n\n' +
        'data: {"type":"tool_result","tool":"checkInventory","success":true,"data":{"list":[1,2]}}\n\n' +
        'data: {"type":"done","conversationId":"sess_smoke"}\n\n',
    });
    return;
  }

  if (path.endsWith("/api/ai/employees") && request.method() === "POST") {
    createEmployeeBody = request.postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: 103, employeeUid: "emp_new", ...createEmployeeBody }),
    });
    return;
  }

  if (path.endsWith("/api/ai/employees")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(employees),
    });
    return;
  }

  if (path.endsWith("/api/admin/session-archive")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        total: 1,
        items: [
          {
            id: 1,
            sessionId: "sess_history",
            messagesJson: [
              { role: "user", content: "查询上周缺货商品" },
              { role: "assistant", content: "共发现 3 个缺货商品。" },
              { role: "tool", content: "内部工具结果" },
            ],
            messageCount: 3,
            endedAt: "2026-11-13T08:00:00.000Z",
          },
        ],
      }),
    });
    return;
  }

  if (path.endsWith("/api/app/version/admin_web")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: null }),
    });
    return;
  }

  if (path.endsWith("/api/ai/agent/plans")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, total: 0, items: [] }),
    });
    return;
  }

  if (path.endsWith("/api/chat/confirmations")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ confirmations: [] }),
    });
    return;
  }

  if (path.endsWith("/admin/notifications")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ total: 0, page: 1, pageSize: 20, records: [] }),
    });
    return;
  }

  if (path.includes("/api/")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [], records: [], total: 0 }),
    });
    return;
  }

  await route.continue();
});

try {
  await page.goto(`${baseURL}/dashboard`, { waitUntil: "networkidle" });
  await page.getByTestId("chat-agent-identity").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);

  assert.equal(await page.getByTestId("chat-tool-timeline").count(), 0, "工具时间线仍渲染");
  assert.equal((await page.locator("body").innerText()).includes("工具调用时间线"), false, "页面仍出现工具调用时间线");
  assert.equal(await page.getByTestId("chat-agent-identity").innerText().then((t) => t.includes("智享 AI 助手")), true);

  await page.locator('[data-side-tab="员工"]').click();
  await page.locator(".sn-staff").filter({ hasText: "周采购" }).click();
  await page.waitForTimeout(250);
  const identity = await page.getByTestId("chat-agent-identity").innerText();
  assert.ok(identity.includes("周采购"), `员工身份未切换：${identity}`);
  assert.ok(identity.includes("采购主管"), `岗位未显示：${identity}`);
  assert.ok(identity.includes("可协同：小采"), `协同员工未显示：${identity}`);
  if (shotDir) await page.screenshot({ path: `${shotDir.replace(/\\/g, "/")}/employee-conversation-1440.png`, fullPage: true });

  await page.locator('[data-side-tab="对话"]').click();
  await page.waitForTimeout(250);
  await page.getByTestId("second-nav-new-chat").click();
  await page.waitForTimeout(250);
  const directoryText = await page.getByTestId("second-nav-directory").innerText();
  assert.ok(directoryText.includes("当前新对话"), `新对话未立即进入会话目录：${directoryText}`);

  await page.locator('[data-side-tab="员工"]').click();
  await page.waitForTimeout(250);
  await page.getByTestId("second-nav-new-chat").click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(350);
  if (shotDir) await page.screenshot({ path: `${shotDir.replace(/\\/g, "/")}/employee-create-dialog-1440.png`, fullPage: true });
  await page.locator(".sn-emp-form input").nth(0).fill("新采购");
  await page.locator(".sn-emp-form input").nth(1).fill("采购专员");
  await page.locator(".sn-emp-form input").nth(2).fill("采购部");
  await page.locator(".sn-emp-form textarea").fill("负责补货与供应商比价");
  await page.locator(".sn-emp-team label").filter({ hasText: "小采" }).click();
  await page.getByRole("button", { name: "创建员工" }).click();
  await page.waitForTimeout(400);

  assert.ok(createEmployeeBody, "新增员工未发出 POST 请求");
  assert.equal(createEmployeeBody.name, "新采购");
  assert.equal(createEmployeeBody.dispatchUids?.[0], "emp_buyer");
  assert.equal(consoleErrors.length, 0, `浏览器 console error：${consoleErrors.join(" | ")}`);

  console.log("AI_SESSION_TRUTH_SMOKE=PASS");
  console.log("TOOL_TIMELINE_VISIBLE=0");
  console.log("EMPLOYEE_IDENTITY=PASS");
  console.log("NEW_CONVERSATION_RECORD=PASS");
  console.log("CREATE_EMPLOYEE_POST=PASS");
} finally {
  await browser.close();
}
