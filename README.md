# Live Citations

> **Inspired by and forked from [obsidian-pandoc-reference-list](https://github.com/obsidian-community/obsidian-pandoc-reference-list).**  
> Special thanks to the original author **mgmeyers** and the Obsidian community for building the foundation that made this plugin possible.

---

Live formatted bibliography and reference list for Pandoc citations in your Obsidian sidebar. Supports both desktop and mobile platforms.

This plugin scans the active document for Pandoc-style citations (e.g., `@citekey` or `[@citekey]`) and renders a beautifully formatted, real-time bibliography in a dedicated sidebar view — no manual refresh needed.

## 🚀 Key Features

- **Live Sidebar Bibliography**: Real-time rendering of your active document's references in a clean sidebar list.
- **Flexible Bibliography Sources**: Use a local `.bib` (BibTeX) file, or fetch directly from your **Zotero** library.
- **Mobile Support**: Fully compatible with Obsidian Mobile, with tailored settings for on-the-go BibTeX or Zotero library configuration.
- **Interactive Citations**: Click on references in the sidebar to view detailed metadata or trigger **Zotero** to open referenced PDF files directly.
- **Custom Citation Styles**: Apply any CSL style file (e.g., APA, Chicago, IEEE) for formatted output.
- **Pandoc Export**: Supports formatting and exporting your notes with complete bibliographies via Pandoc.

## ⚙️ Requirements

To use this plugin, you will need:

1. **Obsidian**: Version `0.15.0` or higher.
2. **Pandoc**: Version `2.11` or higher installed on your system (required for processing bibliographies).  
   → [Download Pandoc](https://pandoc.org/installing.html)
3. **Zotero** *(Optional)*: The Zotero desktop app is required if you want to sync citations directly from your Zotero library and open PDF attachments in Zotero.  
   → [Download Zotero](https://www.zotero.org/)

## 🛠️ Setup & Usage

### 1. Installation

Install manually from the [Releases](https://github.com/f10w3r/Obsidian-Live-Citations/releases) page:

1. Download `obsidian-live-citations-0.9.0.zip` from the latest release.
2. Extract the contents into your vault's plugin folder:  
   `<YourVault>/.obsidian/plugins/obsidian-live-citations/`
3. In Obsidian, go to **Settings → Community Plugins**, and enable **Live Citations**.

### 2. Configuration

Open **Settings → Live Citations** to configure:

| Setting | Description |
|---|---|
| **Pandoc Path** | Path to your `pandoc` executable (e.g. `/usr/local/bin/pandoc`) |
| **Bibliography Source** | Choose **BibTeX File** (provide `.bib` path) or **Zotero** |
| **BibTeX File Path** | Absolute path to your `.bib` file *(if using BibTeX mode)* |
| **CSL Style** *(Optional)* | Path or URL to a `.csl` style file for custom citation formatting |

### 3. Usage

1. Open the **Command Palette** (`Ctrl+P` / `Cmd+P`).
2. Run **`Live Citations: Show reference list`** to open the references sidebar.
3. Write Pandoc-style citekeys in your notes, e.g.:
   ```
   As shown in previous research [@smith2023], the results confirm...
   ```
4. The sidebar bibliography updates **live** as you type.

## 🙏 Acknowledgements

This plugin is a fork of [obsidian-pandoc-reference-list](https://github.com/obsidian-community/obsidian-pandoc-reference-list) by **mgmeyers** and contributors.  
The core citation parsing and rendering engine is based on their excellent work. This fork adds:

- Mobile compatibility
- Zotero local API integration
- Pandoc-based DOCX export
- UI improvements and bug fixes

---

*Maintained by [Miguel Li](https://github.com/f10w3r). Licensed under GPL-3.0.*
