const FEEDBACK_DEVICE_KEY = "ar-feedback-device";

/** Öneri & Şikayet kutusu için anonim, kalıcı cihaz kimliği (localStorage) */
export function getOrCreateFeedbackDeviceId(): string {
  try {
    const existing = localStorage.getItem(FEEDBACK_DEVICE_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "")
        : `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(FEEDBACK_DEVICE_KEY, id);
    return id;
  } catch {
    return `d${Date.now().toString(36)}fallback`;
  }
}
