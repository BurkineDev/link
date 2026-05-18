import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = (await import("@/lib/supabase/server")).createClient as unknown as ReturnType<typeof vi.fn>;
const { POST } = await import("@/app/api/webhooks/pawapay/deposits/route");

type SupabaseRow = { data: unknown; error: unknown };

describe("PawaPay deposit webhook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it("confirms the order when a completed deposit arrives", async () => {
    const updateQuery = {
      eq: vi.fn(async () => ({ data: null, error: null })),
    };

    mockedCreateClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "orders") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "order-1",
                    total_amount: 100,
                    currency: "XOF",
                    payment_status: "pending",
                  },
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => updateQuery),
          };
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })),
          })),
        };
      }),
    });

    const payload = {
      event: "deposit.updated",
      data: {
        id: "deposit-123",
        status: "COMPLETED",
        amount: 100,
        currency: "XOF",
      },
    };

    const request = new Request("http://localhost/api/webhooks/pawapay/deposits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }) as unknown as NextRequest;

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(updateQuery.eq).toHaveBeenCalledWith("id", "order-1");
  });

  it("returns 200 when the order cannot be found", async () => {
    mockedCreateClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })),
        })),
      })),
    });

    const payload = {
      id: "deposit-unknown",
      status: "COMPLETED",
      amount: 100,
      currency: "XOF",
    };

    const request = new Request("http://localhost/api/webhooks/pawapay/deposits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }) as unknown as NextRequest;

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
