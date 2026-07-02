import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";
import crypto from "crypto";

export async function listConfigs(tenantId: string) {
  const rows = await queryWithTenant<any>(
    "SELECT id, platform, app_id AS appId, app_name AS appName, app_icon AS appIcon, status, template_id AS templateId, publish_version AS appVersion, published_at AS publishedAt, created_at AS createdAt, updated_at AS updatedAt FROM miniapp_config WHERE tenant_id = ? ORDER BY platform",
    [tenantId],
    tenantId
  );
  return rows.map((row: any) => ({
    ...row,
    appSecret: "***",
  }));
}

export async function getConfig(tenantId: string, platform: string = "WECHAT") {
  const row = await queryOneWithTenant<any>(
    "SELECT * FROM miniapp_config WHERE tenant_id = ? AND platform = ?",
    [tenantId, platform],
    tenantId
  );
  if (!row) return null;
  return {
    appId: row.app_id,
    appSecret: "***",
    appName: row.app_name,
    appDescription: row.app_description,
    appIcon: row.app_icon,
    appVersion: row.app_version,
    status: row.status,
    auditStatus: row.audit_status,
    auditReason: row.audit_reason,
    templateId: row.template_id,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    domainWhitelist: row.domain_whitelist ? JSON.parse(row.domain_whitelist) : [],
    businessDomain: row.business_domain ? JSON.parse(row.business_domain) : [],
    webviewDomain: row.webview_domain ? JSON.parse(row.webview_domain) : [],
    qrcodeUrl: row.qrcode_url,
    privacyUrl: row.privacy_url,
    serviceAgreementUrl: row.service_agreement_url,
    requiredPrivacySetting: row.required_privacy_setting === 1,
    allowGuest: row.allow_guest === 1,
    allowLocation: row.allow_location === 1,
    allowPhone: row.allow_phone === 1,
    allowShare: row.allow_share === 1,
    allowSubscribe: row.allow_subscribe === 1,
    allowPayment: row.allow_payment === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function saveConfig(tenantId: string, platform: string = "WECHAT", body: any) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM miniapp_config WHERE tenant_id = ? AND platform = ?",
    [tenantId, platform],
    tenantId
  );

  if (existing) {
    const sets: string[] = [];
    const params: any[] = [];
    const map: Record<string, string> = {
      appId: "app_id",
      appSecret: "app_secret",
      appName: "app_name",
      appDescription: "app_description",
      appIcon: "app_icon",
      appVersion: "app_version",
      status: "status",
      auditStatus: "audit_status",
      auditReason: "audit_reason",
      templateId: "template_id",
      contactName: "contact_name",
      contactEmail: "contact_email",
      contactPhone: "contact_phone",
      privacyUrl: "privacy_url",
      serviceAgreementUrl: "service_agreement_url",
      qrcodeUrl: "qrcode_url",
      requiredPrivacySetting: "required_privacy_setting",
      allowGuest: "allow_guest",
      allowLocation: "allow_location",
      allowPhone: "allow_phone",
      allowShare: "allow_share",
      allowSubscribe: "allow_subscribe",
      allowPayment: "allow_payment",
    };

    for (const [key, col] of Object.entries(map)) {
      if (body[key] !== undefined) {
        let val = body[key];
        if (typeof val === "boolean") val = val ? 1 : 0;
        sets.push(`${col} = ?`);
        params.push(val);
      }
    }

    // 域名白名单
    if (body.domainWhitelist !== undefined) {
      sets.push("domain_whitelist = ?");
      params.push(JSON.stringify(body.domainWhitelist));
    }
    if (body.businessDomain !== undefined) {
      sets.push("business_domain = ?");
      params.push(JSON.stringify(body.businessDomain));
    }
    if (body.webviewDomain !== undefined) {
      sets.push("webview_domain = ?");
      params.push(JSON.stringify(body.webviewDomain));
    }

    if (sets.length > 0) {
      params.push(tenantId, platform);
      await queryWithTenant(
        `UPDATE miniapp_config SET ${sets.join(", ")}, updated_at = NOW() WHERE tenant_id = ? AND platform = ?`,
        params,
        tenantId
      );
    }
  } else {
    await queryWithTenant(
      `INSERT INTO miniapp_config (tenant_id, platform, app_id, app_secret, app_name, app_description, app_icon, app_version, status, audit_status, audit_reason, template_id, publish_version, published_at, contact_name, contact_email, contact_phone, domain_whitelist, business_domain, webview_domain, privacy_url, service_agreement_url, qrcode_url, required_privacy_setting, allow_guest, allow_location, allow_phone, allow_share, allow_subscribe, allow_payment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        platform,
        body.appId || "",
        body.appSecret || "",
        body.appName || "",
        body.appDescription || "",
        body.appIcon || "",
        body.appVersion || "",
        body.status || "draft",
        body.auditStatus || "pending",
        body.auditReason || "",
        body.templateId || null,
        body.publishVersion || "",
        body.publishedAt || null,
        body.contactName || "",
        body.contactEmail || "",
        body.contactPhone || "",
        JSON.stringify(body.domainWhitelist || []),
        JSON.stringify(body.businessDomain || []),
        JSON.stringify(body.webviewDomain || []),
        body.privacyUrl || "",
        body.serviceAgreementUrl || "",
        body.qrcodeUrl || "",
        body.requiredPrivacySetting ? 1 : 0,
        body.allowGuest !== false ? 1 : 0,
        body.allowLocation !== false ? 1 : 0,
        body.allowPhone !== false ? 1 : 0,
        body.allowShare !== false ? 1 : 0,
        body.allowSubscribe !== false ? 1 : 0,
        body.allowPayment !== false ? 1 : 0,
      ],
      tenantId
    );
  }
  return { success: true };
}

export async function getPrivacySettings(tenantId: string, platform: string = "WECHAT") {
  const row = await queryOneWithTenant<any>(
    "SELECT required_privacy_setting AS requiredPrivacySetting, allow_guest AS allowGuest, allow_location AS allowLocation, allow_phone AS allowPhone, allow_share AS allowShare, allow_subscribe AS allowSubscribe, allow_payment AS allowPayment, privacy_url AS privacyUrl, service_agreement_url AS serviceAgreementUrl FROM miniapp_config WHERE tenant_id = ? AND platform = ?",
    [tenantId, platform],
    tenantId
  );
  if (!row) return null;
  return {
    requiredPrivacySetting: row.requiredPrivacySetting === 1,
    allowGuest: row.allowGuest === 1,
    allowLocation: row.allowLocation === 1,
    allowPhone: row.allowPhone === 1,
    allowShare: row.allowShare === 1,
    allowSubscribe: row.allowSubscribe === 1,
    allowPayment: row.allowPayment === 1,
    privacyUrl: row.privacyUrl || "",
    serviceAgreementUrl: row.serviceAgreementUrl || "",
  };
}

export async function savePrivacySettings(tenantId: string, body: any, platform: string = "WECHAT") {
  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM miniapp_config WHERE tenant_id = ? AND platform = ?",
    [tenantId, platform],
    tenantId
  );

  if (existing) {
    const sets: string[] = [];
    const params: any[] = [];
    const map: Record<string, string> = {
      requiredPrivacySetting: "required_privacy_setting",
      allowGuest: "allow_guest",
      allowLocation: "allow_location",
      allowPhone: "allow_phone",
      allowShare: "allow_share",
      allowSubscribe: "allow_subscribe",
      allowPayment: "allow_payment",
    };
    for (const [key, col] of Object.entries(map)) {
      if (body[key] !== undefined) {
        sets.push(`${col} = ?`);
        params.push(body[key] ? 1 : 0);
      }
    }
    if (body.privacyUrl !== undefined) { sets.push("privacy_url = ?"); params.push(body.privacyUrl); }
    if (body.serviceAgreementUrl !== undefined) { sets.push("service_agreement_url = ?"); params.push(body.serviceAgreementUrl); }

    if (sets.length > 0) {
      params.push(tenantId, platform);
      await queryWithTenant(
        `UPDATE miniapp_config SET ${sets.join(", ")}, updated_at = NOW() WHERE tenant_id = ? AND platform = ?`,
        params,
        tenantId
      );
    }
  } else {
    await queryWithTenant(
      `INSERT INTO miniapp_config (tenant_id, platform, required_privacy_setting, allow_guest, allow_location, allow_phone, allow_share, allow_subscribe, allow_payment, privacy_url, service_agreement_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        platform,
        body.requiredPrivacySetting ? 1 : 0,
        body.allowGuest !== false ? 1 : 0,
        body.allowLocation !== false ? 1 : 0,
        body.allowPhone !== false ? 1 : 0,
        body.allowShare !== false ? 1 : 0,
        body.allowSubscribe !== false ? 1 : 0,
        body.allowPayment !== false ? 1 : 0,
        body.privacyUrl || "",
        body.serviceAgreementUrl || "",
      ],
      tenantId
    );
  }
  return { success: true };
}

export async function getDomainSettings(tenantId: string, platform: string = "WECHAT") {
  const row = await queryOneWithTenant<any>(
    "SELECT domain_whitelist AS domainWhitelist, business_domain AS businessDomain, webview_domain AS webviewDomain FROM miniapp_config WHERE tenant_id = ? AND platform = ?",
    [tenantId, platform],
    tenantId
  );
  if (!row) return { domainWhitelist: [], businessDomain: [], webviewDomain: [] };
  return {
    domainWhitelist: row.domainWhitelist ? JSON.parse(row.domainWhitelist) : [],
    businessDomain: row.businessDomain ? JSON.parse(row.businessDomain) : [],
    webviewDomain: row.webviewDomain ? JSON.parse(row.webviewDomain) : [],
  };
}

export async function saveDomainSettings(tenantId: string, body: any, platform: string = "WECHAT") {
  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM miniapp_config WHERE tenant_id = ? AND platform = ?",
    [tenantId, platform],
    tenantId
  );

  if (existing) {
    const sets: string[] = [];
    const params: any[] = [];
    if (body.domainWhitelist !== undefined) { sets.push("domain_whitelist = ?"); params.push(JSON.stringify(body.domainWhitelist)); }
    if (body.businessDomain !== undefined) { sets.push("business_domain = ?"); params.push(JSON.stringify(body.businessDomain)); }
    if (body.webviewDomain !== undefined) { sets.push("webview_domain = ?"); params.push(JSON.stringify(body.webviewDomain)); }
    if (sets.length > 0) {
      params.push(tenantId, platform);
      await queryWithTenant(
        `UPDATE miniapp_config SET ${sets.join(", ")}, updated_at = NOW() WHERE tenant_id = ? AND platform = ?`,
        params,
        tenantId
      );
    }
  } else {
    await queryWithTenant(
      "INSERT INTO miniapp_config (tenant_id, platform, domain_whitelist, business_domain, webview_domain) VALUES (?, ?, ?, ?, ?)",
      [tenantId, platform, JSON.stringify(body.domainWhitelist || []), JSON.stringify(body.businessDomain || []), JSON.stringify(body.webviewDomain || [])],
      tenantId
    );
  }
  return { success: true };
}

export async function getFeatures(tenantId: string, platform: string = "WECHAT") {
  const row = await queryOneWithTenant<any>(
    "SELECT app_id AS appId, app_name AS appName, status, template_id AS templateId, allow_guest AS allowGuest, allow_location AS allowLocation, allow_phone AS allowPhone, allow_share AS allowShare, allow_subscribe AS allowSubscribe, allow_payment AS allowPayment FROM miniapp_config WHERE tenant_id = ? AND platform = ?",
    [tenantId, platform],
    tenantId
  );
  if (!row) return null;
  return {
    appId: row.appId,
    appName: row.appName,
    status: row.status,
    templateId: row.templateId,
    features: {
      allowGuest: row.allowGuest === 1,
      allowLocation: row.allowLocation === 1,
      allowPhone: row.allowPhone === 1,
      allowShare: row.allowShare === 1,
      allowSubscribe: row.allowSubscribe === 1,
      allowPayment: row.allowPayment === 1,
    },
  };
}

export async function saveFeatures(tenantId: string, body: any, platform: string = "WECHAT") {
  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM miniapp_config WHERE tenant_id = ? AND platform = ?",
    [tenantId, platform],
    tenantId
  );
  if (existing) {
    const sets: string[] = [];
    const params: any[] = [];
    const featMap: Record<string, string> = {
      allowGuest: "allow_guest",
      allowLocation: "allow_location",
      allowPhone: "allow_phone",
      allowShare: "allow_share",
      allowSubscribe: "allow_subscribe",
      allowPayment: "allow_payment",
    };
    for (const [key, col] of Object.entries(featMap)) {
      if (body[key] !== undefined) {
        sets.push(`${col} = ?`);
        params.push(body[key] ? 1 : 0);
      }
    }
    if (sets.length > 0) {
      params.push(tenantId, platform);
      await queryWithTenant(
        `UPDATE miniapp_config SET ${sets.join(", ")}, updated_at = NOW() WHERE tenant_id = ? AND platform = ?`,
        params,
        tenantId
      );
    }
  }
  return { success: true };
}

export async function getAppId(tenantId: string, platform: string = "WECHAT"): Promise<string | null> {
  const row = await queryOneWithTenant<any>(
    "SELECT app_id AS appId FROM miniapp_config WHERE tenant_id = ? AND platform = ?",
    [tenantId, platform],
    tenantId
  );
  return row?.appId || null;
}