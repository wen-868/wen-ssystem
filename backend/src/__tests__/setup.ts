// vitest setup — 在测试文件导入前设置环境变量
process.env.USE_MOCK_DB = "true";
process.env.JWT_SECRET = "test-secret-key-for-vitest";