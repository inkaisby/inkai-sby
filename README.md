# Inkai SBY

Website resmi Inkai SBY — solusi digital di Surabaya, Indonesia.

Dibangun dengan [Next.js](https://nextjs.org) dan di-deploy di [Vercel](https://vercel.com).

## Development

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

## Deploy ke Vercel

1. Push repository ini ke GitHub
2. Buka [vercel.com/new](https://vercel.com/new)
3. Import repository `inkaisby/inkai-sby`
4. Vercel akan mendeteksi Next.js secara otomatis — klik **Deploy**

Setiap push ke branch `main` akan otomatis di-deploy ulang.

## Struktur

```
src/
├── app/          # Halaman & layout (App Router)
└── components/   # Komponen UI reusable
```
