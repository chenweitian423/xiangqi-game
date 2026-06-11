# 在线中国象棋

这是一个基于 React、TypeScript 和 Vite 的中国象棋网页游戏。项目支持本地单机对弈，也支持好友通过私密房间进行在线对局。

## 功能概览

- 单机模式：内置中国象棋规则、合法走法校验、将军提示、悔棋、重开、提示一步、棋谱回放和 AI 难度选择。
- 联机模式：创建私密房间、房间号邀请、可选房间密码、红黑双方座位、观战成员和房间聊天。
- 实时同步：优先使用 WebSocket；如果连接不可用，前端会回退到 HTTP 提交和轮询同步。
- 对局体验：黑方视角自动翻转；对局结束后棋盘只读；房主可以再开一局；房间结束后可以回到创建房间流程。
- 分享链接：创建房间后可以使用 `/online/房间号` 形式邀请好友，好友打开后会自动预填房间号。

## 技术栈

- 前端：React 19、TypeScript、Vite
- 测试：Vitest、Testing Library、JSDOM
- 联机后端：Cloudflare Workers + Durable Objects
- 部署：Cloudflare Worker 静态资源 + Worker API + Durable Objects

## 本地开发

安装依赖：

```bash
npm install
```

启动前端开发服务器：

```bash
npm run dev
```

运行测试：

```bash
npm test
```

生产构建：

```bash
npm run build
```

## Cloudflare 本地预览

使用 Wrangler 以接近生产环境的方式运行前端静态资源、API 和 WebSocket：

```bash
npm run cf:dev
```

## Cloudflare 部署

项目可以完整部署在 Cloudflare 上，不依赖 Vercel、Render、Docker 或 Postgres。

部署前请在 `wrangler.jsonc` 中替换模板域名：

```jsonc
"vars": {
  "CORS_ORIGINS": "https://xiangqi.example.com"
}
```

如果需要绑定自定义域名，可按 `wrangler.jsonc` 中的注释启用 `routes` 配置。

部署命令：

```bash
npm run cf:deploy
```

详细步骤见 [Cloudflare 全量部署说明](docs/cloudflare-deployment.md)。

## 联机配置

前端生产环境使用同源路径访问联机服务：

```env
VITE_ONLINE_API_BASE_URL=/api
VITE_ONLINE_WS_URL=/ws
```

Worker 会直接处理 `/api/*`、`/rooms/:code/ws`、`/ws` 和 `/health`，其他路径由静态前端接管。

核心 Cloudflare 绑定：

- `ROOM_OBJECT`：Durable Object 房间状态、聊天和 WebSocket 会话。
- `CORS_ORIGINS`：允许访问 API 的前端来源，多个来源可用英文逗号分隔。

## 项目结构

- `src/App.tsx`：应用入口，根据地址选择单机或联机模式。
- `src/app/SinglePlayerApp.tsx`：单机游戏编排层。
- `src/app/OnlineMatchApp.tsx`：联机房间界面和房间流程。
- `src/game/*`：中国象棋规则、走法生成、胜负判断和棋谱记法。
- `src/ai/*`：AI 搜索与局面评估。
- `src/online/*`：联机客户端、房间状态 reducer、会话存储和联机 hooks。
- `src/components/*`：棋盘、棋子、棋谱、控制区和联机房间组件。
- `cloudflare/src/*`：Cloudflare Worker 与 Durable Object 后端。
- `server/src/*`：早期 Node/Fastify 后端实现，当前 Cloudflare 全量部署不依赖它。

## 常用验证命令

```bash
npm run lint
npm test
npm run cf:typecheck
npm run build
```

## 已知说明

- 当前没有账号系统，房间身份通过本地浏览器会话 token 恢复。
- 当前没有公开匹配大厅，主要面向“把链接发给好友”的私密对局。
- 部分网络环境可能影响 WebSocket 稳定性，因此前端提供 HTTP + 轮询兜底。
