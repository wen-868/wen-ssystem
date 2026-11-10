# RBAC 查询型 POST 机读镜像

本文件镜像已裁定的查询型 POST，仅用于历史人读台账退场后 CI 的同一行「路径 + 查询型」校验。

| 路径 | 判定 | 裁定来源 |
|---|---|---|
| POST /api/admin/prices/best-price | 查询型 | S3-220 §十二.6 P 类 #1 |
| POST /api/admin/quote-push/preview | 查询型 | S3-224 §十四.6 Q 类 |
| POST /api/admin/data-permissions/users/:userId/check | 查询型 | S3-225 §十五 ④ |
| POST /api/admin/marketing/calculate | 查询型 | S3-231 §十八.3 |
| POST /api/admin/trace/configs/check | 查询型 | S3-231 §十八.3 |
| POST /api/platform/billing/statement/export | 查询型 | S3-231 §十八.3 |
