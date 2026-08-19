# 1inci Reklam Panosu

QR ile açılan görsel ve şans çarkı. Dijital katalog ve geri bildirim kutuları ayrı. Uygulama indirme yok.

## Stack

- Next.js 15 (App Router)
- Prisma + SQLite (yerel) / Postgres (Vercel + Neon)
- NextAuth (credentials)
- Yerel `storage/` veya Vercel Blob

## Hızlı başlangıç (Windows)

Ayrıntılar: **[KURULUM.md](./KURULUM.md)**

1. `kurulum.bat` — paketler + veritabanı  
2. `baslat.bat` — sunucu  
3. (telefon, yerelde) `tunnel.bat` — HTTPS link  

Panel: http://localhost:3000/admin — `admin` / `admin`

## Kampanya akışı

1. Kampanya oluşturun  
2. Reklam görseli (veya video) yükleyin  
3. İsterseniz şans çarkını açın  
4. Yayınla → QR indirin  
5. Telefonda QR → görsel sayfası veya `/oyun`

## Ortam

`.env.example` dosyasına bakın. QR adresi `NEXT_PUBLIC_APP_URL` (Vercel’de `https://<proje>.vercel.app`).

## Vercel (ücretsiz Hobby)

1. GitHub’a push (`.env` gitmez)  
2. Vercel’de projeyi bağlayın  
3. **Neon** Postgres + **Blob** store ekleyin  
4. Prisma `provider` yayın için `postgresql` olmalı; `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `BLOB_READ_WRITE_TOKEN`  
5. Admin’de QR yeniden derleyin  

Yerel SQLite ve `storage/` dosyaları Vercel’e taşınmaz.

## Klasörler

- `src/app/admin` — yönetim  
- `src/app/ar/[slug]` — QR görsel sayfası  
- `src/app/oyun/[slug]` — şans çarkı  
- `storage/uploads` — yerel medya  
