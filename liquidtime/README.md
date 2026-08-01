# Liquid Time · 流体时间

一个全屏 WebGL 流体时钟，鼠标移动可扰动背景流体场，时间、日期、世界城市时钟实时更新。

## 在线预览

https://liquidtime.vercel.app

## 特性

- **WebGL 流体背景** — 基于分形布朗运动 (FBM) 的域扭曲着色器，支持鼠标交互扰动
- **动态调色板** — 根据一天中的时段自动切换配色（深夜 / 黎明 / 白天 / 黄昏）
- **融化字体效果** — SVG 滤镜驱动的字形畸变，模拟墨水在水中的流动感
- **线框地球仪** — 2D Canvas 绘制的正交投影地球，带自转和悬停暂停
- **世界时钟** — 北京、东京、伦敦、纽约、悉尼五地实时时间
- **彩蛋** — 每小时的整点时刻自动浮现 "Be water, my friend."

## 技术栈

- 纯 HTML / CSS / JavaScript（零依赖）
- WebGL 1.0 + GLSL 片段着色器
- SVG 滤镜（feTurbulence + feDisplacementMap）
- Intl.DateTimeFormat 多时区时间处理

## 本地运行

```bash
npx serve liquidtime
# 或直接用浏览器打开 index.html
```

## License

MIT
