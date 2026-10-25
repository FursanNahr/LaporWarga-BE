import { z } from 'zod'

const email = z.string().trim().toLowerCase().email('Format email tidak valid')

export const registerBody = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter'),
  email,
  // bcrypt hanya memakai 72 byte pertama, jadi batasi di 72.
  password: z.string().min(8, 'Password minimal 8 karakter').max(72, 'Password maksimal 72 karakter'),
  // Sengaja TIDAK ada field "role": register publik selalu menghasilkan WARGA.
})

export const loginBody = z.object({
  email,
  password: z.string().min(1, 'Password wajib diisi'),
})
