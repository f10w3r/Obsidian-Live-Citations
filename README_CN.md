# Live Citations

[English](./README.md)

轻量级学术写作的 Obsidian 插件。在侧边栏实时预览和显示 Pandoc 格式引用（例如 `[@citekey]`）的参考文献列表。

## 功能特性

- **免 Pandoc 依赖**：无需在电脑上安装 Pandoc 软件，文献渲染与排版完全通过 `citeproc-js` 在 Obsidian 内部（纯 JS）完成。
- **支持移动端**：完美适配 Obsidian 移动端（iOS / Android）及桌面端。
- **双文献源支持**：支持读取本地 `.bib`（BibTeX）文件，或直接连接 **Zotero** 本地 API 动态获取文献。
- **纯 JS 导出 DOCX**：支持将笔记直接导出为 Microsoft Word `.docx` 格式（带格式化文献列表），无需任何外部二进制软件。
- **Zotero PDF 联动**：在侧边栏点击引用的文献，可直接唤起 Zotero 并打开对应的 PDF 附件。

## 安装方法

### 方法一：通过 BRAT 插件（推荐，便于更新）
1. 在 Obsidian 社区插件市场中搜索并安装启用 **BRAT** 插件。
2. 进入 **设置 -> BRAT -> Add Beta Plugin**。
3. 输入 `f10w3r/Obsidian-Live-Citations`，点击 **Add Plugin**。

### 方法二：手动安装
1. 从 [Releases](https://github.com/f10w3r/Obsidian-Live-Citations/releases) 页面下载最新的 `live-citations-0.9.0.zip`。
2. 解压并将文件夹放入你的库的插件目录下：`<你的库>/.obsidian/plugins/live-citations/`。
3. 进入 Obsidian 设置 -> 社区插件，启用 **Live Citations**。

## 使用说明

1. 按 `Cmd/Ctrl + P` 唤起命令面板，运行 `Live Citations: Show reference list` 打开文献侧边栏。
2. 在笔记中插入 Pandoc 格式的引用键（如 `[@smith2023]`），侧边栏的文献列表会实时更新。
3. 如需将当前笔记导出为 Word 文档，在命令面板中运行 `Live Citations: Export current file to DOCX`。

## 致谢与项目分叉说明

本项目分叉（Fork）自 mgmeyers 的开源项目 [obsidian-pandoc-reference-list](https://github.com/obsidian-community/obsidian-pandoc-reference-list)。在此基础上，我们移除了对外部 Pandoc 软件的硬性依赖，并使用纯 JS 实现了移动端兼容、Zotero API 联动和 DOCX 导出。

---
许可证: GPL-3.0 | 维护者: [Miguel Li](https://github.com/f10w3r)
