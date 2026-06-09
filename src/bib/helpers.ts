import { BibLatexParser, CSLExporter } from 'biblatex-csl-converter';
import { CSLList, PartialCSLEntry } from './types';
import { Platform, requestUrl } from 'obsidian';

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
  cacheDir: string,
  lang: string
) {
  if (localeCache.has(lang)) {
    return localeCache.get(lang);
  }

  const url = `https://raw.githubusercontent.com/citation-style-language/locales/master/locales-${lang}.xml`;
  
  if (Platform.isMobile) {
    const outpath = `${cacheDir}/locales-${lang}.xml`;
    await ensureDirectory(cacheDir);
    if (await app.vault.adapter.exists(outpath)) {
      const localeData = await app.vault.adapter.read(outpath);
      localeCache.set(lang, localeData);
      return localeData;
    }
    const response = await requestUrl({ url });
    if (response.status !== 200) {
      throw new Error(`Error downloading locale: ${response.status}`);
    }
    const str = response.text;
    await app.vault.adapter.write(outpath, str);
    localeCache.set(lang, str);
    return str;
  }

  // Desktop
  const path = require('path');
  const fs = require('fs');
  const https = require('https');
  const outpath = path.join(cacheDir, `locales-${lang}.xml`);

  await ensureDirectory(cacheDir);
  if (fs.existsSync(outpath)) {
    const localeData = fs.readFileSync(outpath).toString();
    localeCache.set(lang, localeData);
    return localeData;
  }

  const str = await new Promise<string>((res, rej) => {
    https.get(url, (result: any) => {
      let output = '';
      result.setEncoding('utf8');
      result.on('data', (chunk: any) => (output += chunk));
      result.on('error', (e: any) => rej(`Downloading locale: ${e}`));
      result.on('close', () => {
        rej(new Error('Error: cannot download locale'));
      });
      result.on('end', () => {
        if (/^404: Not Found/.test(output)) {
          rej(new Error('Error downloading locale: 404: Not Found'));
        } else {
          res(output);
        }
      });
    });
  });

  fs.writeFileSync(outpath, str);
  localeCache.set(lang, str);
  return str;
}

export async function getCSLStyle(
  styleCache: Map<string, string>,
  cacheDir: string,
  url: string,
  explicitPath?: string
) {
  if (explicitPath) {
    if (styleCache.has(explicitPath)) {
      return styleCache.get(explicitPath);
    }

    if (Platform.isMobile) {
      if (!(await app.vault.adapter.exists(explicitPath))) {
        throw new Error(`Error: retrieving citation style; Cannot find file '${explicitPath}'.`);
      }
      const styleData = await app.vault.adapter.read(explicitPath);
      styleCache.set(explicitPath, styleData);
      return styleData;
    }

    const fs = require('fs');
    if (!fs.existsSync(explicitPath)) {
      throw new Error(
        `Error: retrieving citation style; Cannot find file '${explicitPath}'.`
      );
    }

    const styleData = fs.readFileSync(explicitPath).toString();
    styleCache.set(explicitPath, styleData);
    return styleData;
  }

  if (styleCache.has(url)) {
    return styleCache.get(url);
  }

  const fileFromURL = url.split('/').pop() ?? '';

  if (Platform.isMobile) {
    const outpath = `${cacheDir}/${fileFromURL}`;
    await ensureDirectory(cacheDir);
    if (await app.vault.adapter.exists(outpath)) {
      const styleData = await app.vault.adapter.read(outpath);
      styleCache.set(url, styleData);
      return styleData;
    }
    const response = await requestUrl({ url });
    if (response.status !== 200) {
      throw new Error(`Error downloading CSL: ${response.status}`);
    }
    const str = response.text;
    await app.vault.adapter.write(outpath, str);
    styleCache.set(url, str);
    return str;
  }

  // Desktop
  const path = require('path');
  const fs = require('fs');
  const https = require('https');
  const outpath = path.join(cacheDir, fileFromURL);

  await ensureDirectory(cacheDir);
  if (fs.existsSync(outpath)) {
    const styleData = fs.readFileSync(outpath).toString();
    styleCache.set(url, styleData);
    return styleData;
  }

  const str = await new Promise<string>((res, rej) => {
    https.get(url, (result: any) => {
      let output = '';
      result.setEncoding('utf8');
      result.on('data', (chunk: any) => (output += chunk));
      result.on('error', (e: any) => rej(`Error downloading CSL: ${e}`));
      result.on('close', () => {
        rej(new Error('Error: cannot download CSL'));
      });
      result.on('end', () => {
        try {
          res(output);
        } catch (e) {
          rej(e);
        }
      });
    });
  });

  fs.writeFileSync(outpath, str);
  styleCache.set(url, str);
  return str;
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
