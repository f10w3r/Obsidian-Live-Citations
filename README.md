# Live Citations

> **Inspired by and forked from [obsidian-pandoc-reference-list](https://github.com/obsidian-community/obsidian-pandoc-reference-list).**  
> Special thanks to the original author **mgmeyers** and the Obsidian community for building the foundation that made this plugin possible.

---

Live formatted bibliography and reference list for Pandoc-style citations in your Obsidian sidebar. Fully compatible with both **desktop and mobile** platforms.

This plugin scans the active document for citekeys (e.g., `@citekey` or `[@citekey]`) and renders a dynamically formatted, real-time bibliography list in a dedicated sidebar view.

## 🚀 Key Features & Enhancements

This repository is a customized version of the original `obsidian-pandoc-reference-list` plugin, adding several major features implemented natively in JS:

- **Zero External Dependencies**: Unlike the original plugin, this version **does not require a local Pandoc installation**. All citation parsing, styling, and rendering are handled natively in the sandbox using JavaScript/TypeScript.
- **Obsidian Mobile Support**: Thanks to the removal of the Pandoc executable dependency, this plugin is now fully compatible with **Obsidian Mobile** (iOS and Android).
- **Native DOCX Export**: Supports exporting your notes into beautifully formatted Microsoft Word `.docx` documents, complete with compiled reference lists, generated directly in JS.
- **Dual Bibliography Sources**: Read bibliography keys directly from a local `.bib` (BibTeX) file, or dynamically pull references from your **Zotero** database.
- **Interactive Citations**: Click on references in the sidebar to open the corresponding PDF attachments in **Zotero** instantly.
- **Dynamic CSL Styling**: Supports custom `.csl` style files (e.g., APA, Chicago, IEEE) to render your citations in any academic formatting style.

## ⚙️ Requirements

| Requirement | Details |
|---|---|
| **Obsidian** | Version `0.15.0` or higher |
| **Zotero** *(Optional)* | Required only if you select Zotero as your library source or wish to open PDF files in Zotero. |

> 💡 **No Pandoc installation is required** for any features of this plugin (including rendering, live updates, and DOCX exporting).

## 🛠️ Setup & Usage

### 1. Installation

Install manually via the [Releases](https://github.com/f10w3r/Obsidian-Live-Citations/releases) page:

1. Download the `obsidian-live-citations-0.9.0.zip` file from the latest release.
2. Extract the archive into your Obsidian vault's plugins folder:  
   `<YourVault>/.obsidian/plugins/obsidian-live-citations/`
3. Go to **Settings → Community Plugins** inside Obsidian and enable **Live Citations**.

### 2. Configuration

Open **Settings → Live Citations** to configure:

- **Bibliography Source**: Choose between **BibTeX File** (and specify the absolute path to your `.bib` library file) or **Zotero** database connection.
- **CSL Style** *(Optional)*: Specify the path or URL to a `.csl` style file for custom citation formatting.

### 3. Usage

1. Open the **Command Palette** (`Ctrl+P` / `Cmd+P`).
2. Run **`Live Citations: Show reference list`** to open the references sidebar.
3. Write Pandoc-style citekeys in your notes (e.g. `According to studies [@smith2023]...`).
4. The bibliography updates **live** in the sidebar as you type.

## 🙏 Acknowledgements

This plugin is a fork of [obsidian-pandoc-reference-list](https://github.com/obsidian-community/obsidian-pandoc-reference-list) by **mgmeyers**. The core parsing flow and interface skeleton are credited to the original author. This fork aims to provide a lightweight, cross-platform, dependency-free alternative that runs seamlessly on mobile and desktop alike.

---

*Maintained by [Miguel Li](https://github.com/f10w3r). Licensed under GPL-3.0.*
