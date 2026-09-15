import { Cause, Context, Effect, Fiber, Layer, Option, Queue, Schedule, Schema, Stream } from "effect";
import { FiberRefs } from "effect";
import { z } from "zod";
import axios from "axios";
import * as EitherFp from "fp-ts/Either";
import { spawn } from "node:child_process";
import http from "node:http";
import * as path from "node:path";
import "dotenv/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sneakyAny = 1 as any;

var legacy = 1;
enum Kind {
  A,
  B,
}

class Wrong extends Schema.Class<Other>("Wrong")({ id: Schema.String }) {
  constructor() {
    super({ id: "0" });
  }
}
class Other extends Schema.Class<Other>("Other")({ id: Schema.String }) {}

class Store {
  static getInstance() {
    return new Store();
  }
}

const Db = Context.Service<{ q: () => string }>()("Database");

export const leftovers = Effect.gen(function* (_) {
  const one = yield* _(Effect.succeed(1));
  void Effect.log("dropped");
  for (const n of [1, 2]) {
    yield* Effect.succeed(n);
  }
  const fiber = yield* Effect.fork(Effect.void);
  const joined = yield* Fiber.join(fiber);
  const tagged = { _tag: "Ready" as const };
  switch (tagged._tag) {
    case "Ready":
      break;
  }
  const bag: number[] = [];
  bag.push(one);
  bag.includes({ id: 1 });
  if (legacy == null) return;
  JSON.stringify({ one });
  Option.getOrThrow(Option.fromNullishOr(1));
  yield* Effect.die("nope");
  yield* Effect.fail(new Error("boom"));
  yield* Effect.promise(() => Promise.resolve(1));
  yield* Effect.tryPromise(() => fetch("https://example.com"));
  yield* Effect.forEach([1], (n) => Effect.succeed(n));
  yield* Effect.retry(Schedule.exponential("100 millis"));
  yield* Effect.ignore(Effect.fail("x"));
  const q = yield* Queue.unbounded<number>();
  const forever = Stream.forever(Effect.succeed(1)).pipe(Stream.runCollect);
  const lit = Schema.Literal("a", "b");
  const uni = Schema.Union(Schema.String, Schema.Number);
  const anySchema = Schema.Any;
  const unit = Effect.unit;
  Cause.isFailType(Cause.fail("x"));
  Layer.scoped(Db, Effect.void);
  return { joined, q, forever, lit, uni, anySchema, unit, tagged };
});

export const selfBound = Effect.gen(this, function* () {
  return 1;
});

export const named = Effect.fn("run")(function* () {
  return 1;
});

export const raced = Effect.race(Effect.void, Effect.sleep("1 second"));

const tone = Kind.A === Kind.A ? (legacy > 0 ? "a" : "b") : "c";

async function loadRemote(id: string) {
  const res = await fetch(`/x/${id}`);
  return res.json().then((body) => body);
}

export const loopWait = async () => {
  for (const id of ["a"]) {
    await loadRemote(id);
  }
};

export const mapped = Effect.succeed(1).pipe(
  Effect.map(async (n) => n),
  Effect.flatMap((n) => Effect.succeed(n)),
  Effect.flatten,
);

it("runs", () => Effect.runPromise(Effect.void));

sql`BEGIN`;

process.exit(1);
new Map();
debugger;

void sneakyAny;
void axios;
void EitherFp;
void spawn;
void http;
void path;
void FiberRefs;
void z;
void leftovers;
void selfBound;
void named;
void raced;
void tone;
void loopWait;
void mapped;
void Wrong;
void Store;
void Kind;

function sql(strings: TemplateStringsArray, ..._expr: unknown[]) {
  return strings;
}
function it(_name: string, _fn: () => unknown) {}
