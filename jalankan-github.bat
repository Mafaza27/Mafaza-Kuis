@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Mafaza Kuis - Unggah otomatis ke GitHub
cd /d "%~dp0"
echo.
echo ==============================================================
echo    MAFAZA KUIS - UNGGAH OTOMATIS KE GITHUB + GITHUB PAGES
echo ==============================================================
echo.

rem ---------- 1. Cek Git dan GitHub CLI ----------
where git >nul 2>nul || goto pasang_git
where gh >nul 2>nul || goto pasang_gh
goto cek_login

:pasang_git
echo [!] Git belum terpasang di komputer ini.
where winget >nul 2>nul || goto git_manual
echo Memasang Git lewat winget. Mohon tunggu, izinkan jika muncul jendela konfirmasi...
winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements
echo.
echo Git selesai dipasang. TUTUP jendela ini, lalu jalankan file ini sekali lagi.
pause
exit /b 0
:git_manual
echo Pasang Git dari https://git-scm.com/download/win lalu jalankan file ini lagi.
pause
exit /b 1

:pasang_gh
echo [!] GitHub CLI belum terpasang di komputer ini.
where winget >nul 2>nul || goto gh_manual
echo Memasang GitHub CLI lewat winget. Mohon tunggu...
winget install --id GitHub.cli -e --accept-package-agreements --accept-source-agreements
echo.
echo GitHub CLI selesai dipasang. TUTUP jendela ini, lalu jalankan file ini sekali lagi.
pause
exit /b 0
:gh_manual
echo Pasang GitHub CLI dari https://cli.github.com lalu jalankan file ini lagi.
pause
exit /b 1

rem ---------- 2. Login GitHub ----------
:cek_login
gh auth status >nul 2>nul
if not errorlevel 1 goto sudah_login
echo Anda belum login ke GitHub. Browser akan terbuka.
echo Ikuti petunjuk di layar, lalu masukkan kode yang tampil di jendela ini ke halaman GitHub.
echo.
gh auth login --hostname github.com --git-protocol https --web
if errorlevel 1 goto gagal
:sudah_login
gh auth setup-git >nul 2>nul
set "GH_OWNER="
for /f "usebackq delims=" %%i in (`gh api user --jq .login`) do set "GH_OWNER=%%i"
if "%GH_OWNER%"=="" goto gagal
echo Akun GitHub : %GH_OWNER%
echo.

rem ---------- 3. Pengaturan (tersimpan di pengaturan.txt) ----------
if exist "pengaturan.txt" for /f "usebackq tokens=1,* delims==" %%a in ("pengaturan.txt") do set "%%a=%%b"
if "%REPO%"=="" set "REPO=mafaza-kuis"
set "INP="
echo Nama repository GitHub. Tekan Enter untuk memakai: %REPO%
set /p "INP=Nama repository: "
if not "%INP%"=="" set "REPO=%INP%"
echo.

:tanya_url
if not "%EXEC_URL%"=="" echo Alamat aplikasi tersimpan: %EXEC_URL%
set "INP="
echo Tempel alamat aplikasi web Apps Script (yang berakhiran /exec).
set /p "INP=Alamat /exec (Enter = pakai yang tersimpan): "
if not "%INP%"=="" set "EXEC_URL=%INP%"
if "%EXEC_URL%"=="" goto tanya_url
echo %EXEC_URL%|findstr /b /c:"https://script.google.com/" >nul
if not errorlevel 1 goto url_ok
echo Alamat harus diawali https://script.google.com/ - silakan coba lagi.
set "EXEC_URL="
goto tanya_url
:url_ok
> "pengaturan.txt" echo REPO=%REPO%
>> "pengaturan.txt" echo EXEC_URL=%EXEC_URL%
set "PAGES_URL=https://%GH_OWNER%.github.io/%REPO%/"

echo.
echo --------------------------------------------------------------
echo  Repository : https://github.com/%GH_OWNER%/%REPO%   (PUBLIK)
echo  Alamat web : %PAGES_URL%
echo  Judul dan deskripsi WhatsApp ada di teks-judul.txt dan teks-deskripsi.txt
echo --------------------------------------------------------------
choice /c YT /n /m "Lanjutkan unggah? Tekan Y untuk ya, T untuk tidak: "
if errorlevel 2 goto batal

rem ---------- 4. Buat halaman pratinjau docs\index.html ----------
powershell -NoProfile -ExecutionPolicy Bypass -File "templates\buat-index.ps1"
if errorlevel 1 goto gagal

rem ---------- 5. Git: siapkan dan commit ----------
if exist ".git" goto sudah_git
git init >nul 2>nul
git symbolic-ref HEAD refs/heads/main
:sudah_git
set "GN="
for /f "delims=" %%i in ('git config user.name') do set "GN=%%i"
if "%GN%"=="" git config user.name "%GH_OWNER%"
set "GE="
for /f "delims=" %%i in ('git config user.email') do set "GE=%%i"
if "%GE%"=="" git config user.email "%GH_OWNER%@users.noreply.github.com"
git add -A
git commit -m "Mafaza Kuis: unggah otomatis" >nul 2>nul
git rev-parse HEAD >nul 2>nul
if errorlevel 1 goto gagal

rem ---------- 6. Buat repository atau perbarui ----------
git remote remove origin >nul 2>nul
gh repo view "%GH_OWNER%/%REPO%" >nul 2>nul
if errorlevel 1 goto buat_repo
git remote add origin "https://github.com/%GH_OWNER%/%REPO%.git"
git push -u origin main
if errorlevel 1 goto gagal_push
goto pages
:buat_repo
echo Membuat repository baru...
gh repo create "%GH_OWNER%/%REPO%" --public --source . --remote origin --push --description "Mafaza Kuis - game kuis interaktif untuk siswa"
if errorlevel 1 goto gagal

rem ---------- 7. Aktifkan GitHub Pages ----------
:pages
echo.
echo Mengaktifkan GitHub Pages...
gh api -X POST "repos/%GH_OWNER%/%REPO%/pages" -f "source[branch]=main" -f "source[path]=/docs" >nul 2>nul
if errorlevel 1 gh api -X PUT "repos/%GH_OWNER%/%REPO%/pages" -f "source[branch]=main" -f "source[path]=/docs" >nul 2>nul
set /a N=0
:tunggu
set /a N+=1
set "ST="
for /f "usebackq delims=" %%s in (`gh api "repos/%GH_OWNER%/%REPO%/pages/builds/latest" --jq .status 2^>nul`) do set "ST=%%s"
if /i "%ST%"=="built" goto selesai
if %N% geq 25 goto selesai
echo   Menunggu GitHub membangun situs, percobaan %N% dari 25. Status: %ST%
timeout /t 6 /nobreak >nul
goto tunggu

:selesai
echo.
echo ==============================================================
echo  SELESAI
echo ==============================================================
echo  Repository : https://github.com/%GH_OWNER%/%REPO%
echo  Alamat web : %PAGES_URL%
echo.
echo  LANGKAH BERIKUTNYA
echo  1. Buka alamat web di atas (jika belum muncul, tunggu 1-2 menit lalu muat ulang).
echo  2. Bagikan alamat web itu di WhatsApp: akan tampil judul, stiker logo, dan deskripsi.
echo  3. Di aplikasi, masuk sebagai admin, buka Pengaturan, isi Alamat halaman utama
echo     dengan alamat web di atas, lalu Simpan agar tombol Bagikan memakai alamat itu.
echo  Catatan: WhatsApp menyimpan pratinjau lama. Jika tampil salah, tambahkan
echo  ?v=2 di akhir alamat saat membagikan.
echo ==============================================================
start "" "%PAGES_URL%"
pause
exit /b 0

:batal
echo Dibatalkan. Tidak ada yang diunggah.
pause
exit /b 0

:gagal_push
echo.
echo [!] Gagal mengirim ke GitHub. Biasanya karena repository dengan nama itu sudah berisi
echo     file lain. Jalankan lagi dan pilih nama repository yang baru.
pause
exit /b 1

:gagal
echo.
echo [!] Terjadi kesalahan. Baca pesan di atas, perbaiki, lalu jalankan file ini lagi.
pause
exit /b 1
