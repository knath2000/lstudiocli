import { randomBytes } from 'node:crypto';
import { validatePublicUrl, type Resolver, type ResolvedSource } from './index.js';

const agent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/138 Safari/537.36';
const pageHeaders = { 'User-Agent': agent, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' };
const sourceHeaders = (referer: string, range = false) => ({ Referer: referer, 'User-Agent': agent, Accept: '*/*', 'Accept-Language': 'en-US,en;q=0.9', ...(range ? { Range: 'bytes=0-' } : {}) });
const doodHost = /(^|\.)(doodstream|dood|vide0|dooodster)\./i;
const mixdropHost = /(mixdrop|mxdrop|miiiixdrop|miiixdrop)/i;
const mediaPattern = /https?:[^"'\\\s<>]+(?:\.mp4|\.m3u8)(?:\?[^"'\\\s<>]*)?/ig;
const normalized = (html: string) => html.replaceAll('\\/', '/').replaceAll('&amp;', '&').replaceAll('&#038;', '&').replaceAll('&quot;', '"');

async function fetchPage(url: string, fetcher: typeof fetch) { const response = await fetcher(url, { headers: pageHeaders, redirect: 'follow' }); if (!response.ok) throw new Error(`Resolver HTTP ${response.status}`); return { html: normalized(await response.text()), url: response.url || url }; }
function source(url: string, referer: string, provider: string, range = false): ResolvedSource[] { try { validatePublicUrl(url); return [{ url, headers: sourceHeaders(referer, range), provider }]; } catch { return []; } }
function playmogoURL(url: URL) { if (url.hostname === 'playmogo.com' || url.hostname.endsWith('.playmogo.com')) return url; const result = new URL(url); result.protocol = 'https:'; result.hostname = 'playmogo.com'; return result; }
function embeddedPlayer(html: string, pageUrl: string) { const raw = html.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]; if (!raw) return; const url = new URL(raw, pageUrl); return url.pathname.startsWith('/e/') ? url : undefined; }
function passPath(html: string) { for (const pattern of [/\$\.get\(\s*["']([^"']+)["']/i,/\.get\(\s*["']([^"']*\/pass_md5\/[^"']+)["']/i,/\burl\s*:\s*["']([^"']*\/pass_md5\/[^"']+)["']/i,/\bfetch\(\s*["']([^"']*\/pass_md5\/[^"']+)["']/i,/\.open\(\s*["'][A-Z]+["']\s*,\s*["']([^"']*\/pass_md5\/[^"']+)["']/i,/['"]([^'"]*\/pass_md5\/[^'"]+)['"]/i]) { const match = html.match(pattern); if (match?.[1]) return match[1]; } }
function tokenPrefix(html: string) { const match = html.match(/["']([^"']*\?token=[^"']+&expiry=)["']/i); return match?.[1]; }
function cloudAta(url: string) { try { const parsed = new URL(url); return (parsed.hostname === 'cloudatacdn.com' || parsed.hostname.endsWith('.cloudatacdn.com')) && parsed.pathname.length > 1 && parsed.searchParams.has('token') && parsed.searchParams.has('expiry'); } catch { return false; } }
function randomSuffix() { return randomBytes(16).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 10); }
function discoverDoodProvider(html: string): string | undefined { const pair = html.match(/["']DOODSTREAM["']\s*,\s*["'](https?:[^"']+)["']/i)?.[1]; if (pair) return pair; const record = html.match(/hosting_provider["']?\s*[:=]\s*["']DOODSTREAM["'][\s\S]{0,700}?(?:embed_url|url)["']?\s*[:=]\s*["'](https?:[^"']+)/i)?.[1]; return record; }

export class DirectFileResolver implements Resolver { name = 'direct-file'; async resolve(pageUrl: string): Promise<ResolvedSource[]> { return /\.(mp4|m4v|webm|mov)(?:\?|$)/i.test(new URL(pageUrl).pathname) ? source(pageUrl, pageUrl, this.name, true) : []; } }

export class PlaymogoResolver implements Resolver {
  name = 'dood-playmogo';
  constructor(private fetcher: typeof fetch = fetch) {}
  async resolve(primaryUrl: string): Promise<ResolvedSource[]> {
    let target = new URL(primaryUrl);
    if (!/playmogo/i.test(target.hostname) && !doodHost.test(target.hostname)) { const parent = await fetchPage(primaryUrl, this.fetcher); const discovered = discoverDoodProvider(parent.html); if (!discovered) return []; target = new URL(discovered); }
    target = playmogoURL(target);
    let player = await fetchPage(target.toString(), this.fetcher);
    if (target.pathname.startsWith('/d/')) { const iframe = embeddedPlayer(player.html, player.url); if (!iframe) throw new Error('Dood landing page did not contain an embedded player'); player = await fetchPage(iframe.toString(), this.fetcher); }
    const path = passPath(player.html), prefix = tokenPrefix(player.html); if (!path || !prefix) throw new Error('Playmogo player did not expose pass_md5 metadata');
    const pass = new URL(path, player.url); const response = await this.fetcher(pass, { headers: { Referer: player.url, 'User-Agent': agent, 'X-Requested-With': 'XMLHttpRequest', Accept: '*/*', 'Accept-Language': 'en-US,en;q=0.9' }, redirect: 'follow' });
    if (!response.ok) throw new Error(`Playmogo pass_md5 HTTP ${response.status}`); const base = (await response.text()).trim(); const url = `${base}${randomSuffix()}${prefix}${Date.now()}`;
    if (!cloudAta(url)) throw new Error('Playmogo pass_md5 response was not a complete CloudAta URL'); return source(url, player.url, this.name);
  }
}

export class MixDropResolver {
  name = 'mixdrop'; constructor(private fetcher: typeof fetch = fetch) {}
  async resolve(pageUrl: string): Promise<ResolvedSource[]> { if (!mixdropHost.test(new URL(pageUrl).hostname)) return []; const result = await fetchPage(pageUrl, this.fetcher); const candidates = [...result.html.matchAll(mediaPattern)].map(m => m[0]); const wurl = result.html.match(/wurl\s*[=:]\s*["']([^"']+)/i)?.[1]; if (wurl) candidates.push(wurl); return candidates.filter(url => /mxcontent|\.mp4|\.m3u8/i.test(url)).flatMap(url => source(url, result.url, this.name, true)); }
}

export class PlaywrightCaptureResolver implements Resolver {
  name = 'playwright-media-capture';
  async resolve(pageUrl: string): Promise<ResolvedSource[]> { const { chromium } = await import('playwright'); const cdp = process.env.LUSTRE_CDP_URL; const browser = cdp ? await chromium.connectOverCDP(cdp) : await chromium.launch({ headless: true }); try { const context = browser.contexts()[0] ?? await browser.newContext({ userAgent: agent, locale: 'en-US' }); const tab = await context.newPage(); const found = new Map<string, string>(); tab.on('response', response => { const url = response.url(), type = response.headers()['content-type'] || ''; if (/video|audio|application\/vnd\.apple\.mpegurl/i.test(type) || /(cloudatacdn|mxcontent|\.m3u8|\.mp4)(?:\?|$)/i.test(url)) found.set(url, response.request().url()); }); await tab.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 }); await tab.waitForTimeout(8_000); const cookies = (await context.cookies()).map(c => `${c.name}=${c.value}`).join('; '); const sources = [...found.entries()].flatMap(([url, referer]) => { try { validatePublicUrl(url); return [{ url, headers: { ...sourceHeaders(referer, /mxcontent/i.test(url)), ...(cookies ? { Cookie: cookies } : {}) }, provider: this.name }]; } catch { return []; } }); if (!sources.length) throw new Error('Browser completed without capturing a media request'); return sources; } finally { await browser.close(); } }
}
