import { Context, Effect, Option } from "effect";
import { HttpClient } from "@effect/platform";

export const recovered = Effect.fail("x").pipe(Effect.catchAll(() => Effect.succeed("ok")));

export const fiber = Effect.fork(Effect.void);

export const maybe = Option.fromNullable(1);

export class Db extends Context.Tag("Db")<Db, { readonly q: () => string }>() {}

export const client = HttpClient;

void recovered;
void fiber;
void maybe;
void client;
