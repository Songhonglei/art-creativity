# MBP—14 · 机械研究台

一个以 2025 款 MacBook Pro 14 英寸（M5）为参考的三维机械研究展示，将整机、结构爆炸与 16:9 俯视平铺串联为连续交互，并提供 20 个独立组件的检索与观察。

> 本项目依据公开规格、外观与拆解资料进行形态重建，不是维修级 CAD，也不是经核实的零件清单，不应作为拆机、制造、装配或采购依据。

## 在线预览

[在线预览](https://3d-mac-book.ok.kimi.link)
## 特性

- **三态连续布局** — 单一进度控件连接整机、爆炸与 16:9 俯视平铺，支持自动播放、暂停、复位与布局跳转
- **20 个独立组件** — 包含 M5 SoC、统一内存、SSD、单风扇散热模组、电池、触控板、扬声器及七类真实接口
- **部件检索与聚焦** — 支持分类、材质与中英文别名搜索，点击模型或索引可聚焦部件并查看研究说明
- **击键联动** — 独立键帽响应物理键盘的按下与释放，同步呈现下沉和高亮
- **平滑镜头系统** — 镜头随布局和选中部件平滑过渡，也可切换为自由环绕观察
- **按需渲染与降级** — 静止时停止持续绘制；WebGL 不可用或上下文丢失时，仍可搜索索引并查看组件详情

## 技术栈

- Vite + 原生 HTML / CSS / JavaScript
- Three.js / WebGL 2.0 / OrbitControls
- 参数化几何、实例化网格与程序化材质
- Lucide 图标
- Playwright / Chromium 交互与视觉回归

## 本地运行

```bash
cd macbook-pro-mechanical-study
npm ci
npm run dev
```

构建并预览生产版本：

```bash
npm run build
npm run preview
```

## License

自有内容采用 [PolyForm Noncommercial 1.0.0](LICENSE)。非商业用途免费；许可证允许范围外的商用须先取得书面授权。第三方材料及历史版本的既有授权不变；[范围与商用联系](https://github.com/Songhonglei/art-creativity/blob/main/LICENSING.md)。
