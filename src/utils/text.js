/** Potong teks supaya muat di kolom database (mis. Notification.message maks 500 karakter). */
export const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)