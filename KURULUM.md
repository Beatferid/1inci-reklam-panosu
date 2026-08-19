# Reklam Panosu — Başka bilgisayara kurulum

Windows’ta sıfırdan hızlı kurulum.

## Gereksinim

1. Proje klasörü (USB / zip / kopya). `node_modules` taşımanıza gerek yok.
2. **Node.js** — elle kurmanıza gerek yok: `kurulum.bat` kontrol eder;  
   yoksa veya 20’den eskiyse **kendisi kurar** (`winget` veya Node 20 MSI).  
   Gerekirse BAT’ı **Yönetici olarak çalıştırın**.

## 3 adım

| Sıra | Dosya | Ne yapar |
|------|--------|----------|
| 1 | **`kurulum.bat`** çift tıkla | Paketler, `.env`, veritabanı, admin seed |
| 2 | **`baslat.bat`** çift tıkla | Sunucu: http://localhost:3000 |
| 3 | (telefon/QR) **`tunnel.bat`** | HTTPS public link (GPS / telefon için) |

### Admin giriş

- Adres: http://localhost:3000/admin  
- Varsayılan: **`admin` / `admin`**  
- Panelden değiştir: **Şifre** menüsü (`/admin/hesap`)  
- Veya `.env` → `ADMIN_EMAIL`, `ADMIN_PASSWORD` sonra `npm run db:seed`

## Manuel (bat istemezseniz)

```bat
npm install --ignore-scripts
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

`.env` yoksa `.env.example` dosyasını `.env` olarak kopyalayın.

## Telefon / QR

1. `baslat.bat` çalışsın  
2. Ayrı pencerede `tunnel.bat`  
3. Çıkan `https://….trycloudflare.com` adresini kullanın  
4. Admin’de görsel yükleyip yayınlayın, QR indirin  

> GPS konum kilidi için telefonda **HTTPS** gerekir (tunnel veya gerçek domain).

## Sorun giderme

| Sorun | Çözüm |
|--------|--------|
| `node` bulunamadı | `kurulum.bat` → sağ tık → **Yönetici olarak çalıştır** |
| `npm install` hata | `kurulum.bat` içindeki `--ignore-scripts` kullanır; antivirus’ü geçici kapatın |
| Prisma / EPERM | `baslat.bat` kapalıyken `npx prisma generate` |
| Port 3000 dolu | O portu kullanan programı kapatın veya `package.json` → `dev` portunu değiştirin |
| Eski veritabanı | `prisma/dev.db` silinip `kurulum.bat` tekrar (veriler sıfırlanır) |

## Klasörler

- `storage/` — yüklenen görsel/video (yedekleyin)  
- `prisma/dev.db` — SQLite veritabanı  
- `.env` — gizli ayarlar (paylaşmayın)
