# Command Palette

A command palette for the Steam client, as a [Millennium](https://steambrew.app) plugin. Press **Ctrl+K** (changeable) and a search box opens:

- type to fuzzy-search your library (including non-Steam games) and launch a game with Enter, with game icons
- jump to Steam and community pages: Library, Store, Downloads, Friends, Community, Profile, Inventory, Market, Trade offers, Badges, Workshop, Discussions, Points Shop, Wishlist, Cart, News, Account details, Add funds, Support, Settings, and more
- run actions: set your status, open the Steam console, open the Millennium Library Manager; `>` shows only actions
- search the store: `s ` shows only store results, with prices in your Steam store region. Games you already own open your library page instead

The plugin's settings has an "Open palette" button, a shortcut editor (a Change button, plus a reset icon that appears once the shortcut differs from Ctrl+K), a Position setting (presets, or custom horizontal and vertical sliders) and a Theming tab. A shortcut needs Ctrl, Alt or Meta, or an F-key on its own.

## Install
Grab `steam-command-palette.star` from [Releases](../../releases) (or build it, below) and copy it into Millennium's plugins folder (`<Steam>\millennium\plugins\` on Windows, `~/.local/share/millennium/plugins/` on Linux). Enable it under Millennium, Plugins, and restart Steam if asked.

## How it opens
The palette opens as a Steam menu window (Millennium's `showContextMenu`).
- Steam draws store/community/profile pages as browser views over the main window, so a panel inside the main window is hidden behind them. A menu window shows above them.
- Key presses on those pages never reach the main window, so `webview/preload.ts` (the web view script) catches the shortcut there and forwards it to the plugin.
The palette keeps its own look (it does not pick up Steam's menu styling). If a Steam menu can't be opened it falls back to an overlay in the main window, then to a pop-out modal.

## Theming
The palette keeps its own look and uses stable `cmdpal-*` classes and CSS variables (`--cmdpal-accent`, `--cmdpal-selected-bg`, ...). The plugin's settings has a Theming tab with the class skeleton, the variable list and a "Copy starter CSS" button. Add your CSS through a Millennium theme or Quick CSS.

## Notes
- Library comes from Steam's in-memory app store; the settings panel shows how many games were found.
- Store search tries a direct fetch first, then a Lua backend that runs hidden `curl` (the backend only accepts URL-encoded terms).
- The saved shortcut is kept in the browser's local storage.
- Logs use the `[palette]` prefix (Steam DevTools console / Millennium logs).

## Building
A Starlight project. Needs Millennium 3.5.0 or newer and Bun 1.4.3 or newer.

    bun install
    bun run build

`output_path = "auto"` installs `steam-command-palette.star` into Millennium. `bun run dev` makes backend calls time out; test with the built plugin.

## Files
- `frontend/index.tsx`: the palette, its settings and the Theming tab
- `backend/rpc_functions.lua`: store search through a hidden `curl` process
- `backend/main.lua`: plugin lifecycle
- `webview/preload.ts`: catches the shortcut on store and community pages, which never reach the main window
- `millennium.toml`: plugin manifest

## License
MIT

## Changelog
- 0.7.0: opens as a Steam menu window (shows above store/community pages); shortcut now also works on store/community/profile/market pages (web view script); many more page commands (Community, Profile, Inventory, Market, Trade offers, Badges, Workshop, Discussions, Points Shop, Cart, News, Account details, Add funds, Support). Overlay kept as a fallback.
- 0.6.0: tidied General settings (reset is now an icon shown only when the shortcut was changed; removed the library/store info rows); added a Position setting with presets and custom sliders (`--cmdpal-x` / `--cmdpal-y`, plus `--cmdpal-inset`, `--cmdpal-w`, `--cmdpal-h` variables).
- 0.5.1: non-Steam games added to the library search (launched with their 64-bit game id; shown as letter tiles marked "Non-Steam"); library read from the app store and the library collections together; recent list also uses local play time. (0.5.0 shipped without this code by mistake.)
- 0.4.1: overlay restyled to match Steam's dialog look (fixed 640x480 panel, dialog background, lighter dim layer, larger light-weight text).
- 0.4.0: the palette now opens as an overlay inside the main Steam window (no second window, no close button or empty strip); Esc, clicking outside it, or pressing the shortcut again closes it. Falls back to the old pop-out modal if the overlay can't be created. Theming classes updated (`.cmdpal-backdrop` added, variables now set there).
- 0.3.1: icon fallbacks no longer log a warning per failed URL; only logs when no icon is found at all.
- 0.3.0: Theming tab in settings (class skeleton, variables, starter CSS); palette styling moved from inline styles to `cmdpal-*` classes.
- 0.2.2: extra icon URL fallbacks (newer Steam image host); removed modal-structure debug logging.
- 0.2.1: store prices now use the user's Steam store country (SteamClient.User.GetIPCountry), falling back to automatic.
- 0.2.0: first mini release. Removed the "Millennium settings" action (could not be made to work); "Millennium Library Manager" action kept.
