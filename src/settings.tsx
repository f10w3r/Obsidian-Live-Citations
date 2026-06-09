import { Notice, PluginSettingTab, Setting, Modal, App, Platform, ButtonComponent, debounce } from 'obsidian';

import { t } from './lang/helpers';
import ReferenceList from './main';
import ReactDOM from 'react-dom';
import React from 'react';
import { SettingItem } from './settings/SettingItem';
import { ZoteroLibraryModal } from './settings/ZoteroLibraryModal';
import { CSLStyleManagerModal } from './settings/CSLStyleManagerModal';
import { DEFAULT_ZOTERO_PORT, isZoteroRunning } from './bib/helpers';

export const DEFAULT_SETTINGS: ReferenceListSettings = {
  tooltipDelay: 400,
  zoteroGroups: [],
  renderCitations: true,
  renderCitationsReadingMode: true,
  renderLinkCitations: true,
  cslSource: 'search',
  exportFontSize: 12,
  exportLineSpacing: 1.15,
  exportIncludeUrls: false,
  pullFromZotero: true,
  zoteroPort: DEFAULT_ZOTERO_PORT,
  hideLinks: true,
  showCitekeyTooltips: true,
  enableCiteKeyCompletion: true,
  cslLang: 'en-US',
  cslStyleURL: 'https://raw.githubusercontent.com/citation-style-language/styles/master/apa.csl',
  cslStyleFilename: 'apa.csl',
  cslLangFilename: 'locales-en-US.xml',
};

export interface ZoteroGroup {
  id: number;
  name: string;
  lastUpdate?: number;
}

export interface ReferenceListSettings {
  pathToBibliography?: string;

  cslStyleURL?: string;
  cslStylePath?: string;
  cslLang?: string;
  cslSource?: 'search' | 'custom';
  cslStyleFilename?: string;
  cslLangFilename?: string;

  hideLinks?: boolean;
  showCitekeyTooltips?: boolean;
  tooltipDelay: number;
  enableCiteKeyCompletion?: boolean;
  renderCitations?: boolean;
  renderCitationsReadingMode?: boolean;
  renderLinkCitations?: boolean;

  pullFromZotero?: boolean;
  zoteroPort?: string;
  zoteroGroups: ZoteroGroup[];

  exportFontSize?: number;
  exportLineSpacing?: number;
  exportIncludeUrls?: boolean;
}

export class ReferenceListSettingsTab extends PluginSettingTab {
  plugin: ReferenceList;

  constructor(plugin: ReferenceList) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    const bibSetting = new Setting(containerEl)
      .setName(t('Bibliography'))
      .setDesc(t('Select a local file or connect to Zotero.'))

    bibSetting.addDropdown((dropdown) => {
      dropdown.selectEl.style.order = '4';
      dropdown.selectEl.style.width = '110px';
      dropdown
        .addOption('file', t('BibTex File'))
        .addOption('zotero', 'Zotero')
        .setValue(this.plugin.settings.pullFromZotero ? 'zotero' : 'file')
        .onChange((value) => {
          this.plugin.settings.pullFromZotero = value === 'zotero';
          this.plugin.saveSettings(() => {
            this.plugin.bibManager.reinit(true);
          });
          this.display();
        });
    });




    bibSetting.infoEl.style.whiteSpace = 'nowrap';
    bibSetting.infoEl.style.flexShrink = '0';
    bibSetting.infoEl.style.flex = '0 0 auto';
    bibSetting.controlEl.style.flexWrap = 'wrap';
    bibSetting.controlEl.style.rowGap = '10px';

    const isZoteroSelected = this.plugin.settings.pullFromZotero;

    if (!isZoteroSelected) {
      bibSetting.addText((text) => {
        text.inputEl.style.order = '2';
        text.inputEl.style.width = '100%';
        text.inputEl.style.maxWidth = '240px';

        const debouncedSave = debounce((value: string) => {
          const prev = this.plugin.settings.pathToBibliography;
          this.plugin.settings.pathToBibliography = value;
          this.plugin.saveSettings(() => {
            this.plugin.bibManager.clearWatcher(prev);
            this.plugin.bibManager.reinit(true);
          });
        }, 1000, false);

        text
          .setPlaceholder(t('Path to BibTex file'))
          .setValue(this.plugin.settings.pathToBibliography)
          .onChange((value) => {
            debouncedSave(value);
          });
      });

      if (!Platform.isMobile) {
        bibSetting.addExtraButton((b) => {
          b.extraSettingsEl.style.order = '1';
          b.setIcon('folder');
          b.setTooltip(t('Select a bibliography file.'));
          b.onClick(() => {
            const path = require('electron').remote.dialog.showOpenDialogSync({
              properties: ['openFile'],
            });

            if (path && path.length) {
              this.plugin.settings.pathToBibliography = path[0];
              this.plugin.saveSettings(() =>
                this.plugin.bibManager.reinit(true)
              );
              this.display();
            }
          });
        });
      }
    } else {
      if (Platform.isMobile) {
        const tipEl = bibSetting.controlEl.createDiv();
        tipEl.textContent = t('Using cache from desktop version');
        tipEl.style.order = '1';
        tipEl.style.color = 'var(--text-muted)';
        tipEl.style.fontSize = 'var(--font-small)';
        tipEl.style.display = 'flex';
        tipEl.style.alignItems = 'center';
        tipEl.style.marginRight = '10px';
      } else {
        let libButton: ButtonComponent;

        bibSetting.addButton((button) => {
          libButton = button;
          button.buttonEl.style.order = '2';
          button.buttonEl.style.width = '115px';
          button
            .setButtonText(t('Libraries'))
            .onClick(() => {
              new ZoteroLibraryModal(this.app, this.plugin).open();
            });
        });

        const portLabel = bibSetting.controlEl.createDiv();
        portLabel.textContent = 'API Port:';
        portLabel.style.order = '0';
        portLabel.style.marginRight = '4px';
        portLabel.style.whiteSpace = 'nowrap';
        portLabel.style.display = 'flex';
        portLabel.style.alignItems = 'center';

        bibSetting.addText((text) => {
          text.inputEl.style.order = '1';
          text.inputEl.style.width = '60px';
          text
            .setPlaceholder(t('Port'))
            .setValue(this.plugin.settings.zoteroPort ?? DEFAULT_ZOTERO_PORT)
            .onChange((value) => {
              this.plugin.settings.zoteroPort = value;
              this.plugin.saveSettings();
              libButton.setDisabled(true);
              libButton.setButtonText('...');
              isZoteroRunning(value).then((isRunning) => {
                if (isRunning) {
                  libButton.setDisabled(false);
                  libButton.setButtonText(t('Libraries'));
                } else {
                  libButton.setDisabled(true);
                  libButton.setButtonText(t('Disconnected'));
                }
              }).catch((e) => {
                libButton.setDisabled(true);
                libButton.setButtonText(t('Disconnected'));
              });
            });
        });

        // Initial check
        libButton.setDisabled(true);
        libButton.setButtonText('...');
        isZoteroRunning(this.plugin.settings.zoteroPort).then((isRunning) => {
          if (isRunning) {
            libButton.setDisabled(false);
            libButton.setButtonText(t('Libraries'));
          } else {
            libButton.setDisabled(true);
            libButton.setButtonText(t('Disconnected'));
          }
        }).catch((e) => {
          libButton.setDisabled(true);
          libButton.setButtonText(t('Disconnected'));
        });
      }
    }

    new Setting(containerEl)
      .setName(t('Citation style'))
      .setDesc(t('Configure citation styles and localization language.'))
      .addButton((button) => {
        button
          .setButtonText(t('Manage'))
          .onClick(() => {
            new CSLStyleManagerModal(this.app, this.plugin).open();
          });
      });





    new Setting(containerEl)
      .setName(t('Rendering'))
      .setDesc(t('Configure how citations are rendered in the editor.'))
      .addButton((button) =>
        button
          .setButtonText(t('In editor'))
          .onClick(() => {
            new RenderingSettingsModal(this.app, this.plugin).open();
          })
      );

    new Setting(containerEl)
      .setName(t('Export'))
      .setDesc(t('Convert to docx file.'))
      .addButton((button) =>
        button
          .setButtonText(t('Export format settings'))
          .onClick(() => {
            new ExportSettingsModal(this.app, this.plugin).open();
          })
      );
  }
}

class RenderingSettingsModal extends Modal {
  plugin: ReferenceList;

  constructor(app: App, plugin: ReferenceList) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: t('Rendering') });

    new Setting(contentEl)
      .setName(t('Hide links in references'))
      .setDesc(t('Replace link text with icons.'))
      .addToggle((text) =>
        text.setValue(!!this.plugin.settings.hideLinks).onChange((value) => {
          this.plugin.settings.hideLinks = value;
          this.plugin.saveSettings();
        })
      );

    new Setting(contentEl)
      .setName(t('Render live preview inline citations'))
      .setDesc(t('Render formatted citations in live preview mode.'))
      .addToggle((text) =>
        text
          .setValue(!!this.plugin.settings.renderCitations)
          .onChange((value) => {
            this.plugin.settings.renderCitations = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(contentEl)
      .setName(t('Render reading mode inline citations'))
      .setDesc(t('Render formatted citations in reading mode.'))
      .addToggle((text) =>
        text
          .setValue(!!this.plugin.settings.renderCitationsReadingMode)
          .onChange((value) => {
            this.plugin.settings.renderCitationsReadingMode = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(contentEl)
      .setName(t('Process citations in links'))
      .setDesc(t('Support citations wrapped in wiki-links (e.g. [[@citekey]]).'))
      .addToggle((text) =>
        text
          .setValue(!!this.plugin.settings.renderLinkCitations)
          .onChange((value) => {
            this.plugin.settings.renderLinkCitations = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(contentEl)
      .setName(t('Show citekey suggestions'))
      .setDesc(t('Show autocomplete list when typing citation keys.'))
      .addToggle((text) =>
        text
          .setValue(!!this.plugin.settings.enableCiteKeyCompletion)
          .onChange((value) => {
            this.plugin.settings.enableCiteKeyCompletion = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(contentEl)
      .setName(t('Show citekey tooltips'))
      .setDesc(t('Show hover tooltips for citation keys.'))
      .addToggle((text) =>
        text
          .setValue(!!this.plugin.settings.showCitekeyTooltips)
          .onChange((value) => {
            this.plugin.settings.showCitekeyTooltips = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(contentEl)
      .setName(t('Tooltip delay'))
      .setDesc(t('Delay before showing tooltips (in ms).'))
      .addSlider((slider) => {
        slider
          .setDynamicTooltip()
          .setLimits(0, 7000, 100)
          .setValue(this.plugin.settings.tooltipDelay)
          .onChange((value) => {
            this.plugin.settings.tooltipDelay = value;
            this.plugin.saveSettings();
          });
      });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class ExportSettingsModal extends Modal {
  plugin: ReferenceList;

  constructor(app: App, plugin: ReferenceList) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: t('Export format settings') });

    // 1. Body font size
    new Setting(contentEl)
      .setName(t('Body font size'))
      .addDropdown((dropdown) => {
        dropdown
          .addOption('9', '9 pt')
          .addOption('10', '10 pt')
          .addOption('10.5', '10.5 pt')
          .addOption('11', '11 pt')
          .addOption('12', '12 pt')
          .addOption('14', '14 pt')
          .addOption('16', '16 pt')
          .setValue(String(this.plugin.settings.exportFontSize ?? 12))
          .onChange((value) => {
            this.plugin.settings.exportFontSize = parseFloat(value) || 12;
            this.plugin.saveSettings();
          });
      });

    // 2. Line spacing
    new Setting(contentEl)
      .setName(t('Line spacing'))
      .addDropdown((dropdown) => {
        dropdown
          .addOption('1', '1.0')
          .addOption('1.15', '1.15')
          .addOption('1.25', '1.25')
          .addOption('1.3', '1.3')
          .addOption('1.5', '1.5')
          .addOption('2', '2.0')
          .setValue(String(this.plugin.settings.exportLineSpacing ?? 1.15))
          .onChange((value) => {
            this.plugin.settings.exportLineSpacing = parseFloat(value) || 1.15;
            this.plugin.saveSettings();
          });
      });

    // 3. Include URLs in reference list
    new Setting(contentEl)
      .setName(t('Include URLs in reference list'))
      .addToggle((toggle) => {
        toggle
          .setValue(!!this.plugin.settings.exportIncludeUrls)
          .onChange((value) => {
            this.plugin.settings.exportIncludeUrls = value;
            this.plugin.saveSettings();
          });
      });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
