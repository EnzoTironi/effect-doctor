import { Config, Context, Effect, Layer, Schema } from "effect";

class Db extends Context.Service<Db, { readonly ping: () => string }>()("Db") {}

const User = Schema.Struct({ id: Schema.String });
const decodeUser = Schema.decodeUnknownEffect(User);

export const program = Effect.gen(function* () {
  const token = yield* Config.redacted("TOKEN");
  const user = yield* decodeUser({ id: "1" });
  yield* Effect.log("ok").pipe(Effect.annotateLogs({ id: user.id }));
  const n = yield* Effect.all([Effect.succeed(1), Effect.succeed(2)], {
    concurrency: 2,
  });
  return { token, n, db: Db };
});

const AppLayer = Layer.empty;

export const main = program.pipe(Effect.provide(AppLayer));

export const run = () => Effect.runPromise(main);
