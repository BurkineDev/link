/**
 * `scheduleAfterResponse` : dans une route, la tâche passe par `after()` de
 * Next (l'invocation reste vivante après la réponse) ; hors contexte de
 * requête, elle s'exécute tout de suite, sans jamais lever.
 */
let _afterImpl: (cb: () => unknown) => void = () => {
  throw new Error("`after` was called outside a request scope");
};

jest.mock("next/server", () => ({
  after: (cb: () => unknown) => _afterImpl(cb),
}));

import { scheduleAfterResponse } from "@/lib/after-response";

const tick = () => new Promise((r) => setTimeout(r, 0));

it("exécute la tâche immédiatement hors contexte de requête", async () => {
  const done: string[] = [];
  scheduleAfterResponse(async () => { done.push("ran"); }, () => {});
  await tick();
  expect(done).toEqual(["ran"]);
});

it("route l'erreur vers onError sans la propager", async () => {
  const errors: unknown[] = [];
  expect(() =>
    scheduleAfterResponse(async () => { throw new Error("boom"); }, (e) => errors.push(e)),
  ).not.toThrow();
  await tick();
  expect(errors).toHaveLength(1);
});

it("passe par after() quand un contexte de requête existe", async () => {
  const scheduled: Array<() => unknown> = [];
  _afterImpl = (cb) => { scheduled.push(cb); };
  const done: string[] = [];
  scheduleAfterResponse(async () => { done.push("ran"); }, () => {});
  expect(scheduled).toHaveLength(1);
  expect(done).toEqual([]);
  await scheduled[0]();
  expect(done).toEqual(["ran"]);
});
