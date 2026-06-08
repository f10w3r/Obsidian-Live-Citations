import { App, Modal } from 'obsidian';
import React from 'react';
import ReactDOM from 'react-dom';
import ReferenceList from 'src/main';
import { t } from 'src/lang/helpers';
import { DEFAULT_ZOTERO_PORT, getZUserGroups } from 'src/bib/helpers';
import { SettingItem } from './SettingItem';

function validateGroups(
  plugin: ReferenceList,
  groups: Array<{ id: number; name: string }>
) {
  const validated: Array<{ id: number; name: string }> = [];

  plugin.settings.zoteroGroups.forEach((g) => {
    if (groups.some((g2) => g2.id === g.id)) {
      validated.push(g);
    }
  });

  plugin.settings.zoteroGroups = validated;
  plugin.saveSettings();
}

function ZoteroLibrarySelector({ plugin }: { plugin: ReferenceList }) {
  const [possibleGroups, setPossibleGroups] = React.useState(
    plugin.settings.zoteroGroups
  );
  const [activeGroups, setActiveGroups] = React.useState(
    plugin.settings.zoteroGroups
  );
  const [connected, setConnected] = React.useState(false);

  const pullUserGroups = React.useCallback(async () => {
    try {
      const groups = await getZUserGroups(
        plugin.settings.zoteroPort ?? DEFAULT_ZOTERO_PORT
      );
      if (groups) {
        validateGroups(plugin, groups);
        setPossibleGroups(groups);
        setConnected(true);
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    }
  }, [plugin]);

  React.useEffect(() => {
    pullUserGroups();
  }, [pullUserGroups]);

  return (
    <>
      {connected ? null : (
        <div className="pwc-setting-item setting-item">
          <SettingItem
            name={t('Cannot connect to Zotero')}
            description={t('Start Zotero and try again.')}
          >
            <button onClick={pullUserGroups} className="mod-cta">
              Retry
            </button>
          </SettingItem>
        </div>
      )}
      {connected && (
        <div className="setting-item pwc-setting-item-wrapper">
          <SettingItem name={t('Libraries to include in bibliography')} />
          {possibleGroups.map((g) => {
            const isEnabled = activeGroups.some((g2) => g2.id === g.id);
            return (
              <div key={g.id} className="pwc-group-toggle">
                <SettingItem description={g.name}>
                  <div
                    onClick={() => {
                      let nextGroups;
                      if (isEnabled) {
                        nextGroups = activeGroups.filter(
                          (g2) => g2.id !== g.id
                        );
                      } else {
                        nextGroups = [...activeGroups, g];
                      }
                      plugin.settings.zoteroGroups = nextGroups;
                      setActiveGroups(nextGroups);
                      plugin.saveSettings(() => plugin.bibManager.reinit(true));
                    }}
                    className={`checkbox-container${
                      isEnabled ? ' is-enabled' : ''
                    }`}
                  />
                </SettingItem>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export class ZoteroLibraryModal extends Modal {
  plugin: ReferenceList;

  constructor(app: App, plugin: ReferenceList) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl('h2', { text: t('Select Zotero Libraries') });
    
    const container = contentEl.createDiv();
    ReactDOM.render(<ZoteroLibrarySelector plugin={this.plugin} />, container);
  }

  onClose() {
    const { contentEl } = this;
    ReactDOM.unmountComponentAtNode(contentEl);
    contentEl.empty();
  }
}
