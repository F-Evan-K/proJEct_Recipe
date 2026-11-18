# KitchenFlow AI

KitchenFlow membantu satu outlet dapur mencatat penjualan dan stok, mengelola resep per porsi, dan menyiapkan rencana produksi. Estimasi penjualan besok dibuat dari riwayat per menu dalam database lokal.

| Bagian | Teknologi |
| --- | --- |
| `frontend/` | React, TypeScript, Vite |
| `backend/` | NestJS, Prisma, MySQL |
| `ml-service/` | Python, FastAPI, scikit-learn |
| `compose.yaml` | MySQL 8.4 untuk pengembangan lokal |

## Setup setelah clone

Panduan ini memakai Windows. Siapkan Git, Node.js 22 dengan npm, Docker Desktop dengan Compose, dan Python 3.14 untuk forecasting. Jalankan Docker Desktop sebelum menjalankan perintah MySQL.

### 1. Clone dan siapkan konfigurasi

```cmd
git clone https://github.com/F-Evan-K/proJEct_Recipe.git
cd proJEct_Recipe
copy .env.example .env
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
copy ml-service\.env.example ml-service\.env
```

Salin template hanya pada clone baru. Simpan pengaturan yang sudah kamu isi saat update project.

- **`.env` di folder utama.** Isi password MySQL untuk `MYSQL_PASSWORD` dan password root yang berbeda untuk `MYSQL_ROOT_PASSWORD`. Port lokal default adalah `3307`.
- **`backend/.env`.** Sesuaikan `DATABASE_URL` dengan user, password, nama database, dan port dari `.env` utama. Jika password mengandung karakter khusus seperti `@` atau `#`, tulis versi URL-encoded di `DATABASE_URL`. Isi `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, dan `BOOTSTRAP_ADMIN_PASSWORD` dengan data admin lokalmu. Gunakan email yang belum pernah didaftarkan dan password 12–128 karakter.
- **`frontend/.env`.** Gunakan nilai bawaan `VITE_API_URL=/api/v1` dan `VITE_DATA_MODE=api`. Vite meneruskan request ke backend lokal di port `3000`.
- **Forecasting.** Buat kunci acak dengan perintah di bawah, lalu isi `ML_SERVICE_KEY` dengan nilai yang sama di `backend/.env` dan `ml-service/.env`.

```cmd
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Git menyimpan template `.env.example`. Simpan file `.env`, password, dan kunci layanan di komputer masing-masing. Setiap clone memakai database lokalnya sendiri.

### 2. Pasang dependensi dan siapkan database

Jalankan dari folder `proJEct_Recipe`.

```cmd
npm --prefix frontend ci
npm --prefix backend ci
docker compose up -d --wait mysql
npm run db:generate
npm run db:migrate
npm --prefix backend run auth:create-admin
```

Setelah admin dibuat, hapus nilai `BOOTSTRAP_ADMIN_PASSWORD` dari `backend/.env`. Gunakan email dan password yang tadi kamu pilih untuk login. Akun staf bisa mendaftar dari halaman login, kemudian admin mengaktifkannya lewat **Kelola Akun**.

Untuk mengisi beberapa contoh menu, resep, dan stok lokal, jalankan `npm run db:seed`. Seed bersifat opsional dan tidak berisi riwayat penjualan. Kalau MySQL sudah pernah dibuat, mengubah password di file `.env` saja tidak memperbarui password dalam volume database.

### 3. Jalankan layanan

Buka terminal terpisah di folder `proJEct_Recipe` untuk setiap layanan.

| Layanan | Perintah | Alamat |
| --- | --- | --- |
| Backend | `npm run dev:backend` | [Dokumentasi API](http://127.0.0.1:3000/api/docs) |
| Frontend | `npm run dev` | [Buka KitchenFlow](http://127.0.0.1:5173) |
| Forecasting | `.\ml-service\start.cmd` | `http://127.0.0.1:8000` |

Sebelum menjalankan forecasting untuk pertama kali, buat lingkungan Python dan pasang dependensinya.

```cmd
python -m venv ml-service\.venv
.\ml-service\.venv\Scripts\python.exe -m pip install -r ml-service\requirements.txt
```

Kalau Vite memilih port lain, buka alamat **Local** yang ditampilkan terminal. Tekan Ctrl+C untuk menghentikan layanan aplikasi. Gunakan `docker compose stop` untuk menghentikan MySQL sambil menyimpan data.

## Forecasting dan impor penjualan

1. Masuk ke **AI Forecasting**. Catat penjualan satu per satu atau unduh template dari **Impor riwayat penjualan**.
2. Isi CSV UTF-8 dengan `menu_id,tanggal,porsi,kondisi`. Lihat ID menu di halaman impor. Pakai format tanggal `YYYY-MM-DD` dan kondisi `normal`, `stockout`, atau `tutup`. Pakai 0 porsi untuk hari tutup.
3. Klik **Periksa CSV**. Tinjau mana yang baru atau akan diganti, perbaiki baris yang bermasalah, lalu simpan. Satu file dapat berisi hingga 1.000 catatan.
4. Setelah semua catatan hari ini masuk, klik **Jalankan estimasi**. Estimasi bisa disalin ke draft **Kitchen Planner** jika seluruh menu memenuhi syarat. Admin meninjau dan menyetujui draft secara terpisah.

Model membandingkan Random Forest dan rata-rata hari sejenis. Setiap menu perlu minimal 42 catatan hari buka tanpa stockout dalam 84 hari terakhir. Hari tanpa catatan dibiarkan kosong. MAE dan WAPE di halaman berasal dari tujuh observasi uji dan belum cukup untuk menyimpulkan akurasi bisnis. Beberapa grafik dashboard masih memakai ilustrasi.

## Pengujian dan kolaborasi

```cmd
npm run build
npm test
.\ml-service\.venv\Scripts\python.exe -m unittest discover -s ml-service -p "test_*.py"
```

`npm test` membutuhkan MySQL lokal dengan migrasi yang sudah diterapkan. Untuk tes dari impor sampai estimasi, jalankan layanan Python terlebih dahulu, lalu jalankan `node --test test-integration/forecast.cjs` dari folder `backend`.

Untuk mulai mengerjakan fitur baru, jalankan `git switch main`, `git pull --ff-only`, lalu buat branch sendiri dengan `git switch -c feat/nama-fitur`. Setelah pekerjaanmu dipush, buat pull request menuju `main`.
