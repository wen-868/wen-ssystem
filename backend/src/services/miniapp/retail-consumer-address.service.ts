import { query, queryOne, transaction } from "../../shared/db.js";

export interface RetailConsumerAddress {
  id: number;
  user_id: number;
  name: string;
  mobile: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAddressInput {
  name: string;
  mobile: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  is_default?: number;
}

export interface UpdateAddressInput {
  name: string;
  mobile: string;
  province: string;
  city: string;
  district: string;
  detail: string;
}

export async function listAddresses(userId: number): Promise<RetailConsumerAddress[]> {
  const rows = await query<RetailConsumerAddress>(
    `SELECT * FROM retail_consumer_address WHERE user_id = ? ORDER BY is_default DESC, created_at DESC`,
    [userId]
  );
  return rows;
}

export async function createAddress(userId: number, data: CreateAddressInput) {
  const result = await query<any>(
    `INSERT INTO retail_consumer_address (user_id, name, mobile, province, city, district, detail, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, data.name, data.mobile, data.province, data.city, data.district, data.detail, data.is_default ?? 0]
  ) as unknown as unknown as { insertId: number };
  return { id: result.insertId };
}

export async function updateAddress(id: number, userId: number, data: UpdateAddressInput) {
  await query(
    `UPDATE retail_consumer_address SET name = ?, mobile = ?, province = ?, city = ?, district = ?, detail = ? WHERE id = ? AND user_id = ?`,
    [data.name, data.mobile, data.province, data.city, data.district, data.detail, id, userId]
  );
}

export async function deleteAddress(id: number, userId: number) {
  await query(
    `DELETE FROM retail_consumer_address WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
}

export async function setDefault(id: number, userId: number) {
  await transaction(async (conn) => {
    await conn.query(`UPDATE retail_consumer_address SET is_default = 0 WHERE user_id = ?`, [userId]);
    await conn.query(`UPDATE retail_consumer_address SET is_default = 1 WHERE id = ? AND user_id = ?`, [id, userId]);
  });
}