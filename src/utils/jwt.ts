import jwt from "jsonwebtoken";

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_TOKEN!;

export function createAccessToken(
  userId: number,
  role: string,
  tokenVersion: number,
) {
  const payload = {
    sub: userId,
    role,
    tokenVersion,
  };

  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: "30m",
  });
}
