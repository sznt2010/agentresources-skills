# Quickstart — browser-control

```ts
const open = await dispatcher.dispatch({
  kind: "browser.open",
  input: { url: "https://news.ycombinator.com" },
});

const titles = await dispatcher.dispatch({
  kind: "browser.scrape",
  input: { page_id: open.output.page_id, selector: ".titleline" },
});
```

Build the runtime with `--build-arg WITH_BROWSER=1` to include Playwright.
