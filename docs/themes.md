# 跟随系统的日夜主题

本轮基于 B 版头像提交 `ee402a8` 增量添加外观，不替换地图、头像、相机或数据模型。

默认选项为「跟随系统」，读取 `prefers-color-scheme: dark`，监听 MediaQueryList 的 change 事件；不按小时强制改变用户设置。系统若自行定时切换明暗，页面随之更新。地图右上角也可手动选择浅色/深色，保存至本机 localStorage，并监听同源标签页的 storage 事件。禁止本地存储时仍可在当前页面切换。

`theme.js` 在 head 同步运行并设置根节点 data-theme、color-scheme 与 theme-color 元信息。地图和主题 CSS 在 head 中加载，避免等地图模块下载后才应用主题。

浅色：纸白大陆、浅灰蓝海洋、清晰低对比国界，关闭星点和活动光晕。深色：保留已确认的地球底色和细星点，只给实际在线、拥有有效坐标的访客位置加两层柔和暖光。同位置多人共享一个点，光晕大小有上限，避免挤满地图。光晕表示访问活动，不是现实城市照明、人口热力图或该城市的天文昼夜。不请求 GPS、时区服务或卫星夜景图。

灯光图层与头像共享 people GeoJSON；没有额外虚构点或持续动画循环。数据连接失败时暂停点灯，保留原有最近数据与中断提示；成功更新为零人时没有任何活动光点。平面兼容模式使用同一地理数据换色，并保留头像选择。

主题切换只调用 setPaintProperty，不调用 setStyle 或重建 Map。不重取地理数据、不清空头像纹理、不改变相机中心/缩放、不关闭详情。B 版 avatarSVG 内容、匿名 ID 映射、人数口径和后端均未修改。网站足迹场景保留原有深色设计，不在本轮重设计。

颜色过渡为 220ms；prefers-reduced-motion 下不使用过渡。不增加自动旋转、闪烁或粒子动画。

测试：`node tests/themes.mjs`。与现有头像/地球/降级回归一起运行，验证系统切换、手动覆盖和跨标签页同步、存储不可用、地图视角/详情/头像一致、无外部请求、数据中断停灯、手机布局以及 WebGL 平面兼容模式。截图使用固定的 20 位测试访客，非生产统计。`__tideMap.appearance()` 提供只读样式诊断。

参考 API：
- https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme
- https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList/change_event
- https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setpaintproperty
