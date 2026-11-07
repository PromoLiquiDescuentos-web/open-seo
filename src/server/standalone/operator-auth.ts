import { env } from "cloudflare:workers";
import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { isTelemetryOptOutValue } from "@/shared/selfhost-checks";

const MIN_OPERATOR_SECRET_LENGTH = 32;

// The standalone Docker edition generates this secret at initialization
// (scripts/celld/runtime/configure.mjs) and a Cloudflare self-hoster sets it
// in .env.selfhost when they need the account commands; hosted and the modes
// whose identity comes from outside the app never set it, so everything it
// gates stays off there. A value too short for isOperatorRequest counts as
// unset.
export function hasOperatorSecret(): boolean {
  const secret: unknown = Reflect.get(env, "OPENSEO_OPERATOR_SECRET");
  return (
    typeof secret === "string" && secret.length >= MIN_OPERATOR_SECRET_LENGTH
  );
}

// Set on a public self-host so a stranger cannot claim the first account
// while the operator creates it. Same off-list as telemetry: unset stays
// off, and "0"/"false"/"no"/"off" leave the public first-account form open.
export function isOperatorBootstrapRequired(): boolean {
  const value: unknown = Reflect.get(env, "OPENSEO_OPERATOR_BOOTSTRAP");
  return typeof value === "string" && isTelemetryOptOutValue(value);
}

export function isOperatorRequest(headers: Headers | undefined): boolean {
  const secret: unknown = Reflect.get(env, "OPENSEO_OPERATOR_SECRET");
  const supplied = headers?.get("x-openseo-operator-secret");
  if (!hasOperatorSecret() || typeof secret !== "string" || !supplied)
    return false;
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}
