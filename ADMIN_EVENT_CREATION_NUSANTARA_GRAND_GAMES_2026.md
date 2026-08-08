# Admin Tournament Simulation — Nusantara Grand Games 2026

**Tanggal simulasi:** 2 Agustus 2026  
**Event ID:** `9`  
**Public URL:** `http://localhost:3000/events/nusantara-grand-games-2026`  
**Status:** `live`  
**Visibility:** `published`  
**Active workspace event:** sudah diubah ke **Nusantara Grand Games 2026**  
**Yang perlu dilengkapi pengguna:** hero image pada `/workspaces/event-admin/appearance`

---

## 1. Tujuan simulasi

Simulasi ini dilakukan dari sudut pandang admin turnamen yang baru membuat event besar, bukan sekadar memasukkan satu record event. Alur diuji dari wizard, pengisian sport dan ruleset, category, club/team/player, roster, entry/seeding, venue/court, schedule, standings, bracket, public page, hingga workspace Appearance.

Data volume besar diisi melalui model dan generator internal Payload/ROC agar relationship, hook, match graph, standings, dan bracket cache tetap konsisten. Script bersifat idempotent sehingga dapat dijalankan kembali setelah database lokal di-reset:

```powershell
docker compose exec -T app npx payload run src/scripts/populateNusantaraGrandGames.ts
```

---

## 2. Profil event yang sudah dibuat

| Data | Nilai |
|---|---|
| Nama | Nusantara Grand Games 2026 |
| Tagline | One Nation. Many Arenas. One Grand Stage. |
| Periode | 15 Juli–31 Agustus 2026 |
| Lokasi | Jakarta International Sports Complex |
| Organizer | Nusantara Sports Federation |
| Contact | `committee@nusantara-games.test` |
| Public open | 15 Juni 2026 |
| Registration | 1 Juni–7 Juli 2026 |
| Schedule publish | 10 Juli 2026 |
| Archive | 30 September 2026 |
| Theme | Ocean |
| Hero image | Belum diisi, sengaja diserahkan kepada pengguna |

Public page sudah dapat diakses tanpa session login dan merespons HTTP 200.

---

## 3. Ringkasan data yang sudah masuk

| Collection/fitur | Jumlah |
|---|---:|
| Sports | 8 |
| Rulesets | 8 |
| Competition categories | 10 |
| Clubs | 8 |
| Teams/pairs | 28 |
| Players | 80 |
| Roster memberships | 110 |
| Confirmed competition entries | 100 |
| Venues | 4 |
| Courts/fields/boards/stages | 28 |
| Competition stages | 11 |
| Groups | 2 |
| Matches | 105 |
| Match-set/period score records | 110 |
| Initial standing rows | 28 |
| Published bracket caches | 3 |
| Published announcements | 5 |

### Snapshot pertandingan berjalan per 2 Agustus 2026

| Status | Jumlah | Arti operasional |
|---|---:|---|
| Result published | 58 | Selesai, sudah resmi, menghitung standings/advancement |
| Walkover | 4 | Bye resmi pada bracket table tennis |
| Ongoing | 2 | Sedang dimainkan; termasuk skor parsial basketball 14–12 |
| Paused | 2 | Pertandingan dimulai tetapi sementara dihentikan |
| Finished | 1 | Selesai dimainkan, menunggu publikasi hasil |
| Under review | 1 | Skor lengkap tersedia tetapi masih ditinjau |
| Postponed | 3 | Jadwal baru belum diumumkan |
| Ready to start | 1 | Peserta dan venue siap, pertandingan belum dimulai |
| Published/upcoming | 33 | Pertandingan mendatang sampai final 31 Agustus |

Hasil resmi mempunyai set/period score, `winner_entry_id`, waktu aktual, dan documentation status. Hanya `result_published` dan `walkover` yang memengaruhi standings serta winner advancement. Pertandingan `finished` dan `under_review` sengaja belum dihitung sampai hasilnya dipublikasikan.

Contoh kondisi yang tersedia:

- Badminton Men Singles: Round of 16 selesai; dua quarterfinal resmi, satu under review, dan satu postponed; semifinal baru terisi dari winner resmi.
- Badminton Mixed Doubles: tiga dari lima round-robin rounds sudah selesai.
- Futsal Open: seluruh group matches selesai dan standings terisi; knockout dijadwalkan pertengahan hingga akhir Agustus.
- Basketball 3x3: dua rounds selesai; round ketiga berisi ongoing, paused, dan ready to start.
- Table Tennis: Round of 16 dan quarterfinal selesai; semifinal dijadwalkan 15 Agustus dan final 30 Agustus.
- Rapid Chess: tiga rounds selesai; round keempat berisi ongoing, paused, finished-awaiting-publication, dan postponed.
- Friendship Showcase: satu match selesai dan satu postponed.

### Clubs

1. Jakarta Garuda
2. Bandung Arunika
3. Surabaya Samudra
4. Yogyakarta Cakra
5. Bali Dewata
6. Makassar Phinisi
7. Medan Andalas
8. Kalimantan Borneo

Setiap club memiliki manager, contact email, deskripsi, dan pemain yang terhubung.

### Team dan pair

- 8 futsal squads.
- 8 Mobile Legends squads.
- 6 basketball 3x3 teams.
- 6 badminton mixed pairs.
- Captain dan roster aktif sudah terhubung.

### Venue dan fasilitas

- Gelora Bung Karno Complex.
- Istora Multi-Sport Hall.
- JIExpo Competition Hall.
- Nusantara Archery Ground.
- 4 badminton courts.
- 2 futsal arenas.
- 3 basketball 3x3 courts.
- 4 table-tennis tables.
- 8 chess boards.
- 1 athletics track.
- 4 esports stages.
- 2 archery ranges.

---

## 4. Format kompetisi yang diuji

| Category | Participant | Format yang dipilih | Entry | Kondisi akhir |
|---|---|---|---:|---|
| Badminton Men Singles | Individual | Single elimination | 16 | 15 match, bracket terbit |
| Badminton Mixed Doubles | Pair | Round robin | 6 | 15 match, standings terbit |
| Futsal Open Championship | Team | Group stage to knockout | 8 | 2 group, 12 group matches, 3 knockout matches, bracket cache terbit secara manual |
| Basketball 3x3 Open | Team | Round robin | 6 | 15 match, standings terbit |
| Table Tennis Open Singles | Individual | Single elimination | 12 | Power-of-two bracket 16, 4 bye, 15 match, bracket terbit |
| Rapid Chess League | Individual | League | 8 | 28 match dan standings dibuat dengan league round-robin semantics |
| Futsal Friendship Showcase | Club | Friendly | 4 | 2 exhibition matches |
| 100m Sprint Open | Individual | Time trial | 16 | Entry/stage siap, engine hasil belum tersedia |
| MLBB Open | Team | Double elimination | 8 | Entry/roster/stage siap, double-elimination engine belum tersedia |
| Archery Open Ranking | Individual | Score ranking | 16 | Entry/stage siap, attempt/ranking engine belum tersedia |

### Bracket yang berhasil dibuat

- Badminton Men Singles — 16 seed.
- Table Tennis Open Singles — 12 peserta, termasuk bye handling.
- Futsal Open Championship — semifinal dan final sebagai stage kedua.

Ketiganya tampil pada:

`http://localhost:3000/events/nusantara-grand-games-2026/brackets`

---

## 5. Temuan paling kritis

### F-01 — Slug sport terdeteksi duplikat dari event lain

**Bukti runtime:**

1. Event baru dibuat melalui wizard.
2. Pada Step 2, nama sport diisi `Badminton`.
3. Field slug dibiarkan kosong karena berlabel “advanced”.
4. Sistem menghasilkan `badminton` di server.
5. Form kembali dengan `wizardError=duplicate_slug` dan pesan “That slug is already used”.
6. Event baru masih memiliki 0 sport, walaupun `Badminton` belum pernah dibuat di event tersebut.

**Akar teknis:**

- `Sports.slug`, `Clubs.slug`, `Teams.slug`, `CompetitionCategories.slug`, dan `Rulesets.slug` memakai `unique: true` global.
- Server action melakukan duplicate query hanya dengan `where: { slug: ... }`, tanpa `event_id`.
- Import participant mengulang pola global yang sama.
- Akibatnya nama wajar seperti Badminton, Men Singles, Garuda, atau Team A hanya dapat digunakan sekali untuk seluruh installation.

**Workaround pada data simulasi:** seluruh slug non-event diberi prefix `nusantara-grand-games-2026-`.

**Solusi permanen:** lihat Bagian 9.

### F-02 — Pilihan format lebih banyak daripada kemampuan generator

Category form menawarkan:

- single elimination;
- double elimination;
- round robin;
- group stage to knockout;
- league;
- friendly;
- time trial;
- score ranking.

Namun `AUTO_GENERATE_FORMATS` hanya berisi:

- `single_elimination`;
- `round_robin`.

Di Step 6, lima category pada event ini mempunyai 4–16 confirmed entries tetapi tombol **Generate Matches** disabled. Ini menciptakan false promise: admin diperbolehkan memilih format saat setup, tetapi baru diberi tahu jauh di akhir bahwa format tersebut tidak dapat digenerate.

### F-03 — Round-robin generator menghasilkan pairings, bukan ronde

`generateRoundRobinPairings()` membuat semua kombinasi pasangan, tetapi memberi nama `Round Robin Match 1`, `Match 2`, dan seterusnya. Tidak ada circle scheduling atau pengelompokan ronde di mana setiap participant tampil maksimal satu kali.

Jika jadwal disusun berdasarkan urutan output itu, satu participant dapat memperoleh beberapa pertandingan pada waktu yang sama/berdekatan. Data simulasi akhirnya memakai circle method di script agar 6 peserta menghasilkan 5 ronde × 3 match, dan 8 peserta menghasilkan 7 ronde × 4 match.

### F-04 — Group-to-knockout belum benar-benar end-to-end

Data dapat dimodelkan sebagai dua stages:

1. Group Stage dengan Group A/B dan standings.
2. Single Elimination stage dengan semifinal/final.

Namun sistem belum memiliki:

- UI pembagian entry ke group;
- generator group round-robin;
- promotion rule seperti A1 vs B2 dan B1 vs A2;
- freeze/finalize standings sebelum promotion;
- otomatisasi entry qualifier ke knockout;
- bracket tab pada halaman category `group_stage_to_knockout`.

Bracket Futsal berhasil dibuat dan tampil pada global Brackets page, tetapi halaman category Futsal hanya menampilkan Standings, Schedule, dan Details & Rules. Bracket stage kedua tidak ditemukan dari category navigation.

### F-05 — Status `qualified` muncul sebelum satu pun match dimainkan

Karena `group_qualify_count=2`, standings awal dengan statistik seluruhnya nol langsung memberi status `qualified` kepada posisi 1–2. Sebelum hasil tersedia, status yang benar seharusnya:

- `pending`, atau
- `provisional` dengan penjelasan “current qualification position”.

`qualified` final baru boleh diberikan setelah stage/group selesai atau dikunci admin.

### F-06 — Draft category bocor ke public page

100m Sprint, MLBB Double Elimination, dan Archery Ranking sengaja berstatus `draft` karena engine-nya belum tersedia. Walaupun demikian, ketiganya tetap tampil pada public event homepage dan Sports page.

Category status saat ini bukan publication boundary. Public query perlu membatasi status ke `open`, `locked`, atau `published` sesuai lifecycle yang disepakati.

### F-07 — Wizard menampilkan 100% walaupun category belum siap

Step 6 dan Step 7 menunjukkan **100% complete** karena event memiliki aggregate sports/categories/participants/entries/matches. Persentase tidak mengevaluasi setiap category.

Dalam event ini:

- tiga draft categories belum memiliki engine;
- dua format lain hanya dapat disiapkan manual;
- hero belum ada;
- tetapi wizard dan dashboard tetap menyatakan 100%/8 dari 8.

Readiness harus dihitung per category dan berdasarkan dependency, bukan sekadar `count > 0` pada event.

### F-08 — Bracket step menjadi dead end tanpa `categoryId`

Membuka:

`/workspaces/event-admin/new-event?eventId=9&step=bracket`

menampilkan “Generate matches for a category first”, padahal event memiliki 105 matches dan 3 bracket caches. Tidak ada category selector atau daftar bracket pada state tersebut. Step 7 hanya berguna jika URL membawa `categoryId` dari redirect sebelumnya.

### F-09 — Event baru tidak otomatis menjadi active event

Sesudah wizard membuat event ID 9, main workspace masih menunjuk event lama `Test User`. Admin dapat mengisi wizard event baru, lalu menekan menu sidebar dan tanpa sadar masuk ke event lama.

Active event baru harus otomatis ditetapkan setelah create, atau wizard harus selalu menunjukkan event switch confirmation sebelum keluar.

### F-10 — Scheduler menunjukkan 73 false-positive participant conflicts

Setelah round schedule dan seluruh venue overlap nyata diperbaiki, Scheduler masih menampilkan:

- 73 participant conflicts;
- 0 venue/court conflicts;
- 0 missing schedule fields;
- 0 invalid time ranges.

Contoh:

`Chess match` dan `Badminton match` dianggap conflict karena kedua atlet berasal dari **Medan Andalas**, walaupun orangnya berbeda.

**Akar masalah:** conflict detector memasukkan `club_id` sebagai participant identity untuk semua entry. Artinya, dua atlet atau dua team dari club yang sama tidak boleh bertanding bersamaan di event multi-sport.

**Semantik yang benar:**

- `entry_type=individual` → identity adalah `player_id`.
- `entry_type=pair/team` → identity adalah `team_id`, kemudian roster players bila ingin deteksi lintas category.
- `entry_type=club` → identity adalah `club_id`.
- Parent club adalah atribut organisasi, bukan participant identity universal.

Data tidak dimanipulasi dengan menghapus relasi club hanya untuk membuat angka conflict menjadi nol. Relasi data tetap benar agar bug terlihat jujur.

### F-11 — Interval yang bersentuhan dianggap overlap

Conflict engine menggunakan kondisi inklusif:

```text
a.start <= b.end && b.start <= a.end
```

Match 08:00–09:00 dan 09:00–10:00 dianggap overlap. Jika pergantian tepat pada end time diperbolehkan, kondisi yang lazim adalah interval setengah terbuka:

```text
a.start < b.end && b.start < a.end
```

Jika venue memerlukan changeover, buffer sebaiknya menjadi aturan terpisah per sport/court, misalnya 10–15 menit, bukan efek samping operator `<=`.

### F-12 — Dashboard “All generated matches are scheduled” tidak berarti schedule valid

Sebelum perbaikan slot, dashboard menyatakan semua match scheduled walaupun conflict engine menghitung 272 konflik. Badge hanya memeriksa kelengkapan waktu/court, bukan:

- venue collision;
- participant collision;
- minimum rest;
- cross-category roster collision;
- dependency antar-round;
- match selesai sebelum next-round dimulai.

Gunakan status terpisah:

- 100/100 assigned;
- 0 missing fields;
- 0 hard conflicts;
- N warnings;
- publish readiness blocked/unblocked.

### F-13 — Match model tidak cocok untuk time trial dan score ranking

`Matches` hanya memiliki participant A dan participant B. Time trial dan archery ranking membutuhkan konsep lain:

- heat/session;
- banyak entrants per heat;
- lane/target;
- attempt;
- measured value + unit;
- DNS/DNF/DSQ;
- wind/reaction time untuk athletics bila dibutuhkan;
- ranking dan qualification cutoff.

Memaksa format ini menjadi head-to-head match akan menghasilkan data palsu. Karena itu stage dan entry telah disiapkan, tetapi match tidak dibuat.

### F-14 — Double elimination membutuhkan loser advancement graph

Match saat ini hanya memiliki satu `next_match_id` dan `next_match_slot` untuk winner. Double elimination memerlukan:

- `winner_next_match_id/slot`;
- `loser_next_match_id/slot`;
- winners/losers bracket round identity;
- grand final reset policy;
- seeding dan bye handling lintas dua bracket.

MLBB Open tetap draft sampai capability tersebut tersedia.

### F-15 — Form awal terlalu sedikit untuk event besar

Create Event step hanya meminta nama, slug, start/end, location, organizer, dan optional logo. Data yang hampir selalu dibutuhkan tetapi harus diisi setelahnya:

- timezone;
- description dan hero tagline;
- contact email;
- registration window;
- public open/publish date;
- schedule publication date;
- archive date;
- visibility/status strategy;
- event type/size/template.

Solusinya bukan menaruh semua field pada halaman pertama. Gunakan “Basics” minimal, kemudian lifecycle/readiness checklist dengan default yang jelas.

---

## 6. Hal yang sudah bekerja dengan baik

- Event slug pada Step 1 sekarang otomatis mengikuti nama dan field tidak required.
- Failed event submission mempertahankan data input.
- Duplicate event slug menyediakan jalur suggestion di source.
- Event creator otomatis mendapat event membership.
- Single-elimination topology membuat seluruh ronde dan explicit next-match graph.
- Bye direpresentasikan sebagai auditable walkover.
- Bracket cache dapat dibangun dari match source-of-truth.
- Standings dapat dibuat untuk round-robin, group stage, dan league stage.
- Scheduler mendeteksi venue, participant, missing field, dan invalid time range.
- Active event switcher berhasil mengubah semua workspace setelah refresh.
- Public event page sudah kaya: countdown, sports, matches, standings, updates, organizer, schedule, dan brackets.
- Appearance sudah aktif pada Ocean theme dan siap menerima hero image.

---

## 7. Capability matrix yang direkomendasikan

| Format | Status produk yang seharusnya ditampilkan | Generator | Result model | Public surface |
|---|---|---|---|---|
| Single elimination | Supported | Ya | Match/set/score | Bracket + schedule |
| Round robin | Supported setelah round algorithm diperbaiki | Circle method | Standings | Standings + schedule |
| League | Supported via round-robin engine | Circle method + legs | Standings | Standings + schedule |
| Friendly | Manual supported | Pairing/manual | Match result | Schedule/result |
| Group-to-knockout | Beta/partial sampai promotion siap | Group template + qualifier promotion | Standings + bracket | Kedua surface dalam satu category |
| Double elimination | Coming soon/disabled | Belum | Winner+loser advancement | Winners/losers bracket |
| Time trial | Coming soon/disabled | Heat/lane generator | Measured attempts | Heat + ranking |
| Score ranking | Coming soon/disabled | Session/target generator | Attempts/aggregate | Ranking + qualification |

Format yang belum didukung sebaiknya terlihat disabled dengan label “Coming soon”, bukan dapat dipilih lalu gagal pada Step 6.

---

## 8. Readiness model yang lebih benar

### Event-level readiness

- Basic identity selesai.
- Timezone dan date window valid.
- Public URL tersedia.
- Contact/organizer tersedia.
- Appearance minimum selesai; hero dapat menjadi warning, bukan blocker.
- Setidaknya satu category publishable.
- Tidak ada draft category yang bocor publik.

### Category-level readiness

Setiap category harus memiliki status sendiri:

1. Format didukung.
2. Ruleset lengkap.
3. Entry count memenuhi minimum.
4. Roster memenuhi batas.
5. Seed/group assignment valid.
6. Stage topology tersedia.
7. Matches generated.
8. Semua match assigned.
9. Tidak ada hard conflict.
10. Public preview lolos.

Aggregate event dianggap ready bila semua category yang akan dipublish lulus. Draft/cancelled category tidak boleh menipu progress dan tidak boleh tampil publik.

---

## 9. Solusi terbaik untuk slug

### 9.1 Bedakan public event URL dan internal entity key

`Event.slug` memang harus global unique karena route public berbentuk `/events/[eventSlug]`. Namun sport, category, club, team, dan ruleset hidup di dalam event. Mereka tidak perlu global unique.

### 9.2 Kontrak uniqueness

| Entity | Unique yang benar |
|---|---|
| Event | `slug` global |
| Sport | `(event_id, slug)` |
| Ruleset | `(event_id, slug)` atau `(sport_id, slug)` |
| Category | `(event_id, slug)` atau `(sport_id, slug)` |
| Club | `(event_id, slug)` |
| Team | `(event_id, slug)` |
| Article/announcement | `(event_id, slug)` bila URL berada dalam event |
| Match number | `(event_id, match_number)` |
| Player employee ID | Sesuai tenant: global hanya jika benar-benar corporate-global; biasanya `(event_id, employee_id)` |

### 9.3 Implementasi database

Pilihan terbaik adalah composite unique index melalui migration:

```sql
CREATE UNIQUE INDEX sports_event_slug_unique
ON sports (event_id, slug);
```

Ulangi untuk entity event-scoped, lalu hapus constraint global pada `slug`.

Jika Payload field config belum mendukung composite unique secara langsung, gunakan hidden `scope_key`:

```text
scope_key = event_id + ":" + slug
```

`scope_key` dibuat pada `beforeValidate`/`beforeChange` dan diberi `unique: true`. Database migration tetap lebih eksplisit dan mudah diinspeksi.

### 9.4 UX admin

- Admin hanya mengisi **Name**.
- Slug dibuat otomatis dan disembunyikan di “Advanced URL settings”.
- Preview URL ditampilkan sebagai read-only.
- Perubahan slug setelah publish menampilkan warning broken links dan membuat redirect dari slug lama.
- Jika duplicate dalam event yang sama, sistem otomatis menawarkan `badminton-2` atau meminta admin membedakan nama.
- Error menyebut scope dengan jelas: “Badminton already exists in Nusantara Grand Games 2026”.
- Import dan manual form memakai validator yang sama.
- Nama sama di event lain tidak pernah menjadi error.

### 9.5 Query server action

Duplicate check entity event-scoped harus berbentuk:

```ts
where: {
  and: [
    { event_id: { equals: eventId } },
    { slug: { equals: slug } },
  ],
}
```

Perubahan query saja belum cukup jika constraint database masih global; keduanya harus diubah bersama.

---

## 10. Prioritas perbaikan

### P0

1. Ubah slug non-event menjadi event-scoped composite uniqueness.
2. Filter draft/archived category dari public queries.
3. Jangan tampilkan format yang generator/result model-nya belum ada sebagai supported.
4. Perbaiki participant identity pada conflict detector.
5. Ganti readiness aggregate menjadi per-category validation.

### P1

1. Implementasikan round-robin circle method dan proper round labels.
2. Implementasikan group assignment, qualifier promotion, dan bracket tab untuk group-to-knockout.
3. Auto-set event baru sebagai active event.
4. Perbaiki Bracket step agar menampilkan category selector dan seluruh bracket existing.
5. Gunakan half-open interval atau configurable changeover buffer.
6. Status qualification harus provisional sampai stage selesai.

### P2

1. Bangun multi-participant heat/attempt/ranking model.
2. Bangun double-elimination winner/loser graph.
3. Tambah schedule optimization untuk rest time, roster cross-category, venue capacity, dan broadcast priority.
4. Tambah public registration/My Team/My Schedule.

---

## 11. Handoff kepada pengguna

Data utama sudah tersimpan, event sudah aktif di workspace, theme Ocean sudah dipilih, dan halaman Appearance sudah dibuka. Pengguna cukup:

1. Buka `/workspaces/event-admin/appearance`.
2. Pastikan active event adalah **Nusantara Grand Games 2026**.
3. Pilih hero image maksimal 8 MB.
4. Tekan **Save appearance**.
5. Periksa public preview pada `/events/nusantara-grand-games-2026`.

Catatan: tiga draft capability categories tetap sengaja dipertahankan sebagai bukti data untuk Time Trial, Double Elimination, dan Score Ranking. Mereka tidak dapat dianggap production-ready sampai engine dan public status filtering diperbaiki.
