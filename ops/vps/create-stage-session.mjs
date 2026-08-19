import { SignJWT } from "jose";

const openId = process.env.TAKEOFF_STAGE_TEST_OPEN_ID;
const name = process.env.TAKEOFF_STAGE_TEST_NAME ?? "Stage Verification";
const appId = process.env.VITE_APP_ID;
const secret = process.env.JWT_SECRET;

if (!openId || !appId || !secret) {
  throw new Error("Stage session requires TAKEOFF_STAGE_TEST_OPEN_ID, VITE_APP_ID, and JWT_SECRET.");
}

const token = await new SignJWT({ openId, appId, name })
  .setProtectedHeader({ alg: "HS256", typ: "JWT" })
  .setIssuedAt()
  .setExpirationTime("15m")
  .sign(new TextEncoder().encode(secret));

process.stdout.write(`${token}\n`);
