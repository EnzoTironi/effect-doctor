import * as Alchemy from "alchemy";
import * as Effect from "effect";

export default Alchemy.Stack(
  "App",
  {
    providers: { cloudflare: true },
    state: { memory: true },
  },
  Effect.gen(function* () {
    return { ok: true as const };
  }),
);
