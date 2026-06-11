# 在线中国象棋

一个基于 React、TypeScript 和 Vite 的中国象棋网页游戏，支持本地单机对战 AI，也支持好友私密房间联机对局。

## 功能概览

- 单机模式：内置中国象棋规则、合法走法校验、悔棋、重开、提示一步、棋谱回放、AI 难度选择。
- 联机模式：创建私人房间、房间号邀请、可选密码、红黑双方座位、观战成员、房间聊天。
- 实时同步：优先使用 WebSocket；如果当前网络或 Vercel 代理无法稳定连接 WebSocket，会自动切换到 HTTP 提交和轮询同步。
- 对局体验：黑方视角自动翻转；本局结束后棋盘只读，房主可直接再开一局；房间结束后可返回创建房间。
- 分享链接：创建房间后可使用 `/online/房间号` 形式的链接邀请好友，好友打开后会自动预填房间号。

## 技术栈

- 前端：React 19、TypeScript、Vite
- 测试：Vitest、Testing Library、JSDOM
- 联机后端：Cloudflare Workers + Durable Objects
- 部署：Vercel 前端 + Cloudflare Worker 后端

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

## 联机配置

生产环境前端使用同源代理：

```env
VITE_ONLINE_API_BASE_URL=/api
VITE_ONLINE_WS_URL=/ws
```

Vercel 通过 `vercel.json` 将 `/api`、`/rooms/:code/ws`、`/ws` 转发到 Cloudflare Worker：

```text
https://your-worker-subdomain.workers.dev
```

Cloudflare Worker 配置在 `wrangler.jsonc`，核心绑定为：

- `ROOM_OBJECT`：Durable Object 房间状态
- `CORS_ORIGINS`：允许访问的前端域名

## 项目结构

- `src/App.tsx`：应用入口，根据地址选择单机或联机模式。
- `src/app/SinglePlayerApp.tsx`：单机游戏编排层。
- `src/app/OnlineMatchApp.tsx`：联机房间界面和房间流程。
- `src/app/gameReducer.ts`：单机 reducer。联机逻辑不混入这里。
- `src/game/*`：中国象棋规则、走法生成、胜负判断、棋谱记法。
- `src/ai/*`：AI 搜索与评估。
- `src/online/*`：联机客户端、房间状态 reducer、会话存储和联机 hooks。
- `src/components/*`：棋盘、棋谱、控制区、联机房间组件等 UI。
- `cloudflare/src/*`：Cloudflare Worker 与 Durable Object 房间后端。
- `server/src/*`：早期 Node/Fastify 后端实现与共享契约，当前生产联机以后端 Worker 为准。

## 部署说明

当前生产形态：

- 前端：Vercel 项目
- 后端：Cloudflare Worker
- 域名：按自己的 Vercel / DNS 配置绑定

常用验证命令：

```bash
npm test
npm run build
```

Cloudflare Worker 类型检查：

```bash
npx tsc -p tsconfig.cloudflare.json
```

Worker 发布：

```bash
npx wrangler deploy
```

## 已知说明

- 当前没有账号系统，房间身份通过本浏览器会话 token 恢复。
- 没有公开匹配大厅，主要面向“把链接发给好友”的私密对局。
- WebSocket 在部分网络或代理链路中可能失败，前端已加入 HTTP + 轮询兜底，走棋和聊天仍可同步。
