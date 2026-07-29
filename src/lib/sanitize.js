const BIDI_CONTROL_CHARACTERS = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const ANGLE_BRACKETS = /[<>]/g;

function removeUnsafeControls(value) {
  return [...value].filter((character) => {
    const code = character.codePointAt(0);
    return !(
      code <= 8 ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    );
  }).join("");
}

export function sanitizePlainText(value, maxLength = 5000) {
  return removeUnsafeControls(String(value ?? ""))
    .normalize("NFC")
    .replace(BIDI_CONTROL_CHARACTERS, "")
    .replace(ANGLE_BRACKETS, "")
    .slice(0, maxLength)
    .trim();
}

export function sanitizeSingleLine(value, maxLength = 255) {
  return sanitizePlainText(value, maxLength)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function normalizeEmail(value) {
  return sanitizeSingleLine(value, 254).toLowerCase();
}

export const PASSWORD_MIN_LENGTH = 12;

export function validateStrongPassword(password) {
  const value = String(password || "");
  if (value.length < PASSWORD_MIN_LENGTH || value.length > 128) {
    throw new Error(`A senha precisa ter entre ${PASSWORD_MIN_LENGTH} e 128 caracteres.`);
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    throw new Error("Use letra maiuscula, minuscula, numero e simbolo na senha.");
  }
  return value;
}
