# Mafaza Kuis - Petunjuk pemasangan Google Apps Script

Isi folder ini:
- Code.gs             : backend (akun guru, mapel, soal, nilai disimpan di Google Sheet)
- Index.html          : tampilan aplikasi (jangan diedit manual, isinya sudah dibungkus)
- appsscript.json     : pengaturan proyek (opsional)
- embed-blogger.html  : kode tempel untuk halaman Blogger

## Cara memasang
1. Buat Google Sheet baru > Ekstensi > Apps Script (skrip harus dibuka dari dalam Sheet).
2. Tempel Code.gs. Buat file HTML bernama persis "Index", tempel isi Index.html.
3. (Opsional) Setelan proyek > centang "Tampilkan file manifes appsscript.json", lalu ganti isinya.
4. Jalankan fungsi "setup" sekali dan setujui izin.
5. Terapkan > Deployment baru > Aplikasi web. Jalankan sebagai: Saya. Akses: Siapa saja.
6. Buka tautan /exec, klik Login > Daftar. Akun pertama otomatis menjadi ADMIN.

Setelah mengubah kode: Terapkan > Kelola deployment > Edit > Versi baru > Terapkan.

## Pratinjau WhatsApp (judul + stiker logo + deskripsi)
Jalankan jalankan-github.bat di folder utama paket. Ia membuat halaman di GitHub Pages yang
memuat judul, gambar logo, dan deskripsi, lalu menampilkan aplikasi di dalamnya.
Bagikan alamat GitHub Pages itu di WhatsApp. Isi alamat tersebut juga di aplikasi:
Pengaturan > Alamat halaman utama.

## Blogger
Tempel embed-blogger.html di halaman Blogger (lihat petunjuk di dalam file).
Banner "Aplikasi ini dibuat oleh pengguna Google Apps Script" dari Google tidak bisa dihilangkan.
