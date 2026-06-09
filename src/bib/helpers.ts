import { BibLatexParser, CSLExporter } from 'biblatex-csl-converter';
import { CSLList, PartialCSLEntry } from './types';
import { Platform, requestUrl } from 'obsidian';
import { langListRaw } from './cslLangList';

export const DEFAULT_ZOTERO_PORT = '23119';

async function ensureDirectory(dir: string) {
  if (Platform.isMobile) {
    if (!(await app.vault.adapter.exists(dir))) {
      try {
        await app.vault.adapter.mkdir(dir);
      } catch (e) {
        console.error('Failed to create directory via adapter', e);
      }
    }
    return;
  }
  const fs = require('fs');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getBibPath(bibPath: string, getVaultRoot?: () => string) {
  if (Platform.isMobile) {
    if (app.vault.getAbstractFileByPath(bibPath)) {
      return bibPath;
    }
    throw new Error(`cannot access bibliography file '${bibPath}'.`);
  }

  const fs = require('fs');
  const path = require('path');
  if (!fs.existsSync(bibPath)) {
    const orig = bibPath;
    if (getVaultRoot) {
      bibPath = path.join(getVaultRoot(), bibPath);
      if (!fs.existsSync(bibPath)) {
        throw new Error(`bibToCSL: cannot access bibliography file '${bibPath}'.`);
      }
    } else {
      throw new Error(`bibToCSL: cannot access bibliography file '${orig}'.`);
    }
  }

  return bibPath;
}

export async function bibToCSL(
  bibPath: string,
  getVaultRoot?: () => string
): Promise<PartialCSLEntry[]> {
  bibPath = getBibPath(bibPath, getVaultRoot);

  const parsedExt = bibPath.split('.').pop()?.toLowerCase();
  const isJson = parsedExt === 'json';

  let content: string;
  if (Platform.isMobile) {
    content = await app.vault.adapter.read(bibPath);
  } else {
    const fs = require('fs');
    content = fs.readFileSync(bibPath, 'utf-8');
  }

  if (isJson) {
    return JSON.parse(content);
  }

  // 纯 JS 解析，不需要外部 pandoc 可执行文件
  const parser = new BibLatexParser(content, {
    processUnexpected: true,
    processUnknown: true,
  });
  const bibResult = parser.parse();
  const exporter = new CSLExporter(bibResult.entries, bibResult.groups);
  const cslMap = exporter.parse();

  // CSLExporter 输出的 id 是内部数字 key，需替换为实际的 citekey
  return Object.keys(cslMap).map((key) => {
    const entry = cslMap[key];
    const citekey = bibResult.entries[key]?.entry_key ?? entry.id;
    return { ...entry, id: citekey } as PartialCSLEntry;
  });
}

export async function getCSLLocale(
  localeCache: Map<string, string>,
  localeCacheDir: string,
  lang: string
) {
  if (localeCache.has(lang)) {
    return localeCache.get(lang);
  }

  const filename = `locales-${lang}.xml`;
  const url = `https://raw.githubusercontent.com/citation-style-language/locales/master/${filename}`;
  const filePath = Platform.isMobile
    ? `${localeCacheDir}/${filename}`
    : require('path').join(localeCacheDir, filename);

  await ensureDirectory(localeCacheDir);

  let exists = false;
  if (Platform.isMobile) {
    exists = await app.vault.adapter.exists(filePath);
  } else {
    exists = require('fs').existsSync(filePath);
  }

  if (exists) {
    let localeData = '';
    if (Platform.isMobile) {
      localeData = await app.vault.adapter.read(filePath);
    } else {
      localeData = require('fs').readFileSync(filePath, 'utf8');
    }
    localeCache.set(lang, localeData);
    return localeData;
  }

  // Fallback: download
  let responseText = '';
  try {
    const response = await requestUrl({ url });
    if (response.status === 200) {
      responseText = response.text;
      if (Platform.isMobile) {
        await app.vault.adapter.write(filePath, responseText);
      } else {
        require('fs').writeFileSync(filePath, responseText, 'utf8');
      }
    } else {
      throw new Error(`Status ${response.status}`);
    }
  } catch (e) {
    throw new Error(`Error downloading locale: ${e.message || e}`);
  }

  localeCache.set(lang, responseText);
  return responseText;
}

export async function getCSLStyle(
  styleCache: Map<string, string>,
  cslCacheDir: string,
  url: string,
  explicitPath?: string
) {
  const styleKey = explicitPath ?? url;
  if (styleCache.has(styleKey)) {
    return styleCache.get(styleKey);
  }

  // 1. If explicitPath is provided, read from it
  if (explicitPath) {
    let styleData = '';
    if (Platform.isMobile) {
      if (!(await app.vault.adapter.exists(explicitPath))) {
        throw new Error(`Error: retrieving citation style; Cannot find file '${explicitPath}'.`);
      }
      styleData = await app.vault.adapter.read(explicitPath);
    } else {
      const fs = require('fs');
      if (!fs.existsSync(explicitPath)) {
        throw new Error(`Error: retrieving citation style; Cannot find file '${explicitPath}'.`);
      }
      styleData = fs.readFileSync(explicitPath, 'utf8');
    }
    styleCache.set(styleKey, styleData);
    return styleData;
  }

  // 2. If it's a local filename (doesn't start with http)
  if (!/^https?:\/\//.test(url)) {
    const path = require('path');
    const fs = require('fs');
    let filePath = Platform.isMobile
      ? `${cslCacheDir}/${url}`
      : path.join(cslCacheDir, url);

    let exists = false;
    if (Platform.isMobile) {
      exists = await app.vault.adapter.exists(filePath);
    } else {
      exists = fs.existsSync(filePath);
    }

    if (!exists && !url.endsWith('.csl')) {
      const filename = `${url}.csl`;
      filePath = Platform.isMobile
        ? `${cslCacheDir}/${filename}`
        : path.join(cslCacheDir, filename);
    }

    let styleData = '';
    if (Platform.isMobile) {
      if (!(await app.vault.adapter.exists(filePath))) {
        throw new Error(`Error: retrieving CSL style; Cannot find file '${filePath}'.`);
      }
      styleData = await app.vault.adapter.read(filePath);
    } else {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Error: retrieving CSL style; Cannot find file '${filePath}'.`);
      }
      styleData = fs.readFileSync(filePath, 'utf8');
    }
    styleCache.set(styleKey, styleData);
    return styleData;
  }

  // 3. Otherwise, it is a URL (fallback / compatibility)
  const fileFromURL = url.split('/').pop() ?? '';
  const outpath = Platform.isMobile
    ? `${cslCacheDir}/${fileFromURL}`
    : require('path').join(cslCacheDir, fileFromURL);

  await ensureDirectory(cslCacheDir);

  let exists = false;
  if (Platform.isMobile) {
    exists = await app.vault.adapter.exists(outpath);
  } else {
    exists = require('fs').existsSync(outpath);
  }

  if (exists) {
    let styleData = '';
    if (Platform.isMobile) {
      styleData = await app.vault.adapter.read(outpath);
    } else {
      styleData = require('fs').readFileSync(outpath, 'utf8');
    }
    styleCache.set(styleKey, styleData);
    return styleData;
  }

  // Download URL
  let responseText = '';
  try {
    const response = await requestUrl({ url });
    if (response.status === 200) {
      responseText = response.text;
      if (Platform.isMobile) {
        await app.vault.adapter.write(outpath, responseText);
      } else {
        require('fs').writeFileSync(outpath, responseText, 'utf8');
      }
    } else {
      throw new Error(`Status ${response.status}`);
    }
  } catch (e) {
    throw new Error(`Error downloading CSL: ${e.message || e}`);
  }

  styleCache.set(styleKey, responseText);
  return responseText;
}

export interface CSLStyleInfo {
  filename: string;
  title: string;
  id: string;
}

export interface LocaleInfo {
  filename: string;
  label: string;
  value: string;
}

export function parseCslMetadata(content: string, filename: string): CSLStyleInfo {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, 'text/xml');
    const title = xmlDoc.getElementsByTagName('title')[0]?.textContent || filename.replace('.csl', '');
    const id = xmlDoc.getElementsByTagName('id')[0]?.textContent || '';
    return { filename, title, id };
  } catch (e) {
    return { filename, title: filename.replace('.csl', ''), id: '' };
  }
}

export function parseLocaleMetadata(content: string, filename: string): LocaleInfo {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, 'text/xml');
    const localeEl = xmlDoc.getElementsByTagName('locale')[0];
    const xmlLang = localeEl?.getAttribute('xml:lang') || '';
    const found = langListRaw.find(l => l.value === xmlLang);
    const label = found ? found.label : (xmlLang || filename.replace('.xml', ''));
    return { filename, label, value: xmlLang };
  } catch (e) {
    return { filename, label: filename.replace('.xml', ''), value: '' };
  }
}

// Download defaults
export async function initCslDefaults(cslCacheDir: string, localeCacheDir: string): Promise<void> {
  await ensureDirectory(cslCacheDir);
  await ensureDirectory(localeCacheDir);

  const defaultStyles = [
    { filename: 'apa.csl', url: 'https://raw.githubusercontent.com/citation-style-language/styles/master/apa.csl' },
    { filename: 'chicago-author-date.csl', url: 'https://raw.githubusercontent.com/citation-style-language/styles/master/chicago-author-date.csl' }
  ];

  const defaultLocales = [
    { filename: 'locales-en-US.xml', url: 'https://raw.githubusercontent.com/citation-style-language/locales/master/locales-en-US.xml' },
    { filename: 'locales-zh-CN.xml', url: 'https://raw.githubusercontent.com/citation-style-language/locales/master/locales-zh-CN.xml' }
  ];

  for (const style of defaultStyles) {
    const filePath = Platform.isMobile
      ? `${cslCacheDir}/${style.filename}`
      : require('path').join(cslCacheDir, style.filename);
    
    let exists = false;
    if (Platform.isMobile) {
      exists = await app.vault.adapter.exists(filePath);
    } else {
      exists = require('fs').existsSync(filePath);
    }

    if (!exists) {
      try {
        const res = await requestUrl({ url: style.url });
        if (res.status === 200) {
          if (Platform.isMobile) {
            await app.vault.adapter.write(filePath, res.text);
          } else {
            require('fs').writeFileSync(filePath, res.text, 'utf8');
          }
        }
      } catch (e) {
        console.error(`Failed to download default CSL style ${style.filename}:`, e);
      }
    }
  }

  for (const locale of defaultLocales) {
    const filePath = Platform.isMobile
      ? `${localeCacheDir}/${locale.filename}`
      : require('path').join(localeCacheDir, locale.filename);

    let exists = false;
    if (Platform.isMobile) {
      exists = await app.vault.adapter.exists(filePath);
    } else {
      exists = require('fs').existsSync(filePath);
    }

    if (!exists) {
      try {
        const res = await requestUrl({ url: locale.url });
        if (res.status === 200) {
          if (Platform.isMobile) {
            await app.vault.adapter.write(filePath, res.text);
          } else {
            require('fs').writeFileSync(filePath, res.text, 'utf8');
          }
        }
      } catch (e) {
        console.error(`Failed to download default CSL locale ${locale.filename}:`, e);
      }
    }
  }
}

// Get Cached Styles
export async function getCachedStyles(cslCacheDir: string): Promise<CSLStyleInfo[]> {
  await ensureDirectory(cslCacheDir);
  const styles: CSLStyleInfo[] = [];

  if (Platform.isMobile) {
    const list = await app.vault.adapter.list(cslCacheDir);
    for (const item of list.files) {
      if (item.endsWith('.csl')) {
        const content = await app.vault.adapter.read(item);
        const filename = item.split('/').pop() || '';
        styles.push(parseCslMetadata(content, filename));
      }
    }
  } else {
    const fs = require('fs');
    const path = require('path');
    const files = fs.readdirSync(cslCacheDir);
    for (const file of files) {
      if (file.endsWith('.csl')) {
        const filePath = path.join(cslCacheDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        styles.push(parseCslMetadata(content, file));
      }
    }
  }

  return styles;
}

// Get Cached Locales
export async function getCachedLocales(localeCacheDir: string): Promise<LocaleInfo[]> {
  await ensureDirectory(localeCacheDir);
  const locales: LocaleInfo[] = [];

  if (Platform.isMobile) {
    const list = await app.vault.adapter.list(localeCacheDir);
    for (const item of list.files) {
      if (item.endsWith('.xml')) {
        const content = await app.vault.adapter.read(item);
        const filename = item.split('/').pop() || '';
        locales.push(parseLocaleMetadata(content, filename));
      }
    }
  } else {
    const fs = require('fs');
    const path = require('path');
    const files = fs.readdirSync(localeCacheDir);
    for (const file of files) {
      if (file.endsWith('.xml')) {
        const filePath = path.join(localeCacheDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        locales.push(parseLocaleMetadata(content, file));
      }
    }
  }

  return locales;
}

// Delete Cached Style
export async function deleteCachedStyle(cslCacheDir: string, filename: string): Promise<void> {
  const filePath = Platform.isMobile
    ? `${cslCacheDir}/${filename}`
    : require('path').join(cslCacheDir, filename);

  if (Platform.isMobile) {
    if (await app.vault.adapter.exists(filePath)) {
      await app.vault.adapter.remove(filePath);
    }
  } else {
    const fs = require('fs');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

// Delete Cached Locale
export async function deleteCachedLocale(localeCacheDir: string, filename: string): Promise<void> {
  const filePath = Platform.isMobile
    ? `${localeCacheDir}/${filename}`
    : require('path').join(localeCacheDir, filename);

  if (Platform.isMobile) {
    if (await app.vault.adapter.exists(filePath)) {
      await app.vault.adapter.remove(filePath);
    }
  } else {
    const fs = require('fs');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

// Import Local Style file
export async function importLocalCslFile(cslCacheDir: string, name: string, content: string): Promise<string> {
  await ensureDirectory(cslCacheDir);
  const filename = name.endsWith('.csl') ? name : `${name}.csl`;
  const filePath = Platform.isMobile
    ? `${cslCacheDir}/${filename}`
    : require('path').join(cslCacheDir, filename);

  if (Platform.isMobile) {
    await app.vault.adapter.write(filePath, content);
  } else {
    require('fs').writeFileSync(filePath, content, 'utf8');
  }
  return filename;
}

// Import Local Locale file
export async function importLocalLocaleFile(localeCacheDir: string, name: string, content: string): Promise<string> {
  await ensureDirectory(localeCacheDir);
  const filename = name.endsWith('.xml') ? name : `${name}.xml`;
  const filePath = Platform.isMobile
    ? `${localeCacheDir}/${filename}`
    : require('path').join(localeCacheDir, filename);

  if (Platform.isMobile) {
    await app.vault.adapter.write(filePath, content);
  } else {
    require('fs').writeFileSync(filePath, content, 'utf8');
  }
  return filename;
}

export const defaultHeaders = {
  'Content-Type': 'application/json',
  'User-Agent': 'obsidian/zotero',
  Accept: 'application/json',
  Connection: 'keep-alive',
};

export async function getZUserGroups(
  port: string = DEFAULT_ZOTERO_PORT
): Promise<Array<{ id: number; name: string }>> {
  if (Platform.isMobile) return null;
  if (!(await isZoteroRunning(port))) return null;

  const http = require('http');
  return new Promise((res, rej) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'user.groups',
    });

    const postRequest = http.request(
      {
        host: '127.0.0.1',
        port: port,
        path: '/better-bibtex/json-rpc',
        method: 'POST',
        headers: {
          ...defaultHeaders,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (result: any) => {
        let output = '';

        result.setEncoding('utf8');
        result.on('data', (chunk: any) => (output += chunk));
        result.on('error', (e: any) => rej(`Error connecting to Zotero: ${e}`));
        result.on('close', () => {
          rej(new Error('Error: cannot connect to Zotero'));
        });
        result.on('end', () => {
          try {
            res(JSON.parse(output).result);
          } catch (e) {
            rej(e);
          }
        });
      }
    );

    postRequest.write(body);
    postRequest.end();
  });
}

function panNum(n: number) {
  if (n < 10) return `0${n}`;
  return n.toString();
}

function timestampToZDate(ts: number) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${panNum(d.getUTCMonth() + 1)}-${panNum(
    d.getUTCDate()
  )} ${panNum(d.getUTCHours())}:${panNum(d.getUTCMinutes())}:${panNum(
    d.getUTCSeconds()
  )}`;
}

export async function getZModified(
  port: string = DEFAULT_ZOTERO_PORT,
  groupId: number,
  since: number
): Promise<CSLList> {
  if (Platform.isMobile) return null;
  if (!(await isZoteroRunning(port))) return null;

  const http = require('http');
  return new Promise((res, rej) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'item.search',
      params: [[['dateModified', 'isAfter', timestampToZDate(since)]], groupId],
    });

    const postRequest = http.request(
      {
        host: '127.0.0.1',
        port: port,
        path: '/better-bibtex/json-rpc',
        method: 'POST',
        headers: {
          ...defaultHeaders,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (result: any) => {
        let output = '';

        result.setEncoding('utf8');
        result.on('data', (chunk: any) => (output += chunk));
        result.on('error', (e: any) => rej(`Error connecting to Zotero: ${e}`));
        result.on('close', () => {
          rej(new Error('Error: cannot connect to Zotero'));
        });
        result.on('end', () => {
          try {
            res(JSON.parse(output).result);
          } catch (e) {
            rej(e);
          }
        });
      }
    );

    postRequest.write(body);
    postRequest.end();
  });
}

function applyGroupID(list: CSLList, groupId: number) {
  return list.map((item) => {
    item.groupID = groupId;
    return item;
  });
}

export async function getZBib(
  port: string = DEFAULT_ZOTERO_PORT,
  cacheDir: string,
  groupId: number,
  loadCached?: boolean
) {
  if (Platform.isMobile) {
    const cached = `${cacheDir}/zotero-library-${groupId}.json`;
    if (await app.vault.adapter.exists(cached)) {
      const content = await app.vault.adapter.read(cached);
      return applyGroupID(
        JSON.parse(content) as CSLList,
        groupId
      );
    }
    return null;
  }

  const isRunning = await isZoteroRunning(port);
  const path = require('path');
  const cached = path.join(cacheDir, `zotero-library-${groupId}.json`);

  const fs = require('fs');
  await ensureDirectory(cacheDir);
  if (loadCached || !isRunning) {
    if (fs.existsSync(cached)) {
      return applyGroupID(
        JSON.parse(fs.readFileSync(cached).toString()) as CSLList,
        groupId
      );
    }
    if (!isRunning) {
      return null;
    }
  }

  const download = require('download');
  const bib = await download(
    `http://127.0.0.1:${port}/better-bibtex/export/library?/${groupId}/library.json`
  );

  const str = bib.toString();
  fs.writeFileSync(cached, str);

  return applyGroupID(JSON.parse(str) as CSLList, groupId);
}

export async function refreshZBib(
  port: string = DEFAULT_ZOTERO_PORT,
  cacheDir: string,
  groupId: number,
  since: number
) {
  if (Platform.isMobile) return null;
  if (!(await isZoteroRunning(port))) {
    return null;
  }

  const path = require('path');
  const cached = path.join(cacheDir, `zotero-library-${groupId}.json`);
  const fs = require('fs');
  await ensureDirectory(cacheDir);
  if (!fs.existsSync(cached)) {
    return null;
  }

  const mList = (await getZModified(port, groupId, since)) as CSLList;

  if (!mList?.length) {
    return null;
  }

  const modified: Map<string, PartialCSLEntry> = new Map();
  const newKeys: Set<string> = new Set();

  for (const mod of mList) {
    mod.id = (mod as any).citekey || (mod as any)['citation-key'];
    if (!mod.id) continue;
    modified.set(mod.id, mod);
    newKeys.add(mod.id);
  }

  const list = JSON.parse(fs.readFileSync(cached).toString()) as CSLList;

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (modified.has(item.id)) {
      newKeys.delete(item.id);
      list[i] = modified.get(item.id);
    }
  }

  for (const key of newKeys) {
    list.push(modified.get(key));
  }

  fs.writeFileSync(cached, JSON.stringify(list));

  return {
    list: applyGroupID(list, groupId),
    modified,
  };
}

export async function isZoteroRunning(port: string = DEFAULT_ZOTERO_PORT) {
  if (Platform.isMobile) return false;

  const download = require('download');
  const p = download(`http://127.0.0.1:${port}/better-bibtex/cayw?probe=true`);
  try {
    const res = await Promise.race([
      p,
      new Promise((resolve) => {
        window.setTimeout(() => {
          resolve(null);
          try { p.destroy(); } catch {}
        }, 150);
      }),
    ]);
    return res?.toString() === 'ready';
  } catch (e) {
    return false;
  }
}

export async function getItemJSONFromCiteKeys(
  port: string = DEFAULT_ZOTERO_PORT,
  citeKeys: string[],
  libraryID: number
) {
  if (Platform.isMobile) return null;
  if (!(await isZoteroRunning(port))) return null;

  const http = require('http');
  let res: any;
  try {
    res = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        jsonrpc: '2.0',
        method: 'item.export',
        params: [citeKeys, '36a3b0b5-bad0-4a04-b79b-441c7cef77db', libraryID],
      });

      const postRequest = http.request(
        {
          host: '127.0.0.1',
          port: port,
          path: '/better-bibtex/json-rpc',
          method: 'POST',
          headers: {
            ...defaultHeaders,
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (result: any) => {
          let output = '';

          result.setEncoding('utf8');
          result.on('data', (chunk: any) => (output += chunk));
          result.on('error', (e: any) => reject(`Error connecting to Zotero: ${e}`));
          result.on('close', () => {
            reject(new Error('Error: cannot connect to Zotero'));
          });
          result.on('end', () => {
            try {
              resolve(JSON.parse(output));
            } catch (e) {
              reject(e);
            }
          });
        }
      );

      postRequest.write(body);
      postRequest.end();
    });
  } catch (e) {
    console.error(e);
    return null;
  }

  try {
    if (res.error?.message) {
      console.error(new Error(res.error.message));
      return null;
    }

    return Array.isArray(res.result)
      ? JSON.parse(res.result[2]).items
      : JSON.parse(res.result).items;
  } catch (e) {
    console.error(e);
    return null;
  }
}
