import { FileSystemAdapter, htmlToMarkdown, Platform } from 'obsidian';

export function getVaultRoot() {
  if (Platform.isMobile) return '';
  return (app.vault.adapter as FileSystemAdapter).getBasePath();
}

export function copyElToClipboard(el: HTMLElement) {
  if (Platform.isMobile) {
    navigator.clipboard.writeText(htmlToMarkdown(el.outerHTML));
    return;
  }
  require('electron').clipboard.write({
    html: el.outerHTML,
    text: htmlToMarkdown(el.outerHTML),
  });
}

export class PromiseCapability<T> {
  settled = false;
  promise: Promise<T>;
  resolve: (data: T) => void;
  reject: (reason?: any) => void;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = (data) => {
        resolve(data);
        this.settled = true;
      };

      this.reject = (reason) => {
        reject(reason);
        this.settled = true;
      };
    });
  }
}


export function areSetsEqual<T>(as: Set<T>, bs: Set<T>) {
  if (as.size !== bs.size) return false;
  for (const a of as) if (!bs.has(a)) return false;
  return true;
}
