import { validatePublicUrl, type Resolver, type ResolvedSource } from './index.js';

const agent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/138 Safari/537.36';
const baseHeaders = (referer: string, range = false) => ({ Referer: referer, 'User-Agent': agent, Accept: '*/*', 'Accept-Language': 'en-US,en;q=0.9', ...(range ? { Range: 'bytes=0-' } : {}) });
const mediaPattern = /https?:[^"'\\\s<>]+(?:\.mp4|\.m3u8)(?:\?[^"'\\\s<>]*)?/ig;
function unique(urls: string[], referer: string, provider: string, range = false): ResolvedSource[] { return [...new Set(urls)].flatMap(url => { try { validatePublicUrl(url); return [{ url, headers: baseHeaders(referer, range), provider }]; } catch { return []; } }); }
async function page(url: string) { const response = await fetch(url, { headers: baseHeaders(url), redirect: 'follow' }); if (!response.ok) throw new Error(`Resolver HTTP ${response.status}`); return { html: await response.text(), url: response.url }; }

export class DirectFileResolver implements Resolver {
  name = 'direct-file';
  async resolve(pageUrl: string): Promise<ResolvedSource[]> { return /\.(mp4|m4v|webm|mov)(?:\?|$)/i.test(new URL(pageUrl).pathname) ? unique([pageUrl], pageUrl, this.name, true) : []; }
}

export class PlaymogoResolver implements Resolver {
  name = 'dood-playmogo';
  async resolve(pageUrl: string): Promise<ResolvedSource[]> {
    const input = new URL(pageUrl); if (!/(playmogo|vide0|dood)/i.test(input.hostname)) return [];
    const pageUrlNormalized = input.pathname.startsWith('/d/') ? `${input.origin}/e/${input.pathname.slice(3)}${input.search}` : pageUrl;
    const first = await page(pageUrlNormalized); const iframe = first.html.match(/https?:[^"'\\\s<>]+playmogo[^"'\\\s<>]+/i)?.[0];
    const second = iframe ? await page(iframe.replace(/\\\//g, '/')) : first;
    const candidates = [...second.html.matchAll(mediaPattern)].map(m => m[0].replace(/\\\//g, '/'));
    return unique(candidates.filter(url => /cloudatacdn|\.mp4|\.m3u8/i.test(url)), second.url, this.name, true);
  }
}

export class MixDropResolver implements Resolver {
  name = 'mixdrop';
  async resolve(pageUrl: string): Promise<ResolvedSource[]> {
    if (!/(mixdrop|mxdrop|miiiixdrop|miiixdrop)/i.test(new URL(pageUrl).hostname)) return [];
    const result = await page(pageUrl); const candidates = [...result.html.matchAll(mediaPattern)].map(m => m[0].replace(/\\\//g, '/'));
    const wurl = result.html.match(/wurl\s*[=:]\s*["']([^"']+)/i)?.[1]; if (wurl) candidates.push(wurl.replace(/\\\//g, '/'));
    return unique(candidates.filter(url => /mxcontent|\.mp4|\.m3u8/i.test(url)), result.url, this.name, true);
  }
}

export class PlaywrightCaptureResolver implements Resolver {
  name = 'playwright-media-capture';
  async resolve(pageUrl: string): Promise<ResolvedSource[]> {
    const { chromium } = await import('playwright'); const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ userAgent: agent, locale: 'en-US' }); const tab = await context.newPage(); const found = new Map<string, string>();
      tab.on('response', async response => { const url = response.url(); const type = response.headers()['content-type'] || ''; if (/video|audio|application\/vnd\.apple\.mpegurl/i.test(type) || /(cloudatacdn|mxcontent|\.m3u8|\.mp4)(?:\?|$)/i.test(url)) found.set(url, response.request().url()); });
      await tab.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 }); await tab.waitForTimeout(8_000);
      const cookies = (await context.cookies()).map(c => `${c.name}=${c.value}`).join('; ');
      return [...found.entries()].flatMap(([url, referer]) => { try { validatePublicUrl(url); return [{ url, headers: { ...baseHeaders(referer, true), ...(cookies ? { Cookie: cookies } : {}) }, provider: this.name }]; } catch { return []; } });
    } finally { await browser.close(); }
  }
}
