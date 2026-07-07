import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DRAGONROUTER_BASE_URL,
  resolveDragon RouterBaseUrl,
} from "../../src/shared/utils/resolveDragon RouterBaseUrl.ts";

test("resolveDragon RouterBaseUrl prefers DRAGONROUTER_BASE_URL", () => {
  assert.equal(
    resolveDragon RouterBaseUrl({
      DRAGONROUTER_BASE_URL: "https://internal.example.com/",
      BASE_URL: "https://base.example.com",
      NEXT_PUBLIC_BASE_URL: "https://public.example.com",
    }),
    "https://internal.example.com"
  );
});

test("resolveDragon RouterBaseUrl falls back to BASE_URL", () => {
  assert.equal(
    resolveDragon RouterBaseUrl({
      BASE_URL: "https://base.example.com/",
      NEXT_PUBLIC_BASE_URL: "https://public.example.com",
    }),
    "https://base.example.com"
  );
});

test("resolveDragon RouterBaseUrl falls back to NEXT_PUBLIC_BASE_URL", () => {
  assert.equal(
    resolveDragon RouterBaseUrl({
      NEXT_PUBLIC_BASE_URL: "https://public.example.com/",
    }),
    "https://public.example.com"
  );
});

test("resolveDragon RouterBaseUrl ignores blank values", () => {
  assert.equal(
    resolveDragon RouterBaseUrl({
      DRAGONROUTER_BASE_URL: "   ",
      BASE_URL: "",
      NEXT_PUBLIC_BASE_URL: " https://public.example.com/ ",
    }),
    "https://public.example.com"
  );
});

test("resolveDragon RouterBaseUrl uses the default localhost fallback", () => {
  assert.equal(resolveDragon RouterBaseUrl({}), DEFAULT_DRAGONROUTER_BASE_URL);
});
