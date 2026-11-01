export const preference = (key, fallback = null) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
export const setPreference = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Private or blocked storage must not prevent a visit. */
  }
};
