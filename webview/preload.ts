// @ts-nocheck
// Runs inside Steam's web views: the store, community, profile and market pages.
// Key presses there never reach the main Steam window, so the palette shortcut is caught here and
// forwarded to the plugin (frontend/index.tsx: togglePalette), which opens the palette in a Steam menu.

const LOG = '[palette-web]';
let hk = { ctrl: true, alt: false, shift: false, meta: false, key: 'k' }; // replaced by the saved shortcut once read

const norm = (k) => (k === ' ' ? 'space' : String(k).toLowerCase());

async function readHotkey() {
	try {
		let r = await frontend.getHotkey();
		if (typeof r === 'string') r = JSON.parse(r);
		if (r && typeof r.key === 'string') hk = r;
	} catch (e) {
		console.warn(LOG, 'could not read the shortcut, using Ctrl+K', e);
	}
}

function matches(e) {
	return !!e.key && !!e.ctrlKey === !!hk.ctrl && !!e.altKey === !!hk.alt && !!e.shiftKey === !!hk.shift
		&& !!e.metaKey === !!hk.meta && norm(e.key) === hk.key;
}

export default async function main() {
	if (window.top !== window) return; // pages inside frames are not the page
	await readHotkey();
	window.addEventListener('focus', readHotkey); // picks up a shortcut changed in the settings
	window.addEventListener('keydown', (e) => {
		if (!(e.ctrlKey || e.altKey || e.metaKey || /^F\d{1,2}$/.test(e.key))) return; // every shortcut needs one of these
		if (!matches(e)) return;
		e.preventDefault();
		e.stopPropagation();
		if (e.repeat) return;
		try { frontend.togglePalette(); } catch (err) { console.warn(LOG, 'could not reach the palette', err); }
	}, true);
	console.log(LOG, 'shortcut ready on', location.host);
}
