import {
  Events,
  MarkdownView,
  Menu,
  Plugin,
  WorkspaceLeaf,
  debounce,
  setIcon,
  Platform,
  requestUrl,
} from 'obsidian';

import {
  citeKeyCacheField,
  citeKeyPlugin,
  bibManagerField,
  editorTooltipHandler,
  mobileCursorTooltipPlugin,
} from './editorExtension';
import { t } from './lang/helpers';
import { processCiteKeys } from './markdownPostprocessor';
import {
  DEFAULT_SETTINGS,
  ReferenceListSettings,
  ReferenceListSettingsTab,
} from './settings';
import { TooltipManager } from './tooltip';
import { ReferenceListView, viewType } from './view';
import { PromiseCapability, getVaultRoot } from './helpers';
import { BibManager } from './bib/bibManager';
import { CiteSuggest } from './citeSuggest/citeSuggest';
import { isZoteroRunning, getZUserGroups, initCslDefaults } from './bib/helpers';

export default class ReferenceList extends Plugin {
  settings: ReferenceListSettings;
  emitter: Events;
  tooltipManager: TooltipManager;
  cacheDir: string;
  cslCacheDir: string;
  localeCacheDir: string;
  bibManager: BibManager;
  _initPromise: PromiseCapability<void>;

  get initPromise() {
    if (!this._initPromise) {
      return (this._initPromise = new PromiseCapability());
    }
    return this._initPromise;
  }

  async onload() {
    const { app } = this;

    await this.loadSettings();

    this.registerView(
      viewType,
      (leaf: WorkspaceLeaf) => new ReferenceListView(leaf, this)
    );

    this.cacheDir = Platform.isMobile
      ? `${this.manifest.dir}/zotero-cache`
      : require('path').join(getVaultRoot(), this.manifest.dir, 'zotero-cache');
    this.cslCacheDir = Platform.isMobile
      ? `${this.manifest.dir}/csl-cache`
      : require('path').join(getVaultRoot(), this.manifest.dir, 'csl-cache');
    this.localeCacheDir = Platform.isMobile
      ? `${this.manifest.dir}/locale-cache`
      : require('path').join(getVaultRoot(), this.manifest.dir, 'locale-cache');

    await initCslDefaults(this.cslCacheDir, this.localeCacheDir);
    await this.migrateLegacySettings();
    
    this.emitter = new Events();
    this.bibManager = new BibManager(this);
    this.initPromise.promise
      .then(async () => {
        if (this.settings.pullFromZotero) {
          if (!this.settings.zoteroGroups || this.settings.zoteroGroups.length === 0) {
            try {
              const groups = await getZUserGroups(this.settings.zoteroPort);
              if (groups && groups.length > 0) {
                this.settings.zoteroGroups = [{ id: groups[0].id, name: groups[0].name }];
                await this.saveData(this.settings);
              }
            } catch (e) {
              console.warn('Failed to auto-configure Zotero groups', e);
            }
          }
          return this.bibManager.loadAndRefreshGlobalZBib();
        } else {
          return this.bibManager.loadGlobalBibFile();
        }
      })
      .finally(() => this.bibManager.initPromise.resolve());

    this.addSettingTab(new ReferenceListSettingsTab(this));
    this.registerEditorSuggest(new CiteSuggest(app, this));
    this.tooltipManager = new TooltipManager(this);
    this.registerMarkdownPostProcessor(processCiteKeys(this));
    this.registerEditorExtension([
      bibManagerField.init(() => this.bibManager),
      citeKeyCacheField,
      citeKeyPlugin,
      editorTooltipHandler(this.tooltipManager),
      mobileCursorTooltipPlugin,
    ]);

    this.initPromise.resolve();
    this.app.workspace.trigger('parse-style-settings');

    this.addCommand({
      id: 'focus-reference-list-view',
      name: t('Show reference list'),
      callback: async () => {
        this.initLeaf();
      },
    });

    this.addCommand({
      id: 'export-to-docx',
      name: t('Export current file to DOCX'),
      checkCallback: (checking: boolean) => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
          if (!checking) {
            import('./docxExporter').then(({ exportToDocx }) => {
              exportToDocx(this.app, activeView.file, this);
            });
          }
          return true;
        }
        return false;
      },
    });

    document.body.toggleClass(
      'pwc-tooltips',
      !!this.settings.showCitekeyTooltips
    );

    this.registerEvent(
      app.metadataCache.on(
        'changed',
        debounce(
          async (file) => {
            await this.initPromise.promise;
            await this.bibManager.initPromise.promise;

            const activeView = app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView && file === activeView.file) {
              this.processReferences();
            }
          },
          100,
          true
        )
      )
    );

    this.registerEvent(
      app.workspace.on(
        'active-leaf-change',
        debounce(
          async (leaf) => {
            await this.initPromise.promise;
            await this.bibManager.initPromise.promise;

            app.workspace.iterateRootLeaves((rootLeaf) => {
              if (rootLeaf === leaf) {
                if (leaf.view instanceof MarkdownView) {
                  this.processReferences();
                } else {
                  this.view?.setNoContentMessage();
                }
              }
            });
          },
          100,
          true
        )
      )
    );

    (async () => {
      this.initStatusBar();
      this.setStatusBarLoading();

      await this.initPromise.promise;
      await this.bibManager.initPromise.promise;

      this.setStatusBarIdle();
      this.processReferences();
    })();
  }

  onunload() {
    document.body.removeClass('pwc-tooltips');
    this.app.workspace
      .getLeavesOfType(viewType)
      .forEach((leaf) => leaf.detach());
    this.bibManager.destroy();
  }

  statusBarIcon: HTMLElement;
  initStatusBar() {
    const ico = (this.statusBarIcon = this.addStatusBarItem());
    ico.addClass('pwc-status-icon', 'clickable-icon');
    ico.setAttr('aria-label', t('Pandoc reference list settings'));
    ico.setAttr('data-tooltip-position', 'top');
    this.setStatusBarIdle();
    let isOpen = false;
    ico.addEventListener('click', () => {
      if (isOpen) return;
      const { settings } = this;
      const menu = (new Menu() as any)
        .addSections(['settings', 'actions'])
        .addItem((item: any) =>
          item
            .setSection('settings')
            .setIcon('lucide-message-square')
            .setTitle(t('Show citekey tooltips'))
            .setChecked(!!settings.showCitekeyTooltips)
            .onClick(() => {
              this.settings.showCitekeyTooltips = !settings.showCitekeyTooltips;
              this.saveSettings();
            })
        )
        .addItem((item: any) =>
          item
            .setSection('settings')
            .setIcon('lucide-at-sign')
            .setTitle(t('Show citekey suggestions'))
            .setChecked(!!settings.enableCiteKeyCompletion)
            .onClick(() => {
              this.settings.enableCiteKeyCompletion =
                !settings.enableCiteKeyCompletion;
              this.saveSettings();
            })
        )
        .addItem((item: any) =>
          item
            .setSection('actions')
            .setIcon('lucide-rotate-cw')
            .setTitle(t('Refresh bibliography'))
            .onClick(async () => {
              const activeView =
                this.app.workspace.getActiveViewOfType(MarkdownView);
              if (activeView) {
                const file = activeView.file;

                if (this.bibManager.fileCache.has(file)) {
                  const cache = this.bibManager.fileCache.get(file);
                  if (cache.source !== this.bibManager) {
                    this.bibManager.fileCache.delete(file);
                    this.processReferences();
                    return;
                  }
                }
              }

              this.bibManager.reinit(true);
              await this.bibManager.initPromise.promise;
              this.processReferences();
            })
        );

      const rect = ico.getBoundingClientRect();
      menu.onHide(() => {
        isOpen = false;
      });
      menu.setParentElement(ico).showAtPosition({
        x: rect.x,
        y: rect.top - 5,
        width: rect.width,
        overlap: true,
        left: false,
      });
      isOpen = true;
    });
  }

  setStatusBarLoading() {
    this.statusBarIcon.addClass('is-loading');
    setIcon(this.statusBarIcon, 'lucide-loader');
  }

  setStatusBarIdle() {
    this.statusBarIcon.removeClass('is-loading');
    setIcon(this.statusBarIcon, 'lucide-at-sign');
  }

  get view() {
    const leaves = this.app.workspace.getLeavesOfType(viewType);
    if (!leaves?.length) return null;
    return leaves[0].view as ReferenceListView;
  }

  async initLeaf() {
    if (this.view) return this.revealLeaf();

    await this.app.workspace.getRightLeaf(false).setViewState({
      type: viewType,
    });

    this.revealLeaf();

    await this.initPromise.promise;
    await this.bibManager.initPromise.promise;

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      this.processReferences();
    }
  }

  revealLeaf() {
    const leaves = this.app.workspace.getLeavesOfType(viewType);
    if (!leaves?.length) return;
    this.app.workspace.revealLeaf(leaves[0]);
  }

  async loadSettings() {
    const loadedData = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
    if (this.settings.pathToBibliography && (!loadedData || loadedData.pullFromZotero === undefined)) {
      this.settings.pullFromZotero = false;
    }
  }

  async migrateLegacySettings() {
    let changed = false;
    const { settings } = this;

    if (!settings.cslStyleFilename) {
      if (settings.cslStylePath) {
        try {
          const path = require('path');
          const fs = require('fs');
          const filename = path.basename(settings.cslStylePath);
          const destPath = Platform.isMobile
            ? `${this.cslCacheDir}/${filename}`
            : path.join(this.cslCacheDir, filename);

          let exists = false;
          if (Platform.isMobile) {
            exists = await this.app.vault.adapter.exists(settings.cslStylePath);
          } else {
            exists = fs.existsSync(settings.cslStylePath);
          }

          if (exists) {
            let content = '';
            if (Platform.isMobile) {
              content = await this.app.vault.adapter.read(settings.cslStylePath);
              await this.app.vault.adapter.write(destPath, content);
            } else {
              content = fs.readFileSync(settings.cslStylePath, 'utf8');
              fs.writeFileSync(destPath, content, 'utf8');
            }
            settings.cslStyleFilename = filename;
            changed = true;
          }
        } catch (e) {
          console.error('Failed migrating legacy CSL style path:', e);
        }
      } else if (settings.cslStyleURL) {
        try {
          const filename = settings.cslStyleURL.split('/').pop() || 'apa.csl';
          const destPath = Platform.isMobile
            ? `${this.cslCacheDir}/${filename}`
            : require('path').join(this.cslCacheDir, filename);

          let exists = false;
          if (Platform.isMobile) {
            exists = await this.app.vault.adapter.exists(destPath);
          } else {
            exists = require('fs').existsSync(destPath);
          }

          if (!exists) {
            const res = await requestUrl({ url: settings.cslStyleURL });
            if (res.status === 200) {
              if (Platform.isMobile) {
                await this.app.vault.adapter.write(destPath, res.text);
              } else {
                require('fs').writeFileSync(destPath, res.text, 'utf8');
              }
            }
          }
          settings.cslStyleFilename = filename;
          changed = true;
        } catch (e) {
          console.error('Failed migrating legacy CSL style URL:', e);
        }
      } else {
        settings.cslStyleFilename = 'apa.csl';
        changed = true;
      }
    }

    if (!settings.cslLangFilename) {
      if (settings.cslLang) {
        const filename = `locales-${settings.cslLang}.xml`;
        const destPath = Platform.isMobile
          ? `${this.localeCacheDir}/${filename}`
          : require('path').join(this.localeCacheDir, filename);

        let exists = false;
        if (Platform.isMobile) {
          exists = await this.app.vault.adapter.exists(destPath);
        } else {
          exists = require('fs').existsSync(destPath);
        }

        if (!exists) {
          try {
            const url = `https://raw.githubusercontent.com/citation-style-language/locales/master/${filename}`;
            const res = await requestUrl({ url });
            if (res.status === 200) {
              if (Platform.isMobile) {
                await this.app.vault.adapter.write(destPath, res.text);
              } else {
                require('fs').writeFileSync(destPath, res.text, 'utf8');
              }
              settings.cslLangFilename = filename;
              changed = true;
            }
          } catch (e) {
            console.error('Failed downloading legacy CSL lang locale:', e);
          }
        } else {
          settings.cslLangFilename = filename;
          changed = true;
        }
      }
      
      if (!settings.cslLangFilename) {
        settings.cslLangFilename = 'locales-en-US.xml';
        changed = true;
      }
    }

    if (changed) {
      await this.saveData(this.settings);
    }
  }

  async saveSettings(cb?: () => void) {
    document.body.toggleClass(
      'pwc-tooltips',
      !!this.settings.showCitekeyTooltips
    );

    // Refresh the reference list when settings change
    this.emitSettingsUpdate(cb);
    await this.saveData(this.settings);
  }

  emitSettingsUpdate = debounce(
    (cb?: () => void) => {
      if (this.initPromise.settled) {
        this.view?.contentEl.toggleClass(
          'collapsed-links',
          !!this.settings.hideLinks
        );

        cb && cb();

        this.processReferences();
      }
    },
    500,
    false
  );

  processReferences = async () => {
    const { settings, view } = this;
    if (!settings.pathToBibliography && !settings.pullFromZotero) {
      return view?.setMessage(
        t(
          'Please provide the path to your pandoc compatible bibliography file in the Pandoc Reference List plugin settings.'
        )
      );
    }

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      try {
        const fileContent = await this.app.vault.cachedRead(activeView.file);
        const bib = await this.bibManager.getReferenceList(
          activeView.file,
          fileContent
        );
        const cache = this.bibManager.fileCache.get(activeView.file);

        if (
          !bib &&
          cache?.source === this.bibManager &&
          settings.pullFromZotero &&
          !(await isZoteroRunning(settings.zoteroPort)) &&
          this.bibManager.fileCache.get(activeView.file)?.keys.size
        ) {
          view?.setMessage(t('Cannot connect to Zotero'));
        } else {
          view?.setViewContent(bib);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      view?.setNoContentMessage();
    }
  };
}
