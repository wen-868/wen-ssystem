/**
 * 真库探针（02）专用打桩：`backend/src/__tests__/mocks/mock-db`。
 *
 * 为什么需要：`config/database.ts` 顶部以静态 import 引入 mock 库（mockConn/mockQuery/mockExecute），
 * 而 mock 链中存在"以值导入方式导入类型"的写法（`import { state, result, Row }`），
 * Node 原生类型剥离（不依赖 esbuild）无法擦除它，整条链会加载失败。
 *
 * 本桩只在 USE_MOCK_DB=false 的真库探针下启用；一旦真被调用即抛错，
 * 避免"以为在跑真库、其实走了 mock"。
 */
const boom = () => {
  throw new Error("[B2 探针] mock-db 被调用，但 USE_MOCK_DB=false —— 探针配置有误");
};

export const mockConn = { query: boom, execute: boom };
export const mockQuery = boom;
export const mockExecute = boom;
export const mockPool = { query: boom, execute: boom };
export default { mockConn, mockQuery, mockExecute };
