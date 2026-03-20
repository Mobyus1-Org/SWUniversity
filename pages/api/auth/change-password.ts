import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/server/auth/password";
import { requireAuthApi } from "@/server/auth/guards";
import { clearSessionCookie, revokeAllUserSessions } from "@/server/auth/session";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv, getRequiredEnv } from "@/server/env";
import { UserModel } from "@/server/models/User";

type ChangePasswordBody = {
  currentPassword?: string;
  newPassword?: string;
};

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, "POST");
  }

  try {
    assertRequiredEnv();
    await connectToDatabase();

    const session = await requireAuthApi(request, response);
    if (!session) {
      return;
    }

    const body = request.body as ChangePasswordBody;
    const currentPassword = body.currentPassword || "";
    const newPassword = body.newPassword || "";

    if (!currentPassword || !newPassword) {
      return response.status(400).json({ error: "Current and new password are required." });
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return response.status(400).json({ error: passwordError });
    }

    const user = await UserModel.findById(session.user.id);
    if (!user) {
      clearSessionCookie(response);
      return response.status(401).json({ error: "Unauthorized" });
    }

    const currentPasswordIsValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!currentPasswordIsValid) {
      return response.status(401).json({ error: "Current password is incorrect." });
    }

    user.passwordHash = await hashPassword(newPassword);
    user.passwordPepperVersion = getRequiredEnv("PEPPER_VERSION");
    await user.save();

    await revokeAllUserSessions(user._id.toString());
    clearSessionCookie(response);

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error("change password error", error);
    return response.status(500).json({ error: "Unable to change password." });
  }
}
