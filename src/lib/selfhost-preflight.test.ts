import { describe, expect, it } from "vitest";
import { runSelfhostPreflight } from "./selfhost-preflight";

function itemFor(
  result: ReturnType<typeof runSelfhostPreflight>,
  name: string,
) {
  return result.items.find((item) => item.name === name);
}

describe("runSelfhostPreflight", () => {
  it("passes the stock Docker setup (local_noauth + DataForSEO key)", () => {
    const result = runSelfhostPreflight({
      AUTH_MODE: "local_noauth",
      DATAFORSEO_API_KEY: btoa("user@example.com:secret"),
    });

    expect(result.failed).toBe(false);
    expect(itemFor(result, "AUTH_MODE")?.level).toBe("ok");
    expect(itemFor(result, "DATAFORSEO_API_KEY")?.level).toBe("ok");
  });

  it("fails an invalid AUTH_MODE with the valid list", () => {
    const result = runSelfhostPreflight({ AUTH_MODE: "local-noauth" });

    expect(result.failed).toBe(true);
    expect(itemFor(result, "AUTH_MODE")?.message).toContain(
      "cloudflare_access, local_noauth, hosted, password",
    );
  });

  it.each([
    [{}, ["TEAM_DOMAIN and POLICY_AUD", "AUTH_MODE is unset"]],
    [
      { AUTH_MODE: "hosted", BETTER_AUTH_SECRET: "x".repeat(40) },
      ["BETTER_AUTH_URL", "GOOGLE_CLIENT_ID"],
    ],
    [
      { AUTH_MODE: "password", BETTER_AUTH_SECRET: "x".repeat(40) },
      ["BETTER_AUTH_URL"],
    ],
  ])("fails %o listing every missing variable", (env, mentions) => {
    const result = runSelfhostPreflight(env);

    expect(result.failed).toBe(true);
    const message = itemFor(result, "AUTH_MODE")?.message;
    for (const mention of mentions) expect(message).toContain(mention);
    expect(message).not.toContain("BETTER_AUTH_SECRET,");
  });

  it("requires the operator secret when public bootstrap is closed", () => {
    const result = runSelfhostPreflight({
      AUTH_MODE: "password",
      BETTER_AUTH_URL: "https://open-seo.example.workers.dev",
      BETTER_AUTH_SECRET: "x".repeat(40),
      OPENSEO_OPERATOR_BOOTSTRAP: "1",
    });

    expect(result.failed).toBe(true);
    expect(itemFor(result, "AUTH_MODE")?.message).toContain(
      "OPENSEO_OPERATOR_SECRET",
    );
  });

  it("tells the operator to create the administrator when bootstrap is closed", () => {
    const result = runSelfhostPreflight({
      AUTH_MODE: "password",
      BETTER_AUTH_URL: "https://open-seo.example.workers.dev",
      BETTER_AUTH_SECRET: "x".repeat(40),
      OPENSEO_OPERATOR_SECRET: "y".repeat(32),
      OPENSEO_OPERATOR_BOOTSTRAP: "1",
      DATAFORSEO_API_KEY: btoa("user@example.com:secret"),
    });

    expect(result.failed).toBe(false);
    expect(itemFor(result, "AUTH_MODE")?.message).toContain(
      "the operator creates the administrator",
    );
  });

  it("warns that GSC stays disabled on a short BETTER_AUTH_SECRET", () => {
    const result = runSelfhostPreflight({
      AUTH_MODE: "local_noauth",
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
      BETTER_AUTH_SECRET: "too-short",
    });

    expect(itemFor(result, "Search Console")?.level).toBe("warn");
    expect(itemFor(result, "Search Console")?.message).toContain("32");
  });
});
