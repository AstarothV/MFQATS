
export function validateEmail(email: unknown) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: unknown) {
  return typeof password === 'string' && password.length >= 8;
}

export function validateOtp(code: unknown) {
  return typeof code === 'string' && /^\d{6}$/.test(code);
}
