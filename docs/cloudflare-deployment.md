# Cloudflare 全量部署说明

本项目可以完整运行在 Cloudflare 上：

- 静态前端：Cloudflare Workers Static Assets
- 联机 API：Cloudflare Worker
- 实时房间状态与 WebSocket 会话：Durable Objects

部署配置位于 `wrangler.jsonc`。Worker 会托管构建后的 `dist` 目录，并在静态资源查找前优先处理 API 与 WebSocket 路径。

## 前置条件

1. 安装依赖：

   ```bash
   npm install
   ```

2. 登录 Cloudflare：

   ```bash
   npx wrangler login
   ```

3. 确定公开访问地址。默认 Workers 域名格式通常是：

   ```text
   https://<your-worker-name>.<your-subdomain>.workers.dev
   ```

4. 将 `wrangler.jsonc` 中的 `CORS_ORIGINS` 改成你的公开访问地址。
   如果有多个来源，可用英文逗号分隔。

## 本地 Cloudflare 预览

通过 Wrangler 运行生产构建：

```bash
npm run cf:dev
```

Wrangler 会同时提供静态前端和 Worker 路由。前端使用同源路径：

```env
VITE_ONLINE_API_BASE_URL=/api
VITE_ONLINE_WS_URL=/ws
```

Worker 已直接支持 `/api` 前缀，因此不再需要旧的 Vercel rewrite 层。

## 部署

发布完整应用：

```bash
npm run cf:deploy
```

首次部署会创建 `wrangler.jsonc` 中声明的 Durable Object 迁移：

```jsonc
"migrations": [
  {
    "tag": "v1",
    "new_sqlite_classes": ["RoomDurableObject"]
  }
]
```

部署完成后可验证健康检查接口：

```bash
curl https://<your-worker-name>.<your-subdomain>.workers.dev/health
```

期望返回：

```json
{"ok":true,"service":"xiangqi-online-server"}
```

## 自定义域名

如果要绑定自定义域名，请在 Cloudflare 中添加域名后，修改 `wrangler.jsonc`：

```jsonc
// "routes": [
//   {
//     "pattern": "xiangqi.example.com",
//     "custom_domain": true
//   }
// ],
"vars": {
  "CORS_ORIGINS": "https://xiangqi.example.com"
}
```

启用 `routes` 配置时，请去掉注释并替换成你自己的域名。前端仍然使用同源 `/api` 和 `/ws` 路径，因此自定义域名不需要额外修改 Vite 环境变量。

## 旧部署文件

`vercel.json` 和 `render.yaml` 仅保留作历史参考。Cloudflare 全量部署路径不依赖 Vercel、Render、Docker 或 Postgres。
