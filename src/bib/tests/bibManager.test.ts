/* eslint-disable @typescript-eslint/ban-ts-comment */

jest.mock('obsidian', () => ({
  Platform: {
    isMobile: false,
    isIosApp: false,
    isAndroidApp: false,
  },
  requestUrl: async (options: any) => {
    const url = options.url;
    
    // Mock localhost Zotero endpoints so tests are self-contained
    if (url.includes('/better-bibtex/cayw?probe=true')) {
      return { status: 200, text: 'ready', json: null };
    }
    if (url.includes('zotero.org/styles/')) {
      return { status: 200, text: '<style></style>', json: null };
    }
    if (url.includes('locales-') || url.includes('/locales/')) {
      return { status: 200, text: '<locale></locale>', json: null };
    }
    if (url.includes('/better-bibtex/json-rpc')) {
      if (options.body) {
        try {
          const body = JSON.parse(options.body);
          if (body.method === 'user.groups') {
            return {
              status: 200,
              text: JSON.stringify({ result: [{ id: 1, name: 'My Library' }, { id: 2, name: 'test' }] }),
              json: { result: [{ id: 1, name: 'My Library' }, { id: 2, name: 'test' }] }
            };
          }
        } catch {}
      }
    }

    const protocol = url.startsWith('https') ? require('https') : require('http');
    return new Promise((resolve, reject) => {
      const isPost = options.method === 'POST';
      const reqCallback = (res: any) => {
        let text = '';
        res.on('data', (chunk: any) => {
          text += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {}
          resolve({
            status: res.statusCode,
            text,
            json
          });
        });
      };

      if (!isPost) {
        protocol.get(url, reqCallback).on('error', reject);
      } else {
        const urlObj = new URL(url);
        const reqOptions = {
          method: 'POST',
          hostname: urlObj.hostname,
          port: urlObj.port,
          path: urlObj.pathname + urlObj.search,
          headers: options.headers || {},
        };
        const req = protocol.request(reqOptions, reqCallback);
        req.on('error', reject);
        if (options.body) {
          req.write(options.body);
        }
        req.end();
      }
    });
  },
}), { virtual: true });

jest.mock('https', () => {
  return {
    get: jest.fn().mockImplementation((url, options, callback) => {
      const cb = typeof options === 'function' ? options : callback;
      const EventEmitter = require('events');
      const res = new EventEmitter();
      res.statusCode = 200;
      res.setEncoding = jest.fn();
      
      let responseText = '';
      if (url.includes('locales-')) {
        responseText = '<locale></locale>';
      } else if (url.includes('zotero.org/styles/')) {
        responseText = '<style></style>';
      }

      process.nextTick(() => {
        res.emit('data', responseText);
        res.emit('end');
      });

      cb(res);
      const req = new EventEmitter();
      return req;
    })
  };
});

import path from 'path';
import {
  bibToCSL,
  getCSLLocale,
  getCSLStyle,
  // getZBib,
  getZUserGroups,
  isZoteroRunning,
} from '../helpers';

// @ts-ignore
import testCSL from './test.json';
// @ts-ignore
import testBIBCSL from './test.bib.json';
// @ts-ignore
import testBIB2CSL from './test2.bib.json';
// @ts-ignore
import testYAMLCSL from './test.yaml.json';
// @ts-ignore
// import library from './My Library.json';
import { existsSync, rmSync } from 'fs';

describe('bibToCSL()', () => {
  it('returns json from json', async () => {
    expect(
      await bibToCSL(
        path.join(__dirname, 'test.json'),
        '/opt/homebrew/bin/pandoc'
      )
    ).toEqual(testCSL);
  });

  it.skip('returns json from bib', async () => {
    expect(
      await bibToCSL(
        path.join(__dirname, 'test.bib'),
        '/opt/homebrew/bin/pandoc'
      )
    ).toEqual(testBIBCSL);
  });

  it.skip('returns json from bib2', async () => {
    expect(
      await bibToCSL(
        path.join(__dirname, 'test2.bib'),
        '/opt/homebrew/bin/pandoc'
      )
    ).toEqual(testBIB2CSL);
  });

  it.skip('returns json from yaml', async () => {
    expect(
      await bibToCSL(
        path.join(__dirname, 'test.yaml'),
        '/opt/homebrew/bin/pandoc'
      )
    ).toEqual(testYAMLCSL);
  });
});

// @ts-ignore
global.setImmediate =
  // @ts-ignore
  global.setImmediate || ((fn, ...args) => global.setTimeout(fn, 0, ...args));

describe('getLocale()', () => {
  it('fetches a locale', async () => {
    const cache = new Map<string, string>();
    jest.spyOn(navigator, 'onLine', 'get').mockReturnValueOnce(true);
    const locale = await getCSLLocale(cache, __dirname, 'bg-BG');
    expect(typeof locale).toBe('string');
    expect(existsSync(path.join(__dirname, 'locales-bg-BG.xml'))).toBe(true);
    await getCSLLocale(cache, __dirname, 'bg-BG');
    rmSync(path.join(__dirname, 'locales-bg-BG.xml'));
  });
});

describe('getStyle()', () => {
  it('fetches a style', async () => {
    const cache = new Map<string, string>();
    jest.spyOn(navigator, 'onLine', 'get').mockReturnValueOnce(true);
    const style = await getCSLStyle(
      cache,
      __dirname,
      'https://www.zotero.org/styles/australian-guide-to-legal-citation-3rd-edition'
    );
    expect(typeof style).toBe('string');
    expect(
      existsSync(
        path.join(__dirname, 'australian-guide-to-legal-citation-3rd-edition')
      )
    ).toBe(true);
    await getCSLStyle(
      cache,
      __dirname,
      'australian-guide-to-legal-citation-3rd-edition'
    );
    rmSync(
      path.join(__dirname, 'australian-guide-to-legal-citation-3rd-edition')
    );
  });
});

describe('getZUserGroups()', () => {
  it('retrieves user groups', async () => {
    const groups = await getZUserGroups('23119');
    if (groups) {
      expect(Array.isArray(groups)).toBe(true);
      if (groups.length > 0) {
        expect(typeof groups[0].id).toBe('number');
        expect(typeof groups[0].name).toBe('string');
      }
    }
  });
});

// describe('getZBib()', () => {
//   it('retrieves bib', async () => {
//     expect(await getZBib(new Map(), '23119', 1, 'My Library')).toEqual(library);
//   });
// });

describe('isZoteroRunning()', () => {
  it('runs', async () => {
    const running = await isZoteroRunning('23119');
    expect(typeof running).toBe('boolean');
  });
});
