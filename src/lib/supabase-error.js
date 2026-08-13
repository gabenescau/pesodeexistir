export function getSupabaseErrorMessage(error, fallback = "Erro ao autenticar.") {
  if (!error) return fallback;

  if (typeof error === "string") return error;

  const rawMessage =
    error.message ||
    error.error_description ||
    error.error ||
    error.details ||
    error.hint;

  if (!rawMessage) return fallback;

  const message = String(rawMessage);

  if (/invalid login credentials/i.test(message)) {
    return "Email ou senha incorretos.";
  }

  if (/email not confirmed/i.test(message)) {
    return "Confirme seu email antes de entrar.";
  }

  if (/user already registered|already registered/i.test(message)) {
    return "Esse email ja tem uma conta. Faca login ou use outro email.";
  }

  if (
    /username|profiles_username|character varying\(24\)/i.test(message) &&
    /24|length|limit|check|constraint|too long/i.test(message)
  ) {
    return "Seu identificador ficou muito grande. Use um nome de ate 24 caracteres e tente novamente.";
  }

  if (/database error saving new user/i.test(message)) {
    return "Nao foi possivel criar sua conta porque houve um problema ao salvar seus dados. Tente novamente em alguns minutos.";
  }

  if (/database|postgres|sql|row-level|permission denied|constraint|duplicate key|foreign key|trigger|schema/i.test(message)) {
    return "Nao foi possivel concluir porque houve um problema ao salvar seus dados. Tente novamente em alguns minutos.";
  }

  if (/rate limit|too many requests|over request rate limit/i.test(message)) {
    return "Muitas tentativas seguidas. Aguarde um pouco e tente novamente.";
  }

  if (/failed to fetch|network|timeout|offline|service unavailable|503/i.test(message)) {
    return "Nao foi possivel conectar ao servico. Verifique sua internet e tente novamente.";
  }

  if (/invalid email|email address is invalid/i.test(message)) {
    return "Digite um email valido.";
  }

  if (/email.*(rate|send|deliver)|smtp|mail provider/i.test(message)) {
    return "A conta nao foi criada porque nao conseguimos enviar o email de confirmacao. Tente novamente mais tarde.";
  }

  // Mensagens de validacao criadas pelo proprio app sao seguras para exibir.
  if (/^(Digite|Use |A senha|Para criar|Muitas tentativas|Supabase nao)/i.test(message)) {
    return message;
  }

  return fallback;
}
