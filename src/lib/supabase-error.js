export function getSupabaseErrorMessage(error, fallback = "Erro ao autenticar.") {
  if (!error) return fallback;

  if (typeof error === "string") return error;

  const rawMessage =
    error.message ||
    error.error_description ||
    error.error ||
    error.details ||
    error.hint;

  if (rawMessage) {
    const message = String(rawMessage);

    if (/invalid login credentials/i.test(message)) {
      return "Email ou senha incorretos.";
    }

    if (/email not confirmed/i.test(message)) {
      return "Confirme seu email antes de entrar.";
    }

    if (/user already registered|already registered/i.test(message)) {
      return "Esse email já tem uma conta. Faça login ou use outro email.";
    }

    if (/database error saving new user/i.test(message)) {
      return "Erro ao criar usuário no banco. Rode a SQL de profiles/trigger no Supabase.";
    }

    return message;
  }

  try {
    const json = JSON.stringify(error);
    if (json && json !== "{}") return json;
  } catch {}

  return fallback;
}
