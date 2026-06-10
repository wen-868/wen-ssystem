import "dotenv/config";

export const env = {
  PORT: Number(process.env.PORT || 8080),
  JWT_SECRET: process.env.JWT_SECRET || "please-change-me",
  DB_HOST: process.env.DB_HOST || "127.0.0.1",
  DB_PORT: Number(process.env.DB_PORT || 3306),
  DB_USER: process.env.DB_USER || "root",
  DB_PASSWORD: process.env.DB_PASSWORD || "",
  DB_NAME: process.env.DB_NAME || "liquor_inventory",
  USE_MOCK_DB: process.env.USE_MOCK_DB === "true"
};
