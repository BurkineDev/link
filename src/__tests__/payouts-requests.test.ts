/**
 * Cycle de vie d'une demande de reversement (src/lib/payouts/requests.ts),
 * avec un double de Prisma qui rejoue le verrou et les écritures.
 */

interface PayoutRow {
  id: string;
  shopId: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  reference: string | null;
  note: string | null;
  destination: unknown;
  paidAt: Date | null;
}

let _shop: { id: string; currency: string } | null = null;
let _account: Record<string, unknown> | null = null;
let _ledger: Array<Record<string, unknown>> = [];
let _payouts: PayoutRow[] = [];
let _ledgerWrites: Array<Record<string, unknown>> = [];

const SHOP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DAY = 24 * 60 * 60 * 1000;

const decimal = (n: number) => ({
  toNumber: () => n,
  negated: () => decimal(-n),
  valueOf: () => n,
  toString: () => String(n),
});

const tx = {
  $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
    const sql = strings.join("?");
    if (sql.includes("from public.shops")) return _shop ? [_shop] : [];
    if (sql.includes("from public.payouts")) {
      return _payouts.length ? [{ id: _payouts[0]!.id }] : [];
    }
    return [];
  }),
  payoutAccount: {
    findUnique: jest.fn(async () => _account),
    updateMany: jest.fn(async ({ where }: { where: { accountIdentifier: string } }) => {
      if (_account && _account.accountIdentifier === where.accountIdentifier) {
        _account.isVerified = true;
        return { count: 1 };
      }
      return { count: 0 };
    }),
  },
  payout: {
    count: jest.fn(async ({ where }: { where: { status: { in: string[] } } }) =>
      _payouts.filter((p) => where.status.in.includes(p.status)).length),
    findMany: jest.fn(async ({ where }: { where: { status: { in: string[] } } }) =>
      _payouts.filter((p) => where.status.in.includes(p.status)).map((p) => ({ ...p, amount: decimal(p.amount) }))),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row: PayoutRow = {
        id: "pppppppp-pppp-4ppp-8ppp-pppppppppppp",
        shopId: data.shopId as string,
        amount: Number(data.amount),
        currency: data.currency as string,
        status: data.status as string,
        provider: data.provider as string,
        reference: null,
        note: null,
        destination: data.destination,
        paidAt: null,
      };
      _payouts.push(row);
      return { id: row.id };
    }),
    findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => {
      const row = _payouts.find((p) => p.id === where.id);
      if (!row) throw new Error("not found");
      return { ...row, amount: decimal(row.amount) };
    }),
    findFirst: jest.fn(async ({ where }: { where: { reference: string; id: { not: string } } }) =>
      _payouts.find((p) => p.reference === where.reference && p.id !== where.id.not) ?? null),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<PayoutRow> }) => {
      const row = _payouts.find((p) => p.id === where.id)!;
      Object.assign(row, data);
      return row;
    }),
  },
  transactionLedger: {
    findMany: jest.fn(async () => _ledger.map((row) => ({ ...row, amount: decimal(row.amount as number) }))),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      _ledgerWrites.push({ ...data, amount: Number(data.amount) });
      return data;
    }),
  },
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    payout: {
      updateMany: jest.fn(async ({ where, data }: { where: { id: string; status: string }; data: { status: string } }) => {
        const row = _payouts.find((p) => p.id === where.id && p.status === where.status);
        if (row) row.status = data.status;
        return { count: row ? 1 : 0 };
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => _payouts.find((p) => p.id === where.id) ?? null),
    },
  },
}));

import { markPayoutFailed, markPayoutPaid, markPayoutProcessing, requestPayout } from "@/lib/payouts/requests";

beforeEach(() => {
  _shop = { id: SHOP_ID, currency: "XOF" };
  _account = {
    provider: "wave",
    accountName: "Awa Traoré",
    accountIdentifier: "22670123456",
    country: "BF",
  };
  _ledger = [
    { type: "seller_net", amount: 12_000, currency: "XOF", provider: "geniuspay", createdAt: new Date(Date.now() - 5 * DAY) },
    { type: "seller_net", amount: 3_000, currency: "XOF", provider: "geniuspay", createdAt: new Date(Date.now() - 1 * DAY) },
  ];
  _payouts = [];
  _ledgerWrites = [];
});

describe("requestPayout", () => {
  test("crée la demande du disponible mûri, avec la destination figée", async () => {
    const res = await requestPayout(SHOP_ID);
    expect(res).toMatchObject({ ok: true, amount: 12_000, currency: "XOF" });
    expect(_payouts).toHaveLength(1);
    expect(_payouts[0]).toMatchObject({
      status: "requested",
      provider: "wave",
      amount: 12_000,
      destination: { provider: "wave", accountName: "Awa Traoré", accountIdentifier: "22670123456", country: "BF" },
    });
  });

  test("refuse sans compte de reversement", async () => {
    _account = null;
    expect(await requestPayout(SHOP_ID)).toEqual({ ok: false, reason: "no_account" });
    expect(_payouts).toHaveLength(0);
  });

  test("refuse une seconde demande tant que la première est ouverte", async () => {
    await requestPayout(SHOP_ID);
    const second = await requestPayout(SHOP_ID);
    expect(second).toMatchObject({ ok: false, reason: "already_open" });
    expect(_payouts).toHaveLength(1);
  });

  test("refuse sous le minimum, en disant combien est disponible", async () => {
    _ledger = [{ type: "seller_net", amount: 2_500, currency: "XOF", provider: "geniuspay", createdAt: new Date(Date.now() - 5 * DAY) }];
    expect(await requestPayout(SHOP_ID)).toEqual({
      ok: false,
      reason: "below_minimum",
      available: 2_500,
      minimum: 5_000,
      currency: "XOF",
    });
  });

  test("boutique inconnue", async () => {
    _shop = null;
    expect(await requestPayout(SHOP_ID)).toEqual({ ok: false, reason: "shop_not_found" });
  });
});

describe("markPayoutPaid / markPayoutFailed / markPayoutProcessing", () => {
  test("versé : statut, référence, date et ligne comptable négative, une seule fois", async () => {
    await requestPayout(SHOP_ID);
    const id = _payouts[0]!.id;

    const first = await markPayoutPaid(id, { reference: "WAVE-123", note: "Fait le 12/09" });
    expect(first).toEqual({ ok: true });
    expect(_payouts[0]).toMatchObject({ status: "paid", reference: "WAVE-123", note: "Fait le 12/09" });
    expect(_payouts[0]!.paidAt).toBeInstanceOf(Date);
    expect(_account?.isVerified).toBe(true);
    expect(_ledgerWrites).toEqual([
      expect.objectContaining({
        shopId: SHOP_ID,
        type: "payout",
        amount: -12_000,
        currency: "XOF",
        provider: "wave",
        reference: "WAVE-123",
        metadata: { payoutId: id },
      }),
    ]);

    const again = await markPayoutPaid(id, { reference: "WAVE-456" });
    expect(again).toEqual({ ok: false, reason: "already_settled" });
    expect(_ledgerWrites).toHaveLength(1);
  });

  test("une référence déjà utilisée par un autre reversement est refusée", async () => {
    await requestPayout(SHOP_ID);
    _payouts.push({ ..._payouts[0]!, id: "qqqqqqqq-qqqq-4qqq-8qqq-qqqqqqqqqqqq", status: "paid", reference: "WAVE-123" });
    expect(await markPayoutPaid(_payouts[0]!.id, { reference: "WAVE-123" })).toEqual({
      ok: false,
      reason: "reference_taken",
    });
  });

  test("refusé : note enregistrée, aucune ligne comptable, la somme redevient demandable", async () => {
    await requestPayout(SHOP_ID);
    const id = _payouts[0]!.id;
    expect(await markPayoutFailed(id, { note: "Numéro inexistant" })).toEqual({ ok: true });
    expect(_payouts[0]).toMatchObject({ status: "failed", note: "Numéro inexistant" });
    expect(_ledgerWrites).toHaveLength(0);

    const next = await requestPayout(SHOP_ID);
    expect(next).toMatchObject({ ok: true, amount: 12_000 });
  });

  test("prise en charge : requested → processing, puis plus possible", async () => {
    await requestPayout(SHOP_ID);
    const id = _payouts[0]!.id;
    expect(await markPayoutProcessing(id)).toEqual({ ok: true });
    expect(_payouts[0]!.status).toBe("processing");
    expect(await markPayoutProcessing(id)).toEqual({ ok: false, reason: "already_settled" });
    expect(await markPayoutProcessing("zzzzzzzz-zzzz-4zzz-8zzz-zzzzzzzzzzzz")).toEqual({ ok: false, reason: "not_found" });
  });

  test("demande introuvable", async () => {
    expect(await markPayoutPaid("zzzzzzzz-zzzz-4zzz-8zzz-zzzzzzzzzzzz", { reference: "X-1" })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});
