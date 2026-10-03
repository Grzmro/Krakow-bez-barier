---
name: playwright-cli
description: Automate browser interactions, test web pages and work with Playwright tests.
allowed-tools: Bash(npx playwright cli:*) Bash(npx playwright:*)
---

# Browser Automation with playwright-cli

> **In this repo:** vendored from `playwright-core` (matches the installed `@playwright/test`). Run it as
> `npx playwright cli <command>` from `apps/web` — there is no global `playwright-cli` binary. Use a
> session per worktree (`-s=<task id>`) so parallel agents don't share a browser, and point it at
> your worktree's dev server, never another agent's.

## Quick start

```bash
# open new browser
npx playwright cli open
# navigate to a page
npx playwright cli goto https://playwright.dev
# interact with the page using refs from the snapshot
npx playwright cli click e15
npx playwright cli type "page.click"
npx playwright cli press Enter
# take a screenshot (rarely used, as snapshot is more common)
npx playwright cli screenshot
# close the browser
npx playwright cli close
```

## Commands

### Core

```bash
npx playwright cli open
# open and navigate right away
npx playwright cli open https://example.com/
npx playwright cli goto https://playwright.dev
npx playwright cli type "search query"
npx playwright cli click e3
npx playwright cli dblclick e7
# --submit presses Enter after filling the element
npx playwright cli fill e5 "user@example.com"  --submit
npx playwright cli drag e2 e8
# drop files or data onto an element (from outside the page)
npx playwright cli drop e4 --path=./image.png
npx playwright cli drop e4 --data="text/plain=hello world"
npx playwright cli hover e4
npx playwright cli select e9 "option-value"
npx playwright cli upload ./document.pdf
npx playwright cli check e12
npx playwright cli uncheck e12
npx playwright cli snapshot
# search the snapshot for text or a regexp, returns matching nodes with surrounding context
npx playwright cli find "Sign in"
npx playwright cli find --regex "Sign (in|up)"
# wrap the regexp in slashes to add flags, e.g. /i for case-insensitive
npx playwright cli find --regex "/sign (in|up)/i"
npx playwright cli eval "document.title"
npx playwright cli eval "el => el.textContent" e5
# get element id, class, or any attribute not visible in the snapshot
npx playwright cli eval "el => el.id" e5
npx playwright cli eval "el => el.getAttribute('data-testid')" e5
npx playwright cli dialog-accept
npx playwright cli dialog-accept "confirmation text"
npx playwright cli dialog-dismiss
npx playwright cli resize 1920 1080
npx playwright cli close
```

### Navigation

```bash
npx playwright cli go-back
npx playwright cli go-forward
npx playwright cli reload
```

### Keyboard

```bash
npx playwright cli press Enter
npx playwright cli press ArrowDown
npx playwright cli keydown Shift
npx playwright cli keyup Shift
```

### Mouse

```bash
npx playwright cli mousemove 150 300
npx playwright cli mousedown
npx playwright cli mousedown right
npx playwright cli mouseup
npx playwright cli mouseup right
npx playwright cli mousewheel 0 100
```

### Save as

```bash
npx playwright cli screenshot
npx playwright cli screenshot e5
npx playwright cli screenshot --filename=page.png
npx playwright cli screenshot --hires
npx playwright cli pdf --filename=page.pdf
```

### Tabs

```bash
npx playwright cli tab-list
npx playwright cli tab-new
npx playwright cli tab-new https://example.com/page
npx playwright cli tab-close
npx playwright cli tab-close 2
npx playwright cli tab-select 0
```

### Storage

```bash
npx playwright cli state-save
npx playwright cli state-save auth.json
npx playwright cli state-load auth.json

# Cookies
npx playwright cli cookie-list
npx playwright cli cookie-list --domain=example.com
npx playwright cli cookie-get session_id
npx playwright cli cookie-set session_id abc123
npx playwright cli cookie-set session_id abc123 --domain=example.com --httpOnly --secure
npx playwright cli cookie-delete session_id
npx playwright cli cookie-clear

# LocalStorage
npx playwright cli localstorage-list
npx playwright cli localstorage-get theme
npx playwright cli localstorage-set theme dark
npx playwright cli localstorage-delete theme
npx playwright cli localstorage-clear

# SessionStorage
npx playwright cli sessionstorage-list
npx playwright cli sessionstorage-get step
npx playwright cli sessionstorage-set step 3
npx playwright cli sessionstorage-delete step
npx playwright cli sessionstorage-clear
```

### Network

```bash
npx playwright cli route "**/*.jpg" --status=404
npx playwright cli route "https://api.example.com/**" --body='{"mock": true}'
npx playwright cli route-list
npx playwright cli unroute "**/*.jpg"
npx playwright cli unroute
```

### DevTools

```bash
npx playwright cli console
npx playwright cli console warning
npx playwright cli requests
npx playwright cli request 5
npx playwright cli run-code "async page => await page.context().grantPermissions(['geolocation'])"
npx playwright cli run-code --filename=script.js
npx playwright cli tracing-start
npx playwright cli tracing-stop

# record user actions in the browser, print them as Playwright code on stop
npx playwright cli recording-start
npx playwright cli recording-stop

npx playwright cli video-start video.webm
npx playwright cli video-chapter "Chapter Title" --description="Details" --duration=2000
npx playwright cli video-stop

# annotate each subsequent action (click, type, ...) with a callout naming the action and highlighting the target
npx playwright cli video-show-actions --duration=600 --position=top-right
npx playwright cli video-hide-actions

# launch the dashboard for UI review / design feedback — user annotates the page, you receive the annotated screenshot, snapshot, and notes
npx playwright cli show --annotate

# generate a Playwright locator for an element from its ref or selector
npx playwright cli generate-locator e5 --raw

# show a persistent highlight overlay for an element, optionally with a custom style
npx playwright cli highlight e5
npx playwright cli highlight e5 --style="outline: 3px dashed red"
# hide a single element highlight, or all page highlights when no target is given
npx playwright cli highlight e5 --hide
npx playwright cli highlight --hide
```

## Raw output

The global `--raw` option strips page status, generated code, and snapshot sections from the output, returning only the result value. Use it to pipe command output into other tools. Commands that don't produce output return nothing.

```bash
npx playwright cli --raw eval "JSON.stringify(performance.timing)" | jq '.loadEventEnd - .navigationStart'
npx playwright cli --raw eval "JSON.stringify([...document.querySelectorAll('a')].map(a => a.href))" > links.json
npx playwright cli --raw snapshot > before.yml
npx playwright cli click e5
npx playwright cli --raw snapshot > after.yml
diff before.yml after.yml
TOKEN=$(playwright-cli --raw cookie-get session_id)
npx playwright cli --raw localstorage-get theme
```

For structured output wrapping every reply as JSON, pass --json
```bash
npx playwright cli list --json
```

## Open parameters
```bash
# Use specific browser when creating session
npx playwright cli open --browser=chrome
npx playwright cli open --browser=firefox
npx playwright cli open --browser=webkit
npx playwright cli open --browser=msedge

# Emulate a generic mobile device (Pixel 10 for Chromium, iPhone 17 for WebKit).
# Prefer this when a mobile layout is acceptable: mobile pages are usually
# lighter, so snapshots are smaller and cheaper.
npx playwright cli open --mobile
npx playwright cli open --device="iPhone 15"

# Use persistent profile (by default profile is in-memory)
npx playwright cli open --persistent
# Use persistent profile with custom directory
npx playwright cli open --profile=/path/to/profile

# Connect to browser via Playwright Extension
npx playwright cli attach --extension=chrome

# Connect to a running Chrome or Edge by channel name
npx playwright cli attach --cdp=chrome
npx playwright cli attach --cdp=msedge

# Connect to a running browser via CDP endpoint
npx playwright cli attach --cdp=http://localhost:9222

# Start with config file
npx playwright cli open --config=my-config.json

# Close the browser
npx playwright cli close
# Detach from an attached browser (leaves the external browser running)
npx playwright cli -s=msedge detach
# Delete user data for the default session
npx playwright cli delete-data
```

## URLs with `&` on Windows

On Windows, `cmd.exe` and PowerShell treat `&` as a command separator, so URLs with multiple query parameters get truncated before `playwright-cli` runs. Escape `&` with `^&` in `cmd.exe`, or use `--%` in PowerShell:

```batch
npx playwright cli goto "https://example.com/?a=1^&b=2"
```

```powershell
npx playwright cli --% goto "https://example.com/?a=1&b=2"
```

## Snapshots

After each command, playwright-cli provides a snapshot of the current browser state.

```bash
> playwright-cli goto https://example.com
### Page
- Page URL: https://example.com/
- Page Title: Example Domain
### Snapshot
[Snapshot](.playwright-cli/page-2026-02-14T19-22-42-679Z.yml)
```

You can also take a snapshot on demand using `npx playwright cli snapshot` command. All the options below can be combined as needed.

```bash
# default - save to a file with timestamp-based name
npx playwright cli snapshot

# save to file, use when snapshot is a part of the workflow result
npx playwright cli snapshot --filename=after-click.yaml

# snapshot an element instead of the whole page
npx playwright cli snapshot "#main"

# limit snapshot depth for efficiency, take a partial snapshot afterwards
npx playwright cli snapshot --depth=4
npx playwright cli snapshot e34

# include each element's bounding box as [box=x,y,width,height]
npx playwright cli snapshot --boxes

# search a large snapshot instead of capturing it all — returns matching nodes
# with 3 lines of context around each match (like grep -C)
npx playwright cli find "Add to cart"
npx playwright cli find --regex "\\$[0-9]+\\.[0-9]{2}"
```

## Targeting elements

By default, use refs from the snapshot to interact with page elements.

```bash
# get snapshot with refs
npx playwright cli snapshot

# interact using a ref
npx playwright cli click e15
```

You can also use css selectors or Playwright locators.

```bash
# css selector
npx playwright cli click "#main > button.submit"

# role locator
npx playwright cli click "getByRole('button', { name: 'Submit' })"

# test id
npx playwright cli click "getByTestId('submit-button')"
```

## Browser Sessions

```bash
# create new browser session named "mysession" with persistent profile
npx playwright cli -s=mysession open example.com --persistent
# same with manually specified profile directory (use when requested explicitly)
npx playwright cli -s=mysession open example.com --profile=/path/to/profile
npx playwright cli -s=mysession click e6
npx playwright cli -s=mysession close  # stop a named browser
npx playwright cli -s=mysession delete-data  # delete user data for persistent session

npx playwright cli list
# Close all browsers
npx playwright cli close-all
# Forcefully kill all browser processes
npx playwright cli kill-all
```

## Installation

If global `playwright-cli` command is not available, try a local version via `npx playwright cli`:

```bash
npx --no-install playwright --version
```

When local version is available, use `npx playwright cli` in all commands. Otherwise, install `playwright-cli` as a global command:

```bash
npm install -g @playwright/cli@latest
```

## Example: Form submission

```bash
npx playwright cli open https://example.com/form
npx playwright cli snapshot

npx playwright cli fill e1 "user@example.com"
npx playwright cli fill e2 "password123"
npx playwright cli click e3
npx playwright cli snapshot
npx playwright cli close
```

## Example: Multi-tab workflow

```bash
npx playwright cli open https://example.com
npx playwright cli tab-new https://example.com/other
npx playwright cli tab-list
npx playwright cli tab-select 0
npx playwright cli snapshot
npx playwright cli close
```

## Example: Debugging with DevTools

```bash
npx playwright cli open https://example.com
npx playwright cli click e4
npx playwright cli fill e7 "test"
npx playwright cli console
npx playwright cli requests
npx playwright cli close
```

```bash
npx playwright cli open https://example.com
npx playwright cli tracing-start
npx playwright cli click e4
npx playwright cli fill e7 "test"
npx playwright cli tracing-stop
npx playwright cli close
```

## Example: Interactive session

Ask the user for UI review or design feedback. The user draws boxes on the live page and types comments; you receive the annotated screenshot, the snapshot of the marked region, and the user's notes. Use this whenever the user asks for "UI review", "design feedback", or to "ask the user what they think / want / mean":

```bash
npx playwright cli open https://example.com
npx playwright cli show --annotate
```

## Specific tasks

* **Running and Debugging Playwright tests** [references/playwright-tests.md](references/playwright-tests.md)
* **Request mocking** [references/request-mocking.md](references/request-mocking.md)
* **Running Playwright code** [references/running-code.md](references/running-code.md)
* **Browser session management** [references/session-management.md](references/session-management.md)
* **Storage state (cookies, localStorage)** [references/storage-state.md](references/storage-state.md)
* **Test generation (plan / generate / heal)** [references/test-generation.md](references/test-generation.md)
* **Tracing** [references/tracing.md](references/tracing.md)
* **Video recording** [references/video-recording.md](references/video-recording.md)
* **Inspecting element attributes** [references/element-attributes.md](references/element-attributes.md)
