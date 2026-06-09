import { App, Modal, Notice, requestUrl } from 'obsidian';
import React from 'react';
import ReactDOM from 'react-dom';
import ReferenceList from '../main';
import { t } from '../lang/helpers';
import {
  getCachedStyles,
  getCachedLocales,
  deleteCachedStyle,
  deleteCachedLocale,
  importLocalCslFile,
  importLocalLocaleFile,
  initCslDefaults,
  CSLStyleInfo,
  LocaleInfo,
} from '../bib/helpers';
import AsyncSelect from 'react-select/async';
import {
  customSelectStyles,
  loadCSLLangOptions,
  loadCSLOptions,
} from './select.helpers';

function CSLStyleManager({ plugin }: { plugin: ReferenceList }) {
  const [stylesList, setStylesList] = React.useState<CSLStyleInfo[]>([]);
  const [localesList, setLocalesList] = React.useState<LocaleInfo[]>([]);
  const [activeStyle, setActiveStyle] = React.useState(plugin.settings.cslStyleFilename || 'apa.csl');
  const [activeLocale, setActiveLocale] = React.useState(plugin.settings.cslLangFilename || 'locales-en-US.xml');

  const loadData = React.useCallback(async () => {
    try {
      const styles = await getCachedStyles(plugin.cslCacheDir);
      const locales = await getCachedLocales(plugin.localeCacheDir);
      setStylesList(styles);
      setLocalesList(locales);
    } catch (e) {
      console.error('Failed to load styles or locales from cache:', e);
    }
  }, [plugin]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectStyle = async (filename: string) => {
    setActiveStyle(filename);
    plugin.settings.cslStyleFilename = filename;
    await plugin.saveSettings(() => plugin.bibManager.reinit(false));
    new Notice(t('Active style updated'));
  };

  const handleSelectLocale = async (filename: string) => {
    setActiveLocale(filename);
    plugin.settings.cslLangFilename = filename;
    
    // Map back to legacy code e.g. locales-zh-CN.xml -> zh-CN
    const langMatch = filename.match(/locales-(.+)\.xml/);
    if (langMatch) {
      plugin.settings.cslLang = langMatch[1];
    }
    
    await plugin.saveSettings(() => plugin.bibManager.reinit(false));
    new Notice(t('Active language updated'));
  };

  const handleAddStyleOnline = async (selection: any) => {
    if (!selection) return;
    try {
      const url = selection.value;
      const id = selection.id;
      const res = await requestUrl({ url });
      if (res.status === 200) {
        const filename = await importLocalCslFile(plugin.cslCacheDir, id, res.text);
        new Notice(`${selection.label} style added`);
        await loadData();
        // Automatically select the newly downloaded style
        await handleSelectStyle(filename);
      } else {
        new Notice(`Failed to download CSL style: Status ${res.status}`);
      }
    } catch (e) {
      new Notice(`Error downloading CSL style: ${e}`);
    }
  };

  const handleAddStyleLocal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith('.csl')) {
      new Notice('Please select a valid CSL (.csl) file');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        if (content) {
          const filename = await importLocalCslFile(plugin.cslCacheDir, file.name, content);
          new Notice(`Imported style ${file.name}`);
          await loadData();
          // Automatically select the newly imported style
          await handleSelectStyle(filename);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      new Notice(`Failed to import local CSL: ${err}`);
    }
  };

  const handleDeleteStyle = async (filename: string) => {
    if (stylesList.length <= 1) {
      new Notice('Cannot delete the last CSL style. You must keep at least one.');
      return;
    }
    try {
      await deleteCachedStyle(plugin.cslCacheDir, filename);
      new Notice(`Deleted style ${filename}`);
      
      if (activeStyle === filename) {
        const remaining = stylesList.filter(s => s.filename !== filename);
        let nextActive = remaining[0]?.filename || 'apa.csl';
        
        // Re-download apa.csl if it was somehow deleted and is the fallback
        if (nextActive === 'apa.csl') {
          await initCslDefaults(plugin.cslCacheDir, plugin.localeCacheDir);
        }
        
        await handleSelectStyle(nextActive);
      }
      await loadData();
    } catch (e) {
      new Notice(`Failed to delete style: ${e}`);
    }
  };

  const handleAddLocaleOnline = async (selection: any) => {
    if (!selection) return;
    try {
      const url = selection.url;
      const value = selection.value;
      const res = await requestUrl({ url });
      if (res.status === 200) {
        const filename = await importLocalLocaleFile(plugin.localeCacheDir, `locales-${value}`, res.text);
        new Notice(`${selection.label} language added`);
        await loadData();
        // Automatically select the newly downloaded language
        await handleSelectLocale(filename);
      } else {
        new Notice(`Failed to download CSL locale: Status ${res.status}`);
      }
    } catch (e) {
      new Notice(`Error downloading CSL locale: ${e}`);
    }
  };

  const handleAddLocaleLocal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith('.xml')) {
      new Notice('Please select a valid Locale XML (.xml) file');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        if (content) {
          const filename = await importLocalLocaleFile(plugin.localeCacheDir, file.name, content);
          new Notice(`Imported language ${file.name}`);
          await loadData();
          // Automatically select the newly imported language
          await handleSelectLocale(filename);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      new Notice(`Failed to import local Locale XML: ${err}`);
    }
  };

  const handleDeleteLocale = async (filename: string) => {
    if (localesList.length <= 1) {
      new Notice('Cannot delete the last language locale. You must keep at least one.');
      return;
    }
    try {
      await deleteCachedLocale(plugin.localeCacheDir, filename);
      new Notice(`Deleted language ${filename}`);
      
      if (activeLocale === filename) {
        const remaining = localesList.filter(l => l.filename !== filename);
        let nextActive = remaining[0]?.filename || 'locales-en-US.xml';
        
        // Re-download locales-en-US.xml if it was somehow deleted and is the fallback
        if (nextActive === 'locales-en-US.xml') {
          await initCslDefaults(plugin.cslCacheDir, plugin.localeCacheDir);
        }
        
        await handleSelectLocale(nextActive);
      }
      await loadData();
    } catch (e) {
      new Notice(`Failed to delete language locale: ${e}`);
    }
  };

  return (
    <div className="csl-manager-modal" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Citation Languages Section */}
      <div>
        <div className="setting-item setting-item-header" style={{ fontSize: '1.2em', fontWeight: 'bold', borderBottom: '1px solid var(--background-modifier-border)', paddingBottom: '5px', marginBottom: '8px' }}>
          {t('Citation Languages')}
        </div>
        <div className="setting-item-description" style={{ color: 'var(--text-muted)', fontSize: '0.9em', marginBottom: '12px' }}>
          Select the active locale language for citations, or add/remove languages.
        </div>

        {/* Add Language Controls (Top) - Search Box takes almost full width, choose file is just an icon at the far right */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
            <AsyncSelect
              noOptionsMessage={() => <span>Type to search language...</span>}
              placeholder="Search online language..."
              cacheOptions
              className="pwc-multiselect"
              loadOptions={loadCSLLangOptions}
              isClearable
              onChange={handleAddLocaleOnline}
              styles={customSelectStyles}
              value={null}
            />
          </div>
          <div style={{ flexShrink: 0 }}>
            <label className="clickable-icon" style={{ cursor: 'pointer', margin: 0, padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Import Locale XML File">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-folder-plus">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>
                <line x1="12" y1="10" x2="12" y2="16"/>
                <line x1="9" y1="13" x2="15" y2="13"/>
              </svg>
              <input
                type="file"
                accept=".xml"
                onChange={handleAddLocaleLocal}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        <div className="setting-item-description" style={{ fontSize: '0.85em', fontWeight: 'bold', marginBottom: '6px', color: 'var(--text-normal)' }}>
          Installed Languages:
        </div>

        {/* Languages List */}
        <div className="csl-list-container" style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '5px' }}>
          {localesList.map(locale => (
            <div
              key={locale.filename}
              className={`csl-list-item setting-item ${activeLocale === locale.filename ? 'is-active' : ''}`}
              style={{
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: '4px',
                border: activeLocale === locale.filename ? '1px solid var(--interactive-accent)' : '1px solid var(--background-modifier-border)',
                backgroundColor: activeLocale === locale.filename ? 'var(--background-modifier-hover)' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
              onClick={() => handleSelectLocale(locale.filename)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                <input
                  type="radio"
                  checked={activeLocale === locale.filename}
                  onChange={() => handleSelectLocale(locale.filename)}
                  style={{ cursor: 'pointer', flexShrink: 0 }}
                />
                <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} className="setting-item-name">
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-normal)' }}>{locale.label}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>({locale.filename})</span>
                </div>
              </div>
              <div
                className="clickable-icon"
                style={{
                  color: 'var(--text-error)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteLocale(locale.filename);
                }}
                title="Delete"
              >
                &times;
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderBottom: '1px solid var(--background-modifier-border)' }}></div>

      {/* CSL Styles Section */}
      <div>
        <div className="setting-item setting-item-header" style={{ fontSize: '1.2em', fontWeight: 'bold', borderBottom: '1px solid var(--background-modifier-border)', paddingBottom: '5px', marginBottom: '8px' }}>
          {t('CSL Styles')}
        </div>
        <div className="setting-item-description" style={{ color: 'var(--text-muted)', fontSize: '0.9em', marginBottom: '12px' }}>
          Select the active style to format bibliography and citations, or add/remove styles.
        </div>

        {/* Add Style Controls (Top) - Search Box takes almost full width, choose file is just an icon at the far right */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
            <AsyncSelect
              noOptionsMessage={() => <span>Type to search style...</span>}
              placeholder="Search online style..."
              cacheOptions
              className="pwc-multiselect"
              loadOptions={loadCSLOptions}
              isClearable
              onChange={handleAddStyleOnline}
              styles={customSelectStyles}
              value={null}
            />
          </div>
          <div style={{ flexShrink: 0 }}>
            <label className="clickable-icon" style={{ cursor: 'pointer', margin: 0, padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Import CSL Style File">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-folder-plus">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>
                <line x1="12" y1="10" x2="12" y2="16"/>
                <line x1="9" y1="13" x2="15" y2="13"/>
              </svg>
              <input
                type="file"
                accept=".csl"
                onChange={handleAddStyleLocal}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        <div className="setting-item-description" style={{ fontSize: '0.85em', fontWeight: 'bold', marginBottom: '6px', color: 'var(--text-normal)' }}>
          Installed Styles:
        </div>

        {/* Styles List */}
        <div className="csl-list-container" style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '5px' }}>
          {stylesList.map(style => (
            <div
              key={style.filename}
              className={`csl-list-item setting-item ${activeStyle === style.filename ? 'is-active' : ''}`}
              style={{
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: '4px',
                border: activeStyle === style.filename ? '1px solid var(--interactive-accent)' : '1px solid var(--background-modifier-border)',
                backgroundColor: activeStyle === style.filename ? 'var(--background-modifier-hover)' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
              onClick={() => handleSelectStyle(style.filename)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                <input
                  type="radio"
                  checked={activeStyle === style.filename}
                  onChange={() => handleSelectStyle(style.filename)}
                  style={{ cursor: 'pointer', flexShrink: 0 }}
                />
                <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} className="setting-item-name">
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-normal)' }}>{style.title}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>({style.filename})</span>
                </div>
              </div>
              <div
                className="clickable-icon"
                style={{
                  color: 'var(--text-error)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteStyle(style.filename);
                }}
                title="Delete"
              >
                &times;
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export class CSLStyleManagerModal extends Modal {
  plugin: ReferenceList;

  constructor(app: App, plugin: ReferenceList) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.style.maxWidth = '600px';

    contentEl.createEl('h2', { text: t('CSL Style Manager') });

    const container = contentEl.createDiv();
    ReactDOM.render(<CSLStyleManager plugin={this.plugin} />, container);
  }

  onClose() {
    const { contentEl } = this;
    ReactDOM.unmountComponentAtNode(contentEl);
    contentEl.empty();
  }
}
