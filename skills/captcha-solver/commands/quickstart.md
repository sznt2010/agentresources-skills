# Quickstart — captcha-solver

```ts
const result = await dispatcher.dispatch({
  kind: "captcha.solve",
  input: {
    type: "image",
    url: "https://example.com/login",
    sitekey: "6Lc...",
    image_base64: "<png bytes>",
  },
});

// result.output.solution — owner-pasted text
```

**Note:** every call escalates to the owner. There is no automated solver
backend at launch (D40, deferred to Phase 17+).
