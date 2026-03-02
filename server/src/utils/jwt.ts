import jwt from "jsonwebtoken";

export type AuthTokenPayload = {
  staffId: string;
  username: string;
  role: "WARDEN" | "STAFF";
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length > 0) return secret;

  if (process.env.NODE_ENV !== "production") return "dev-jwt-secret";

  throw new Error("JWT_SECRET is required in production");
}

export function signAuthToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
}
