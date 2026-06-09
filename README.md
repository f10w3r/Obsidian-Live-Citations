# Live Citations

[简体中文](./README_CN.md)

An Obsidian plugin for lightweight academic writing. Displays real-time formatted bibliographies and reference lists in the sidebar for Pandoc-style citations (e.g. `[@citekey]`).

## Features

- **No Pandoc Required**: Citation rendering and layout are handled natively in JavaScript using `citeproc-js`.
- **Mobile Support**: Works fully on Obsidian Mobile (iOS/Android) as well as desktop.
- **Dual Sources**: Sync citations from a local `.bib` file or directly from your **Zotero** library (via Zotero's local API).
- **Native DOCX Export**: Export notes to Microsoft Word `.docx` documents with formatted bibliography lists (generated in JS).
- **Zotero PDF Link**: Click sidebar citations to open referenced PDFs directly in Zotero.

## Installation

### Method 1: Via BRAT (Recommended for updates)
1. Install and enable the **BRAT** plugin from Obsidian's Community Plugins.
2. Go to **Settings -> BRAT -> Add Beta Plugin**.
3. Enter `f10w3r/Obsidian-Live-Citations` and click **Add Plugin**.

### Method 2: Manual Installation
1. Download the latest `live-citations-0.9.0.zip` from [Releases](https://github.com/f10w3r/Obsidian-Live-Citations/releases).
2. Extract it into your vault's plugin directory: `<vault>/.obsidian/plugins/live-citations/`.
3. Enable **Live Citations** in Obsidian Settings -> Community Plugins.

## Usage

1. Open the Command Palette (`Cmd/Ctrl + P`) and run `Live Citations: Show reference list` to open the sidebar.
2. Insert Pandoc-style citekeys in your notes (e.g. `[@smith2023]`). The reference list will update live in the sidebar.
3. To export the current note as a Word document, run `Live Citations: Export current file to DOCX` from the Command Palette.

## Credits & Fork Info

This plugin is a fork of [obsidian-pandoc-reference-list](https://github.com/obsidian-community/obsidian-pandoc-reference-list) by **mgmeyers**. We have removed the external Pandoc binary dependency and added mobile compatibility, Zotero API integration, and DOCX exporting natively in JS.

---
License: GPL-3.0 | Maintained by [Miguel Li](https://github.com/f10w3r)
