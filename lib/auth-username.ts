/** Internal auth email domain — users never see this. */
export const AUTH_EMAIL_DOMAIN = "accounts.fantasybuild.game";

/** Trim only; usernames are case-sensitive. */
export function sanitizeUsername(raw: string): string {
  return raw.trim();
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Maps a display username to the Supabase auth email (case-preserving). */
export function usernameToAuthEmail(username: string): string {
  return `${toBase64Url(sanitizeUsername(username))}@${AUTH_EMAIL_DOMAIN}`;
}

export function mapAuthError(err: { message: string }): Error {
  const msg = err.message.toLowerCase();
  if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
    return new Error("Invalid username or password.");
  }
  if (msg.includes("user already registered") || msg.includes("already been registered")) {
    return new Error("That username is already taken.");
  }
  if (msg.includes("email signups are disabled") || msg.includes("signups not allowed")) {
    return new Error(
      "Account creation is off in Supabase. Go to Authentication → Providers → Email and turn ON “Enable sign ups”."
    );
  }
  if (msg.includes("email not confirmed")) {
    return new Error("Account could not be activated. Contact the host.");
  }
  return new Error(err.message);
}
