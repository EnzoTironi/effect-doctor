import { Effect, Layer, Schema } from "effect";

const User = Schema.Struct({ id: Schema.String });

const leaked = "cf_examplelocalonlytoken99";

let scratch = 0;

export const program = Effect.gen(function* () {
  scratch += 1;
  try {
    const user = Schema.decodeUnknownSync(User)({ id: "1" });
    const data = JSON.parse("{\"ok\":true}");
    const envToken = process.env.TOKEN;
    console.log(envToken, data);
    const res = yield fetch("https://example.com");
    const both = Promise.all([Promise.resolve(1)]);
    const p = new Promise((resolve) => resolve(1));
    Effect.log("floating");
    const ran = Effect.runPromise(Effect.succeed(user));
    Date.now();
    Math.random();
    setTimeout(() => undefined, 0);
    return Effect.succeed({ ran, res, both, p, leaked });
  } catch (_err) {
    return Effect.fail("nope");
  }
});

Effect.succeed(1);

const syncPromise = Effect.sync(async () => 1);

const provided = program.pipe(Effect.provide(Layer.empty), Effect.provide(Layer.empty));

const sneaky = program as unknown as never;

void leaked;
void syncPromise;
void provided;
void sneaky;

Effect.runPromise(program);
