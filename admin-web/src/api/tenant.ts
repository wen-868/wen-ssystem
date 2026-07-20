import { api } from "./request";

// ==================== 租户注册 API（商家端注册页面使用）====================
export async function tenantRegister(payload: {
  company_name: string;
  company_short_name?: string;
  contact_person: string;
  contact_mobile: string;
  contact_email?: string;
  province?: string;
  city?: string;
  district?: string;
  address?: string;
  business_license?: string;
  legal_person?: string;
  industry?: string;
  company_scale?: string;
  admin_username: string;
  admin_password: string;
  admin_real_name: string;
}) {
  const { data } = await api.post("/tenant/register", payload);
  return data.data;
}
