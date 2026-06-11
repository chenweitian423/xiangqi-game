# 中国象棋游戏实现计划

## 目标

实现一个 React + TypeScript 中国象棋网页游戏。玩家可以在本地单机模式中执红对战内置 AI，也可以通过私密房间和好友进行在线对局。

## 架构原则

- 游戏规则、AI 搜索、UI 状态、联机客户端和 React 组件分层实现。
- 游戏规则核心不依赖 React，方便单元测试和后续复用。
- 联机状态通过可序列化的数据结构表达，便于在 Cloudflare Durable Objects 中保存和同步。
- 前端默认使用同源 `/api` 与 `/ws` 路径，避免在代码中写死真实域名。

## 主要模块

```text
src/
  app/              应用编排、单机入口、联机入口和 reducer
  game/             棋盘状态、走法生成、合法性校验、执行走法和棋谱
  ai/               局面评估、搜索和异步 AI worker
  online/           联机客户端、房间状态、hooks 和会话存储
  components/       棋盘、棋子、控制区、棋谱、联机房间和聊天组件
  feedback/         音效、震动和用户偏好
  storage/          本地保存
  styles/           主题样式
cloudflare/
  src/              Worker、Durable Object 和房间状态逻辑
server/
  src/              早期 Node/Fastify 后端，当前 Cloudflare 全量部署不依赖
```

## 实施步骤

### 1. 搭建前端基础

- 使用 Vite 创建 React + TypeScript 项目。
- 配置 Vitest、Testing Library 和 JSDOM。
- 保留常用脚本：`dev`、`build`、`lint`、`preview`、`test`。

### 2. 实现游戏规则核心

- 定义棋子、阵营、位置、走法和游戏状态类型。
- 初始化 10 行 9 列中国象棋棋盘。
- 实现车、马、炮、相/象、仕/士、帅/将、兵/卒的伪合法走法。
- 过滤会导致己方被将军的走法。
- 处理双将照面、吃子、将军、胜负和棋谱。

### 3. 实现 AI

- 通过局面评估函数计算子力、位置、过河兵、将帅安全和将军机会。
- 使用浅层 minimax 与 alpha-beta 剪枝选择黑方走法。
- 通过异步 worker 或延迟调度避免阻塞 UI。

### 4. 实现单机 UI

- 渲染棋盘、棋子、合法目标、最后一步和吃子区。
- 提供重开、悔棋、提示一步、回放和难度选择。
- 在 AI 思考时显示状态提示。

### 5. 实现联机房间

- 前端支持创建房间、加入房间、恢复会话、选择座位、聊天和提交走法。
- WebSocket 优先同步房间快照、聊天和走法。
- 当 WebSocket 不稳定时，回退到 HTTP 提交和轮询同步。

### 6. 实现 Cloudflare 后端

- Worker 处理 `/api/*`、`/rooms/:code/ws`、`/ws` 和 `/health`。
- Durable Object 按房间保存成员、座位、聊天、棋局、连接和 token。
- 房间支持过期清理、断线恢复和房主结束/重开。

### 7. 完成 Cloudflare 全量部署

- 使用 Workers Static Assets 托管 `dist`。
- 使用 Durable Objects 保存实时房间状态。
- 在 `wrangler.jsonc` 中保留模板化域名和 CORS 来源。
- 真实域名、账号、邮箱和 token 不写入仓库。

### 8. 验证

每次关键改动后运行：

```bash
npm run lint
npm test
npm run cf:typecheck
npm run build
```

发布前可使用：

```bash
npx wrangler deploy --dry-run
```

## 当前状态

项目已经具备单机玩法、联机房间、Cloudflare Worker 后端、Durable Object 房间状态和 Cloudflare 全量部署配置。后续主要工作是根据实际运营域名更新私有部署配置，并在 Cloudflare 控制台完成域名绑定。
