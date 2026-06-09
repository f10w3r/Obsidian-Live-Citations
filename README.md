# Live Citations

Live formatted bibliography and reference list for Pandoc citations in your Obsidian sidebar. Supports both desktop and mobile platforms.

This plugin scans the active document for Pandoc-style citations (e.g., `@citekey` or `[@citekey]`) and renders a beautifully formatted, real-time bibliography in a dedicated sidebar view.

## 🚀 Key Features

- **Live Sidebar Bibliography**: Real-time rendering of your active document's references in a clean sidebar list.
- **Flexible Bibliography Sources**: Use a local `.bib` (BibTeX) file, or fetch directly from your **Zotero** library.
- **Mobile Support**: Fully compatible with Obsidian Mobile, with tailored settings for on-the-go BibTeX or Zotero library configuration.
- **Interactive Citations**: Click on references in the sidebar to view detailed metadata or trigger **Zotero** to open referenced PDF files directly.
- **Pandoc Export**: Supports formatting and exporting your notes with complete bibliographies via Pandoc.

## ⚙️ Requirements

To use this plugin, you will need:

1. **Obsidian**: Version `0.15.0` or higher.
2. **Pandoc**: Version `2.11` or higher installed on your system (required for processing bibliographies).
3. **Zotero** (Optional): The Zotero desktop app is required if you want to sync citations directly from your Zotero library and open PDF attachments in Zotero.

## 🛠️ Setup & Usage

### 1. Installation
You can install the plugin manually by downloading the latest release from the [Releases](https://github.com/f10w3r/Obsidian-Live-Citations/releases) page:
1. Download the `obsidian-live-citations-0.9.0.zip` file.
2. Extract the contents into your vault's plugin directory: `<vault>/.obsidian/plugins/obsidian-live-citations/`.
3. Open Obsidian settings, navigate to **Community Plugins**, and enable **Live Citations**.

### 2. Configuration
Go to the plugin's settings tab (**Live Citations**) to configure:
- **Pandoc Path**: Provide the path to the `pandoc` executable on your system.
- **Bibliography Source**: Choose between **BibTeX File** (and specify the `.bib` file path) or **Zotero** integration.
- **CSL Style** (Optional): Specify a `.csl` file path or URL to render your bibliography in a custom style (e.g., APA, Chicago, IEEE).

### 3. Usage
1. Open the Command Palette (`Ctrl+P` or `Cmd+P`).
2. Search and run `Live Citations: Show reference list` to open the references tab in the sidebar.
3. Start typing Pandoc citekeys in your markdown notes (e.g., `As discussed in @smith2023...`).
4. The bibliography list in the sidebar will update dynamically to display the formatted reference details.

---

*Maintained by [Miguel Li](https://github.com/f10w3r).*
