// @ts-nocheck
// Command palette for the Steam client (Millennium / Starlight).
// Ctrl+K in the main Steam window opens a palette: library games, Steam pages, actions, store search.
import { definePlugin, Field, ButtonItem, ModalRoot, showModal, Focusable, DialogButton, DialogButtonPrimary, Dropdown, SliderField, showContextMenu } from 'millennium';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

/* ------------------------------------------------------------------ data */

const PAGES = [
	['Library', 'steam://open/games'],
	['Store', 'steam://store'],
	['Downloads', 'steam://open/downloads'],
	['Friends list', 'steam://open/friends'],
	['Community', 'steam://openurl/https://steamcommunity.com/'],
	['Profile', 'steam://openurl/https://steamcommunity.com/my/'],
	['Inventory', 'steam://openurl/https://steamcommunity.com/my/inventory/'],
	['Market', 'steam://openurl/https://steamcommunity.com/market/'],
	['Trade offers', 'steam://openurl/https://steamcommunity.com/my/tradeoffers/'],
	['Badges', 'steam://openurl/https://steamcommunity.com/my/badges/'],
	['Workshop', 'steam://openurl/https://steamcommunity.com/workshop/'],
	['Discussions', 'steam://openurl/https://steamcommunity.com/discussions/'],
	['Points Shop', 'steam://openurl/https://store.steampowered.com/points/shop/'],
	['Wishlist', 'steam://openurl/https://store.steampowered.com/wishlist'],
	['Cart', 'steam://openurl/https://store.steampowered.com/cart/'],
	['News', 'steam://openurl/https://store.steampowered.com/news/'],
	['Account details', 'steam://openurl/https://store.steampowered.com/account/'],
	['Add funds', 'steam://openurl/https://store.steampowered.com/steamaccount/addfunds'],
	['Steam Support', 'steam://openurl/https://help.steampowered.com/'],
	['Screenshots', 'steam://open/screenshots'],
	['Settings', 'steam://open/settings'],
];

const ACTIONS = [
	['Set status: Online', 'steam://friends/status/online'],
	['Set status: Away', 'steam://friends/status/away'],
	['Set status: Invisible', 'steam://friends/status/invisible'],
	['Open Steam console', 'steam://open/console'],
	['Millennium Library Manager', () => openMillenniumLibraryManager()],
];

/** Millennium's library manager (quick access panel). */
function openMillenniumLibraryManager() {
	const M = window.Millennium;
	try {
		if (!M || typeof M.openQuickAccess !== 'function') throw new Error('Millennium.openQuickAccess missing');
		M.openQuickAccess();
	} catch (e) {
		console.error('[palette] could not open library manager; Millennium object:', typeof M, M && Object.keys(M), e);
	}
}

const cls = (...names) => names.filter(Boolean).join(' ');

const TILE_COLORS = ['#3b6ea5', '#7a4fa0', '#2f8a7b', '#a0603b', '#8a3f56', '#4f7a3a'];

/* ------------------------------------------------------------- theming data */

/** CSS variables set on .cmdpal-backdrop. Themes can override these instead of restyling every class. */
const VARS = [
	['--cmdpal-scrim', 'rgba(0, 0, 0, 0.3)'],
	['--cmdpal-bg', '#25282e'],
	['--cmdpal-text', '#dcdedf'],
	['--cmdpal-accent', 'var(--SystemAccentColor, #66c0f4)'],
	['--cmdpal-dim', '#8f98a0'],
	['--cmdpal-border', '#2a475e'],
	['--cmdpal-panel-border', 'rgba(255, 255, 255, 0.08)'],
	['--cmdpal-selected-bg', '#2a475e'],
	['--cmdpal-tile-bg', '#16202d'],
	['--cmdpal-owned', '#a4d007'],
	['--cmdpal-radius', '3px'],
	['--cmdpal-inset', '16px'],
	['--cmdpal-w', 'min(640px, calc(100% - 2 * var(--cmdpal-inset)))'],
	['--cmdpal-h', 'min(480px, calc(100% - 2 * var(--cmdpal-inset)))'],
];

/** [depth, selector, note]. Drives the class skeleton shown in settings and the starter CSS. */
const CLASS_TREE = [
	[0, '.cmdpal-backdrop', 'fallback overlay only: full-window dim layer; clicking it closes the palette; holds the variables; the Position setting sets --cmdpal-x and --cmdpal-y (0-100) inline'],
	[1, '.cmdpal', 'the palette panel; .cmdpal--hosted when it is a Steam menu (the default); data-mode="all | store | actions"'],
	[2, '.cmdpal-inputrow', 'search row'],
	[3, '.cmdpal-mode', '"Store only" / "Actions only" chip'],
	[3, '.cmdpal-input', 'search box'],
	[2, '.cmdpal-list', 'scrolling results'],
	[3, '.cmdpal-group', 'group header (Library, Store, ...)'],
	[4, '.cmdpal-group-label', 'group name'],
	[4, '.cmdpal-group-right', 'status text, e.g. Searching...'],
	[3, '.cmdpal-row', 'result; data-type="game | page | action | store"; states .is-selected, .is-owned, .is-nonsteam'],
	[4, '.cmdpal-icon', 'icon; .cmdpal-icon--img (image) or .cmdpal-icon--letter (fallback tile, colour in --cmdpal-tile)'],
	[4, '.cmdpal-text', 'title and subtitle'],
	[5, '.cmdpal-name', 'title'],
	[6, '.cmdpal-match', 'highlighted matched letters'],
	[5, '.cmdpal-sub', 'subtitle'],
	[4, '.cmdpal-right', 'price, Play, or Owned'],
	[3, '.cmdpal-skeleton', 'loading placeholder'],
	[3, '.cmdpal-empty', 'empty or error message'],
	[2, '.cmdpal-footer', 'hint line'],
];

const TREE_TEXT = CLASS_TREE.map(([d, sel, note]) => `${'  '.repeat(d)}${sel}  - ${note}`).join('\n');
const VARS_TEXT = VARS.map(([k, v]) => `${k}: ${v};`).join('\n');
const STARTER_CSS = [
	'/* Command Palette theme skeleton. The palette is an overlay in the main Steam window. */',
	'/* Tip: override the variables first; restyle classes only where needed. */',
	'.cmdpal-backdrop {',
	...VARS.map(([k, v]) => `  ${k}: ${v};`),
	'}',
	...CLASS_TREE.filter(([d]) => d > 0).map(([, sel]) => `${sel} {\n}`),
	'.cmdpal-row.is-selected {\n}',
	'.cmdpal-row.is-owned .cmdpal-right {\n}',
	'.cmdpal[data-mode="store"] {\n}',
].join('\n');

const BASE_CSS = `
.cmdpal-backdrop,.cmdpal--modal,.cmdpal--hosted{${VARS.map(([k, v]) => `${k}:${v};`).join('')}}
.cmdpal-backdrop{position:fixed;inset:0;z-index:2147483000;box-sizing:border-box;background:var(--cmdpal-scrim);-webkit-app-region:no-drag}
.cmdpal{position:absolute;left:calc(var(--cmdpal-inset) + (100% - 2 * var(--cmdpal-inset) - var(--cmdpal-w)) * var(--cmdpal-x, 50) / 100);top:calc(var(--cmdpal-inset) + (100% - 2 * var(--cmdpal-inset) - var(--cmdpal-h)) * var(--cmdpal-y, 50) / 100);display:flex;flex-direction:column;box-sizing:border-box;width:var(--cmdpal-w);height:var(--cmdpal-h);min-height:0;padding:22px 24px 12px;background:var(--cmdpal-bg);color:var(--cmdpal-text);border:1px solid var(--cmdpal-panel-border);border-radius:4px;box-shadow:0 18px 50px rgba(0,0,0,.5);overflow:hidden;font-size:16px;font-weight:300;-webkit-app-region:no-drag}
.cmdpal--modal{position:relative;left:auto;top:auto;width:auto;max-height:none;height:100%;padding:0;background:transparent;border:0;border-radius:0;box-shadow:none;position:relative;z-index:1000}
.cmdpal-handle{height:26px;flex:none;-webkit-app-region:drag}
.cmdpal-inputrow{display:flex;align-items:center;gap:10px;margin:0 13px;border-bottom:1px solid var(--cmdpal-border)}
.cmdpal-mode{font-size:12px;color:var(--cmdpal-accent);background:var(--cmdpal-selected-bg);border-radius:var(--cmdpal-radius);padding:2px 7px}
.cmdpal-input{flex:1;background:transparent;border:0;outline:0;color:inherit;font:inherit;font-size:17px;padding:8px 0 12px;-webkit-app-region:no-drag;user-select:text;-webkit-user-select:text}
.cmdpal-list{flex:1 1 auto;overflow-y:auto;padding:6px 0;min-height:0;-webkit-app-region:no-drag}
.cmdpal-group{padding:10px 14px 4px;font-size:13px;color:var(--cmdpal-dim);display:flex;justify-content:space-between}
.cmdpal-row{display:flex;align-items:center;gap:14px;padding:7px 14px;cursor:pointer;border-left:2px solid transparent}
.cmdpal-row.is-selected{background:var(--cmdpal-selected-bg);border-left-color:var(--cmdpal-accent)}
.cmdpal-icon{width:30px;height:30px;border-radius:var(--cmdpal-radius);flex:none;display:grid;place-items:center;font-size:13px;font-weight:600;color:#fff;background:var(--cmdpal-tile,var(--cmdpal-tile-bg));object-fit:cover}
.cmdpal-icon--img{display:block;background:var(--cmdpal-tile-bg)}
.cmdpal-text{flex:1;min-width:0}
.cmdpal-name{font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmdpal-match{color:var(--cmdpal-accent);font-weight:500}
.cmdpal-sub{font-size:13px;color:var(--cmdpal-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmdpal-right{font-size:13px;color:var(--cmdpal-dim);white-space:nowrap}
.cmdpal-row.is-owned .cmdpal-right{color:var(--cmdpal-owned)}
.cmdpal-skeleton{height:30px;margin:6px 14px;border-radius:var(--cmdpal-radius);background:var(--cmdpal-tile-bg)}
.cmdpal-empty{padding:14px;color:var(--cmdpal-dim);font-size:14px}
.cmdpal-footer{margin:0 13px;padding:9px 0 0;border-top:1px solid var(--cmdpal-border);color:var(--cmdpal-dim);font-size:13px}

/* Hosted: the palette is inside a Steam menu window, so it shows above store and community pages. It keeps its
 * own look; only the size is fixed, because Steam sizes a menu's window once, when it opens. */
.cmdpal--hosted{position:relative;left:auto;top:auto;width:640px;height:480px;max-height:none;box-shadow:none}
`;

const STYLE_ID = 'cmdpal-base-style';

/** Inserts the base stylesheet first in the document head, so theme CSS added later wins ties. */
function ensureStyles(doc) {
	try {
		if (!doc || doc.getElementById(STYLE_ID)) return;
		const st = doc.createElement('style');
		st.id = STYLE_ID;
		st.textContent = BASE_CSS;
		const head = doc.head || doc.documentElement;
		head.insertBefore(st, head.firstChild);
	} catch (e) {
		console.warn('[palette] could not inject styles', e);
	}
}

async function copyText(text, doc) {
	try {
		if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
	} catch {}
	try {
		const ta = doc.createElement('textarea');
		ta.value = text;
		doc.body.appendChild(ta);
		ta.select();
		const ok = doc.execCommand('copy');
		ta.remove();
		return !!ok;
	} catch { return false; }
}

/* --------------------------------------------------------------- helpers */

function tileColor(s) {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
	return TILE_COLORS[Math.abs(h) % TILE_COLORS.length];
}

function openUrl(url) {
	try {
		if (window.SteamClient?.URL?.ExecuteSteamURL) {
			window.SteamClient.URL.ExecuteSteamURL(url);
			return;
		}
	} catch (e) {
		console.error('[palette] ExecuteSteamURL failed', e);
	}
	try {
		window.location.href = url;
	} catch (e) {
		console.error('[palette] could not open', url, e);
	}
}

function ago(ts) {
	if (!ts) return 'In your library';
	const s = Date.now() / 1000 - ts;
	if (s < 3600) return `Played ${Math.max(1, Math.floor(s / 60))} min ago`;
	if (s < 86400) return `Played ${Math.floor(s / 3600)}h ago`;
	if (s < 172800) return 'Played yesterday';
	if (s < 2592000) return `Played ${Math.floor(s / 86400)} days ago`;
	return 'Played a while ago';
}

let libSource = 'none';
let libLogged = '';

function appsFrom(src) {
	if (!src) return null;
	try { return Array.isArray(src) ? src : Array.from(src.values ? src.values() : src); } catch { return null; }
}

const SHORTCUT_TYPE = 1073741824; // app_type of non-Steam shortcuts in Steam's app store

function isShortcutId(id) { return id >= 2147483648; } // shortcut app ids have the top bit set

/** Id for steam://rungameid/. Non-Steam shortcuts need the 64-bit game id, not the 32-bit app id. */
function launchId(g) {
	if (!g.nonSteam) return String(g.appid);
	if (g.gameid) return String(g.gameid);
	try { return (BigInt(g.appid) * BigInt(4294967296) + BigInt(33554432)).toString(); } catch { return String(g.appid); }
}

/**
 * Games from Steam's in-memory stores (app store plus the library collections, merged by app id).
 * Kept: normal games, non-Steam shortcuts, and anything Steam itself lists in the library
 * (visible_in_game_list). Property names are from Steam's UI and may change.
 */
function getLibrary() {
	const cs = window.collectionStore;
	const sources = [
		['appStore.allApps', () => window.appStore?.allApps],
		['allGamesCollection', () => cs?.allGamesCollection?.allApps],
		['localGamesCollection', () => cs?.localGamesCollection?.allApps],
		['allAppsCollection', () => cs?.allAppsCollection?.allApps],
	];
	const byId = new Map();
	const used = [];
	for (const [label, get] of sources) {
		let a = null;
		try { a = appsFrom(get()); } catch {}
		if (!a || !a.length) continue;
		used.push(`${label}:${a.length}`);
		a.forEach((o) => {
			const raw = o && (o.appid ?? o.app_id);
			if (typeof raw !== 'number') return;
			const id = raw >>> 0; // shortcut ids can arrive as negative 32-bit numbers
			if (!byId.has(id)) byId.set(id, o);
		});
	}
	const arr = Array.from(byId.values());
	const norm = arr
		.map((a) => {
			const id = (a.appid ?? a.app_id) >>> 0;
			return {
				name: a.display_name ?? a.name, appid: id, type: a.app_type, visible: a.visible_in_game_list === true,
				last: Math.max(a.rt_last_time_played || 0, a.rt_last_time_locally_played || 0),
				hash: a.icon_hash, gameid: a.m_gameid,
			};
		})
		.filter((a) => a.name && a.appid > 0);
	const isShortcut = (a) => a.type === SHORTCUT_TYPE || isShortcutId(a.appid);
	const games = norm.filter((a) => a.type === 1 || a.visible || isShortcut(a));
	const out = games.length ? games : norm;
	libSource = used.join(' + ') || 'none';
	const sig = `${libSource}:${arr.length}:${out.length}`;
	if (sig !== libLogged) {
		libLogged = sig;
		const types = {};
		norm.forEach((a) => { types[a.type] = (types[a.type] || 0) + 1; });
		console.log('[palette] library', {
			sources: libSource, merged: arr.length, kept: out.length, nonSteam: out.filter(isShortcut).length,
			typeCounts: types,
			notType1: out.filter((a) => a.type !== 1).slice(0, 8).map((a) => `${a.name} [type ${a.type}, id ${a.appid}]`),
			appStore: typeof window.appStore, collectionStore: typeof window.collectionStore,
		});
	}
	return out.map((a) => ({ name: a.name, appid: a.appid, last: a.last, hash: a.hash, gameid: a.gameid, nonSteam: isShortcut(a) }));
}

/* ----------------------------------------------------------------- fuzzy */

function fuzzy(q, t) {
	q = q.toLowerCase();
	const l = t.toLowerCase();
	const at = l.indexOf(q);
	if (at >= 0) {
		const ix = [];
		for (let k = 0; k < q.length; k++) ix.push(at + k);
		return { s: 200 - at - (l.length - q.length) * 0.1, i: ix };
	}
	const ix = [];
	let p = 0, gaps = 0, last = -2;
	for (let j = 0; j < l.length && p < q.length; j++) {
		if (l[j] === q[p]) {
			if (last >= 0 && j - last > 1) gaps++;
			ix.push(j);
			last = j;
			p++;
		}
	}
	return p === q.length ? { s: 100 - gaps * 8 - ix[0], i: ix } : null;
}

function rank(arr, q, get, max) {
	return arr
		.map((x) => ({ x, m: fuzzy(q, get(x)) }))
		.filter((r) => r.m)
		.sort((a, b) => b.m.s - a.m.s)
		.slice(0, max);
}

function Hl({ text, m }) {
	if (!m) return <>{text}</>;
	const set = new Set(m.i);
	const parts = [];
	let buf = '', on = false, k = 0;
	const flush = () => {
		if (!buf) return;
		parts.push(on ? <span key={k++} className="cmdpal-match">{buf}</span> : buf);
		buf = '';
	};
	for (let n = 0; n < text.length; n++) {
		const o = set.has(n);
		if (o !== on) { flush(); on = o; }
		buf += text[n];
	}
	flush();
	return <>{parts}</>;
}

/* ------------------------------------------------------------ store search */

const storeCache = new Map();
let fetchBlocked = false;
let lastStoreMethod = 'not used yet';
let backendShapeLogged = false;
let countryCache = null;

/** Two-letter store country from Steam itself; '' means "let the store decide by IP". */
async function getCountry() {
	if (countryCache !== null) return countryCache;
	let cc = '';
	try {
		const r = await window.SteamClient?.User?.GetIPCountry?.();
		if (typeof r === 'string' && /^[A-Za-z]{2}$/.test(r)) cc = r.toLowerCase();
	} catch (e) {
		console.warn('[palette] could not read Steam country', e);
	}
	countryCache = cc;
	console.log('[palette] store country:', cc || '(automatic)');
	return cc;
}

function enc(term) {
	return encodeURIComponent(term).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

async function storeSearch(term) {
	const e = enc(term);
	const cc = await getCountry();
	const url = `https://store.steampowered.com/api/storesearch/?term=${e}&l=english${cc ? `&cc=${cc}` : ''}`;

	if (!fetchBlocked) {
		try {
			const r = await fetch(url);
			if (r.ok) {
				const j = await r.json();
				lastStoreMethod = 'direct fetch from Steam UI';
				return { ok: true, items: j.items || [] };
			}
		} catch (err) {
			fetchBlocked = true; // probably CORS; use the backend from now on
			console.warn('[palette] direct store fetch failed, switching to backend', err);
		}
	}
	try {
		const raw = await backend.search_store(e, cc || 'auto');
		if (!backendShapeLogged) {
			backendShapeLogged = true;
			console.log('[palette] backend.search_store returned', typeof raw, raw && typeof raw === 'object' ? Object.keys(raw) : String(raw).slice(0, 80));
		}
		let j = typeof raw === 'string' ? JSON.parse(raw) : raw;
		if (j && j.items === undefined && j.result !== undefined) j = typeof j.result === 'string' ? JSON.parse(j.result) : j.result;
		if (!j) return { ok: false, error: 'empty_response' };
		if (j.error) return { ok: false, error: j.error };
		lastStoreMethod = 'backend (curl)';
		return { ok: true, items: j.items || [] };
	} catch (err) {
		return { ok: false, error: String(err) };
	}
}

function priceLabel(p) {
	if (!p) return '';
	if (p.final === 0) return 'Free';
	try {
		return new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency }).format(p.final / 100);
	} catch {
		return `${(p.final / 100).toFixed(2)} ${p.currency}`;
	}
}

/* ------------------------------------------------------------ item builder */

function parseQuery(raw) {
	if (/^s\s/i.test(raw)) return { mode: 'store', term: raw.slice(2).trim() };
	if (/^>/.test(raw)) return { mode: 'actions', term: raw.replace(/^>\s?/, '').trim() };
	return { mode: 'all', term: raw.trim() };
}

function buildItems({ mode, term, library, store }) {
	const out = [];
	const owned = new Set(library.filter((g) => !g.nonSteam).map((g) => g.appid));

	if (mode === 'all') {
		const games = term
			? rank(library, term, (g) => g.name, 5)
			: library.filter((g) => g.last).sort((a, b) => b.last - a.last).slice(0, 5).map((x) => ({ x, m: null }));
		if (games.length) {
			out.push({ kind: 'group', label: term ? 'Library' : 'Recent' });
			games.forEach((r) => out.push({ kind: 'row', type: 'game', name: r.x.name, m: r.m, sub: r.x.nonSteam ? (r.x.last ? `Non-Steam · ${ago(r.x.last)}` : 'Non-Steam game') : ago(r.x.last), icon: r.x.name[0], appid: r.x.nonSteam ? undefined : r.x.appid, hash: r.x.hash, nonSteam: r.x.nonSteam, right: 'Play', url: `steam://rungameid/${launchId(r.x)}` }));
		}
		const pages = term ? rank(PAGES, term, (p) => p[0], 5) : PAGES.slice(0, 4).map((x) => ({ x, m: null }));
		if (pages.length) {
			out.push({ kind: 'group', label: 'Steam pages' });
			pages.forEach((r) => out.push({ kind: 'row', type: 'page', name: r.x[0], m: r.m, sub: 'Go to', icon: '›', right: '', url: r.x[1] }));
		}
	}

	if (mode === 'all' || mode === 'actions') {
		const acts = term ? rank(ACTIONS, term, (a) => a[0], 4) : mode === 'actions' ? ACTIONS.map((x) => ({ x, m: null })) : [];
		if (acts.length) {
			out.push({ kind: 'group', label: 'Actions' });
			acts.forEach((r) => out.push({ kind: 'row', type: 'action', name: r.x[0], m: r.m, sub: 'Run', icon: '⚡', right: '', url: typeof r.x[1] === 'string' ? r.x[1] : undefined, fn: typeof r.x[1] === 'function' ? r.x[1] : undefined }));
		}
	}

	const wantStore = (mode === 'all' && term.length >= 2) || (mode === 'store' && term.length >= 1);
	if (wantStore) {
		out.push({ kind: 'group', label: 'Store', right: store === 'loading' ? 'Searching…' : '' });
		if (store === 'loading') {
			out.push({ kind: 'skel' }, { kind: 'skel' });
		} else if (Array.isArray(store)) {
			if (!store.length) out.push({ kind: 'empty', text: `No store results for “${term}”.` });
			store.slice(0, 5).forEach((it) => {
				const own = it.type === 'app' && owned.has(it.id);
				const m = fuzzy(term, it.name);
				out.push({
					kind: 'row', type: 'store', name: it.name, m, icon: it.name[0], appid: it.type === 'app' ? it.id : undefined, img: it.tiny_image, own,
					sub: own ? 'Already in your library' : it.type === 'app' ? 'Open store page' : `Open ${it.type} page`,
					right: own ? 'Owned' : priceLabel(it.price),
					url: own ? `steam://nav/games/details/${it.id}`
						: it.type === 'app' ? `steam://store/${it.id}`
						: `steam://openurl/https://store.steampowered.com/${it.type}/${it.id}`,
				});
			});
		} else if (store && store.error) {
			out.push({ kind: 'empty', text: `Store search failed (${store.error}).` });
		}
	}

	if (mode === 'store' && !term) out.push({ kind: 'empty', text: 'Type a game name to search the store.' });
	if (mode === 'actions' && !out.length) out.push({ kind: 'empty', text: 'No matching actions.' });

	const hasRun = out.some((o) => o.kind === 'row');
	if ((mode === 'all' || mode === 'store') && term && !hasRun && store !== 'loading') {
		out.push({
			kind: 'row', type: 'store', name: `Search the store for “${term}”`, sub: 'Opens the store search page', icon: '⌕', right: '',
			url: `steam://openurl/https://store.steampowered.com/search/?term=${enc(term)}`,
		});
	}
	return out;
}

/* ----------------------------------------------------------------- palette */

let modalInst = null; // fallback pop-out modal
let menuInst = null; // { instance }: the palette in a Steam menu window (the default)
let overlay = null; // { host, root, rd }: the palette rendered inside the main window

function closePalette() {
	if (menuInst) {
		const m = menuInst;
		menuInst = null;
		try { if (m.instance) { m.instance.Hide(); if (m.instance.Close) m.instance.Close(); } } catch (e) { /* already closed */ }
	}
	if (overlay) {
		const o = overlay;
		overlay = null;
		setTimeout(() => { // not inside the click/key handler that asked for the close
			try {
				if (o.root && o.root.unmount) o.root.unmount();
				else if (o.rd && o.rd.unmountComponentAtNode) o.rd.unmountComponentAtNode(o.host);
			} catch (e) { console.warn('[palette] unmount failed', e); }
			try { o.host.remove(); } catch {}
		}, 0);
	}
	try { modalInst?.Close?.(); } catch (e) { console.error(e); }
	modalInst = null;
}

function getReactDOM() {
	const rd = window.SP_REACTDOM || window.ReactDOM || null;
	return rd && !rd.createRoot && !rd.render && rd.default ? rd.default : rd;
}


const iconGaveUp = new Set();

/** Icon: image URL from the store API if given, then Steam's library icon, then the header image, then a letter tile. */
function GameIcon({ appid, hash, img, letter }) {
	const urls = [
		img,
		hash && `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appid}/${hash}.jpg`,
		hash && `https://shared.fastly.steamstatic.com/community_assets/images/apps/${appid}/${hash}.jpg`,
		hash && `https://shared.akamai.steamstatic.com/community_assets/images/apps/${appid}/${hash}.jpg`,
		hash && `https://shared.akamai.steamstatic.com/steamcommunity/public/images/apps/${appid}/${hash}.jpg`,
		`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
		`https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
	].filter(Boolean);
	const [n, setN] = useState(0);
	if (n >= urls.length) {
		if (!iconGaveUp.has(appid)) { iconGaveUp.add(appid); console.warn('[palette] no icon found for app', appid); }
		return <LetterTile letter={letter} seed={letter || String(appid)} />;
	}
	return (
		<img
			className="cmdpal-icon cmdpal-icon--img"
			src={urls[n]}
			onError={() => setN(n + 1)}
		/>
	);
}

function LetterTile({ letter, seed }) {
	return <div className="cmdpal-icon cmdpal-icon--letter" style={{ '--cmdpal-tile': tileColor(seed || letter || '?') }}>{letter}</div>;
}

function ResultRow({ it, active, rowRef, onHover, onPick }) {
	return (
		<div
			ref={rowRef}
			className={cls('cmdpal-row', active && 'is-selected', it.own && 'is-owned', it.nonSteam && 'is-nonsteam')}
			data-type={it.type || 'item'}
			onMouseMove={onHover}
			onClick={onPick}
		>
			{it.appid
				? <GameIcon key={it.appid} appid={it.appid} hash={it.hash} img={it.img} letter={it.icon} />
				: <LetterTile letter={it.icon} seed={it.icon || it.name} />}
			<div className="cmdpal-text">
				<div className="cmdpal-name"><Hl text={it.name} m={it.m} /></div>
				<div className="cmdpal-sub">{it.sub}</div>
			</div>
			<div className="cmdpal-right">{it.right}</div>
		</div>
	);
}

function Palette({ onClose, modal, hosted, onGone }) {
	const [raw, setRaw] = useState('');
	const [sel, setSel] = useState(0);
	const [store, setStore] = useState(null);
	const inputRef = useRef(null);
	const selRef = useRef(null);
	const wrapRef = useRef(null);
	useLayoutEffect(() => { ensureStyles(wrapRef.current?.ownerDocument); }, []);
	const [library, setLibrary] = useState(() => getLibrary());
	const { mode, term } = parseQuery(raw);
	const close = () => (onClose ? onClose() : closePalette());

	useEffect(() => {
		// a menu window's stylesheets and focus can still be settling: focus again a little later
		const focus = () => {
			const i = inputRef.current;
			if (i && i.ownerDocument.activeElement !== i) { i.focus(); if (hosted && i.select) i.select(); }
		};
		const timers = [setTimeout(focus, 50), ...(hosted ? [setTimeout(focus, 250)] : [])];
		return () => timers.forEach(clearTimeout);
	}, []);

	// Hosted: tell the opener when Steam closes the menu (it does when the window loses focus).
	useEffect(() => {
		if (!hosted) return undefined;
		return () => { if (onGone) onGone(); };
	}, []);

	// Esc closes from anywhere in the window while the palette is open.
	useEffect(() => {
		const win = wrapRef.current?.ownerDocument?.defaultView;
		if (!win) return;
		const h = (e) => {
			if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
			else if (hosted && !capturingHotkey && matchesHotkey(e, hotkey)) { e.preventDefault(); e.stopPropagation(); close(); } // the shortcut toggles
		};
		win.addEventListener('keydown', h, true);
		return () => win.removeEventListener('keydown', h, true);
	}, []);

	// Fallback modal only: the pop-out window adds its own chrome (a black column with the close X).
	// Recolour pure-black ancestors to match the panel so the column blends in.
	useEffect(() => {
		const el = wrapRef.current;
		if (!modal || !el) return;
		try {
			const win = el.ownerDocument.defaultView;
			const bgOf = (n) => win.getComputedStyle(n).backgroundColor;
			const chain = [];
			for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.push(n);
			const clear = (c) => !c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)';
			const black = (c) => c === 'rgb(0, 0, 0)';
			const good = chain.map(bgOf).find((c) => !clear(c) && !black(c));
			if (good) chain.forEach((n) => { if (black(bgOf(n))) n.style.background = good; });
		} catch (e) {
			console.warn('[palette] modal chrome inspection failed', e);
		}
	}, []);

	useEffect(() => {
		const want = (mode === 'all' && term.length >= 2) || (mode === 'store' && term.length >= 1);
		if (!want) { setStore(null); return; }
		const key = term.toLowerCase();
		if (storeCache.has(key)) { setStore(storeCache.get(key)); return; }
		setStore('loading');
		let dead = false;
		const t = setTimeout(async () => {
			const res = await storeSearch(term);
			if (dead) return;
			if (res.ok) storeCache.set(key, res.items);
			setStore(res.ok ? res.items : { error: res.error });
		}, 250);
		return () => { dead = true; clearTimeout(t); };
	}, [mode, term]);

	const items = useMemo(() => buildItems({ mode, term, library, store }), [mode, term, library, store]);
	const runnable = items.filter((i) => i.kind === 'row');

	useEffect(() => { setSel(0); }, [raw]);
	useEffect(() => { if (!library.length) { const l = getLibrary(); if (l.length) setLibrary(l); } }, [raw]);
	useEffect(() => { selRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [sel, items]);

	const run = (it) => {
		if (!it) return;
		close();
		setTimeout(() => (it.fn ? it.fn() : openUrl(it.url)), 50);
	};

	const onKeyDown = (e) => {
		if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) e.stopPropagation();
		const n = runnable.length;
		if (e.key === 'ArrowDown') { e.preventDefault(); if (n) setSel((sel + 1) % n); }
		else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) setSel((sel - 1 + n) % n); }
		else if (e.key === 'Enter') { e.preventDefault(); run(runnable[sel]); }
		else if (e.key === 'Escape') { e.preventDefault(); close(); }
	};

	let ri = -1;
	const panel = (
		<div className={cls('cmdpal', modal && 'cmdpal--modal', hosted && 'cmdpal--hosted')} data-mode={mode} ref={wrapRef}>
			{modal && <div className="cmdpal-handle" />}
			<div className="cmdpal-inputrow">
				{mode !== 'all' && <span className="cmdpal-mode">{mode === 'store' ? 'Store only' : 'Actions only'}</span>}
				<input
					ref={inputRef}
					className="cmdpal-input"
					value={raw}
					onChange={(e) => setRaw(e.target.value)}
					onKeyDown={onKeyDown}
					placeholder="Search games, pages, actions, or the store"
					spellCheck={false}
					autoComplete="off"
				/>
			</div>
			<div className="cmdpal-list">
				{items.length === 0 && <div className="cmdpal-empty">{library.length ? 'Start typing.' : 'Start typing. Library games are not loaded yet.'}</div>}
				{items.map((it, k) => {
					if (it.kind === 'group') return <div key={k} className="cmdpal-group"><span className="cmdpal-group-label">{it.label}</span><span className="cmdpal-group-right">{it.right || ''}</span></div>;
					if (it.kind === 'skel') return <div key={k} className="cmdpal-skeleton" />;
					if (it.kind === 'empty') return <div key={k} className="cmdpal-empty">{it.text}</div>;
					ri++;
					const idx = ri;
					return (
						<ResultRow
							key={k}
							it={it}
							active={idx === sel}
							rowRef={idx === sel ? selRef : null}
							onHover={() => { if (sel !== idx) setSel(idx); }}
							onPick={() => run(it)}
						/>
					);
				})}
			</div>
			<div className="cmdpal-footer">Up/Down to move, Enter to run, Esc to close. Prefix “s ” searches the store only, “&gt;” lists actions.</div>
		</div>
	);
	if (modal) return <ModalRoot onCancel={close} closeModal={close} bAllowFullSize bHideCloseIcon>{panel}</ModalRoot>;
	if (hosted) return panel; // Steam's menu window is the container
	return <div className="cmdpal-backdrop" style={{ '--cmdpal-x': position.x, '--cmdpal-y': position.y }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>{panel}</div>;
}

/* ------------------------------------------------- opening and the hotkey */

const HK_KEY = 'steam-command-palette:hotkey';
const DEFAULT_HOTKEY = { ctrl: true, alt: false, shift: false, meta: false, key: 'k' };
let capturingHotkey = false;

function normKey(k) { return k === ' ' ? 'space' : String(k).toLowerCase(); }
function validHotkey(h) {
	return !!h && typeof h.key === 'string' && h.key.length > 0 && (h.ctrl || h.alt || h.meta || /^f\d{1,2}$/.test(h.key));
}
function fmtHotkey(h) {
	const p = [];
	if (h.ctrl) p.push('Ctrl');
	if (h.alt) p.push('Alt');
	if (h.shift) p.push('Shift');
	if (h.meta) p.push('Meta');
	p.push(h.key.length === 1 ? h.key.toUpperCase() : h.key[0].toUpperCase() + h.key.slice(1));
	return p.join('+');
}
function loadHotkey() {
	try {
		const raw = window.localStorage?.getItem(HK_KEY);
		if (raw) { const h = JSON.parse(raw); if (validHotkey(h)) return h; }
	} catch (e) { console.warn('[palette] could not read saved shortcut', e); }
	return { ...DEFAULT_HOTKEY };
}
function saveHotkey(h) {
	hotkey = h;
	try { window.localStorage?.setItem(HK_KEY, JSON.stringify(h)); }
	catch (e) { console.warn('[palette] could not save shortcut', e); }
}
let hotkey = loadHotkey();
function matchesHotkey(e, h) {
	return !!e.key && !!e.ctrlKey === !!h.ctrl && !!e.altKey === !!h.alt && !!e.shiftKey === !!h.shift && !!e.metaKey === !!h.meta && normKey(e.key) === h.key;
}

function sameHotkey(a, b) {
	return !!a.ctrl === !!b.ctrl && !!a.alt === !!b.alt && !!a.shift === !!b.shift && !!a.meta === !!b.meta && a.key === b.key;
}

/* Where the palette appears: x/y are 0-100 (0 = left/top edge, 100 = right/bottom edge, 50 = centred). */
const POS_KEY = 'steam-command-palette:position';
const PRESETS = [
	{ id: 'center', label: 'Center', x: 50, y: 50 },
	{ id: 'upper', label: 'Upper center', x: 50, y: 22 },
	{ id: 'top-left', label: 'Top left', x: 0, y: 0 },
	{ id: 'top-right', label: 'Top right', x: 100, y: 0 },
	{ id: 'bottom-left', label: 'Bottom left', x: 0, y: 100 },
	{ id: 'bottom', label: 'Bottom center', x: 50, y: 100 },
	{ id: 'bottom-right', label: 'Bottom right', x: 100, y: 100 },
	{ id: 'custom', label: 'Custom', x: 50, y: 50 },
];
function loadPosition() {
	try {
		const raw = window.localStorage?.getItem(POS_KEY);
		if (raw) {
			const p = JSON.parse(raw);
			const ok = (v) => typeof v === 'number' && v >= 0 && v <= 100;
			if (p && PRESETS.some((x) => x.id === p.preset) && ok(p.x) && ok(p.y)) return p;
		}
	} catch (e) { console.warn('[palette] could not read saved position', e); }
	return { preset: 'center', x: 50, y: 50 };
}
let position = loadPosition();
function savePosition(p) {
	position = p;
	try { window.localStorage?.setItem(POS_KEY, JSON.stringify(p)); }
	catch (e) { console.warn('[palette] could not save position', e); }
}

function getDesktopPopup() {
	try { return window.g_PopupManager?.GetExistingPopup?.('SP Desktop_uid0'); } catch { return null; }
}

/** A hidden 1px anchor in the main window where the Position setting puts the panel; the menu hangs from it. */
function placeSpot(win) {
	const doc = win.document;
	let n = doc.getElementById('cmdpal-spot');
	if (!n) {
		n = doc.createElement('div');
		n.id = 'cmdpal-spot';
		n.style.cssText = 'position:fixed;width:1px;height:1px;visibility:hidden;pointer-events:none';
		doc.body.appendChild(n);
	}
	const W = 640, H = 480, inset = 16;
	n.style.left = Math.round(inset + Math.max(0, win.innerWidth - 2 * inset - W) * position.x / 100) + 'px';
	n.style.top = Math.round(inset + Math.max(0, win.innerHeight - 2 * inset - H) * position.y / 100) + 'px';
	return n;
}

/**
 * The palette as a Steam menu (Millennium's showContextMenu). Steam draws its menus in windows of their own,
 * so they show above the store and community pages (browser views laid over the main window's page), and
 * Steam's menu styling and the theme's apply to the palette like to any Steam menu.
 */
function openHosted() {
	const popup = getDesktopPopup();
	const win = popup?.window ?? popup?.m_popup;
	const show = typeof showContextMenu === 'function' ? showContextMenu : window.MILLENNIUM_API?.showContextMenu;
	if (typeof show !== 'function' || !win?.document?.body || !win.SteamClient?.Window) {
		console.warn('[palette] Steam menu unavailable', { showContextMenu: typeof show, mainWindow: !!win });
		return false;
	}
	try {
		const m = {};
		const Host = () => <Palette hosted onClose={closePalette} onGone={() => { if (menuInst === m) menuInst = null; }} />;
		// no title: the window keeps Steam's menu window title ("Menu"), which themes match to style Steam's menus
		m.instance = show(<Host />, placeSpot(win), { bForcePopup: true, bOverlapHorizontal: true, bOverlapVertical: false, bCreateHidden: false, bRetainOnHide: false });
		menuInst = m;
		console.log('[palette] opened as a Steam menu');
		return true;
	} catch (e) {
		menuInst = null;
		console.warn('[palette] could not open as a Steam menu, falling back', e);
		return false;
	}
}

/** Fallback: the palette rendered straight into the main Steam window (no second window). */
function openOverlay() {
	const popup = getDesktopPopup();
	const win = popup?.window ?? popup?.m_popup;
	const rd = getReactDOM();
	if (!win?.document?.body || !rd) {
		console.warn('[palette] overlay unavailable', { mainWindow: !!win, reactDom: !!rd });
		return false;
	}
	let host = null;
	try {
		const doc = win.document;
		ensureStyles(doc);
		host = doc.createElement('div');
		host.setAttribute('data-cmdpal-host', '');
		doc.body.appendChild(host);
		const el = <Palette onClose={closePalette} />;
		let root = null;
		if (rd.createRoot) { root = rd.createRoot(host); root.render(el); }
		else rd.render(el, host);
		overlay = { host, root, rd };
		console.log('[palette] opened as an overlay in the main window');
		return true;
	} catch (e) {
		console.warn('[palette] overlay failed', e);
		try { host?.remove(); } catch {}
		return false;
	}
}

/** Fallback: Steam's pop-out modal window. */
function openModalFallback() {
	const popup = getDesktopPopup();
	const win = popup?.window ?? popup?.m_popup;
	const opts = { strTitle: 'Command palette', popupWidth: 640, popupHeight: 480, bNeverPopOut: false };
	const attempts = [
		['parent window', win, () => showModal(<Palette modal onClose={closePalette} />, win, opts)],
		['no parent', true, () => showModal(<Palette modal onClose={closePalette} />)],
		['popup object', popup, () => showModal(<Palette modal onClose={closePalette} />, popup, opts)],
	];
	for (const [label, usable, fn] of attempts) {
		if (!usable) continue;
		try {
			modalInst = fn();
			console.log('[palette] modal opened via', label);
			return;
		} catch (e) {
			console.warn('[palette] showModal via', label, 'failed', e);
		}
	}
	console.error('[palette] all showModal attempts failed');
}

function openPalette() {
	if (overlay || menuInst) { closePalette(); return; } // pressing the shortcut again closes it
	closePalette();
	if (!openHosted() && !openOverlay()) openModalFallback();
}

let lastOpen = 0;

function onKey(e) {
	if (!capturingHotkey && matchesHotkey(e, hotkey)) {
		e.preventDefault();
		e.stopPropagation();
		if (e.repeat) return;
		const now = Date.now();
		if (now - lastOpen < 400) return;
		lastOpen = now;
		openPalette();
	}
}

// Called from the web view script (webview/preload.ts) when the shortcut is pressed on a store/community page.
/** @ffi */
export function togglePalette(): boolean {
	const now = Date.now();
	if (now - lastOpen < 300) return false;
	lastOpen = now;
	openPalette();
	return true;
}

// The web view script reads the shortcut from here, so a changed shortcut works there too.
/** @ffi */
export function getHotkey(): string {
	return JSON.stringify(hotkey);
}

function attachTo(w) {
	if (!w || w.__mcpPaletteAttached || !w.addEventListener) return;
	w.addEventListener('keydown', onKey, true);
	w.__mcpPaletteAttached = true;
}

function start() {
	try { window.__commandPalette?.dispose?.(); } catch {}
	const attach = () => {
		attachTo(window);
		const p = getDesktopPopup();
		attachTo(p?.window ?? p?.m_popup);
	};
	attach();
	const timer = setInterval(attach, 2000); // the main window can be recreated; re-attach when it is
	window.__commandPalette = {
		dispose() {
			clearInterval(timer);
			const p = getDesktopPopup();
			[window, p?.window ?? p?.m_popup].forEach((w) => {
				try { w?.removeEventListener('keydown', onKey, true); if (w) w.__mcpPaletteAttached = false; } catch {}
			});
			closePalette();
			try { (p?.window ?? p?.m_popup)?.document?.getElementById('cmdpal-spot')?.remove(); } catch {}
		},
	};
	console.log('[palette] started, shortcut:', fmtHotkey(hotkey), 'library games:', getLibrary().length);
}

/* ---------------------------------------------------------- settings panel */

function ActionRow({ label, description, onClick }) {
	const last = useRef(0);
	const fire = (e) => {
		const now = Date.now();
		if (now - last.current < 400) return; // the row and the wrapper can both report one click
		last.current = now;
		onClick(e);
	};
	return (
		<div onClick={fire} style={{ cursor: 'pointer' }}>
			<ButtonItem label={label} description={description} onClick={fire} />
		</div>
	);
}

const RefreshIcon = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<polyline points="23 4 23 10 17 10" />
		<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
	</svg>
);

/** DialogButton with a guard: the wrapper and the button can both report one click. */
function PanelButton({ primary, onClick, style, title, children }) {
	const last = useRef(0);
	const fire = () => {
		const now = Date.now();
		if (now - last.current < 400) return;
		last.current = now;
		onClick();
	};
	const Btn = primary ? DialogButtonPrimary : DialogButton;
	return (
		<div onClick={fire} style={{ flex: '0 0 auto' }} title={title}>
			<Btn onClick={fire} style={style}>{children}</Btn>
		</div>
	);
}

function ShortcutRow() {
	const [hk, setHk] = useState(hotkey);
	const [capturing, setCapturing] = useState(false);
	const [msg, setMsg] = useState('');
	const ref = useRef(null);

	useEffect(() => {
		capturingHotkey = capturing;
		if (!capturing) return;
		const win = ref.current?.ownerDocument?.defaultView || window;
		const h = (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (e.key === 'Escape') { setCapturing(false); setMsg(''); return; }
			if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return; // wait for the real key
			const next = { ctrl: !!e.ctrlKey, alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey, key: normKey(e.key) };
			if (!validHotkey(next)) { setMsg(' Use Ctrl, Alt or Meta with a key, or an F-key.'); return; }
			saveHotkey(next);
			setHk(next);
			setCapturing(false);
			setMsg('');
		};
		win.addEventListener('keydown', h, true);
		return () => { win.removeEventListener('keydown', h, true); capturingHotkey = false; };
	}, [capturing]);

	const changed = !sameHotkey(hk, DEFAULT_HOTKEY);
	const reset = () => { saveHotkey({ ...DEFAULT_HOTKEY }); setHk({ ...DEFAULT_HOTKEY }); setCapturing(false); setMsg(''); };

	return (
		<div ref={ref}>
			<Field
				label="Shortcut"
				description={capturing ? `Press the new shortcut now (Esc to cancel).${msg}` : `${fmtHotkey(hk)} opens the palette from the main Steam window.${msg}`}
				bottomSeparator="none"
			>
				<Focusable style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					<PanelButton style={{ minWidth: 0, padding: '0 16px' }} onClick={() => { setMsg(''); setCapturing(!capturing); }}>
						{capturing ? 'Cancel' : 'Change'}
					</PanelButton>
					{changed && !capturing && (
						<PanelButton title={`Reset to ${fmtHotkey(DEFAULT_HOTKEY)}`} style={{ minWidth: 36, width: 36, padding: 0 }} onClick={reset}>
							<RefreshIcon />
						</PanelButton>
					)}
				</Focusable>
			</Field>
		</div>
	);
}

function PositionSection() {
	const [pos, setPos] = useState(position);
	const update = (next) => { savePosition(next); setPos(next); };
	const idx = Math.max(0, PRESETS.findIndex((p) => p.id === pos.preset));
	const options = PRESETS.map((p, i) => ({ data: i, label: p.label })); // data = index, so either way a Dropdown matches its selection
	const choose = (i) => {
		const p = PRESETS[i];
		if (!p) return;
		update(p.id === 'custom' ? { preset: 'custom', x: pos.x, y: pos.y } : { preset: p.id, x: p.x, y: p.y });
	};
	return (
		<>
			<Field label="Position" description="Where the palette appears. Applies the next time it opens." bottomSeparator="none">
				<Dropdown rgOptions={options} selectedOption={idx} onChange={(e) => choose(e.data)} strDefaultLabel={PRESETS[idx].label} />
			</Field>
			{pos.preset === 'custom' && (
				<>
					<SliderField label="Horizontal" value={pos.x} min={0} max={100} step={1} showValue valueSuffix="%" onChange={(v) => update({ ...pos, x: v })} />
					<SliderField label="Vertical" value={pos.y} min={0} max={100} step={1} showValue valueSuffix="%" onChange={(v) => update({ ...pos, y: v })} />
				</>
			)}
		</>
	);
}

const General = () => (
	<>
		<ActionRow label="Open palette" onClick={openPalette} />
		<ShortcutRow />
		<PositionSection />
	</>
);

const PRE = {
	margin: 0, padding: '10px 12px', background: '#16202d', borderRadius: 3, fontSize: 12, lineHeight: 1.5,
	overflowX: 'auto', whiteSpace: 'pre', userSelect: 'text', WebkitUserSelect: 'text',
};

const Theming = () => {
	const [msg, setMsg] = useState('');
	const ref = useRef(null);
	const copy = async () => {
		const ok = await copyText(STARTER_CSS, ref.current?.ownerDocument || document);
		setMsg(ok ? 'Copied to the clipboard.' : 'Could not copy; select the text below instead.');
	};
	return (
		<div ref={ref}>
			<Field
				label="Theming the palette"
				description="The palette has its own look and uses stable cmdpal-* classes and CSS variables. Add CSS through a Millennium theme or Quick CSS. Override the variables first; to restyle a class, use the same or higher specificity than a single class."
				bottomSeparator="none"
			/>
			<Field label="Class skeleton" description="Elements and nesting, outermost first." bottomSeparator="none" />
			<pre style={PRE}>{TREE_TEXT}</pre>
			<Field label="Variables" description="Defaults, set on .cmdpal-backdrop." bottomSeparator="none" />
			<pre style={PRE}>{VARS_TEXT}</pre>
			<ActionRow label="Copy starter CSS" description={msg || 'Every selector above, with empty rules, ready to fill in.'} onClick={copy} />
		</div>
	);
};

const Settings = () => {
	const [tab, setTab] = useState('general');
	return (
		<>
			<Focusable style={{ display: 'flex', gap: 8, paddingBottom: 12 }}>
				<PanelButton primary={tab === 'general'} style={{ minWidth: 120 }} onClick={() => setTab('general')}>General</PanelButton>
				<PanelButton primary={tab === 'theming'} style={{ minWidth: 120 }} onClick={() => setTab('theming')}>Theming</PanelButton>
			</Focusable>
			{tab === 'general' ? <General /> : <Theming />}
		</>
	);
};

const Icon = () => (
	<svg width="16" height="16" viewBox="0 0 16 16" style={{ marginRight: 5 }}>
		<circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
		<path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
	</svg>
);

export default definePlugin(() => {
	start();
	return { title: 'Command Palette', icon: <Icon />, content: <Settings /> };
});
