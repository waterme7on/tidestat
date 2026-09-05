# TideStat

> **最新：实时访问人数**：默认世界地图已改为 Nomads 风格的深色地球与 Q 版匿名头像；在线数据、位置缺失、聚合与测试说明见 [docs/realtime-map.md](docs/realtime-map.md)。地图采用 MapLibre 原生 globe 投影与自托管 Natural Earth 地理数据，不使用早先的 Observatory 仪器地球。

实时访客可视化分析——把「谁在访问你的网站」变成两个一眼可读的 3D 场景:

- **世界地图**:一个可拖拽旋转的卡通地球,每位访客在其所在城市升起一枚暖橙色光束,光束高度 = 该城市当前在线人数,地表脉冲环标记位置,≥3 人时显示城市标签。
- **网站足迹**:把你的网站画成一座立体公园——节点是建筑(入口/首页/作品馆/文章林/实验室…),页面链接是发光小径;**每位访客是一个卡通头像**,沿小径在页面之间行走、停留、离开,像看一群人逛园子。点击右侧事件流任意一条,即可追踪该访客的完整足迹与时间线。

在线地址:**https://tidestat.yololab.cc**(备用:GitHub Pages 镜像与 workers.dev)。加 `?demo=1` 进入内置模拟器的演示模式。

当前已接入 **yololab.cc** 的真实埋点数据。

---

## 架构总览

单文件应用 + 一个 Cloudflare Worker,零构建链。

```
 浏览器(yololab.cc 页面)
   │  <script async src="https://tidestat.yololab.cc/t.js">
   ▼
 t.js 埋点 SDK(Worker 分发)
   │  navigator.sendBeacon / fetch keepalive
   ▼
 POST /api/collect ────────►  Cloudflare Worker (worker.js)
                                │  request.cf 自动附带城市/经纬度/国家
                                ▼
                              D1 events 表 ──► 2% 概率顺带清理 24h 前旧数据
                                │
 App(index.html,4s 轮询) ◄── GET /api/live(10 分钟窗口聚合,90 秒在线判定)
   │
   ├─ view=map   → 3D 地球(three.js)
   └─ view=park  → 3D 公园(three.js)+ 右侧事件流/访客时间线
```

## 目录结构

```
index.html                  全部前端:UI、模拟器、2D 兜底、three.js 场景(单文件)
worker.js                   Worker:collect API / live 聚合 / t.js 分发 / 静态资产
schema.sql                  D1 表结构
vendor/three.module.js      three.js 0.169(自托管,见「踩坑备忘」)
vendor/OrbitControls.js     轨道控制器(自托管)
server.cjs                  本地预览小服务器(仅开发用)
wrangler.toml               Worker 配置(D1 绑定 + tidestat.yololab.cc 自定义域)
.github/workflows/
  deploy-worker.yml         push main → wrangler deploy(Cloudflare)
  deploy.yml                push main → GitHub Pages(镜像)
```

## 数据管线

### 1. 埋点 SDK(`t.js`)

Worker 直接以字符串分发(~30 行),接入方只需一行:

```html
<script async defer src="https://tidestat.yololab.cc/t.js"></script>
```

- 首次访问生成 `visitor_id` 存 `localStorage`,匿名、无 Cookie
- 上报字段:`{ v: visitor_id, p: pathname+hash, r: referrer, w: viewport宽, site: hostname }`
- 猴子补丁 `history.pushState` + 监听 `popstate`,SPA 路由变化自动补发 pageview
- 发送优先 `navigator.sendBeacon`,降级 `fetch keepalive`

### 2. 采集(`/api/collect`)

- 地理信息不做任何 IP 查询服务:直接读 Cloudflare 边缘注入的 `request.cf`(city / country / latitude / longitude),**不落库原始 IP**
- `device` 由 User-Agent 归纳为 desktop / mobile / tablet
- 写入 D1 `events` 表;每次写入 2% 概率触发一次 `DELETE ts < now-24h` 的惰性清理

### 3. 实时聚合(`/api/live`)

一次 SQL 取出最近 10 分钟事件,内存中按 `visitor_id` 聚合为:

```json
{ "now": 0, "onlineMs": 90000, "visitors": [{
    "id": "...", "city": "Tokyo", "country": "JP", "lat": 35.7, "lng": 139.7,
    "device": "desktop", "firstTs": 0, "lastTs": 0,
    "paths": [{ "path": "/zh/writing", "ts": 0 }]
}]}
```

- **在线** = 最近 90 秒内有事件;`paths` 即该访客的页面时间线(最多保留 12 条)

### 4. 前端渲染(App)

- 主循环 rAF:live 模式每 4s 轮询一次 `/api/live`,diff 出「新访客进入 / 页面切换 / 离开」并驱动事件流
- 访客在两个视图间共享同一份数据:同一个人,在地球上是一枚光柱,在公园里是一个走动的头像

## 数据模型(前端)

访客是一个小型状态机:

```
entering ──► walking ──► reading ──► walking ──► … ──► leaving ──► 移除
             沿边曲线插值     停留该节点        下一个节点      渐隐
```

- `t` ∈ [0,1] 为边上的进度,speed 按边长换算;reading 停留 3.5–13s(真实模式由两次 pageview 的实际间隔驱动)
- `visited[]` 记录页面序列与到达时间,驱动选中访客的高亮轨迹与右侧时间线

### 站点结构(`SITE`)

节点 = `{ id, label, x, y, kind }`,kind 决定 3D 建筑造型与屋顶颜色;边带转移权重,`nextNode()` 按权重随机选路(真实模式下路径由实际 pageview 决定,权重只用于 demo)。真实 URL → 节点通过 `PATH_NODES` 前缀映射(如 `/zh/writing/dyor → dyor`),未匹配的路径归入兜底节点。

## 世界地图(3D 地球)

- **陆地点阵**:预生成的 96×48 陆地位图(base64,768 字节,源自 Natural Earth GeoJSON 一次性离线转换)投影到半径 2 的球面,`InstancedMesh` 一次绘制 ~1,359 个陆点;地球整体倾斜 23°
- **海球**:toon 材质纸蓝;**大气辉光**:BackSide 球壳 + 片元着色器边缘发光
- **城市 beacon**:访客所在城市升起光束(加色混合圆柱)+ 顶端亮点 + 地表脉冲环 + 径向光晕 Sprite;高度随并发人数伸缩;**背面剔除**——`城市法线 · 相机方向 > 0.28` 才显示,避免光束穿球
- **交互**:OrbitControls(阻尼、惯性、滚轮缩放、缓速自转)

## 网站足迹(3D 公园)

- **建筑**:kind 决定造型——入口=发光横梁拱门、首页=双塔、内容区=双层楼+塔、实验室=圆顶、小屋=锥顶屋;统一蓝灰体 + 该类型的屋顶色;楼体嵌发光窗
- **小径**:每条边一条 CatmullRom 上拱曲线 + `TubeGeometry` 细管(墨蓝半透明)
- **头像系统**:每个访客按 id 哈希**稳定生成**外观——6 种肤色 × 6 种发色 × 4 种发型(刘海/短发/马尾/棒球帽)× 眼镜 × 表情;同一访客永远同一张脸,不同访客长相不同;表情随状态变化(走路圆嘴、停留微笑、离开抿嘴)
- **停泊**:同节点停留的头像围绕节点散布成环(`_ringIdx`),避免遮住建筑标签
- **轨迹**:被追踪(选中)访客的已走路径高亮为蓝色曲线,其余头像降透明度

## 视觉系统

全部 3D 颜色集中在 module 顶部的 `P` 调色板(一处调全站):

- **对比策略(明度阶梯)**:暖纸背景(最亮)→ 沙盘/海球(中)→ 建筑体/陆点(深)→ 光束/信号(最饱和)
- **颜色即信息**:屋顶色编码页面类型(入口蓝 / 首页陶土 / 内容区鼠尾草 / 实验室灰蓝 / 小屋芥末);**光束是全画面唯一的暖色**——视线自动落在「有人访问」上
- UI(顶栏/事件流/时间线)与 3D 场景共享同一组 CSS token(暖纸底、墨字、青蓝 accent)

## 隐私原则

- 无 Cookie、无跨站追踪;`visitor_id` 是站点内的随机 localStorage 值
- 不存储原始 IP;地理信息来自 Cloudflare 边缘的 `request.cf`
- 事件 24 小时后惰性清理;D1 中只保留 `visitor_id / 时间 / 路径 / 城市 / 设备`

## 性能预算

- 3D 渲染上限 **30fps**(自转+脉冲足够顺滑,移动端省电)
- 数据同步(walker/beacon 状态)**200ms 节流**,渲染仍每帧
- 陆点 InstancedMesh 单次 draw call;头像为 Sprite(每人一张 128×128 CanvasTexture,状态变化才重绘)
- `preserveDrawingBuffer: true`(支持 `toDataURL` 导出画面,为后续截图分享预留)

## 部署

- **Cloudflare(主)**:`push main → deploy-worker.yml → wrangler deploy`。需要仓库 Secrets:`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`
- **GitHub Pages(镜像)**:`push main → deploy.yml`。首次启用需在仓库 Settings → Pages 选择 "GitHub Actions"
- **自定义域**:`wrangler.toml` 中 `routes = [{ pattern = "tidestat.yololab.cc", custom_domain = true }]`,部署时自动建 DNS 与证书
- **本地预览**:`node server.cjs`(127.0.0.1:8893,服务仓库根目录)

## 已知限制与路线图

- 仅"实时"单一窗口(90 秒在线);**时间段回放**(某时间段内谁访问过)在路线图首位
- 未过滤爬虫/机器人流量(部分爬虫会执行 JS,会出现在访客中)
- 头像纹理在访客数很大时可用纹理池优化;事件流无分页
- 单文件 index.html 已 ~1,300 行,若功能继续扩张应拆分为 Vite 工程(部署链已就绪,拆分成本低)

## 踩坑备忘(为什么是现在这个样子)

- **three.js 必须自托管**:jsdelivr CDN 在代理与大陆网络下不稳定,曾导致 3D 视图整页空白
- **WebGL 画布导出必须 `preserveDrawingBuffer`**,否则 `toDataURL` 全黑
- **不要依赖 alpha 透传**:部分路径下透明 clear color 合成不稳定,场景背景直接给不透明色
- **多人共用同一工作树**:并行会话会在同仓切分支、PR 编号会撞车;任何改动前先 `git status` 确认现场,merge 前核对 PR 的 head 分支归属
