import * as Alchemy from "alchemy";
import * as Effect from "effect";

const cloudflareToken = "cf_abcdefghijklmnopqrstuvwxyz123456";

export const stack = Alchemy.Stack(
  "Bad",
  { state: { memory: true } },
  Effect.gen(function* () {
    return { cloudflareToken };
  }),
);
