import { Notice, PluginSettingTab, Setting, Modal, App } from 'obsidian';

import { t } from './lang/helpers';
import ReferenceList from './main';
import ReactDOM from 'react-dom';
import React from 'react';
import { SettingItem } from './settings/SettingItem';
import AsyncSelect from 'react-select/async';
import {
  NoOptionMessage,
  customSelectStyles,
  loadCSLLangOptions,
  loadCSLOptions,
} from './settings/select.helpers';
import { cslListRaw } from './bib/cslList';
import { langListRaw } from './bib/cslLangList';
import { ZoteroLibraryModal } from './settings/ZoteroLibraryModal';
import { DEFAULT_ZOTERO_PORT, isZoteroRunning } from './bib/helpers';

export const DEFAULT_SETTINGS: ReferenceListSettings = {
  tooltipDelay: 400,
  zoteroGroups: [],
  renderCitations: true,
  renderCitationsReadingMode: true,
  renderLinkCitations: true,
  cslSource: 'search',
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
      .addDropdown((dropdown) => {
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

    if (!this.plugin.settings.pullFromZotero) {
      bibSetting.addText((text) => {
        text.inputEl.style.order = '2';
        text.inputEl.style.width = '100%';
        text.inputEl.style.maxWidth = '240px';
        text
          .setPlaceholder(t('Path to BibTex file'))
          .setValue(this.plugin.settings.pathToBibliography)
          .onChange((value) => {
            const prev = this.plugin.settings.pathToBibliography;
            this.plugin.settings.pathToBibliography = value;
            this.plugin.saveSettings(() => {
              this.plugin.bibManager.clearWatcher(prev);
              this.plugin.bibManager.reinit(true);
            });
          });
      });

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

    const cslSource = this.plugin.settings.cslSource || 'search';

    const sourceSetting = new Setting(containerEl)
      .setName(t('Citation style'))
      .setDesc(t('Select a local file or search online.'))
      .addDropdown((dropdown) => {
        dropdown.selectEl.style.order = '2';
        dropdown.selectEl.style.width = '110px';
        dropdown
          .addOption('search', t('Search'))
          .addOption('custom', t('CSL File'))
          .setValue(cslSource)
          .onChange((value: 'search' | 'custom') => {
            this.plugin.settings.cslSource = value;
            this.plugin.saveSettings(() => this.plugin.bibManager.reinit(false));
            this.display();
          });
      });

    sourceSetting.infoEl.style.whiteSpace = 'nowrap';
    sourceSetting.infoEl.style.flexShrink = '0';
    sourceSetting.infoEl.style.flex = '0 0 auto';
    sourceSetting.controlEl.style.flexWrap = 'wrap';
    sourceSetting.controlEl.style.rowGap = '10px';

    const langContainer = sourceSetting.controlEl.createDiv();
    langContainer.style.order = '1';
    langContainer.style.width = '100%';
    langContainer.style.maxWidth = '180px';
    langContainer.style.marginLeft = '5px';
    
    const defaultLanguage = langListRaw.find(
      (item) => item.value === this.plugin.settings.cslLang
    );

    ReactDOM.render(
      <AsyncSelect
        noOptionsMessage={() => <span>{t('Type to search CSL style language')}</span>}
        placeholder={t('Type to search CSL style language')}
        cacheOptions
        className="pwc-multiselect"
        defaultValue={defaultLanguage}
        loadOptions={loadCSLLangOptions}
        isClearable
        onChange={(selection: any) => {
          this.plugin.settings.cslLang = selection?.value;
          this.plugin.saveSettings(() =>
            this.plugin.bibManager.reinit(false)
          );
        }}
        styles={customSelectStyles}
      />,
      langContainer
    );

    const breakEl = sourceSetting.controlEl.createDiv();
    breakEl.style.order = '3';
    breakEl.style.flexBasis = '100%';
    breakEl.style.height = '0';

    if (cslSource === 'search') {
      const searchContainer = sourceSetting.controlEl.createDiv();
      searchContainer.style.order = '4';
      searchContainer.style.width = '100%';
      searchContainer.style.maxWidth = '392px';
      searchContainer.style.marginLeft = '5px';
      
      const defaultStyle = cslListRaw.find(
        (item) => item.value === this.plugin.settings.cslStyleURL
      );

      ReactDOM.render(
        <AsyncSelect
          noOptionsMessage={NoOptionMessage}
          placeholder={t('Search...')}
          cacheOptions
          className="pwc-multiselect"
          defaultValue={defaultStyle}
          loadOptions={loadCSLOptions}
          isClearable
          onChange={(selection: any) => {
            this.plugin.settings.cslStyleURL = selection?.value;
            this.plugin.saveSettings(() =>
              this.plugin.bibManager.reinit(false)
            );
          }}
          styles={customSelectStyles}
        />,
        searchContainer
      );
    } else {
      sourceSetting.addText((text) => {
        text.inputEl.style.order = '5';
        text.inputEl.style.width = '100%';
        text.inputEl.style.maxWidth = '362px';
        text
          .setPlaceholder(t('Path to CSL file'))
          .setValue(this.plugin.settings.cslStylePath)
          .onChange((value) => {
            this.plugin.settings.cslStylePath = value;
            this.plugin.saveSettings(() =>
              this.plugin.bibManager.reinit(false)
            );
          });
      });

      sourceSetting.addExtraButton((b) => {
        b.extraSettingsEl.style.order = '4';
        b.setIcon('folder');
        b.setTooltip(t('Select a CSL file located on your computer'));
        b.onClick(() => {
          const path = require('electron').remote.dialog.showOpenDialogSync({
            properties: ['openFile'],
          });

          if (path && path.length) {
            this.plugin.settings.cslStylePath = path[0];
            this.plugin.saveSettings(() =>
              this.plugin.bibManager.reinit(false)
            );
            this.display();
          }
        });
      });
    }





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
      .setDesc(t('Replace links with link icons to save space.'))
      .addToggle((text) =>
        text.setValue(!!this.plugin.settings.hideLinks).onChange((value) => {
          this.plugin.settings.hideLinks = value;
          this.plugin.saveSettings();
        })
      );

    new Setting(contentEl)
      .setName(t('Render live preview inline citations'))
      .setDesc(
        t(
          'Convert [@pandoc] citations to formatted inline citations in live preview mode.'
        )
      )
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
      .setDesc(
        t(
          'Convert [@pandoc] citations to formatted inline citations in reading mode.'
        )
      )
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
      .setDesc(
        t(
          'Include [[@pandoc]] citations in the reference list and format them as inline citations in live preview mode.'
        )
      )
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
      .setDesc(
        t(
          'When enabled, an autocomplete dialog will display when typing citation keys.'
        )
      )
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
      .setDesc(
        t(
          'When enabled, hovering over citekeys will open a tooltip containing a formatted citation.'
        )
      )
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
      .setDesc(
        t(
          'Set the amount of time (in milliseconds) to wait before displaying tooltips.'
        )
      )
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
