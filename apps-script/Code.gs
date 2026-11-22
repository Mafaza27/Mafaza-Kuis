/**
 * Safari Kuis - Code.gs
 * Pasang di Apps Script yang TERIKAT ke sebuah Google Sheet (Ekstensi > Apps Script).
 * Sheet "Guru", "Mapel", "Soal", "Nilai" dibuat otomatis saat pertama dipakai.
 * Fungsi berakhiran _ bersifat privat (tidak bisa dipanggil dari browser).
 */
const HD_ = {
  G: ['id', 'user', 'nama', 'role', 'status', 'salt', 'hash', 'kode', 'dibuat'],
  M: ['id', 'guru', 'nama', 'warna', 'ikon'],
  S: ['id', 'mapel', 'guru', 'q', 'A', 'B', 'C', 'D', 'kunci', 'penjelasan'],
  N: ['id', 'guru', 'mapel', 'nama', 'skor', 'max', 'waktu']
};
const NM_ = { G: 'Guru', M: 'Mapel', S: 'Soal', N: 'Nilai' };
const WARNA_ = ['#ff6b6b', '#00b8a9', '#3d8bfd', '#ff9f1c', '#9b5de5', '#2ec4b6', '#f15bb5'];

function doGet(e) {
  const kode = String((e && e.parameter && e.parameter.g) || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const base = ScriptApp.getService().getUrl();
  let html = HtmlService.createHtmlOutputFromFile('Index').getContent();
  let out;
  if (html.indexOf('<?!=') >= 0) { // jaga-jaga: Index.html versi lama yang masih memakai penanda template
    const t = HtmlService.createTemplateFromFile('Index'); t.kode = kode; t.base = base;
    out = t.evaluate();
  } else {
    html = html.replace("'__KODE__'", () => JSON.stringify(kode)).replace("'__BASE__'", () => JSON.stringify(base));
    out = HtmlService.createHtmlOutput(html);
  }
  return out.setTitle('Safari Kuis')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Satu-satunya pintu masuk dari browser
function api(fn, a) {
  const f = API_[fn];
  if (!f) throw new Error('Perintah tidak dikenal.');
  if (fn === 'kode') return kodeCached_(f, a);           // dibaca banyak siswa sekaligus: tanpa antre
  if (fn === 'load') return f.apply(null, a || []);       // hanya membaca
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const r = f.apply(null, a || []);
    CacheService.getScriptCache().put('VER', String(Date.now()), 21600); // data berubah: buang salinan lama
    return r;
  } finally { lock.releaseLock(); }
}

// Salinan sementara (30 detik) data kuis agar puluhan siswa yang mulai bersamaan tidak membebani Sheet
function kodeCached_(f, a) {
  const c = CacheService.getScriptCache(), ver = c.get('VER') || '0';
  const key = 'K' + ver + String((a && a[0]) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const hit = c.get(key);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  const r = f.apply(null, a || []);
  try { const s = JSON.stringify(r); if (s.length < 90000) c.put(key, s, 30); } catch (e) {}
  return r;
}

/* ---------- Helper Sheet ---------- */
// Jalankan sekali dari editor (pilih "setup" lalu Run) untuk langsung membuat tab Guru, Mapel, Soal, Nilai.
function setup() { ['G', 'M', 'S', 'N'].forEach(k => sh_(k)); }

function sh_(k) {
  const ss = SpreadsheetApp.getActive();
  if (!ss) throw new Error('Skrip ini belum terikat ke Google Sheet. Buka Google Sheet, lalu Ekstensi > Apps Script, dan pasang kode di sana.');
  let s = ss.getSheetByName(NM_[k]);
  if (!s) {
    s = ss.insertSheet(NM_[k]);
    s.getRange(1, 1, s.getMaxRows(), HD_[k].length).setNumberFormat('@'); // semua teks
    s.appendRow(HD_[k]);
    s.setFrozenRows(1);
  }
  return s;
}
function all_(k) {
  const v = sh_(k).getDataRange().getValues(), h = v.shift();
  return v.map((r, i) => { const o = { _r: i + 2 }; h.forEach((c, j) => o[c] = r[j]); return o; })
    .filter(o => o.id !== '');
}
function row_(k, o) { return HD_[k].map(c => o[c] === undefined ? '' : o[c]); }
function put_(k, o) {
  const s = sh_(k), r = row_(k, o);
  if (o._r) s.getRange(o._r, 1, 1, r.length).setValues([r]); else s.appendRow(r);
}
function putMany_(k, list) {
  if (!list.length) return;
  const s = sh_(k), last = s.getLastRow(), need = last + list.length;
  if (s.getMaxRows() < need) s.insertRowsAfter(s.getMaxRows(), need - s.getMaxRows());
  s.getRange(last + 1, 1, list.length, HD_[k].length).setValues(list.map(o => row_(k, o)));
}
function rm_(k, fn) { all_(k).filter(fn).reverse().forEach(o => sh_(k).deleteRow(o._r)); }
// cegah rumus (=, +, -, @) tereksekusi di Sheet
function t_(x) { x = String(x == null ? '' : x); return /^[=+\-@]/.test(x) ? '\u200b' + x : x; }
function id_() { return 'x' + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function sha_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}

/* ---------- Auth ---------- */
function me_(t) {
  if (typeof t !== 'string' || t.length > 100) throw new Error('Sesi berakhir, silakan login ulang.');
  const id = CacheService.getScriptCache().get('S' + t);
  const g = id && all_('G').find(x => x.id == id);
  if (!g || g.status != 'ok') throw new Error('Sesi berakhir, silakan login ulang.');
  return g;
}
function adm_(t) { const g = me_(t); if (g.role != 'admin') throw new Error('Khusus admin.'); return g; }
// k kosong = soal milik admin (beranda umum); k berisi = soal milik guru pemilik token itu
function gk_(k) {
  const gs = all_('G').filter(x => x.status == 'ok');
  k = String(k || '').toUpperCase();
  const g = k ? gs.find(x => x.kode == k)
    : gs.filter(x => x.role == 'admin').sort((a, b) => Number(a.dibuat) - Number(b.dibuat))[0];
  if (!g) throw new Error(k ? 'Token guru tidak ditemukan.' : 'Belum ada soal. Admin perlu mendaftar dan membuat soal dulu.');
  return g;
}
function newG_(n, u, p, role, st) {
  n = String(n || '').trim().slice(0, 50); u = String(u || '').trim().toLowerCase(); p = String(p || '');
  if (!n || !/^[a-z0-9_.]{3,30}$/.test(u)) throw new Error('Isi nama dan username (3-30 karakter: huruf kecil, angka, titik, garis bawah).');
  if (p.length < 6 || p.length > 100) throw new Error('Kata sandi minimal 6 karakter.');
  const gs = all_('G');
  if (gs.some(x => x.user == u)) throw new Error('Username sudah dipakai.');
  let kode; const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ', B = A + '23456789';
  do { kode = A[Math.floor(Math.random() * A.length)]; for (let i = 0; i < 5; i++) kode += B[Math.floor(Math.random() * B.length)]; }
  while (gs.some(x => x.kode == kode));
  const salt = Utilities.getUuid();
  put_('G', { id: id_(), user: u, nama: t_(n), role: role, status: st, salt: salt, hash: sha_(salt + p), kode: kode, dibuat: Date.now() });
}

/* ---------- Bentuk data ---------- */
function home_() { return PropertiesService.getScriptProperties().getProperty('HOME_URL') || ''; }
function sub_(m, so) {
  return { id: m.id, name: m.nama, color: m.warna, icon: m.ikon,
    qs: so.filter(s => s.mapel == m.id).map(s => ({ id: s.id, q: s.q, o: [s.A, s.B, s.C, s.D], a: Number(s.kunci), e: s.penjelasan })) };
}
function state_(g) {
  const so = all_('S').filter(s => s.guru == g.id);
  const r = {
    me: { id: g.id, n: g.nama, u: g.user, role: g.role, kode: g.kode },
    subs: all_('M').filter(m => m.guru == g.id).map(m => sub_(m, so)),
    res: all_('N').filter(n => n.guru == g.id).map(n => ({ id: n.id, n: n.nama, s: n.mapel, sc: Number(n.skor), mx: Number(n.max), t: Number(n.waktu) }))
  };
  r.home = home_();
  if (g.role == 'admin') r.teachers = all_('G').map(t => ({ id: t.id, u: t.user, n: t.nama, role: t.role, st: t.status }));
  return r;
}
function soal_(g, mid, s, id) {
  const o = (Array.isArray(s.o) ? s.o : []).slice(0, 4).map(x => String(x || '').trim().slice(0, 200));
  while (o.length < 4) o.push('');
  const a = Math.round(Number(s.a)), q = String(s.q || '').trim().slice(0, 500);
  if (!q || o.filter(Boolean).length < 2 || !(a >= 0 && a <= 3) || !o[a]) throw new Error('Soal tidak lengkap: isi pertanyaan, minimal 2 pilihan, dan kunci.');
  return { id: id || id_(), mapel: mid, guru: g.id, q: t_(q), A: t_(o[0]), B: t_(o[1]), C: t_(o[2]), D: t_(o[3]), kunci: a, penjelasan: t_(String(s.e || '').trim().slice(0, 500)) };
}
function own_(g, mid) {
  const m = all_('M').find(x => x.id == mid && x.guru == g.id);
  if (!m) throw new Error('Mata pelajaran tidak ditemukan.');
  return m;
}

/* ---------- API ---------- */
const API_ = {
  // === siswa / publik ===
  kode(k) {
    const g = gk_(k), so = all_('S').filter(s => s.guru == g.id);
    return {
      gn: g.nama, home: home_(),
      subs: all_('M').filter(m => m.guru == g.id).map(m => sub_(m, so)),
      res: all_('N').filter(n => n.guru == g.id).map(n => ({ n: n.nama, s: n.mapel, sc: Number(n.skor), mx: Number(n.max), t: Number(n.waktu) }))
        .sort((a, b) => b.sc / b.mx - a.sc / a.mx).slice(0, 20)
    };
  },
  skor(k, nama, mid, skor) {
    const g = gk_(k), m = own_(g, mid);
    const n = all_('S').filter(s => s.mapel == m.id).length, sc = Math.round(Number(skor));
    if (!n || !(sc >= 0 && sc <= n * 10)) throw new Error('Skor tidak valid.');
    put_('N', { id: id_(), guru: g.id, mapel: m.nama, nama: t_(String(nama || '').trim().slice(0, 30) || 'Anonim'), skor: sc, max: n * 10, waktu: Date.now() });
    return true;
  },
  login(u, p) {
    u = String(u || '').trim().toLowerCase();
    const g = all_('G').find(x => x.user == u);
    if (!g || g.hash != sha_(g.salt + String(p || ''))) throw new Error('Username atau kata sandi salah.');
    if (g.status != 'ok') throw new Error('Akun Anda belum disetujui admin.');
    const t = Utilities.getUuid();
    CacheService.getScriptCache().put('S' + t, g.id, 21600);
    return Object.assign({ token: t }, state_(g));
  },
  daftar(n, u, p) {
    const first = all_('G').length === 0; // akun pertama otomatis jadi admin
    newG_(n, u, p, first ? 'admin' : 'guru', 'ok'); // langsung aktif, tanpa persetujuan admin
    return first ? 'Akun admin pertama dibuat.' : 'Pendaftaran berhasil.';
  },
  // === guru ===
  logout(t) { CacheService.getScriptCache().remove('S' + t); return true; },
  load(t) { return state_(me_(t)); },
  pw(t, p) {
    const g = me_(t); p = String(p || '');
    if (p.length < 6 || p.length > 100) throw new Error('Kata sandi minimal 6 karakter.');
    g.salt = Utilities.getUuid(); g.hash = sha_(g.salt + p); put_('G', g);
    return state_(g);
  },
  mapelAdd(t) {
    const g = me_(t), n = all_('M').filter(m => m.guru == g.id).length;
    put_('M', { id: id_(), guru: g.id, nama: 'Mapel Baru', warna: WARNA_[n % WARNA_.length], ikon: '\uD83D\uDCDA' });
    return state_(g);
  },
  mapelSet(t, id, nama, warna) {
    const g = me_(t), m = own_(g, id);
    nama = String(nama || '').trim().slice(0, 40);
    if (!nama) throw new Error('Nama mapel tidak boleh kosong.');
    m.nama = t_(nama); if (/^#[0-9a-f]{6}$/i.test(warna)) m.warna = warna;
    put_('M', m);
    return state_(g);
  },
  mapelDel(t, id) {
    const g = me_(t); own_(g, id);
    rm_('S', s => s.mapel == id && s.guru == g.id);
    rm_('M', m => m.id == id && m.guru == g.id);
    return state_(g);
  },
  soalSave(t, mid, s) {
    const g = me_(t); own_(g, mid);
    if (s && s.id) {
      const old = all_('S').find(x => x.id == s.id && x.guru == g.id && x.mapel == mid);
      if (!old) throw new Error('Soal tidak ditemukan.');
      const n = soal_(g, mid, s, old.id); n._r = old._r; put_('S', n);
    } else put_('S', soal_(g, mid, s || {}));
    return state_(g);
  },
  soalMany(t, mid, arr) {
    const g = me_(t); own_(g, mid);
    if (!Array.isArray(arr) || !arr.length || arr.length > 300) throw new Error('Jumlah soal harus 1-300.');
    putMany_('S', arr.map(s => soal_(g, mid, s)));
    return state_(g);
  },
  soalDel(t, mid, id) {
    const g = me_(t);
    rm_('S', s => s.id == id && s.guru == g.id);
    return state_(g);
  },
  nilaiClear(t) {
    const g = me_(t);
    rm_('N', n => n.guru == g.id);
    return state_(g);
  },
  drive(t, u) {
    me_(t);
    const m = String(u || '').match(/[-\w]{25,}/);
    if (!m) throw new Error('Tautan Google Drive tidak valid.');
    let f; try { f = DriveApp.getFileById(m[0]); } catch (e) { throw new Error('File tidak ditemukan atau tidak bisa diakses.'); }
    const acc = f.getSharingAccess(); // hanya file yang dibagikan lewat link yang boleh dibaca
    if (acc != DriveApp.Access.ANYONE && acc != DriveApp.Access.ANYONE_WITH_LINK) throw new Error('Ubah berbagi file di Drive menjadi "Siapa saja yang memiliki link", lalu coba lagi.');
    const mt = f.getMimeType(), name = f.getName();
    if (mt == 'application/vnd.google-apps.document') return { kind: 'text', name: name, text: DocumentApp.openById(f.getId()).getBody().getText() };
    if (mt == 'application/vnd.google-apps.spreadsheet') return { kind: 'rows', name: name, rows: SpreadsheetApp.openById(f.getId()).getSheets()[0].getDataRange().getDisplayValues() };
    const ext = { 'application/pdf': 'pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx', 'text/csv': 'csv' }[mt];
    if (!ext) throw new Error('Format tidak didukung. Gunakan PDF, Word (.docx), Excel (.xlsx), Google Docs, atau Google Sheets.');
    if (f.getSize() > 8 * 1024 * 1024) throw new Error('Ukuran file maksimal 8 MB.');
    return { kind: 'bytes', name: name, ext: ext, b64: Utilities.base64Encode(f.getBlob().getBytes()) };
  },
  // === admin ===
  urlSet(t, u) {
    const g = adm_(t); u = String(u || '').trim();
    if (u && !/^https?:\/\/[^\s"'<>]{4,500}$/.test(u)) throw new Error('Alamat harus diawali http:// atau https:// dan tidak boleh mengandung spasi.');
    const P = PropertiesService.getScriptProperties();
    if (u) P.setProperty('HOME_URL', u); else P.deleteProperty('HOME_URL');
    return state_(g);
  },
  gAdd(t, n, u, p) { const g = adm_(t); newG_(n, u, p, 'guru', 'ok'); return state_(g); },
  gAct(t, id, a) {
    const g = adm_(t), x = all_('G').find(y => y.id == id);
    if (!x) throw new Error('Akun tidak ditemukan.');
    const admins = all_('G').filter(y => y.role == 'admin' && y.status == 'ok');
    if (a == 'ok') { x.status = 'ok'; put_('G', x); }
    else if (a == 'role') {
      if (x.role == 'admin' && admins.length < 2) throw new Error('Harus ada minimal satu admin aktif.');
      x.role = x.role == 'admin' ? 'guru' : 'admin'; put_('G', x);
    } else if (a == 'pw') { x.salt = Utilities.getUuid(); x.hash = sha_(x.salt + 'guru123'); put_('G', x); }
    else if (a == 'del') {
      if (x.id == g.id) throw new Error('Tidak bisa menghapus akun sendiri.');
      if (x.role == 'admin' && admins.length < 2) throw new Error('Tidak bisa menghapus admin terakhir.');
      rm_('S', s => s.guru == x.id); rm_('M', m => m.guru == x.id); rm_('N', n => n.guru == x.id); rm_('G', y => y.id == x.id);
    }
    return state_(all_('G').find(y => y.id == g.id));
  }
};
