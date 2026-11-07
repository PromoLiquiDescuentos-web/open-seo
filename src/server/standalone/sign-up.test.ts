import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertStandaloneSignUpOpen,
  isStandaloneSignUpOpen,
} from "@/server/standalone/sign-up";

const mocks = vi.hoisted(() => ({
  hasAnyUser: vi.fn(),
  hasPendingInvitationForEmail: vi.fn(),
}));

const { env } = vi.hoisted(() => ({ env: {} as Record<string, string> }));

vi.mock("cloudflare:workers", () => ({ env }));
vi.mock("@/server/auth/repositories/AuthRepository", () => ({
  AuthRepository: mocks,
}));

const operatorSecret = "s".repeat(32);

describe("isStandaloneSignUpOpen", () => {
  beforeEach(() => {
    delete env.OPENSEO_OPERATOR_BOOTSTRAP;
    delete env.OPENSEO_OPERATOR_SECRET;
    mocks.hasAnyUser.mockResolvedValue(true);
    mocks.hasPendingInvitationForEmail.mockResolvedValue(false);
  });

  it("lets the first account through on a fresh installation", async () => {
    mocks.hasAnyUser.mockResolvedValue(false);

    await expect(isStandaloneSignUpOpen("stranger@example.com")).resolves.toBe(
      true,
    );
  });

  it("closes once an account exists", async () => {
    await expect(isStandaloneSignUpOpen("stranger@example.com")).resolves.toBe(
      false,
    );
  });

  it("stays open for an address with a pending invitation", async () => {
    mocks.hasPendingInvitationForEmail.mockResolvedValue(true);

    await expect(isStandaloneSignUpOpen("invitee@example.com")).resolves.toBe(
      true,
    );
    expect(mocks.hasPendingInvitationForEmail).toHaveBeenCalledWith(
      "invitee@example.com",
    );
  });

  it("closes the first account while operator bootstrap is required", async () => {
    env.OPENSEO_OPERATOR_BOOTSTRAP = "1";
    mocks.hasAnyUser.mockResolvedValue(false);

    await expect(isStandaloneSignUpOpen("stranger@example.com")).resolves.toBe(
      false,
    );
  });

  it("keeps an invitation open while operator bootstrap is required", async () => {
    env.OPENSEO_OPERATOR_BOOTSTRAP = "1";
    mocks.hasAnyUser.mockResolvedValue(false);
    mocks.hasPendingInvitationForEmail.mockResolvedValue(true);

    await expect(isStandaloneSignUpOpen("invitee@example.com")).resolves.toBe(
      true,
    );
  });

  it("lets the operator create the first account while public signup is closed", async () => {
    env.OPENSEO_OPERATOR_BOOTSTRAP = "1";
    env.OPENSEO_OPERATOR_SECRET = operatorSecret;
    mocks.hasAnyUser.mockResolvedValue(false);

    await expect(
      assertStandaloneSignUpOpen(new Headers(), {
        email: "stranger@example.com",
      }),
    ).rejects.toThrow(/Registration is closed/);
    await expect(
      assertStandaloneSignUpOpen(
        new Headers({ "x-openseo-operator-secret": operatorSecret }),
        { email: "owner@example.com", name: "Owner", password: operatorSecret },
      ),
    ).resolves.toBeUndefined();
  });
});
