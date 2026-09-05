# 实时访问人数：头像地球

依据用户给出的 Nomads.com community 截图调整：深灰海面、低对比大陆与国界、稀疏静态星点、直接落在地理位置上的圆形 Q 版匿名头像。没有底座、光柱、经纬装饰环或自动旋转。

## 实现

MapLibre GL JS 5.6.0 的原生 globe 投影；不是自制 Three.js 球体，也未复制 Nomads 的源码或会员照片。头像绘制函数从上一版原样提取，同一匿名访客仍是同一张脸。头像使用原生地图 symbol layer，在地球背面会被地图渲染器遮挡。共用同一坐标的人显示头像组，点击可逐一选择。

Natural Earth 1:50m 国家边界来自 world-atlas 2.0.2，经 topojson-client 3.1.0 转换，四位小数保存；地理轮廓不是手绘。渲染器、样式、地理文件均自托管，没有地图 API key、外部瓦片、图片或字体请求。第三方许可证见 vendor/maplibre/LICENSE.txt、assets/WORLD-ATLAS-LICENSE，文件摘要见 assets/globe-assets.sha256。Natural Earth 的边界表达是其源数据约定，不是法律边界认定；这也不是街道/导航地图。

公开参考：https://nomads.com/community
MapLibre 原生地球：https://maplibre.org/maplibre-gl-js/docs/examples/display-a-globe-with-a-vector-map/
地理数据许可：https://www.naturalearthdata.com/about/terms-of-use/

## 连续性与降级

在线人数仍使用同一个 /api/live 与90秒活动窗口。采集 SDK、D1、worker.js 与网站足迹 scene.js 未在本轮变更。数据断线显示最近数据/未知状态，不伪装为实时0人。没有坐标的人只显示在列表里。支持拖拽、缩放、地区快捷切换、展开地图、头像/键盘列表选择和时间线。头像是匿名本地生成，不推断真实长相。

WebGL 不可用或上下文丢失时使用同一地理数据和 Leaflet 的二维兼容视图，并明确标记；数据统计继续工作。地理文件失败有独立重试提示，不再受上一版公共瓦片失败影响。前台按350ms同步访客；地图自身按交互/数据更新渲染，不做自动绕球动画；纹理随访客离开清理。

## 验证

PORT=8894 node server.cjs
node tests/globe.mjs

测试使用固定的模拟 API 访客，地理数据与渲染器均为仓库里的真实静态文件。没有生产数据访问，也不向公共地图服务批量请求。最终结果与截图见 PR 的 Visual review artifact。
