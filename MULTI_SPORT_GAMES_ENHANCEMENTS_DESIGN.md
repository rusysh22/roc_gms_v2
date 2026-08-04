# Multi-Sport Games Enhancements — Design Draft

**Status:** MSG-01 s.d. MSG-12 sudah diimplementasikan & ter-commit di branch ini (lihat riwayat commit untuk detail per item). Bagian B (MSG-07–12) belum diverifikasi visual/Playwright di lingkungan sesi ini — verifikasi dua-viewport dan `npm run test:e2e` per rencana verifikasi di bawah masih perlu dijalankan sebelum dianggap final.
**Tanggal:** 4 Agustus 2026
**Konteks:** Kebutuhan muncul dari sesi konsultasi alur "Kompas Gramedia Cup 2026", tetapi seluruh rancangan di dokumen ini bersifat **generik** untuk semua event multi-cabor bergaya olimpiade/PORSENI/games. Nama event tersebut hanya dipakai sebagai contoh kasus, tidak pernah sebagai asumsi desain.

---

## 0. Ringkasan

Dokumen ini terbagi dua:

- **Bagian A — Kemampuan sistem.** Hal-hal yang belum bisa dilakukan InTourney sama sekali: medali dan juara umum, perebutan juara 3, aturan berbeda per babak, filter hari di penjadwalan, dan beberapa keterbatasan operasional lain.
- **Bagian B — Kemudahan pengisian.** Wizard hari ini bekerja baik untuk event 1–3 kategori, tetapi satuan kerjanya adalah "satu kategori" sementara satuan kerja event multi-cabor adalah "belasan kategori". Bagian ini merancang ulang cara pengguna memasukkan struktur turnamen agar lengkap secara data tetapi ringan secara pengisian.

| ID | Item | Bagian | Prioritas | Ukuran |
|---|---|---|---|---|
| MSG-01 | Match perebutan juara 3 (bronze) | A | P1 | S–M |
| MSG-02 | Medal tally & klasemen kontingen (juara umum) | A | **P0** | L |
| MSG-03 | Ruleset override per stage | A | P1 | M |
| MSG-04 | Filter hari aktif di optimizer jadwal | A | P2 | S |
| MSG-05 | Kolom `employee_id` + `photo` di bulk import | A | P2 | S |
| MSG-06 | Scoping peran per cabor | A | P2 | M |
| MSG-07 | Katalog cabor & nomor pertandingan | B | **P0** | L |
| MSG-08 | Panel aturan main berlapis + halaman edit ruleset | B | P1 | M |
| MSG-09 | Kelola nomor: edit, duplikat, hapus | B | P1 | S |
| MSG-10 | Pola konsisten "pilih kategori lalu bertindak" | B | P2 | S–M |
| MSG-11 | Panel Progress yang menskala + tautan readiness | B | P2 | S |
| MSG-12 | Penyederhanaan Setup Assistant | B | P2 | S |

### Urutan pengerjaan

Sesuai keputusan: **dikerjakan berurutan mengikuti struktur dokumen ini.**

```
MSG-01 → MSG-02 → MSG-03 → MSG-04 → MSG-05 → MSG-06 → MSG-07 → MSG-08 → MSG-09 → MSG-10 → MSG-11 → MSG-12
```

Dua penyesuaian kecil terhadap urutan mentah tersebut, karena murni soal ketergantungan teknis:

- **MSG-01 tetap sebelum MSG-02.** Medali perunggu paling akurat diturunkan dari match bronze yang benar-benar ada; membalik urutannya memaksa kita membuat jalur perunggu sementara yang nanti dibongkar lagi.
- **MSG-08 dikerjakan menyatu dengan MSG-07.** Panel aturan main adalah bagian dari layar katalog itu sendiri — memisahkannya berarti membangun layar yang sama dua kali.

Konsekuensi yang perlu disadari: seluruh Bagian A selesai lebih dulu, jadi kalau ada pengguna yang menginput event sungguhan sebelum MSG-07 mendarat, dia masih akan melewati alur pengisian yang berat seperti sekarang. Ini konsekuensi yang diterima, bukan kelalaian.

### Prinsip desain yang dipegang di seluruh dokumen

1. **Derive, jangan minta input ulang.** Medali diturunkan dari hasil match yang sudah ada; `participant_mode` diturunkan dari nomor pertandingan yang dipilih. Pengguna tidak diminta menerjemahkan apa yang sudah diketahui sistem.
2. **Cache mengikuti pola yang sudah ada.** Perhitungan turunan disimpan sebagai baris yang di-recalculate, persis seperti `standings` dan `brackets` hari ini.
3. **Opt-in dan backward compatible.** Setiap field baru punya default yang membuat event lama berperilaku persis seperti sekarang.
4. **Restriksi, bukan pemberian hak.** Field scoping baru (MSG-06) hanya boleh mempersempit kewenangan.
5. **Gagal tanpa merusak.** Perhitungan turunan yang gagal dicatat ke log + audit dan tidak membatalkan aksi yang memicunya.
6. **Default boleh tersembunyi, tetapi tidak boleh tak terlihat.** Setiap nilai yang diisikan sistem harus bisa ditemukan dan diubah pengguna — kalau tidak, sistem berbohong tentang kelengkapan datanya. Ini prinsip yang mengikat seluruh Bagian B.

### Catatan lingkungan

- Schema Postgres memakai auto-push Payload/Drizzle (`payload.config.ts` tidak menyetel `migrationDir`), jadi field baru langsung terbentuk di dev. Setiap perubahan collection **wajib** diikuti `npm run generate:types`.
- Setelah mengubah collection/access, container dev perlu di-restart (`docker restart roc_gms_v2-app-1`) — hot reload tidak andal untuk file-file ini di Windows.

---
---

# BAGIAN A — Kemampuan sistem

---

## MSG-01 — Match perebutan juara 3 (Bronze Final)

### Masalah

`createSingleEliminationBracketMatches` di `src/lib/matchGeneration.ts` hanya membangun ronde-ronde utama bagan (Final, Semifinal, Quarterfinal, Round of N). Tidak ada match perebutan juara 3. Padahal untuk event yang membagikan medali, posisi ke-3 sama pentingnya dengan posisi 1 dan 2.

Yang sudah ada dan bisa dipakai ulang:
- `getRoundOrder` di `src/lib/brackets.ts:153` **sudah** mengenali nama ronde yang mengandung kata `bronze` dan memberinya order 45 — tepat di antara Semifinal (40) dan Final (50). Penampil bagan sudah siap.
- Field `next_loser_match_id` / `next_loser_match_slot` **sudah ada** di `src/collections/Matches.ts:262-283`, dibuat untuk double elimination. Ini persis mekanisme yang dibutuhkan untuk merutekan pecundang semifinal ke match bronze.

Yang belum ada: pembuatan match-nya, dan perutean pecundang di jalur single elimination.

### Perilaku fungsional

- Tiap nomor punya pilihan **"Perebutan juara 3"** dengan tiga opsi:
  - `none` — tidak ada juara 3 (default, agar event lama tidak berubah)
  - `match` — dibuatkan satu match Bronze Final; pecundang kedua semifinal otomatis masuk ke sana
  - `shared` — kedua pecundang semifinal sama-sama menempati posisi 3 tanpa bertanding (gaya judo/tinju/wushu)
- Saat Generate Matches dijalankan untuk nomor ber-opsi `match`, satu match tambahan bernama **"Bronze Final"** ikut terbentuk, dengan kedua slot peserta masih kosong.
- Begitu hasil sebuah semifinal dipublikasikan, pemenang naik ke Final (perilaku sekarang) **dan** yang kalah otomatis mengisi slot Bronze Final.
- Di bagan publik, Bronze Final muncul sebagai kolom tersendiri sebelum kolom Final.
- Deteksi juara tidak berubah: kolom terakhir tetap Final.

### Desain teknis

**Schema — `src/collections/CompetitionCategories.ts`**

```ts
{
  name: 'third_place_policy',
  type: 'select',
  required: true,
  defaultValue: 'none',
  options: [
    { label: 'No third place', value: 'none' },
    { label: 'Third-place match (Bronze Final)', value: 'match' },
    { label: 'Both semifinal losers share third', value: 'shared' },
  ],
}
```

Tiga opsi ini sengaja disatukan dalam satu select (bukan checkbox terpisah) karena MSG-02 perlu membacanya sebagai satu keputusan tunggal saat menurunkan medali perunggu.

**Generasi match — `src/lib/matchGeneration.ts`**

Tambahkan `thirdPlacePolicy` ke `CreateSingleEliminationBracketMatchesInput`. Setelah loop ronde utama selesai (setelah baris ~368), bila `thirdPlacePolicy === 'match'` **dan** `totalRounds >= 2`:

1. Buat satu match dengan
   - `round_name: 'Bronze Final'`
   - `generation_key: ${eventSlug}:${categorySlug}:${stageId}:${groupSegment}:single_elimination:bronze`
   - `status: 'ready_for_scheduling'`, kedua `participant_*_entry_id` kosong
   - `generation_source: 'single_elimination'`
2. Ambil dua match semifinal dari `matchIdByRoundAndIndex` pada key `${totalRounds - 2}:0` dan `${totalRounds - 2}:1`, lalu update masing-masing dengan `next_loser_match_id` = id match bronze, `next_loser_match_slot` = `'a'` dan `'b'`.

Guard `totalRounds >= 2` penting: bagan berisi 2 peserta hanya punya Final, tidak ada semifinal yang bisa jadi sumber pecundang.

**Perutean pecundang — `src/lib/winnerAdvancement.ts`**

Saat ini `attemptSingleEliminationWinnerAdvancement` hanya menangani `next_match_id`. Perutean pecundang lewat `next_loser_match_id` baru diimplementasikan di `src/lib/doubleElimination.ts:517`.

Ekstrak logika penulisan slot yang dipakai kedua sisi menjadi satu helper bersama, lalu panggil dari jalur single elimination. Menyalin ulang logikanya sebaiknya dihindari — bagian ini sudah pernah kena perbaikan bug sekali.

Hasilnya dikembalikan lewat perluasan `WinnerAdvancementResult` (mis. `loserTargetMatchNumber`) supaya `matchActions.ts` bisa ikut me-`revalidatePath` halaman match bronze, sama seperti yang sudah dilakukan untuk match tujuan pemenang di `matchActions.ts:206-209`.

**Bagan — tidak ada perubahan.** `getRoundOrder` sudah mengurutkan `bronze` di 45, dan `detectSingleEliminationChampion` membaca `rounds[rounds.length - 1]` yang tetap Final karena 50 > 45. Sudah diverifikasi terhadap `buildSingleEliminationBracketLayout` di `src/lib/brackets.ts:380-394`.

### Edge case & keputusan

| Situasi | Keputusan |
|---|---|
| Bagan hanya 2 peserta (langsung Final) | Bronze tidak dibuat, walau policy `match`. Ditampilkan sebagai peringatan lembut di langkah Generate. |
| Salah satu semifinal berakhir `walkover`/bye | Perutean tetap jalan lewat jalur yang sama; bila tidak ada peserta kalah yang valid, slot dibiarkan kosong dan admin mengisinya manual. |
| Policy diubah **setelah** match sudah digenerate | Generate ulang bersifat idempotent lewat `generation_key`, jadi menyalakan `match` belakangan akan menambah match bronze tanpa menyentuh yang lain. Mematikannya **tidak** menghapus match yang sudah ada — admin harus menghapusnya sendiri (sengaja: penghapusan match otomatis terlalu berisiko). |
| `seedConfig.round_count` bertambah 1 | Kosmetik, dibiarkan. |
| Double elimination | Tidak berlaku — format ini sudah punya jalur penentu peringkat sendiri. Field diabaikan. |

### Kriteria penerimaan

- Nomor single-elim 8 peserta dengan policy `match` menghasilkan 8 match (7 + bronze), dengan nama ronde Quarterfinal/Semifinal/Bronze Final/Final.
- Publikasi hasil kedua semifinal mengisi kedua slot Bronze Final secara otomatis.
- Bagan publik menampilkan Bronze Final di antara Semifinal dan Final; kartu juara tetap membaca dari Final.
- Nomor dengan policy `none` menghasilkan jumlah match yang identik dengan sebelum perubahan (uji regresi).

---

## MSG-02 — Medal tally & klasemen kontingen (juara umum)

### Masalah

Ini celah terbesar di Bagian A. Event bergaya games/olimpiade pada dasarnya adalah *kompetisi antar-kontingen* yang diselenggarakan lewat banyak nomor. InTourney saat ini hanya mengenal juara **per nomor** (tab Champions di `src/app/(frontend)/events/[eventSlug]/schedule/page.tsx`). Tidak ada pencatatan emas/perak/perunggu, pemetaan hasil nomor ke kontingen, maupun tabel peringkat kontingen.

Akibatnya penyelenggara harus melakukan tally manual di spreadsheet — pekerjaan yang justru paling rawan salah dan paling sering ditanya peserta.

### Perilaku fungsional

- Event punya sakelar **"Medal tally"**. Bila mati (default), tidak ada perubahan apa pun pada UI mana pun.
- Saat menyala, setiap nomor yang selesai otomatis menyumbang medali ke kontingen (Club) peraihnya.
- Halaman publik baru **`/events/[eventSlug]/medals`**: tabel peringkat kontingen dengan kolom Emas / Perak / Perunggu / Total, plus rincian medali per nomor yang bisa dibuka.
- Halaman workspace **`/workspaces/medals`**: tabel yang sama, plus daftar medali yang **belum terpetakan** ke kontingen mana pun, plus kemampuan override manual.
- Metode pemeringkatan bisa dipilih per event:
  - `gold_first` (default, standar olimpiade) — bandingkan emas dulu, lalu perak, lalu perunggu
  - `weighted_points` — emas/perak/perunggu punya bobot poin yang bisa diatur (default 3/2/1)
- Peraih medali muncul juga di halaman nomor masing-masing sebagai podium.

### Desain teknis

#### Schema

**`src/collections/Events.ts`** — tambahan:

| Field | Tipe | Default | Keterangan |
|---|---|---|---|
| `medal_tally_enabled` | checkbox | `false` | Sakelar utama |
| `medal_ranking_method` | select | `gold_first` | `gold_first` \| `weighted_points` |
| `medal_points_gold` / `_silver` / `_bronze` | number | 3 / 2 / 1 | Hanya dipakai bila metode `weighted_points` |

**`src/collections/CompetitionCategories.ts`** — tambahan:

| Field | Tipe | Default | Keterangan |
|---|---|---|---|
| `medal_eligible` | checkbox | `true` | Nomor eksibisi bisa dikecualikan dari tally |
| `medal_weight` | number | `1` | Pengali untuk nomor yang dihitung lebih dari satu keping |

**Collection baru — `src/collections/MedalRecords.ts`**

```ts
{
  slug: 'medal-records',
  indexes: [{ fields: ['event_id', 'category_id', 'entry_id', 'medal'], unique: true }],
  fields: [
    event_id, category_id, stage_id?,          // relationship
    entry_id,                                  // relationship -> competition-entries
    club_id,                                   // relationship -> clubs, NULLABLE
    medal: 'gold' | 'silver' | 'bronze',
    source: 'final_match' | 'bronze_match' | 'shared_bronze'
          | 'standings_rank' | 'ranking_result' | 'manual',
    source_match_id?,                          // relationship -> matches
    is_manual: checkbox (default false),
    note?: text,
  ],
  access: { create/update/delete: canManageSchedule, read: publicReadScopedToEvent() },
}
```

Alasan memakai collection sendiri, bukan menghitung on the fly:
- Sejalan dengan pola cache yang sudah ada (`standings`, `brackets`) sehingga halaman publik tidak membaca ulang seluruh match tiap render.
- Memungkinkan override manual bertahan melewati recalculation — kasus yang pasti terjadi (diskualifikasi setelah medali diberikan, medali bersama, keputusan panitia).
- Memberi audit trail yang jelas: satu baris = satu keping medali, dengan asal-usulnya.

#### Algoritma penurunan medali

File baru **`src/lib/medals.ts`**, fungsi utama `recalculateMedalsForCategory(payload, { categoryId })`, mengikuti bentuk `recalculateStandingsForScope` di `src/lib/standings.ts:522`.

Strateginya bercabang menurut tipe stage terakhir nomor tersebut — penting supaya sistem tetap generik, bukan hanya melayani knockout:

**A. Nomor berujung `single_elimination` / `double_elimination`**
1. Ambil match Final (ronde dengan order tertinggi). Bila `status !== 'result_published'` → belum selesai, keluar tanpa menulis apa pun.
2. Pemenang → `gold` (source `final_match`), yang kalah → `silver`.
3. Perunggu, menurut `third_place_policy` (MSG-01):
   - `match` → pemenang match ber-`round_name` mengandung "bronze", bila hasilnya sudah dipublikasikan
   - `shared` → **kedua** pecundang semifinal
   - `none` → tidak ada perunggu

**B. Nomor berujung `round_robin` / `league` / `group_stage` (tanpa knockout)**
Baca `standings` stage terakhir, urutkan berdasarkan `rank`. Rank 1/2/3 → emas/perak/perunggu. Hanya dijalankan bila seluruh match stage sudah berstatus hasil.
Bila ada baris ber-`tie_note` (masih seri setelah semua tie-breaker) di posisi 1–3, medali **tidak** dibuat otomatis; nomor ditandai butuh keputusan manual. Ini disengaja: sistem tidak boleh mengarang juara dari urutan alfabet.

**C. Nomor `time_trial` / `score_ranking`**
Baca hasil `recalculateRankingStandingsForScope`, ambil rank 1/2/3.

**Aturan penulisan:** hapus seluruh baris nomor tersebut yang `is_manual === false`, lalu tulis ulang hasil turunan. Baris `is_manual === true` tidak pernah disentuh — dan bila sebuah baris manual sudah menempati kombinasi (nomor, medali) yang sama, baris turunan untuk kombinasi itu dilewati. Override admin selalu menang.

#### Pemetaan entry → kontingen

`src/lib/brackets.ts:201` sudah punya `collectEntryClubLabels` yang memetakan entry ke **nama** club. Yang dibutuhkan di sini adalah **id**-nya. Buat `resolveEntryClubIds(payload, entryIds): Map<string, Id>`:

| `entry_type` | Sumber club |
|---|---|
| `club` | `entry.club_id` |
| `team`, `pair` | `entry.team_id → team.club_id` |
| `individual` | `entry.player_id → player.club_id` |
| `open`, `tbd` | tidak terpetakan |

Bila club tidak dapat ditentukan, baris medali tetap ditulis dengan `club_id: null`. Baris seperti ini **tidak hilang diam-diam** — halaman workspace menampilkannya di panel "Medali belum terpetakan". Medali yang menguap tanpa jejak adalah kegagalan yang paling sulit disadari.

#### Titik pemicu

Di `src/app/(frontend)/workspaces/matches/matchActions.ts`, setelah blok `recalculateSingleEliminationBracket` (baris ~217) dan setelah blok `recalculateStandingsForScope` (baris ~150), panggil `recalculateMedalsForCategory` bila `medal_tally_enabled` menyala.

Mengikuti pola di sekitarnya: dibungkus `try/catch`, kegagalan hanya di-`logger.error` dan **tidak** membatalkan transisi status match; hasilnya dicatat ke audit log dengan action `medal.recalculate`.

Tambahkan skrip `npm run medals:recalculate` (mengikuti `brackets:recalculate` dan `standings:recalculate` yang sudah ada) untuk backfill event yang sudah berjalan.

#### Agregasi & pemeringkatan

`buildMedalTally(records, { method, points, weights })` di `src/lib/medals.ts` — fungsi murni tanpa akses database, agar bisa diuji dengan Vitest tanpa DB (pola yang sama dengan `computeSchedulePlan`):

1. Kelompokkan per `club_id`, hitung emas/perak/perunggu dengan mengalikan `medal_weight`.
2. Urutkan: `gold_first` → emas desc, perak desc, perunggu desc, nama asc. `weighted_points` → total poin desc, emas desc, nama asc.
3. Peringkat sama berbagi nomor peringkat yang sama, ditandai eksplisit di UI.

#### Halaman

| Route | Isi |
|---|---|
| `src/app/(frontend)/events/[eventSlug]/medals/page.tsx` | Tabel peringkat kontingen + rincian per nomor |
| `src/app/(frontend)/workspaces/(shell)/medals/page.tsx` | Tabel yang sama + panel "belum terpetakan" + override manual |

Halaman publik hanya dirender bila `medal_tally_enabled` true; bila tidak, `notFound()`. Tautan nav pun hanya muncul dalam kondisi yang sama.

### Edge case & keputusan

| Situasi | Keputusan |
|---|---|
| Peserta didiskualifikasi setelah medali tercatat | Recalculation membaca ulang match; untuk kasus yang tidak tercermin di hasil match, dipakai override manual. |
| Satu kontingen mengirim 2 tim, keduanya masuk final | Dua baris berbeda `entry_id`, `club_id` sama. Tally menjumlahkannya — benar. |
| Entry individual yang pemainnya tidak punya `club_id` | Baris ditulis dengan `club_id: null`, muncul di panel "belum terpetakan". |
| Nomor dibatalkan di tengah jalan | Tidak menghasilkan medali karena Final tidak pernah `result_published`. |
| Klasemen masih seri di posisi 1–3 | Tidak menulis medali otomatis; ditandai butuh keputusan manual. |
| Event mengaktifkan tally di tengah jalan | Jalankan `npm run medals:recalculate`. |

### Kriteria penerimaan

- Unit test `buildMedalTally`: `gold_first`, `weighted_points`, dan peringkat kembar.
- Unit test penurunan medali dari ketiga strategi.
- E2E: menyelesaikan satu nomor knockout kecil menghasilkan 3 baris medali dengan `club_id` benar dan tampil di halaman publik.
- Override manual bertahan setelah recalculation dipicu ulang.
- Event dengan `medal_tally_enabled: false` tidak menampilkan nav/route baru apa pun (uji regresi).

### Risiko

Item terbesar di Bagian A dan satu-satunya yang menambah collection baru. Risiko utamanya bukan algoritma, melainkan **kualitas data peserta**: pemetaan entry→club hanya sebaik kelengkapan `club_id` pada Team/Player. Panel "belum terpetakan" ada justru untuk membuat masalah itu terlihat sejak awal.

---

## MSG-03 — Ruleset override per stage

### Masalah

`loadRulesetForMatch` di `src/lib/ruleValidation.ts:115` menyelesaikan ruleset lewat satu jalur: `match.category_id → category.ruleset_id`. Artinya satu nomor hanya bisa punya satu aturan pada satu waktu.

Ini bertabrakan dengan praktik yang sangat umum: babak grup memakai best-of-3, semifinal dan final memakai best-of-5. Hari ini satu-satunya jalan adalah mengganti `ruleset_id` nomor secara manual di antara babak — rawan terlupa dan tidak terekam sebagai bagian dari desain kompetisi.

### Perilaku fungsional

- Setiap stage boleh punya **ruleset sendiri**. Bila kosong (default), stage mewarisi ruleset nomor — persis perilaku sekarang.
- Panel aturan main (MSG-08) menampilkan aturan efektif per babak, dengan penanda jelas antara "diwarisi" dan "diubah khusus babak ini".
- Validasi skor, batas set, dan durasi penjadwalan mengikuti ruleset efektif stage tersebut.

### Desain teknis

**Schema — `src/collections/Stages.ts`**

```ts
{
  name: 'ruleset_id',
  type: 'relationship',
  relationTo: 'rulesets',
  admin: {
    description: 'Optional per-stage override. Leave empty to inherit the category ruleset.',
  },
}
```

**Resolusi — `src/lib/ruleValidation.ts`**

Ubah `loadRulesetForMatch(payload, categoryId)` menjadi `loadRulesetForMatch(payload, { categoryId, stageId })`:

1. Bila ada `stageId` dan `stage.ruleset_id` terisi, itu yang dipakai.
2. Bila tidak, jatuh ke `category.ruleset_id`.
3. Bila keduanya kosong, kembalikan `null` — tetap bukan error, sesuai kontrak yang sudah didokumentasikan.

Seluruh pemanggil harus diperbarui untuk meneruskan `match.stage_id`. Mempertahankan signature lama sebagai overload opsional lebih berisiko daripada bermanfaat: pemanggil yang lupa dimigrasi akan diam-diam memakai ruleset nomor, dan bug seperti itu baru ketahuan saat pertandingan berlangsung. Lebih baik memaksa perubahan signature agar `npm run typecheck` yang menangkapnya.

**Penjadwalan — `src/lib/scheduleOptimizer.ts`**

Bagian yang mudah terlewat. `buildCategoryRulesetIndex` (baris ~393) mengindeks `CategoryRulesetInfo` per **nomor**, dan `computeSchedulePlan` membacanya untuk `defaultDurationMinutes` dan `minRestMinutes`. Bila final BO5 berdurasi lebih panjang daripada match grup BO3, indeks per nomor akan salah menghitung.

Ubah indeks menjadi berkunci `stage_id` dengan fallback ke `category_id`. Perhatikan: tipe `OptimizerMatch` saat ini **belum memuat `stage_id`**, jadi field itu perlu ditambahkan ke tipe dan ke query `depth: 1` di `generateSchedulePlan`. Kecil, tapi wajib — kalau tidak, override durasi tidak akan pernah terpakai.

### Edge case & keputusan

| Situasi | Keputusan |
|---|---|
| Ruleset override berasal dari cabor berbeda | Batasi `filterOptions` relasi ke ruleset dengan `sport_id` yang sama. |
| Override diubah setelah beberapa match stage selesai | Diizinkan. Validasi dibaca saat entri skor, jadi hasil yang sudah tercatat tidak berubah. Beri konfirmasi eksplisit karena ini mengubah aturan di tengah babak. |
| Override diubah setelah jadwal dibuat | Jadwal yang sudah ada tidak digeser otomatis. Selisih durasi ditangani lewat Delay Impact. |

### Kriteria penerimaan

- Stage tanpa override berperilaku identik dengan sebelum perubahan (uji regresi terhadap validasi `best_of`).
- Stage knockout dengan override BO5 menolak set ke-6 dan menerima set ke-5, sementara stage grup nomor yang sama tetap BO3.
- Optimizer memakai `default_duration_minutes` milik ruleset stage saat menempatkan match knockout.

---

## MSG-04 — Filter hari aktif di optimizer jadwal

### Masalah

`SchedulePlanParams` di `src/lib/scheduleOptimizer.ts:162` menerima rentang tanggal dan jendela jam harian, tetapi tidak ada cara mengecualikan hari tertentu. Banyak event hanya bermain di hari kerja tertentu, atau justru hanya akhir pekan.

Workaround yang ada — menjalankan optimizer beberapa kali per blok tanggal — memang berfungsi (optimizer hanya memproses match yang belum terjadwal), tapi untuk rentang 5–6 minggu berarti 5–6 kali proses manual yang mudah salah.

### Perilaku fungsional

- Di `/workspaces/scheduler/optimize` muncul pilihan **hari aktif**: tujuh checkbox Senin–Minggu, seluruhnya tercentang secara default.
- Optimizer hanya menempatkan match pada hari yang tercentang.
- Bila semua hari dimatikan, form ditolak dengan pesan jelas.

### Desain teknis

```ts
export type SchedulePlanParams = {
  // ...
  // Hari yang boleh dipakai, 0 = Minggu … 6 = Sabtu (JS getDay()).
  // Kosong/undefined = seluruh hari, agar pemanggil lama tidak berubah perilaku.
  allowedWeekdays?: number[]
}
```

Filter diterapkan di `dayKeysInRange` (baris ~188). Cara paling aman: tetap iterasi seluruh rentang seperti sekarang — termasuk penghitungan batas `MAX_DAYS` — lalu buang hari yang tidak lolos filter sebelum key dimasukkan ke array. Menghitung `MAX_DAYS` terhadap hari yang **lolos** filter akan diam-diam memperluas rentang kalender jauh melebihi 62 hari, yang bukan maksud pengaman itu.

`formatLocalDayKey` sengaja bekerja di zona waktu lokal server (lihat komentarnya di baris 176-180). Pengecekan hari **wajib** memakai objek `Date` lokal yang sama, bukan hasil parsing ulang string ISO, agar tidak bergeser sehari di zona UTC+7.

**UI** — tambah satu baris checkbox di `scheduler/optimize/page.tsx`. Server action membaca `formData.getAll('weekday')`, memvalidasi tidak kosong, lalu meneruskannya.

### Di luar cakupan

- Jendela jam berbeda per hari (mis. hari kerja 17.00–20.00, akhir pekan 08.00–17.00).
- Tanggal libur/blackout individual.

Keduanya berguna, tetapi sebaiknya dinilai setelah filter hari dipakai.

### Kriteria penerimaan

- Unit test: dengan `allowedWeekdays: [2,3,4,5]`, tidak ada assignment jatuh di Sabtu/Minggu/Senin.
- Tanpa `allowedWeekdays`, hasil identik dengan sebelum perubahan (uji regresi terhadap `scheduleOptimizer.test.ts`).
- Rentang panjang tetap tunduk pada batas `MAX_DAYS` hari kalender.

---

## MSG-05 — Kolom `employee_id` dan `photo` di bulk import

### Masalah

`Players` sudah punya field `employee_id` dan `photo` (`src/collections/Players.ts:38,57`), tetapi template Excel di `src/lib/participantsImportTemplate.ts` hanya menyediakan `name`, `club_name`, `email`, `phone`, `gender`, dan parser di `src/lib/participantsImport.ts:49-57` hanya membaca kolom-kolom itu.

Akibatnya, event dengan ratusan pemain harus mengisi nomor identitas satu per satu lewat halaman Participants, dan foto hanya bisa lewat Payload admin.

### Temuan tambahan yang harus ikut diperbaiki

`Players.employee_id` disetel `unique: true` — **unik secara global, lintas event**. Padahal `event_id` adalah field wajib di collection yang sama, dan Clubs/Teams/CompetitionCategories/Rulesets semuanya sudah memakai pola index unik gabungan `[event_id, slug]` justru karena masalah ini pernah ditemukan.

Konsekuensinya nyata: menyelenggarakan event kedua dengan peserta yang sama akan **gagal saat import**. Ini bug yang tinggal menunggu waktu, dan MSG-05 akan langsung memicunya karena membuat pengisian `employee_id` menjadi lumrah.

```ts
indexes: [{ fields: ['event_id', 'employee_id'], unique: true }],
```

dan hapus `unique: true` dari definisi field. Perlu diverifikasi terhadap data yang sudah ada sebelum diterapkan.

### Desain teknis

- **Template** — tambah `employee_id` dan `photo` pada sheet Players beserta lebar kolom, dan satu baris instruksi bahwa `photo` diisi URL gambar.
- **Parser** — tambah `employeeId` dan `photo` ke `ParsedPlayerRow`. Komentar "Column names here must match…" di kedua file harus tetap sinkron.
- **Importer** — teruskan kedua field ke `payload.create`. Tambahkan penanganan konflik `employee_id` yang eksplisit: baris yang bentrok dilaporkan sebagai baris gagal dengan nomor baris dan nilai yang bentrok, bukan menggagalkan seluruh import.

### Di luar cakupan

`photo` (Players) dan `logo` (Clubs/Teams) masih berupa field teks berisi URL, dengan komentar "Temporary URL field until the media collection is added" — padahal collection `media` sudah ada dan sudah dipakai `Events.logo`. Memigrasikannya menjadi relasi upload layak dikerjakan, tetapi lebih besar (migrasi data + UI unggah + validasi) dan menjadi item tersendiri.

### Kriteria penerimaan

- Template hasil unduhan memuat kolom `employee_id` dan `photo`.
- Import 3 pemain dengan nomor identitas menyimpan nilainya dan tampil di halaman Participants.
- Import dengan satu nomor identitas duplikat melaporkan baris itu saja sebagai gagal; baris lain tetap masuk.
- Dua event berbeda boleh memakai nomor identitas yang sama.

---

## MSG-06 — Scoping peran per cabor

### Masalah

Peran diberikan per **event** lewat `EventMemberships`, bukan per cabor. Pada event multi-cabor dengan PIC berbeda tiap cabor, seorang `match_officer` secara teknis dapat mengubah skor cabor yang bukan tanggung jawabnya.

Mitigasi yang ada adalah `Match.officer_ids` (`src/collections/Matches.ts:226`) — penugasan per match. Berguna untuk kejelasan kepemilikan dan terekam di audit log, tetapi bukan pagar, dan mengisinya per match untuk ratusan match tidak praktis.

### Perilaku fungsional

- Anggota event dapat dibatasi ke sekumpulan cabor tertentu.
- Bila daftar cabor kosong (default), anggota berlaku untuk **seluruh** cabor — perilaku sekarang.
- Anggota yang dibatasi hanya melihat match dari cabor yang ditugaskan, dan upaya mengubah match di luar itu ditolak di batas collection.

### Desain teknis

```ts
{
  name: 'sport_ids',
  type: 'relationship',
  relationTo: 'sports',
  hasMany: true,
  admin: {
    description:
      'Restrict this member to specific sports. Leave empty for all sports. This field can only narrow what the member may do - it never grants capability their account roles lack.',
  },
}
```

**Penegakan** — di `enforceMatchMutationCapabilities` (hook `beforeChange` pada `Matches`, `src/access/roles.ts`). Hook ini sudah menjadi tempat penyempitan kewenangan per-field per-peran, sehingga menjadi lokasi yang tepat dan sudah dijamin dilewati oleh **setiap** jalur mutasi (Local API, REST, GraphQL, Payload Admin).

Logikanya: bila aktor punya membership pada event match tersebut dan `sport_ids` tidak kosong, tolak mutasi ketika `match.sport_id` di luar daftar. `super_admin` dan `event_admin` dikecualikan.

**Catatan semantik penting.** Deskripsi field `roles` sekarang menyatakan `EventMemberships` bersifat catatan saja dan "does not grant extra capability by itself". MSG-06 membuat collection ini untuk pertama kalinya **membatasi** kewenangan. Pergeseran makna ini harus dinyatakan eksplisit di komentar file, dan arahnya dijaga satu arah: field ini hanya boleh mempersempit. Membalik arahnya akan menciptakan dua sumber kebenaran untuk otorisasi — persis masalah yang dulu diperbaiki AUDIT_E2E AUTH-01/AUTH-02.

### Edge case & keputusan

| Situasi | Keputusan |
|---|---|
| Anggota tanpa `sport_ids` | Seluruh cabor. Default ini menjaga event lama tidak berubah. |
| Cabor dihapus dari event | Relasi ikut kosong; anggota kembali "seluruh cabor". Perlu peringatan di UI karena ini pelebaran hak yang tidak disengaja. |
| Pengguna tanpa membership | Sudah wewenang `canAccessEvent` di `src/access/eventMembership.ts`. |
| `super_admin` / `event_admin` | Selalu dikecualikan. |

### Kriteria penerimaan

- `match_officer` dengan `sport_ids: [Badminton]` berhasil mengubah skor match badminton dan ditolak pada match futsal — diuji lewat Local API **dan** REST.
- `match_officer` tanpa `sport_ids` tetap dapat mengubah keduanya (uji regresi).
- Penolakan tercatat di audit log dengan alasan yang bisa dibaca.

---
---

# BAGIAN B — Kemudahan pengisian

---

## B.0 — Rombak atau tidak?

**Tidak rombak total.** Tulang punggung 10 langkah wizard sudah benar dan cocok dengan cara orang berpikir saat menyelenggarakan event. Yang dirombak hanya **dua langkah**, yang memang harus digabung karena keduanya adalah satu keputusan yang sama di kepala pengguna. Sisanya disempurnakan, bukan dibongkar.

### Apa yang sudah baik dan tidak disentuh

- Preset ruleset per tipe cabor, `GlossaryHint` pada istilah asing, estimasi sebelum generate (*"Will generate: 7 matches · 3 rounds · 1 bye"*), peringatan lapangan yang belum tersedia
- Bulk import Excel untuk club/team/player — justru bagian terberat dan sudah tertangani satu file
- Shell wizard tinggi tetap dengan scroll internal + tombol utama sticky
- Seluruh langkah Peserta, Registrasi, Draw, Generate, Bracket, History sebagai konsep

### Diagnosis: kenapa pengisian terasa berat

Bukan karena jumlah field. Tiga sebab yang sebenarnya:

**1. Urutan keputusan terbalik.** Sekarang: cabor → ruleset → nomor. Padahal aturan main (BO3 atau BO5, poin 21 atau 25) baru bisa diputuskan setelah tahu nomor apa yang dilombakan. Pengguna diminta mengarang ruleset saat nomornya belum ada.

**2. Pengguna dipaksa membongkar satu hal menjadi tiga objek.** Penyelenggara berpikir dalam satu satuan: "Badminton Ganda Putra". Sistem memintanya memecah jadi Sport + Ruleset + Category. Dekomposisi itu benar sebagai model data, tetapi itu kebenaran milik sistem, bukan milik pengguna. Wizard membocorkan struktur database ke permukaan.

**3. Pengguna diminta menerjemahkan istilah domainnya ke istilah sistem.** Dia tahu "Ganda Putra"; sistem memintanya menerjemahkan itu menjadi `participant_mode: pair`. Dia tahu "grup dulu baru gugur"; sistem memintanya memilih `group_stage_to_knockout`. Terjemahan itu bisa dilakukan sistem.

### Temuan yang memperkuat: sebagian besar field ternyata tidak wajib

Dari 9 field di form nomor, yang benar-benar wajib secara struktur hanya **2** — nama dan cabor. Sisanya sudah punya default di `categoryActions.ts:33-37`: `participantMode` default `'open'`, `formatType` default `'single_elimination'`, ruleset boleh kosong, roster boleh kosong. Bahkan ruleset **sepenuhnya opsional secara desain** — `ruleValidation.ts:112-114` menyatakan eksplisit bahwa nomor tanpa ruleset diperlakukan sebagai "tidak ada batasan tambahan", bukan error.

Tetapi di form-nya, radio "Who's competing in this category?" ditandai `required` — wizard memaksa pengguna memilih sesuatu yang backend-nya sendiri sudah punya jawaban. Dan kesembilan field tampil dengan bobot visual sama, sehingga tidak ada petunjuk mana yang penting dan mana yang bisa dilewati.

**Kesimpulan: bukan struktur turnamen yang menuntut sebanyak itu — wizard-nya yang menuntut.**

### Perubahan struktur langkah

```
SEBELUM                          SESUDAH
1. Setup Assistant               1. Setup Assistant  (disederhanakan, MSG-12)
2. Event                         2. Event
3. Sports & Rulesets      ┐
                          ├───►  3. Cabor & Nomor Pertandingan  (MSG-07 + MSG-08)
4. Categories             ┘
5. Clubs/Teams/Players           4. Peserta
6. Registration                  5. Registrasi
7. Draw & Seeding                6. Draw & Seeding      ┐
8. Generate Matches              7. Generate Matches    ├─ pola seragam (MSG-10)
9. Bracket                       8. Bracket             ┘
10. History                      9. Riwayat
```

Sepuluh langkah menjadi sembilan. Hanya satu penggabungan; tidak ada langkah yang dihapus atau dipindah maknanya.

### Prinsip UX yang mengikat Bagian B

1. **Tanya apa yang dilombakan, bukan bagaimana sistem dikonfigurasi.** "Cabor apa saja?" bisa dijawab siapa pun. "Apa participant mode-nya?" tidak.
2. **Tiga lapis pengungkapan.** Lapis 1 wajib (cabor + nomor). Lapis 2 sudah terisi default dan terlihat sebagai ringkasan sekali baca. Lapis 3 lengkap secara teknis, di balik satu klik. Tidak ada yang dipaksa ke lapis 3, tetapi lapis 3 selalu ada dan bisa ditemukan.
3. **Default terlihat, bukan tersembunyi.** Setiap nilai yang diisikan sistem ditampilkan sebagai kalimat yang bisa dibaca, bukan disembunyikan di balik field kosong.
4. **Bahasa domain, bukan bahasa field.** "Cara menang", bukan `best_of`. "Perkiraan durasi", bukan `default_duration_minutes`.
5. **Satu pola untuk satu jenis tugas.** Semua langkah yang berupa "pilih nomor lalu lakukan sesuatu" memakai tata letak yang sama.

---

## MSG-07 — Katalog cabor & nomor pertandingan

### Masalah

Langkah 3 dan 4 hari ini menuntut pengguna membuat tiga objek terpisah untuk satu hal yang di kepalanya adalah satu hal. Untuk event 19 nomor itu berarti ~26 submit form dan ~150 pengisian field, dengan setiap nomor menuntut pengguna memutuskan `participant_mode`, `format_type`, dan ruleset secara mandiri.

### Ide inti

Sistem punya **katalog cabor bawaan** berisi cabor umum beserta daftar nomor standarnya dan aturan default yang masuk akal. Pengguna memilih cabor, mencentang nomor yang dilombakan, dan sistem membuat Sport + Ruleset + seluruh Category sekaligus dengan `participant_mode` yang sudah benar.

Mekanismenya bukan barang baru: `RULESET_PRESET_BY_SPORT_TYPE` di `new-event/page.tsx:1073` sudah melakukan persis ini, hanya pada tingkat terlalu kasar (per *tipe* cabor: court/field/table). Katalog ini adalah versi yang sama, diperkaya ke tingkat cabor bernama dan nomornya.

### Rancangan antarmuka

#### Layar utama langkah 3 — keadaan kosong

```
┌────────────────────────────────────────────────────────────┐
│  3. Cabor & Nomor Pertandingan                             │
│  Pilih cabor yang dilombakan, lalu centang nomornya.       │
│  Aturan main dan format sudah kami isikan — bisa diubah.   │
│                                                            │
│              ┌──────────────────────┐                      │
│              │   + Tambah cabor     │                      │
│              └──────────────────────┘                      │
│                                                            │
│   Belum ada cabor di event ini.                            │
└────────────────────────────────────────────────────────────┘
```

#### Pemilih cabor

```
┌────────────────────────────────────────────────────────────┐
│  Pilih cabor                                        [ ✕ ]  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🔍  Cari cabor…                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐               │
│  │   🏸   │ │   ⚽   │ │   🏐   │ │   🏀   │               │
│  │Badminton│ │ Futsal │ │  Voli  │ │ Basket │               │
│  │5 nomor │ │2 nomor │ │2 nomor │ │4 nomor │               │
│  └────────┘ └────────┘ └────────┘ └────────┘               │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐               │
│  │   🎾   │ │   🏓   │ │   🎯   │ │   🎮   │               │
│  │ Tenis  │ │T. Meja │ │Petanque│ │eSports │               │
│  └────────┘ └────────┘ └────────┘ └────────┘               │
│                                                            │
│         Cabor tidak ada di daftar?  → Buat sendiri         │
└────────────────────────────────────────────────────────────┘
```

Grid 4 kolom di desktop, 2 kolom di mobile. Kartu berisi ikon, nama, dan jumlah nomor standarnya, sehingga pengguna tahu apa yang akan didapat sebelum mengklik.

#### Pemilih nomor + aturan (layar kunci)

```
┌────────────────────────────────────────────────────────────┐
│  🏸 Badminton                                       [ ✕ ]  │
│                                                            │
│  Nomor yang dilombakan                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ☑  Tunggal Putra                        perorangan   │  │
│  │ ☑  Tunggal Putri                        perorangan   │  │
│  │ ☑  Ganda Putra                            pasangan   │  │
│  │ ☑  Ganda Putri                            pasangan   │  │
│  │ ☑  Ganda Campuran                         pasangan   │  │
│  └──────────────────────────────────────────────────────┘  │
│                          [Pilih semua]  [Kosongkan semua]  │
│                                                            │
│  + Nomor lain:  [____________________]  [perorangan ▾]     │
│  ──────────────────────────────────────────────────────    │
│                                                            │
│  Format pertandingan                                       │
│   ( ) Gugur langsung — kalah sekali, selesai               │
│   (•) Grup dulu, lalu gugur — juara grup lanjut ke bagan   │
│   ( ) Setengah kompetisi — semua lawan semua               │
│                              → Atur berbeda per nomor      │
│  ──────────────────────────────────────────────────────    │
│                                                            │
│  Aturan main                                          [ ▾ ]│
│  3 set · poin 21 · deuce · perkiraan 40 menit per match    │
│                                                            │
│                        [ Batal ]  [ Tambahkan 5 nomor ]    │
└────────────────────────────────────────────────────────────┘
```

Keputusan tata letak yang perlu dijelaskan:

- **Semua nomor tercentang secara default.** Menghapus centang lebih murah daripada mencentang satu per satu, dan mayoritas penyelenggara memang melombakan nomor standar. Jumlah pada tombol (*"Tambahkan 5 nomor"*) yang menjadi pengaman agar tidak ada yang terbuat tanpa disadari.
- **Mode peserta ditampilkan sebagai keterangan abu-abu, bukan input.** Pengguna melihat bahwa "Ganda Putra" berarti "pasangan" — jadi sistem tetap transparan — tetapi tidak diminta memutuskannya. Kalau salah, bisa diubah lewat MSG-09.
- **Format dipilih sekali untuk seluruh cabor**, dengan pre-fill dari Setup Assistant. Tautan "Atur berbeda per nomor" melayani kasus minoritas tanpa membebani kasus mayoritas.
- **Aturan main tertutup secara default, tetapi isinya terbaca sebagai kalimat.** Ini menjalankan prinsip "default terlihat": pengguna tahu ada aturan yang sedang berlaku dan seperti apa isinya, tanpa harus membukanya.
- **Tombol utama menyebut hasilnya**, bukan aksinya. "Tambahkan 5 nomor" memberi tahu persis apa yang akan terjadi.

#### Daftar setelah cabor ditambahkan

```
┌────────────────────────────────────────────────────────────┐
│  Cabor dalam event ini (2)              [ + Tambah cabor ] │
│                                                            │
│  ┌─ 🏸 Badminton ──────────────────────────────────[⋯]──┐  │
│  │  3 set · poin 21 · deuce · 40 menit      [Ubah aturan]│  │
│  │                                                       │  │
│  │  Tunggal Putra      perorangan · grup→gugur      [⋯]  │  │
│  │  Tunggal Putri      perorangan · grup→gugur      [⋯]  │  │
│  │  Ganda Putra        pasangan   · grup→gugur      [⋯]  │  │
│  │  Ganda Putri        pasangan   · grup→gugur      [⋯]  │  │
│  │  Ganda Campuran     pasangan   · grup→gugur      [⋯]  │  │
│  │                                      [ + Tambah nomor ]│ │
│  └───────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─ ⚽ Futsal ─────────────────────────────────────[⋯]──┐  │
│  │  Gol · boleh seri · 2×20 menit           [Ubah aturan]│  │
│  │                                                       │  │
│  │  Putra              tim · grup→gugur             [⋯]  │  │
│  │  Putri              tim · grup→gugur             [⋯]  │  │
│  │                                      [ + Tambah nomor ]│ │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

Pengelompokan per cabor, bukan daftar rata 19 baris. Menu `[⋯]` pada tiap baris memuat Ubah / Duplikat / Hapus (MSG-09).

### Dampak terukur

| | Sekarang | Dengan katalog |
|---|---|---|
| Submit form untuk 19 nomor | ~26 | **7** (satu per cabor) |
| Pengisian field | ~150 | ~7 nama cabor + centang |
| Istilah teknis yang harus dipahami | `participant_mode`, `score_type`, `format_type`, `set_based`, `best_of` × 19 | **nol** di jalur utama |
| Nomor non-standar | sama beratnya dengan yang standar | jalur "nomor lain" / duplikat |

### Desain teknis

**Katalog sebagai data statis, bukan collection.** File baru `src/lib/sportCatalog.ts` berisi konstanta bertipe. Alasannya: katalog adalah pengetahuan produk, bukan data milik pengguna — menaruhnya di database berarti harus diseed, dimigrasi, dan diversikan tanpa manfaat nyata. Pengguna tetap bebas membuat cabor/nomor di luar katalog; yang dibuat tetap masuk ke collection `sports`/`competition-categories` seperti biasa.

```ts
export type CatalogEvent = {
  name: string                    // "Ganda Putra"
  participantMode: 'individual' | 'pair' | 'team' | 'club'
  rosterRequired?: boolean
  minRosterSize?: number
  maxRosterSize?: number
}

export type CatalogSport = {
  key: string                     // 'badminton'
  name: string                    // "Badminton"
  sportType: 'court' | 'field' | 'table' | 'board' | 'esport' | 'track' | 'other'
  icon: string                    // nama ikon lucide
  events: CatalogEvent[]
  ruleset: {
    name: string                  // "Badminton standar"
    summary: string               // "3 set · poin 21 · deuce · 40 menit"
    scoreType: string
    setBased: boolean
    bestOf?: number
    targetScore?: number
    maxScore?: number
    deuceEnabled?: boolean
    allowDraw?: boolean
    periodCount?: number
    periodDuration?: number
    defaultDurationMinutes: number
    minRestMinutes: number
    pointsWin: number
    pointsDraw: number
    pointsLoss: number
    tieBreakers: string[]
  }
}
```

`summary` sengaja ditulis manual, bukan digenerate dari field-field di bawahnya — kalimat yang enak dibaca manusia tidak selalu bisa disusun otomatis dari nilai mentah, dan inilah teks yang dilihat pengguna di lapis 2.

**Isi katalog awal (perlu ditinjau dari sisi domain, bukan sisi kode):**

| Cabor | Tipe | Nomor standar | Aturan default |
|---|---|---|---|
| Badminton | court | Tunggal Putra/Putri, Ganda Putra/Putri/Campuran | 3 set, poin 21, maks 30, deuce, 40′ |
| Tenis Meja | table | Tunggal Putra/Putri, Ganda Putra/Putri | 3 set, poin 11, deuce, 30′ |
| Tenis Lapangan | court | Tunggal Putra/Putri, Ganda Putra/Putri/Campuran | 3 set, 60′ |
| Voli | court | Putra, Putri | 3 set, poin 25, deuce, 75′ |
| Futsal | field | Putra, Putri | gol, boleh seri, 2×20′, roster 5–14 |
| Sepak Bola | field | Putra, Putri | gol, boleh seri, 2×45′, roster 11–23 |
| Basket | field | 5v5 Putra, 5v5 Putri, 3v3 Putra, 3v3 Putri | poin, 4×10′ (3v3: 1×10′), roster 5–12 |
| Petanque | other | Single, Double, Triple | poin 13, 60′ |
| Catur | board | Perorangan Putra/Putri, Beregu | hasil menang/seri/kalah, 60′ |
| Atletik | track | Lari 100m/400m/estafet | waktu, time trial |
| Renang | track | Gaya bebas/dada/punggung | waktu, time trial |
| eSports | esport | Mobile Legends, PUBG Mobile, Free Fire | poin, BO3, 45′, roster 5–7 |
| Bulu tangkis rekreasi / lainnya | — | — | jalur "buat sendiri" |

Daftar ini **bukan** klaim kelengkapan. Ia harus ditinjau oleh orang yang paham penyelenggaraan, dan sengaja mudah ditambah karena hanya berupa konstanta.

**Server action baru — `sportCatalogActions.ts`**

`addSportFromCatalogAction(formData)`:
1. Validasi akses (`WORKSPACE_ROLES.eventAdmin`, sama seperti `addSportAction`).
2. Buat/temukan `Sport` untuk event ini berdasarkan slug katalog — idempotent, agar menambahkan nomor susulan tidak membuat cabor kembar.
3. Buat satu `Ruleset` dari preset katalog (atau pakai yang sudah ada bila cabor sudah pernah ditambahkan).
4. Buat satu `CompetitionCategory` per nomor yang dicentang, dengan `participant_mode` dari katalog, `format_type` dari pilihan pengguna, dan `ruleset_id` menunjuk ruleset di atas.
5. Seluruhnya dijalankan berurutan dengan pelaporan gagal-sebagian yang eksplisit — mengikuti pola `confirmParticipantsImportAction` yang sudah menangani "sebagian baris berhasil, sebagian gagal" dan bukan pola all-or-nothing.

Uniknya slug per event sudah dijamin index gabungan `[event_id, slug]` di `competition-categories`; bila terjadi tabrakan nama (mis. pengguna sudah membuat "Ganda Putra" manual), nomor tersebut dilewati dan dilaporkan, bukan menggagalkan seluruh batch.

**Komponen** — `SportCatalogPicker.tsx` (client, dialog dua tahap: pilih cabor → pilih nomor). Pemilihan nomor memakai `useState` lokal supaya jumlah pada tombol hidup mengikuti centang; submit tetap lewat server action.

### Edge case & keputusan

| Situasi | Keputusan |
|---|---|
| Cabor sudah pernah ditambahkan, lalu ditambah lagi | Sport & Ruleset dipakai ulang; hanya nomor baru yang dibuat. |
| Nama nomor bentrok dengan yang sudah ada | Nomor itu dilewati dan dilaporkan; sisanya tetap dibuat. |
| Cabor tidak ada di katalog | Jalur "buat sendiri" — form manual seperti sekarang, tetapi kini jalur minoritas. |
| Pengguna ingin aturan berbeda antar nomor dalam satu cabor | Ubah lewat MSG-09 pada nomor tersebut (membuat ruleset turunan). Katalog hanya menetapkan titik awal. |
| Event lama yang sudah punya sport/kategori | Tidak terpengaruh. Layar baru menampilkannya apa adanya; katalog hanya jalur penambahan. |

### Kriteria penerimaan

- Memilih Badminton dan mencentang 5 nomor menghasilkan 1 sport, 1 ruleset, 5 kategori dengan `participant_mode` benar (2 individual, 3 pair).
- Menambahkan Badminton kedua kalinya tidak membuat sport atau ruleset kembar.
- Nomor dengan nama bentrok dilewati dan dilaporkan, sisanya tetap terbuat.
- Jalur "buat sendiri" tetap dapat membuat cabor & nomor di luar katalog.
- Event yang sudah ada sport/kategori sebelum perubahan tetap tampil utuh (uji regresi).

### Risiko

Item terbesar di seluruh dokumen — menyentuh dua langkah wizard sekaligus dan menambah dialog dua tahap. Risiko utamanya bukan teknis melainkan **kurasi**: katalog yang salah secara domain (nomor yang tidak lazim, durasi yang tidak realistis) akan menyesatkan pengguna awam justru pada titik mereka paling percaya sistem. Isi katalog wajib ditinjau sebelum rilis.

---

## MSG-08 — Panel aturan main berlapis + halaman edit ruleset

### Masalah

Form ruleset di wizard hanya membuka 4 field: `scoreType`, `bestOf`, `setBased`, `allowDraw`. Padahal `default_duration_minutes` dan `min_rest_minutes` (dipakai optimizer jadwal), serta `target_score`, `max_score`, `points_win/draw/loss`, dan `tie_breakers` (dipakai klasemen) **tidak ada di mana pun di workspace** — ruleset hanya bisa dibuat di wizard dan tidak ada halaman edit-nya sama sekali. Satu-satunya jalan adalah Payload admin di `/admin`, UI yang berbeda dan tidak pernah disinggung alur wizard.

Efeknya: pengguna menyelesaikan wizard dengan perasaan "sudah beres", lalu optimizer diam-diam memakai durasi default untuk semua cabor dan klasemen memakai tie-breaker kosong. **Ini masalah kebenaran hasil yang menyamar sebagai masalah UX**, dan menjadi alasan MSG-08 dikerjakan menyatu dengan MSG-07.

### Rancangan antarmuka

Panel yang sama dipakai di dua tempat: di dalam dialog katalog (lapis 3 dari "Aturan main"), dan di halaman edit ruleset. Bahasa yang dipakai adalah bahasa domain, dengan penjelasan **kenapa** field itu penting.

```
Aturan main                                              [ ▴ ]
─────────────────────────────────────────────────────────────
Cara menang
  [ 3 set — menang 2 set dulu          ▾ ]
  Poin per set  [ 21 ]      Poin maksimal  [ 30 ]
  ☑ Deuce — harus unggul 2 poin untuk menutup set

Perkiraan waktu
  Durasi satu match       [ 40 ] menit
     Dipakai penjadwalan untuk memesan lapangan.
  Jeda minimal antar main [ 60 ] menit
     Dipakai penjadwalan agar orang yang sama tidak main
     beruntun — berlaku juga lintas cabor.

Klasemen
  Poin  Menang [ 3 ]   Seri [ 1 ]   Kalah [ 0 ]
  Urutan penentu peringkat saat poin sama:
   1. [ Poin              ▾ ]
   2. [ Head-to-head      ▾ ]
   3. [ Selisih set       ▾ ]              [ + Tambah ]

Perebutan juara 3                                    (MSG-01)
   ( ) Tidak ada
   (•) Ada match perebutan juara 3
   ( ) Dua semifinalis kalah sama-sama juara 3
─────────────────────────────────────────────────────────────
```

Dua keputusan penting:

- **Setiap field penjadwalan diberi satu kalimat "dipakai untuk apa".** Tanpa itu, angka 40 dan 60 hanyalah angka; dengan itu, pengguna tahu konsekuensi mengosongkannya.
- **`third_place_policy` dari MSG-01 diletakkan di sini**, bukan di form nomor, karena secara mental ia bagian dari "aturan kompetisi" dan biasanya seragam satu cabor.

### Desain teknis

- **Komponen bersama** `RulesetFieldset.tsx` — dipakai dialog katalog, halaman edit ruleset, dan (nantinya) override per stage MSG-03. Satu sumber kebenaran untuk tata letak dan label.
- **Halaman baru** `/workspaces/event-admin/rulesets` — daftar ruleset event ini beserta nomor mana saja yang memakainya, dan form edit memakai komponen yang sama. Ini menutup ketiadaan jalur edit di luar Payload admin.
- **Override per stage (MSG-03)** memakai komponen yang sama dengan penanda "diwarisi dari nomor" pada field yang belum di-override.
- **Ringkasan satu kalimat** yang tampil di lapis 2 dihasilkan `formatRulesetSummary(ruleset)` di `src/lib/rulesetSummary.ts` — dipakai juga oleh kartu cabor di daftar langkah 3 dan halaman detail nomor.

### Kriteria penerimaan

- Seluruh field `Rulesets` yang berpengaruh pada penjadwalan dan klasemen dapat diisi dan diubah tanpa membuka `/admin`.
- Mengubah `default_duration_minutes` lewat halaman baru mengubah hasil optimizer pada run berikutnya.
- Ringkasan satu kalimat di daftar cabor mencerminkan nilai yang tersimpan.

---

## MSG-09 — Kelola nomor: edit, duplikat, hapus

### Masalah

Daftar kategori di wizard hanya menyediakan pengubahan **status** (`updateCategoryStatusAction`). Tidak ada edit nama/format/mode, tidak ada duplikat, tidak ada hapus. Salah ketik nama nomor atau salah pilih format berarti jalan buntu — pengguna awam akan membuat nomor baru dan meninggalkan yang lama sebagai sampah.

Duplikat juga menjadi jalur utama untuk nomor non-standar: "Futsal U-38 Putra" paling mudah dibuat dengan menduplikasi "Futsal Putra" lalu mengganti namanya.

### Rancangan antarmuka

Menu `[⋯]` pada tiap baris nomor:

```
┌──────────────────────┐
│  Ubah nomor          │
│  Duplikat            │
│  Aturan khusus nomor │
│  ──────────────────  │
│  Hapus               │
└──────────────────────┘
```

- **Ubah nomor** — dialog berisi nama, mode peserta, format, roster.
- **Duplikat** — langsung membuat salinan bernama "… (salinan)" dalam keadaan draft, siap diganti nama. Tidak membuka dialog dulu supaya cepat saat membuat beberapa varian berturut-turut.
- **Aturan khusus nomor** — membuat ruleset turunan khusus nomor ini (memakai `RulesetFieldset` dari MSG-08).
- **Hapus** — hanya diizinkan bila nomor belum punya entry maupun match. Bila sudah, tombol dinonaktifkan dengan penjelasan dan diarahkan ke status `archived` sebagai gantinya.

### Desain teknis

Tiga server action baru di `categoryActions.ts`: `updateCategoryAction`, `duplicateCategoryAction`, `deleteCategoryAction`.

Pengaman pada `deleteCategoryAction` — hitung `competition-entries`, `matches`, dan `stages` yang menunjuk nomor tersebut; bila ada satu pun, tolak dengan `wizardError` yang menjelaskan alasannya. Penghapusan berantai sengaja tidak disediakan: menghapus nomor yang sudah punya match berarti menghapus hasil pertandingan, dan itu bukan sesuatu yang boleh terjadi dari sebuah menu tiga titik.

`duplicateCategoryAction` menyalin seluruh field kecuali `slug` (dibuat ulang dari nama salinan) dan `status` (selalu `draft`). Entry, stage, dan match **tidak** ikut disalin.

### Kriteria penerimaan

- Mengubah nama nomor memperbarui nama tanpa memutus relasi entry/match yang sudah ada.
- Duplikat menghasilkan nomor baru berstatus draft dengan pengaturan identik dan slug berbeda.
- Hapus ditolak untuk nomor yang sudah punya entry atau match, dengan pesan yang menjelaskan.

---

## MSG-10 — Pola konsisten "pilih nomor lalu bertindak"

### Masalah

Tiga langkah melakukan tugas yang sama secara konseptual — pilih satu nomor, lakukan sesuatu padanya — dengan tiga pola antarmuka berbeda:

| Langkah | Pola sekarang |
|---|---|
| Draw & Seeding | dropdown `SearchableSelect` (`page.tsx:2378`) |
| Generate Matches | daftar seluruh nomor dengan tombol per baris (`page.tsx:2583`) |
| Bracket | dropdown switcher (`page.tsx:2706`) |

Untuk event 19 nomor, dropdown memaksa pengguna mengingat nomor mana yang sudah dikerjakan, karena tidak ada satu pun yang menampilkan status seluruh nomor sekaligus. Pola daftar di Generate jelas lebih baik — pengguna melihat semuanya, tahu mana yang siap, dan bertindak langsung.

### Rancangan

Seragamkan ketiganya ke pola daftar milik Generate, dikelompokkan per cabor, dengan penanda status dan penyaring:

```
┌────────────────────────────────────────────────────────────┐
│  6. Draw & Seeding                                         │
│  [ Semua ▾ ]  [🔍 Cari nomor…]     ☑ Sembunyikan yang siap │
│                                                            │
│  🏸 Badminton                                        3/5   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Tunggal Putra    12 peserta · seed siap    ✓  [Atur]│    │
│  │ Ganda Putra       8 peserta · belum di-seed   [Atur]│    │
│  │ Ganda Campuran    belum ada peserta      —          │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  ⚽ Futsal                                            2/2   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Putra             7 tim · seed siap        ✓  [Atur]│    │
│  │ Putri             5 tim · seed siap        ✓  [Atur]│    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

Mengklik `[Atur]` membuka panel kerja nomor tersebut di bawah daftar — pola yang persis sudah dipakai `GroupKnockoutPanel` di langkah Generate, jadi bukan interaksi baru yang harus dipelajari.

"Sembunyikan yang siap" adalah penyaring kecil dengan dampak besar pada event 19 nomor: daftar menyusut seiring pekerjaan selesai, sehingga yang tersisa selalu terlihat.

### Desain teknis

Ekstrak `CategoryWorkList.tsx` — komponen bersama yang menerima daftar nomor beserta status per nomor dan sebuah render-prop untuk aksi baris. Ketiga langkah memakainya dengan definisi status masing-masing:

| Langkah | "Siap" berarti |
|---|---|
| Draw | seluruh entry terkonfirmasi punya `seed_number` |
| Generate | match sudah terbentuk (untuk `group_stage_to_knockout`: bagan knockout sudah ada) |
| Bracket | stage sudah punya bracket dan sudah dipublikasikan |

Definisi "siap" untuk Generate sudah ada persis di `SummaryPanel` (`page.tsx:722-732`, termasuk penanganan khusus `group_stage_to_knockout` yang hanya dianggap siap setelah kualifier dipromosikan). Logika itu diangkat ke satu tempat dan dipakai bersama, bukan disalin.

Pertimbangkan memakai `categoryReadiness.ts` yang sudah ada sebagai sumber status — kontraknya (`blockers`/`warnings`/`nextAction`) sudah lebih kaya daripada yang dibutuhkan di sini. Perlu diperiksa dulu apakah biaya query-nya masuk akal untuk dipanggil di dalam wizard; kalau tidak, versi ringkas dipakai dan `categoryReadiness` tetap melayani halaman analytics.

### Kriteria penerimaan

- Ketiga langkah menampilkan seluruh nomor dikelompokkan per cabor dengan penanda status.
- "Sembunyikan yang siap" menyaring baris tanpa memuat ulang halaman penuh.
- Membuka panel kerja satu nomor tidak menghilangkan daftar.

---

## MSG-11 — Panel Progress yang menskala + tautan readiness

### Masalah

Panel Progress di sisi kanan wizard menampilkan status per nomor sebagai daftar rata (`page.tsx:772-786`). Untuk 19 nomor itu menjadi dinding 19 baris yang harus di-scroll — informasinya benar, tapi bentuknya tidak menskala.

Selain itu, halaman `/workspaces/analytics/readiness` sudah ada dan jauh lebih kaya — blocker, warning, dan `nextAction` per nomor plus deteksi konflik jadwal — tetapi **wizard tidak pernah menautkannya**. Fitur yang sudah dibangun tetapi tidak ditemukan sama saja dengan tidak ada.

### Rancangan

```
┌──────────────────────────┐
│  Progress                │
│  Kompas Gramedia Cup     │
│  24 Agu 2026 · Jakarta   │
│  ──────────────────────  │
│  Kesiapan nomor   12/19  │
│  ████████████░░░░░░      │
│                          │
│  🏸 Badminton      5/5 ✓ │
│  ⚽ Futsal         2/3   │
│     └ Putri: belum ada   │
│       peserta            │
│  🏐 Voli           2/2 ✓ │
│  🏀 Basket         0/2   │
│  … 3 cabor lagi      [▾] │
│                          │
│  Lihat rincian kesiapan →│
│  ──────────────────────  │
│  Cabor              7    │
│  Nomor             19    │
│  Klub               7    │
│  …                       │
└──────────────────────────┘
```

- Dikelompokkan per cabor dengan hitungan ringkas; cabor yang seluruhnya siap menciut jadi satu baris bertanda centang.
- Hanya nomor yang **belum** siap yang dirinci — informasi yang butuh tindakan mendapat ruang, yang sudah selesai tidak.
- Cabor keempat dan seterusnya disembunyikan di balik `[▾]` supaya panel tidak pernah melebihi tinggi layar.
- Satu tautan ke halaman readiness lengkap.

### Desain teknis

Perubahan terbatas pada `SummaryPanel` di `page.tsx:733-786` — kelompokkan `categoryReadiness` menurut `sport_id`, hitung siap/total per cabor, dan render kelompok yang seluruhnya siap sebagai satu baris. Tidak ada perubahan query: `categories` sudah diambil dengan `depth: 1` sehingga `sport_id` sudah berupa objek ber-nama.

Progress bar memakai nilai yang sudah dihitung (`readyCount` / `categoryReadiness.length`).

### Kriteria penerimaan

- Event 19 nomor menampilkan panel yang muat dalam satu layar desktop tanpa scroll internal.
- Cabor yang seluruh nomornya siap tampil sebagai satu baris.
- Tautan ke `/workspaces/analytics/readiness` tersedia dan membuka halaman yang benar.

---

## MSG-12 — Penyederhanaan Setup Assistant

### Masalah

Setup Assistant menanyakan *"tournament type?"* dan *"who's competing?"* satu kali di level event, seolah seluruh event punya satu jawaban. Untuk event multi-cabor jawaban jujurnya adalah "tergantung nomor" — futsal `team`, badminton tunggal `individual`, badminton ganda `pair`. Pertanyaan pertama yang dilihat pengguna adalah pertanyaan yang tidak bisa dia jawab dengan benar.

Memang skippable dan hanya melakukan pre-fill, tetapi framing-nya terlanjur memberi tahu bahwa sistem ini mengharapkan event berformat tunggal — kesan pertama yang salah, di layar pertama.

### Rancangan

Ganti pertanyaan pertama menjadi pertanyaan tentang **skala**, yang selalu bisa dijawab:

```
Seberapa besar event Anda?

  ┌──────────────────────┐  ┌──────────────────────┐
  │  🏆                  │  │  🏅                  │
  │  Satu cabor          │  │  Multi-cabor         │
  │  Satu atau beberapa  │  │  Beberapa cabor,     │
  │  nomor dalam satu    │  │  masing-masing       │
  │  cabang olahraga     │  │  dengan nomornya     │
  └──────────────────────┘  └──────────────────────┘
```

- **Satu cabor** → pertanyaan format tetap ditanyakan seperti sekarang (relevan, karena memang satu jawaban).
- **Multi-cabor** → pertanyaan format diubah menjadi *"Format yang paling umum Anda pakai?"* dengan penjelasan bahwa itu hanya nilai awal dan bisa berbeda per cabor. Jujur terhadap apa yang sebenarnya terjadi.

Pertanyaan `participant_mode` di level event **dihapus** — dengan MSG-07, mode peserta datang dari katalog per nomor, sehingga pertanyaan itu kehilangan gunanya. Pertanyaan "di mana data peserta Anda sekarang?" tetap, karena masih dipakai ParticipantsStep untuk menyorot jalur Bulk Import.

### Desain teknis

- Tambah `setup_event_scale` (`'single_sport' | 'multi_sport'`) ke `Events`, mengikuti pola `setup_*` yang sudah ada — opsional, hanya untuk pre-fill.
- `setup_participant_mode` **tetap ada di schema** dan tetap dibaca kalau terisi (event lama), hanya tidak ditanyakan lagi di layar. Menghapus field berarti migrasi tanpa manfaat.
- `SetupStep` dan `EventStep` menyesuaikan hidden input yang diteruskan.

### Kriteria penerimaan

- Memilih "Multi-cabor" mengubah kalimat pertanyaan format menjadi versi "nilai awal".
- Event lama yang punya `setup_participant_mode` tetap mendapat pre-fill seperti sebelumnya.
- Melewati Setup Assistant sepenuhnya tetap menghasilkan perilaku default yang sama persis (uji regresi).

---
---

## Ringkasan dampak file

| File | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 11 | 12 |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `collections/CompetitionCategories.ts` | ● | ● | | | | | | | | | | |
| `collections/Events.ts` | | ● | | | | | | | | | | ● |
| `collections/Stages.ts` | | | ● | | | | | | | | | |
| `collections/Players.ts` | | | | | ● | | | | | | | |
| `collections/EventMemberships.ts` | | | | | | ● | | | | | | |
| `collections/MedalRecords.ts` *(baru)* | | ● | | | | | | | | | | |
| `lib/matchGeneration.ts` | ● | | | | | | | | | | | |
| `lib/winnerAdvancement.ts` | ● | | | | | | | | | | | |
| `lib/doubleElimination.ts` *(ekstraksi)* | ● | | | | | | | | | | | |
| `lib/medals.ts` *(baru)* | | ● | | | | | | | | | | |
| `lib/brackets.ts` | | ● | | | | | | | | | | |
| `lib/ruleValidation.ts` | | | ● | | | | | | | | | |
| `lib/scheduleOptimizer.ts` | | | ● | ● | | | | | | | | |
| `lib/participantsImport*.ts` | | | | | ● | | | | | | | |
| `lib/sportCatalog.ts` *(baru)* | | | | | | | ● | | | | | |
| `lib/rulesetSummary.ts` *(baru)* | | | | | | | | ● | | | | |
| `access/roles.ts` | | | | | | ● | | | | | | |
| `matches/matchActions.ts` | ● | ● | ● | | | | | | | | | |
| `new-event/page.tsx` | | | | | | | ● | ● | ● | ● | ● | ● |
| `new-event/categoryActions.ts` | | | | | | | | | ● | | | |
| `new-event/sportCatalogActions.ts` *(baru)* | | | | | | | ● | | | | | |
| `SportCatalogPicker.tsx` *(baru)* | | | | | | | ● | | | | | |
| `RulesetFieldset.tsx` *(baru)* | | | ● | | | | | ● | | | | |
| `CategoryWorkList.tsx` *(baru)* | | | | | | | | | | ● | | |
| `/events/[slug]/medals` *(baru)* | | ● | | | | | | | | | | |
| `/workspaces/medals` *(baru)* | | ● | | | | | | | | | | |
| `/workspaces/event-admin/rulesets` *(baru)* | | | | | | | | ● | | | | |
| `scheduler/optimize/page.tsx` | | | | ● | | | | | | | | |

---

## Rencana verifikasi

Setiap item mengikuti siklus yang sudah berlaku di repositori ini:

1. `npm run typecheck` (hapus `.next/dev/types` bila muncul error yang janggal)
2. `npm run test` — unit test untuk logika murni (`buildMedalTally`, penurunan medali, `computeSchedulePlan` dengan filter hari, pemetaan katalog → kategori)
3. `docker restart roc_gms_v2-app-1` sebelum verifikasi langsung
4. Verifikasi terhadap data seed nyata lewat Playwright/skrip, lalu **kembalikan seluruh perubahan data uji**, termasuk efek samping di audit log
5. `npm run test:e2e` lengkap sebelum setiap commit (ulangi sekali bila timeout terjadi pada route yang baru disentuh — artefak kompilasi dingin Turbopack, bukan regresi)
6. Commit granular per item, merujuk ID MSG-nya

Khusus Bagian B, verifikasi visual pada dua lebar viewport (desktop dan mobile) sebelum commit, karena seluruh itemnya menyentuh tata letak.

---

## Hal yang sengaja tidak dicakup

- **Migrasi `photo`/`logo` ke relasi media upload** — layak, tetapi berdiri sendiri dan lebih besar dari MSG-05.
- **Jendela jam berbeda per hari & tanggal blackout** di optimizer — nilainya diukur setelah MSG-04 dipakai.
- **Klasemen kontingen antar-event** (rekap multi-tahun).
- **Kartu berbagi juara/klasemen sebagai gambar** — sudah tercatat sebagai item terbuka di reconciliation AUDIT_UI_UX_CSS.
- **Poin "juara umum" non-medali** (poin partisipasi, poin per kemenangan) — bisa ditambahkan kemudian sebagai metode pemeringkatan ketiga di MSG-02 tanpa mengubah bentuk data.
- **Impor katalog cabor dari sumber eksternal** — katalog sengaja berupa konstanta yang dikurasi manual.
