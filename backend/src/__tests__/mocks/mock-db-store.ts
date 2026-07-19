/**
 * 门店/员工 mock handlers: stores, users (store-related queries)
 */
import { state, Row } from "./mock-db-state";

export const queryHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // store 查询
  (s, _params) => {
    if ((s.includes("from store") || s.includes("from t_store")) && s.includes("count(*)")) return [{ total: state.stores.length }];
    if ((s.includes("from store") || s.includes("from t_store")) && !s.includes("group by") && !s.includes("join")) {
      return state.stores.map((st) => ({
        id: st.id,
        storeCode: st.store_code,
        name: st.name,
        address: st.address,
        contact: st.contact,
        phone: st.phone,
        deliveryRadius: st.delivery_radius,
        businessStatus: st.business_status,
        status: st.status,
        miniappAppid: st.miniapp_appid ?? null,
        wxMerchantName: st.wx_merchant_name ?? null,
        wxServicePhone: st.wx_service_phone ?? null,
        wxHeadImg: st.wx_head_img ?? null,
        wxQrcodeUrl: st.wx_qrcode_url ?? null
      }));
    }
    return null;
  },

  // 按门店分组的销售统计
  (s, _params) => {
    if ((s.includes("left join sale_bill") || s.includes("left join t_sale_bill")) && s.includes("group by")) {
      return state.stores.map((st: Row) => {
        const bills = state.saleBills.filter((b: Row) => (b.storeId || b.store_id) === st.id);
        const total = bills.reduce((sum: number, b: Row) => sum + Number(b.receivableAmount || b.receivable_amount || 0), 0);
        return { storeId: st.id, storeName: st.name, totalSales: total, billCount: bills.length };
      });
    }
    return null;
  },
];

export const executeHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // store INSERT
  (s, params) => {
    if (s.includes("insert into store") || s.includes("insert into t_store")) {
      state.stores.push({
        id: state.stores.length + 1,
        store_code: String(params[0]),
        name: String(params[1]),
        address: String(params[2]),
        contact: params[5] == null ? "" : String(params[5]),
        phone: params[6] == null ? "" : String(params[6]),
        delivery_radius: Number(params[7] ?? 3),
        business_status: "OPEN",
        status: 1,
        miniapp_appid: null,
        wx_merchant_name: null,
        wx_service_phone: null,
        wx_head_img: null,
        wx_qrcode_url: null
      });
      return [];
    }
    return null;
  },
];