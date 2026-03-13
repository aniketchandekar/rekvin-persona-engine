# Playwright Reference Guide — Synthetic UI Agents

> Focused on the APIs that matter for an autonomous agent navigating and interacting with a webpage.

---

## Table of Contents

1. [The Agent Loop](#the-agent-loop)
2. [Reading Page State](#reading-page-state)
3. [Locators — Finding Elements](#locators--finding-elements)
4. [Acting on Elements](#acting-on-elements)
5. [Page Navigation](#page-navigation)
6. [Waiting Strategies](#waiting-strategies)
7. [Screenshots](#screenshots)
8. [Keyboard](#keyboard)
9. [Event Handling](#event-handling)
10. [Frames & iFrames](#frames--iframes)

---

## The Agent Loop

Every synthetic agent repeats this core cycle:

```
1. Read page state  →  screenshot or DOM
2. Decide what to do
3. Find the element  →  locator
4. Act on it  →  click / fill / press
5. Wait for the UI to respond
6. Repeat
```

The sections below map directly to each step.

---

## Reading Page State

Before the agent can decide what to do, it needs to understand the current state of the page.

### Get the full HTML

```typescript
const html = await page.content();
```

Useful for passing the DOM to an LLM to reason about structure.

### Get visible text only

```typescript
const text = await page.innerText('body');
```

Much shorter than full HTML — good for agents that only need readable content.

### Evaluate JavaScript in the page

```typescript
// Run any JS expression and get the result back
const title = await page.evaluate(() => document.title);
const url = await page.evaluate(() => window.location.href);

// Extract structured data from the page
const links = await page.evaluate(() =>
  Array.from(document.querySelectorAll('a')).map(a => ({
    text: a.innerText,
    href: a.href,
  }))
);

// Check custom app state
const isLoggedIn = await page.evaluate(() => window.__user !== undefined);
```

### Get current URL and title

```typescript
const url = page.url();
const title = await page.title();
```

Lightweight checks to confirm where the agent currently is.

---

## Locators — Finding Elements

Locators are the agent's primary way to find elements. Always prefer locators that mirror what a real user sees — not CSS classes or IDs, which are implementation details.

### Recommended order of preference

```typescript
// 1. By ARIA role — most resilient, mirrors what users see
page.getByRole('button', { name: 'Submit' })
page.getByRole('link', { name: 'Sign in' })
page.getByRole('heading', { name: 'Dashboard' })
page.getByRole('textbox', { name: 'Email' })
page.getByRole('checkbox', { name: 'Remember me' })
page.getByRole('combobox', { name: 'Country' })
page.getByRole('menuitem', { name: 'Settings' })

// 2. By label — great for form inputs
page.getByLabel('Password')
page.getByLabel('Search')

// 3. By placeholder text
page.getByPlaceholder('Enter your email')

// 4. By visible text content
page.getByText('Welcome back')
page.getByText('Continue', { exact: true })
page.getByText(/error/i)               // regex match

// 5. By alt text — for images and icons
page.getByAltText('User avatar')

// 6. By title attribute
page.getByTitle('Close')

// 7. By test id — if the app exposes them
page.getByTestId('submit-btn')         // looks for data-testid attribute

// 8. CSS / XPath — last resort only
page.locator('.nav-menu > li:first-child')
page.locator('xpath=//button[@type="submit"]')
```

### Filtering when multiple elements match

```typescript
// Filter by text
page.getByRole('listitem').filter({ hasText: 'Order #1042' })

// Filter by a nested element
page.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Edit' }) })

// Exclude items
page.getByRole('listitem').filter({ hasNotText: 'Cancelled' })

// Chain locators to narrow scope
page.getByRole('navigation').getByRole('link', { name: 'Home' })
page.getByRole('form', { name: 'Login' }).getByLabel('Email')
```

### Selecting among multiple matches

```typescript
locator.first()       // first match
locator.last()        // last match
locator.nth(2)        // 0-indexed

const count = await locator.count();          // how many matched
const all = await locator.all();              // array of Locators for iteration
```

### Checking if an element exists before acting

```typescript
const isVisible = await page.getByRole('button', { name: 'Accept' }).isVisible();
if (isVisible) {
  await page.getByRole('button', { name: 'Accept' }).click();
}

// Or use count
const cookieBanner = page.getByText('Accept cookies');
if (await cookieBanner.count() > 0) {
  await cookieBanner.click();
}
```

---

## Acting on Elements

Once the agent has found an element, these are the actions it can take.

### Clicking

```typescript
await locator.click();
await locator.click({ button: 'right' });          // right-click
await locator.click({ modifiers: ['Shift'] });     // shift-click
await locator.click({ modifiers: ['Control'] });   // ctrl-click
await locator.dblclick();
```

### Filling forms

```typescript
// Recommended for inputs — clears existing value first
await locator.fill('user@example.com');

// Clear an input
await locator.clear();

// Select a dropdown option
await locator.selectOption('value');
await locator.selectOption({ label: 'United States' });
await locator.selectOption(['option1', 'option2']);  // multi-select

// Check / uncheck
await locator.check();
await locator.uncheck();
```

### Reading state before acting

```typescript
await locator.isVisible()    // is it on screen?
await locator.isEnabled()    // is it interactive?
await locator.isDisabled()   // is it greyed out?
await locator.isChecked()    // is checkbox/radio checked?
await locator.isEditable()   // can it be typed into?
await locator.textContent()  // raw text (including hidden)
await locator.innerText()    // visible text only
await locator.inputValue()   // current value of an input
await locator.getAttribute('href')
```

### Scrolling

```typescript
await locator.scrollIntoViewIfNeeded();   // scroll until element is visible
```

---

## Page Navigation

```typescript
// Navigate to a URL
await page.goto('https://example.com');

// Control when to consider navigation done
await page.goto('https://example.com', { waitUntil: 'load' });
// Options: 'load' (default), 'domcontentloaded', 'networkidle', 'commit'
// For SPAs, 'networkidle' is often most reliable

// Go back / forward
await page.goBack();
await page.goForward();

// Reload
await page.reload();

// Check current location
const url = page.url();
const title = await page.title();
```

---

## Waiting Strategies

This is critical for autonomous agents. Never use fixed `waitForTimeout` — always wait for a meaningful condition.

### Wait for navigation / URL change

```typescript
// Wait for URL to match after a click
await page.waitForURL('**/dashboard');
await page.waitForURL(/checkout/);
await page.waitForURL('https://example.com/success', { waitUntil: 'networkidle' });
```

### Wait for an element to appear

```typescript
// Wait for element to exist in DOM
await page.waitForSelector('.modal');

// Wait for element to be visible (preferred)
await page.waitForSelector('.modal', { state: 'visible' });

// Wait for element to disappear
await page.waitForSelector('.loading-spinner', { state: 'hidden' });
await page.waitForSelector('.loading-spinner', { state: 'detached' });
```

### Wait for page load state

```typescript
await page.waitForLoadState('load');             // HTML and resources loaded
await page.waitForLoadState('domcontentloaded'); // HTML parsed
await page.waitForLoadState('networkidle');      // no network requests for 500ms
```

### Wait for a network response

```typescript
// Wait for a specific API call to complete
const response = await page.waitForResponse('**/api/user');
const data = await response.json();

// Trigger action and wait for response simultaneously
const [response] = await Promise.all([
  page.waitForResponse('**/api/submit'),
  page.getByRole('button', { name: 'Submit' }).click(),
]);
```

### Wait for a custom condition

```typescript
// Wait until arbitrary JS expression is true
await page.waitForFunction(() => document.querySelectorAll('.item').length > 0);
await page.waitForFunction(() => window.__appReady === true);

// With a timeout
await page.waitForFunction(() => window.__loaded, { timeout: 10_000 });
```

### Timeouts

```typescript
// Set default timeout for all actions (ms)
page.setDefaultTimeout(30_000);

// Set default navigation timeout
page.setDefaultNavigationTimeout(60_000);
```

---

## Screenshots

Essential for vision-capable agents — gives the agent a literal picture of the current state.

```typescript
// Capture the visible viewport
const buffer = await page.screenshot();

// Save to file
await page.screenshot({ path: 'state.png' });

// Full page (scrolls and stitches)
await page.screenshot({ path: 'full.png', fullPage: true });

// Specific region
await page.screenshot({
  path: 'region.png',
  clip: { x: 0, y: 0, width: 800, height: 400 },
});

// Screenshot of a specific element
const buffer = await page.getByRole('dialog').screenshot();
await page.locator('.chart').screenshot({ path: 'chart.png' });

// Use the buffer directly (e.g. pass to vision model)
const base64 = buffer.toString('base64');
```

---

## Keyboard

Use for actions that locators can't handle alone — shortcuts, multi-key combos, or navigating without a mouse.

```typescript
// Press a single key
await page.keyboard.press('Enter');
await page.keyboard.press('Escape');
await page.keyboard.press('Tab');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowUp');
await page.keyboard.press('Backspace');

// Key combinations
await page.keyboard.press('Control+A');   // select all
await page.keyboard.press('Control+C');   // copy
await page.keyboard.press('Control+V');   // paste
await page.keyboard.press('Shift+Tab');   // reverse tab

// Type text (fires key events — useful for autocomplete triggers)
await page.keyboard.type('search query', { delay: 50 });

// Hold and release (for multi-key workflows)
await page.keyboard.down('Shift');
await page.keyboard.press('ArrowDown');  // shift + arrow = select text
await page.keyboard.up('Shift');

// Most of the time, prefer these locator shortcuts instead:
await locator.press('Enter');
await locator.fill('text');
```

---

## Event Handling

Autonomous agents must handle unexpected UI states gracefully — popups, errors, crashes — rather than freezing.

### Console messages (catch JS errors)

```typescript
page.on('console', msg => {
  if (msg.type() === 'error') {
    console.log('Page JS error:', msg.text());
  }
});
```

### Dialogs (alert, confirm, prompt)

```typescript
// Must register handler BEFORE the action that triggers the dialog
page.on('dialog', async dialog => {
  console.log('Dialog type:', dialog.type());    // 'alert' | 'confirm' | 'prompt' | 'beforeunload'
  console.log('Dialog message:', dialog.message());

  // Accept (click OK / provide input)
  await dialog.accept();
  await dialog.accept('my input');  // for prompt dialogs

  // Dismiss (click Cancel)
  await dialog.dismiss();
});

// One-time handler (use when you expect exactly one dialog)
page.once('dialog', dialog => dialog.accept());
await page.click('#trigger-confirm');
```

### Page crash

```typescript
page.on('crash', () => {
  console.log('Page crashed — restarting agent loop');
});
```

### New popups / tabs

```typescript
// Intercept a popup before it opens
const popupPromise = page.waitForEvent('popup');
await page.click('#open-popup');
const popup = await popupPromise;
await popup.waitForLoadState();
// Now interact with popup as a regular page
await popup.getByRole('button', { name: 'Close' }).click();
```

### Page close

```typescript
page.on('close', () => {
  console.log('Page was closed');
});
```

---

## Frames & iFrames

If the page contains iframes (common with auth flows, payment widgets, chat embeds, maps), the agent must switch into the frame's context to interact with its contents.

### FrameLocator — preferred approach

Chain locators through the frame just like a regular page:

```typescript
// Select the iframe, then use normal locators inside it
const frame = page.frameLocator('iframe[name="payment"]');
await frame.getByLabel('Card number').fill('4242424242424242');
await frame.getByLabel('Expiry').fill('12/26');
await frame.getByRole('button', { name: 'Pay now' }).click();

// Target by src URL pattern
const frame = page.frameLocator('iframe[src*="stripe.com"]');

// Nested iframes
page.frameLocator('#outer-frame').frameLocator('#inner-frame').getByRole('button')
```

### Frame — when you need full page-level control

```typescript
// Get a frame by name attribute
const frame = page.frame({ name: 'checkout' });

// Get a frame by URL pattern
const frame = page.frame({ url: /billing\.example\.com/ });

// List all frames
const frames = page.frames();

// Frame supports the same methods as Page
await frame.goto('https://example.com');
await frame.fill('input', 'text');
await frame.click('button');
const text = await frame.textContent('h1');
const html = await frame.content();
await frame.screenshot({ path: 'frame.png' });
```

### Detecting iframes on the page

```typescript
// Check if any iframes exist before trying to interact
const iframeCount = await page.locator('iframe').count();

// Get all iframe src attributes
const iframeSrcs = await page.evaluate(() =>
  Array.from(document.querySelectorAll('iframe')).map(f => f.src)
);
```

---

## Quick Reference Card

| Goal | API |
|------|-----|
| Read the page DOM | `page.content()` |
| Read visible text | `page.innerText('body')` |
| Get current URL | `page.url()` |
| Take a screenshot | `page.screenshot()` |
| Navigate to URL | `page.goto(url)` |
| Find by role | `page.getByRole('button', { name })` |
| Find by label | `page.getByLabel('Email')` |
| Find by text | `page.getByText('Submit')` |
| Click an element | `await locator.click()` |
| Type into a field | `await locator.fill('text')` |
| Select a dropdown | `await locator.selectOption('value')` |
| Check if visible | `await locator.isVisible()` |
| Check if enabled | `await locator.isEnabled()` |
| Wait for URL change | `page.waitForURL('**/path')` |
| Wait for element | `page.waitForSelector('.el', { state: 'visible' })` |
| Wait for network | `page.waitForResponse('**/api/**')` |
| Wait for condition | `page.waitForFunction(() => window.ready)` |
| Handle a dialog | `page.on('dialog', d => d.accept())` |
| Interact in iframe | `page.frameLocator('iframe').getByRole(...)` |
| Run JS in page | `page.evaluate(() => ...)` |
| Press a key | `page.keyboard.press('Enter')` |

---

*Focused on the Playwright APIs most relevant to synthetic agents autonomously navigating and interacting with web UIs.*
