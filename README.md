# Live Citations

> **Inspired by and forked from [obsidian-pandoc-reference-list](https://github.com/obsidian-community/obsidian-pandoc-reference-list).**  
> Special thanks to the original author **mgmeyers** and the Obsidian community for building the foundation that made this plugin possible.

---

Live formatted bibliography and reference list for Pandoc-style citations in your Obsidian sidebar. Supports both **desktop and mobile** platforms.

This plugin scans the active document for Pandoc-style citekeys (e.g., `@citekey` or `[@citekey]`) and renders a beautifully formatted, real-time bibliography in a dedicated sidebar — no external tools required for basic use.

## 🚀 Key Features

- **Live Sidebar Bibliography**: Real-time rendering of your active document's references in a clean sidebar list.
- **Flexible Bibliography Sources**: Use a local `.bib` (BibTeX) file, or fetch directly from your **Zotero** library via the Zotero local API.
- **Mobile Support**: Fully compatible with Obsidian Mobile, with tailored settings for BibTeX or Zotero configuration on the go.
- **Interactive Citations**: Click on references in the sidebar to trigger **Zotero** to open the referenced PDF attachment directly.
- **Custom Citation Styles**: Apply any CSL style file (e.g., APA, Chicago, IEEE) for formatted output.
- **Built-in Citation Engine**: Uses [citeproc-js](https://github.com/Juris-M/citeproc-js) — no external tools needed to render references.

## ⚙️ Requirements

| Requirement | Details |
|---|---|
| **Obsidian** | Version `0.15.0` or higher |
| **Zotero** *(Optional)* | Required only if using Zotero as your bibliography source. → [Download Zotero](https://www.zotero.org/) |

> No Pandoc installation is required. Citation rendering is handled entirely within the plugin.

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
| **Bibliography Source** | Choose **BibTeX File** (provide `.bib` file path) or **Zotero** |
| **BibTeX File Path** | Absolute path to your `.bib` file *(if using BibTeX mode)* |
| **CSL Style** *(Optional)* | Path or URL to a `.csl` file for custom citation formatting |

### 3. Using with Zotero

If you select **Zotero** as your bibliography source:
1. Make sure the **Zotero** desktop app is running.
2. The plugin connects to Zotero's local API at `http://localhost:23119`.
3. Your entire Zotero library becomes available as a citation source automatically.

### 4. Usage in Notes

1. Open the **Command Palette** (`Ctrl+P` / `Cmd+P`).
2. Run **`Live Citations: Show reference list`** to open the references sidebar.
3. Write Pandoc-style citekeys in your notes, e.g.:
   ```
   As shown in previous research [@smith2023], the results confirm...
   ```
4. The sidebar bibliography updates **live** as you type.

## 🙏 Acknowledgements

This plugin is a fork of [obsidian-pandoc-reference-list](https://github.com/obsidian-community/obsidian-pandoc-reference-list) by **mgmeyers** and contributors.  
The core citation parsing and rendering engine is built upon their excellent work. This fork adds:

- Mobile compatibility
- Zotero local API integration
- UI improvements and bug fixes

---

*Maintained by [Miguel Li](https://github.com/f10w3r). Licensed under GPL-3.0.*
