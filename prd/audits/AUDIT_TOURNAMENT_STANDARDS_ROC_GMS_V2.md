# Audit Standar Turnamen & Bracket ROC GMS V2

Tanggal audit: 9 September 2026
Workspace: `roc_gms_v2`
Stack: Next.js 16, React 19, Payload CMS 3, PostgreSQL
Jenis audit: static code review menyeluruh terhadap seluruh fitur, dibandingkan dengan standar/konvensi umum sistem turnamen dan bracket yang dipakai publik (Challonge, Toornament, start.gg/Battlefy) serta aturan kompetisi olahraga standar (seeding, tie-breaker, medali, walkover, dsb) - bukan sekadar tinjauan kualitas kode generik.

Audit sebelumnya ada di [`AUDIT_E2E_ROC_GMS_V2.md`](./AUDIT_E2E_ROC_GMS_V2.md) (2 Agustus 2026, dibandingkan dengan Tournify). Audit ini **tidak mengulang temuan yang sudah diperbaiki** - setiap bagian di bawah mencatat status re-verifikasi terhadap temuan lama yang relevan (AUTH-01, AUTH-02, MAT-01..09, STD-01..07, REG-01, GEN-01/02, dll).

## 1. Ringkasan eksekutif

| Area | Status standar | Catatan |
|---|---|---|
| Bracket & seeding | Baik, dengan 1 gap penting | Seeding standar & bye placement sudah benar (BRK-01/02 lama sudah fix). Gap baru: Quick Bracket double-elimination tanpa bracket reset, tidak diberitahukan ke pengguna. |
| Match lifecycle & scoring | Baik, beberapa gap nyata | Mayoritas MAT-01..09 lama sudah fix (transisi status, live-score atomic update, walkover advance bracket). Gap baru: hasil seri (draw) tidak bisa dipublikasi meski ruleset mengizinkan; double-elimination tidak bisa dikoreksi setelah publish. |
| Scheduling, standings & medali | Sedang | Optimizer punya aturan istirahat minimum tapi jalur manual (yang dipakai admin sehari-hari) tidak; timezone event tidak konsisten dipakai di semua jalur; tie-break round-robin hanya 2 arah. |
| Registrasi & import peserta | Sedang | Alur registrasi publik + approval sudah ada (REG-01 lama sudah fix), tapi tidak ada kapasitas/waitlist otomatis, tidak ada cek duplikasi, dan validasi ukuran roster hanya di form publik. |
| Otorisasi & keamanan | **Kritis - perlu tindakan segera** | Model `EventMemberships` sudah benar dibangun, TAPI hampir seluruh Server Action workspace memakai Payload Local API tanpa `overrideAccess: false`, yang membuat seluruh scoping event tersebut **tidak berjalan** di jalur yang justru paling sering dipakai organizer. |
| Quick Bracket UX & Billing | Sedang | Fitur baru sesi ini (edit Score/Schedule/Venue) sudah diverifikasi jalan dan sudah diperbaiki 1 bug timezone yang ditemukan selama audit. Beberapa gap UX billing standar (grace period tidak ditampilkan, dsb). |

**Total temuan: 51** (target awal 25-50 poin).

**Verdict:** Fondasi domain turnamen (bracket, seeding, scoring, standings) sudah jauh lebih matang dibanding audit sebelumnya dan banyak yang sudah sesuai konvensi standar. Namun **SEC-01 bersifat mengunci ulang temuan lama AUTH-01/AUTH-02 secara efektif** - perbaikan scoping per-event yang sudah dibangun tidak benar-benar aktif di UI yang dipakai organizer. Ini harus jadi prioritas P0 sebelum sistem dipakai untuk lebih dari satu organizer yang tidak saling percaya.

## 2. Ruang lingkup & metode

Diperiksa oleh 5 sub-agent riset paralel (baca-saja, tidak mengubah kode) plus verifikasi langsung penulis pada fitur yang baru dibangun sesi ini:

1. Generasi bracket & standar seeding (single/double elimination, bye, grand final reset, round naming).
2. Match lifecycle, live scoring, walkover, reversibilitas hasil.
3. Scheduling, konflik venue/waktu, standings (tie-breaker round-robin), medal tally.
4. Registrasi publik, roster/participant management, import Excel.
5. Otorisasi lintas-event, keamanan, integritas data - termasuk re-verifikasi AUTH-01/AUTH-02 dari audit lama.
6. Quick Bracket Tournament (fitur baru sesi ini) dan Billing/Licensing (Berlanggan) - diperiksa langsung oleh penulis, termasuk 1 bug timezone yang ditemukan dan diperbaiki di tempat.

Batasan: audit statis (baca kode) + verifikasi browser langsung untuk fitur Quick Bracket yang baru dibangun. Tidak menjalankan penetration test aktif terhadap deployment produksi.

## 3. Temuan: Bracket generation & seeding

Ringkasan sub-agent: mesin seeding/bye single-elimination (`matchGeneration.ts`) sudah memakai penempatan standar (seed 1 vs N, dst), bye ke seed teratas tersebar merata, dan advancement pakai graph `next_match_id` eksplisit - BRK-01/BRK-02 dari audit lama **sudah benar-benar fix**. Double-elimination pada alur event asli (bukan Quick Bracket) sudah mengimplementasikan bracket reset dengan benar sesuai aturan standar.

#### BRK-01 — High — Quick Bracket double elimination diam-diam melewati bracket reset tanpa pemberitahuan di UI

`src/lib/quickBracketAdvancement.ts:425-432` membuat siapa pun yang menang di grand final langsung jadi juara - termasuk saat finalis dari losers bracket (belum kalah sama sekali di final) mengalahkan finalis winners bracket di game pertama, padahal double-elimination standar mewajibkan game kedua ("bracket reset") dalam situasi ini. Ini fitur yang benar-benar dipakai publik (bukan preview), tapi `QuickBracketForm.tsx:137-141` hanya menjelaskan format sebagai "Lose once, fight back through the losers bracket" tanpa menyebut reset yang hilang. Tim losers-bracket yang berhasil comeback ke grand final dan menang dinyatakan juara hanya dengan satu kemenangan atas finalis yang sebelumnya tak terkalahkan - format yang secara materiil lebih lemah dari "double elimination" sesungguhnya seperti dipahami di Challonge/Toornament/start.gg.

**Perbaikan:** Tambahkan match reset ke alur double-elimination Quick Bracket (meniru `doubleElimination.ts` yang sudah benar), atau tambahkan penjelasan eksplisit di kartu pemilihan format dan di match grand final ("tidak ada bracket reset - grand final hanya satu game").

#### BRK-02 — Medium — `ensureSingleEliminationBracketStructure` sudah jadi kode mati untuk semua bracket yang dihasilkan generator saat ini

`src/lib/bracketRepair.ts:24-25` men-syarat-kan perbaikan pada `round_name` yang mengandung kata "first" - generator saat ini tidak pernah menghasilkan nama round seperti itu, sehingga fungsi ini tidak berbuat apa-apa untuk bracket manapun yang dibuat kode saat ini (hanya relevan untuk data legacy pra-refactor). Bahkan pada kasus legacy itu pun, match downstream yang dibuat tidak mendapat `next_match_id`, sehingga tetap tidak bisa auto-advance.

**Perbaikan:** Hapus jalur repair usang ini jika tidak ada data legacy tersisa, atau ubah agar mendeteksi berdasarkan `generation_source`/ketiadaan `next_match_id` (bukan substring nama round), dan pastikan `next_match_id` benar-benar terpasang.

#### BRK-03 — Medium — Grand Final Reset ditampilkan ke penonton sebelum diketahui apakah dibutuhkan

`src/app/(frontend)/brackets/doubleEliminationSections.tsx:26` menampilkan match `grandFinalReset` selama statusnya bukan `'cancelled'` - padahal match ini dibuat di awal dengan status `'draft'` (`doubleElimination.ts:325-337`), sebelum grand final dimainkan sama sekali. `bracketTree.tsx` tidak punya penanganan khusus untuk status `'draft'` ini, sehingga tampil sejak awal seolah game kedua pasti terjadi, padahal kondisional.

**Perbaikan:** Sembunyikan kartu reset selagi statusnya `'draft'`, atau beri label "jika diperlukan" selama draft.

#### BRK-04 — Low — Deteksi juara bisa salah jika round final diganti nama manual

`brackets.ts`'s `getRoundOrder` (baris 162-177) memberi urutan `100` untuk nama round apa pun yang tidak cocok kata kunci standar ("final", "semi", dst). Jika admin mengganti nama round final menjadi sesuatu yang tak mengandung "final" (mis. "Championship Match"), deteksi juara bisa membaca match yang salah. Tidak tercapai lewat nama round hasil generator otomatis, hanya lewat edit manual.

**Perbaikan:** Deteksi juara dari topologi bracket sesungguhnya (match tanpa `next_match_id`), bukan dari urutan hasil parsing nama round.

#### BRK-05 — Low — Pemasangan losers bracket tidak pernah menghindari rematch langsung

`doubleElimination.ts:65-68` selalu memasangkan berdasarkan indeks berdekatan, sudah didokumentasikan di kode sebagai simplifikasi yang disengaja (bukan defect). Banyak konvensi double-elimination standar sengaja mengacak agar dua peserta yang baru saja bertanding di winners bracket tidak langsung bertemu lagi di losers bracket.

**Perbaikan:** Opsional - jika ingin fidelitas lebih tinggi, terapkan rotasi seed standar losers bracket; prioritas rendah karena tidak memengaruhi korektnes.

#### BRK-06 — Low — Risiko tabrakan sesama-grup pada seeding cross-group untuk 3+ grup (sudah terdokumentasi, sudah ada mitigasi UI)

`matchGeneration.ts:452-461`'s `computeCrossGroupQualifierOrder` memang tidak selalu menghindari pasangan babak pertama dari grup yang sama untuk 3+ grup - tapi sudah ada peringatan UI (`QualifierSeedOrder.tsx:57-58`) dan opsi reorder manual, jadi bukan defect diam-diam. Dicatat sebagai risiko residual yang sudah didokumentasikan, bukan bug aktif.

## 4. Temuan: Match lifecycle & live scoring

Ringkasan sub-agent: alur match-day pada event asli jauh lebih matang dari audit lama - MAT-01 s/d MAT-09 lama sebagian besar **sudah fix** (pemilihan pemenang tersentralisasi, live-score pakai atomic update SQL, status `under_review`/`disputed` sudah terhubung ke state machine nyata, walkover meng-advance bracket, dan membuka-ulang hasil single-elimination yang sudah dipublikasi dengan benar menarik-mundur advancement downstream).

#### MATCH-01 — Critical — Hasil seri (draw) yang sah tidak pernah bisa dipublikasikan

`src/collections/Rulesets.ts` memodelkan `allow_draw`, `src/lib/ruleValidation.ts:39` mengizinkan skor seri saat `allow_draw` aktif, dan `src/lib/standings.ts:287` menghitung `isDraw` dari `winner_entry_id` kosong dengan skor sama. Dropdown "Winner" bahkan menawarkan opsi "No winner / draw" (`workspaces/(shell)/matches/[matchNumber]/page.tsx:504`). Tapi `result_published` diberi `requiresWinnerSelection: true` tanpa syarat di `matchLifecycle.ts:38-44`, dan `performMatchTransition` (`matchActions.ts:581-583`) selalu menolak transisi jika `winner_entry_id` kosong - terlepas dari `allow_draw`. Pertandingan sepak bola yang sah berakhir 1-1 tidak bisa pernah dipublikasikan hasilnya.

**Perbaikan:** Lewati pengecekan `requiresWinnerSelection` untuk `result_published` ketika `allow_draw` ruleset true dan hasil yang diturunkan memang seri (bukan "belum diputuskan").

#### MATCH-02 — High — Hasil double-elimination tidak pernah bisa dikoreksi setelah dipublikasikan

`matchActions.ts:557-559`: `isReopenPublished` selalu mengembalikan `reopen_not_supported` untuk `stageType === 'double_elimination'`. Satu-satunya jalan keluar adalah "Undo Phase" (menghapus semua hasil lain di bracket) atau menandai `disputed` (tidak menarik-mundur pemenang yang salah tercatat). Salah tap pemenang oleh match officer adalah kesalahan umum di dunia nyata, terutama pada bracket besar (esports/beladiri).

**Perbaikan:** Perluas pendekatan `retractSingleEliminationAdvancement` ke double elimination (minimal blokir reopen begitu peserta yang di-advance sudah main lagi, tapi izinkan sebelum itu).

#### MATCH-03 — Medium — Tidak ada jalur walkover/retirement setelah match sudah dimulai

`matchLifecycle.ts:71-77`: transisi "Mark Walkover" hanya dari status `['scheduled', 'published', 'ready_to_start']` - tidak termasuk `ongoing`/`paused`. Retirement di tengah pertandingan (cedera, diskualifikasi) adalah praktik standar yang perlu dibedakan dari kekalahan biasa untuk keperluan standings/statistik, tapi tidak ada jalur untuk itu di sini.

**Perbaikan:** Tambahkan `ongoing`/`paused` ke daftar `from` transisi walkover (atau tambahkan status `retired` terpisah).

#### MATCH-04 — Medium — Indikator "live" di halaman publik bersifat kosmetik, tidak ada mekanisme live-update sungguhan

`publicMatchComponents.tsx:165-169` menampilkan titik berdenyut "live" saat status `ongoing`/`paused`, tapi prop `liveIndicator` yang menggerakkannya tidak pernah benar-benar dipasang dengan mekanisme polling/WebSocket/SSE apa pun - skor hanya update lewat refresh manual. Penonton yang menonton "live" mendapat janji visual yang tidak dipenuhi.

**Perbaikan:** Sambungkan indikator ke mekanisme polling/SSE sungguhan, atau hapus animasi "live" agar tidak menjanjikan sesuatu yang tidak ada.

#### MATCH-05 — Medium — Penyederhanaan scoring Quick Bracket tidak dijelaskan ke organizer

`MatchDetailsPanel` di `bracketTree.tsx` menampilkan dua input angka polos tanpa ruleset/struktur set, tanpa keterangan bahwa ini model yang disederhanakan (penjelasannya hanya ada di komentar kode `quickBracketAdvancement.ts:12-23`, tidak sampai ke UI). Organizer yang terbiasa dengan alur Match Officer penuh (skor per-set, tervalidasi ruleset) bisa bingung.

**Perbaikan:** Tambahkan catatan singkat inline di tab Score ("Entri skor cepat - tanpa pelacakan per-set; klik ulang pemenang untuk mengoreksi kesalahan").

#### MATCH-06 — Low — Status Disputed/Under Review tidak terjangkau dari alur kerja match-day sungguhan

Halaman Match Officer dan Live Score memfilter status ini keluar dari daftar tampilan - kedua aksi hanya ada di halaman Match Details penuh, yang tidak ada tautannya dari layar mobile-first yang dipakai officer di match-day.

**Perbaikan:** Tampilkan tautan "Match details" (atau aksi Review/Dispute langsung) begitu match mencapai `finished`.

#### MATCH-07 — Low — Jalur revisi skor manual tidak punya proteksi konkurensi

Berbeda dari `applyLiveScorePoint` (tap "+1") yang pakai atomic `UPDATE ... SET score = score + delta`, `updateMatchSetScoreAction` (form "Score Input" untuk koreksi nilai absolut) baca-lalu-tulis tanpa cek versi. Dua official yang mengoreksi set yang sama nyaris bersamaan bisa saling menimpa tanpa peringatan.

**Perbaikan:** Tambahkan pengecekan optimistic-concurrency (bandingkan `updatedAt` sebelum menulis) pada jalur ini juga.

#### MATCH-08 — Low — Transisi status match sendiri tidak punya optimistic lock

`performMatchTransition` membaca status, memvalidasi, lalu menulis tanpa re-cek di antara keduanya. Race lebih jarang terjadi dibanding MATCH-07 tapi celahnya sama jenisnya.

**Perbaikan:** Sertakan status yang diharapkan dalam klausa `where` saat `payload.update`, agar transisi basi gagal bersih, bukan diam-diam menimpa perubahan bersamaan.

#### MATCH-09 — Low (belum pasti) — Field `score_type` tampaknya kosmetik saja

`Rulesets.ts:54-66` mendefinisikan pilihan `score_type` (points/goals/sets/time/result/custom), tapi tidak ada kode validasi/derivasi yang benar-benar membacanya - semuanya memakai `set_based`/`best_of`/`target_score` terlepas dari `score_type` yang dipilih. Belum ditelusuri tuntas, mungkin hanya memengaruhi label tampilan.

**Perbaikan:** Sambungkan `score_type` ke validasi/label di tempat relevan, atau dokumentasikan di admin bahwa field ini presentasional saja.

## 5. Temuan: Scheduling, standings & medali

Ringkasan sub-agent: logika lebih matang dari snapshot audit lama - banyak temuan STD lama sudah fix. Gap nyata terkonsentrasi di tiga area: (1) jalur scheduling manual (yang dipakai admin sehari-hari) menegakkan cek tumpang-tindih tapi bukan jeda istirahat minimum; (2) tie-break standings hanya berlaku 2 arah; (3) derivasi medali bisa macet permanen karena satu match yang dibatalkan, dan diam-diam membuang entry yang tidak terhubung ke klub dari tabel medali publik.

#### SKD-01 — High — Cek konflik scheduling manual menegakkan tumpang-tindih waktu tapi tidak pernah jeda istirahat minimum

`scheduler/conflicts.ts:37-61` hanya menandai konflik jika rentang waktu dua match benar-benar beririsan. Tidak ada konsep `min_rest_minutes` di sini, padahal `scheduleOptimizer.ts:245-247` sudah mengimplementasikannya - tapi hanya berlaku saat optimizer otomatis yang mengusulkan slot, bukan saat admin menjadwalkan manual lewat `AddMatchDialog`/`RescheduleMatchDialog`/import Excel.

**Perbaikan:** Salurkan `min_rest_minutes` dari ruleset ke `detectScheduleConflicts` juga, sehingga aturan jeda istirahat konsisten di semua jalur.

#### SKD-02 — High — Cek konflik tidak dibatasi per-event dan punya batas keras 500/1000 match

`schedulerActions.ts:99,116` memanggil `payload.find({collection: 'matches', limit: 500})` **tanpa filter `event_id`** - seluruh match di seluruh event di platform ikut terambil, dan di atas 500 match sistem-lebar, sisanya diam-diam terlewat dari pengecekan konflik.

**Perbaikan:** Batasi query ke `event_id` event aktif, dan naikkan/paginasi batas limit.

#### SKD-03 — High — Pembuatan/reschedule match manual mengabaikan timezone event yang dikonfigurasi

`AddMatchDialog.tsx`/`RescheduleMatchDialog.tsx` memakai `<input type="datetime-local">` tanpa konteks timezone, dan `schedulerActions.ts:56-58` mem-parsing string mentah dengan `new Date(value)` polos - ini diinterpretasikan dalam timezone lokal **server**, bukan `Events.timezone`. Sebaliknya, import Excel jadwal sudah benar memakai `parseScheduleDateTime` yang menghormati timezone event. Untuk event multi-kota, admin yang mengetik "14:00" bermaksud waktu lokal venue bisa tersimpan meleset berjam-jam.

**Perbaikan:** Alirkan field tanggal/waktu dialog manual lewat helper `parseScheduleDateTime`/`resolveEventTimezone` yang sama dipakai jalur import, dan beri label timezone event pada input.

#### SKD-04 — High — Auto-scheduler eksplisit beroperasi di waktu lokal server, bukan timezone event

`scheduleOptimizer.ts:187-215` sendiri mendokumentasikan parameter-nya "diinterpretasikan dalam timezone lokal server" - simplifikasi yang disengaja dan disadari, tapi tetap gap standar nyata untuk platform turnamen multi-kota/multi-timezone.

**Perbaikan:** Terima offset UTC event sebagai parameter eksplisit optimizer (meniru `TIMEZONE_UTC_OFFSETS` milik `scheduleImport.ts`).

#### SKD-05 — Medium — Tie-breaker round-robin hanya mendukung head-to-head 2 arah, bukan mini-table multi-arah sungguhan

`standings.ts`'s `compareRows` adalah comparator `Array.sort` berpasangan; ketika 3+ entry seri poin/selisih (skenario umum), praktik federasi standar (gaya FIFA/UEFA) menghitung ulang mini-liga khusus di antara yang seri - hal ini secara struktural tidak mungkin dari comparator berpasangan. Kode diam-diam jatuh ke urutan alfabetis begitu head-to-head berpasangan habis.

**Perbaikan:** Untuk grup 3+ entry yang seri, hitung sub-table yang tepat (poin/selisih/gol dibatasi hanya pada pertandingan sesama yang seri) sebelum fallback.

#### SKD-06 — Medium — Flag `tie_note` (seri belum terselesaikan) tidak pernah sampai ke halaman standings publik

`Standings.ts:105-112` mendefinisikan `tie_note` khusus untuk menandai baris yang peringkatnya alfabetis-sementara, dan `medals.ts:171-173` sudah benar memakainya untuk memblokir derivasi medali. Tapi halaman standings publik tidak mereferensikan `tie_note` sama sekali - penonton melihat peringkat alfabetis-sementara persis seperti peringkat yang benar-benar diputuskan aturan, tanpa indikasi apa pun.

**Perbaikan:** Tampilkan `tie_note` di baris standings publik (mis. badge "seri - menunggu keputusan").

#### SKD-07 — High — Pemenang match yang dipublikasikan bisa bertentangan dengan skor sebenarnya, tanpa validasi, dan standings mempercayainya begitu saja

`resolvePublishResult` (matchActions.ts:651-674) membiarkan `manualWinnerSide` admin menimpa tanpa syarat hasil yang diturunkan dari ruleset berdasarkan skor set sebenarnya. `standings.ts`'s `addMatchToRows` lalu mempercayai `winner_entry_id` dulu, baru fallback ke perbandingan skor. Skenario: match officer salah klik pemenang; entry yang sebenarnya kalah-skor mendapat poin menang sementara `score_for`/`score_against` masih mencerminkan skor asli (kalah) - baris standings yang bertentangan secara internal, tanpa peringatan saat publish. (Ini temuan STD-04 audit lama, masih dapat direproduksi.)

**Perbaikan:** Ketika pemilihan pemenang manual tidak sesuai dengan hasil yang diturunkan ruleset dari skor yang dimasukkan, wajibkan konfirmasi/alasan eksplisit.

#### SKD-08 — Medium — Derivasi medali macet permanen karena satu match yang dibatalkan/void

`medals.ts:159,210` men-syarat-kan SEMUA match berstatus `result_published`/`walkover` sebelum medali bisa diturunkan otomatis. Match yang sah dibatalkan (cuaca, walkover pasangan ganjil yang dibatalkan) tidak pernah mencapai status itu, sehingga medali kategori tersebut tidak akan pernah bisa diturunkan otomatis - hanya override manual yang bisa, tanpa sinyal jelas ke admin mengapa.

**Perbaikan:** Perlakukan match `cancelled` sebagai dikecualikan dari pengecekan "semua match sudah diputuskan" (sebagaimana bye sudah dikecualikan).

#### SKD-09 — Medium — Tabel medali publik diam-diam membuang entry tanpa pemetaan klub

Halaman medali publik memfilter dengan `records.filter((record) => record.club_id)` - baris `medal-records` yang tidak bisa dilacak ke klub (entry individu/pair tanpa `club_id`) dikecualikan sepenuhnya dari tabel publik. Medali emas untuk atlet dengan tautan klub tidak lengkap hilang begitu saja dari hitungan medali "resmi" publik tanpa catatan apa pun.

**Perbaikan:** Tampilkan medali yang belum terpetakan di bawah baris "Tidak Berafiliasi", atau tampilkan notifikasi eksplisit jumlah medali yang belum ditetapkan ke kontingen.

#### SKD-10 — Low — Rekalkulasi standings memakai satu query per match yang sudah diputuskan (N+1), beberapa batas keras

`standings.ts:403-423` mengambil match yang sudah diputuskan (limit 500) lalu mengeluarkan query terpisah per match untuk match-sets di dalam loop. Untuk event multi-hari/multi-cabang besar, ini pola query sekuensial O(n) per rekalkulasi dan berisiko diam-diam terpotong di atas batas limit. (Mirip STD-07 lama, masih berlaku - prioritas rendah karena soal skala, bukan korektnes.)

**Perbaikan:** Batch-fetch semua match-sets dalam satu query `match_id: {in: [...]}`, naikkan/paginasi batas limit.

## 6. Temuan: Registrasi, participant & import

Ringkasan sub-agent: registrasi mandiri publik + antrian approval + mesin import Excel bersama sudah dibangun sejak audit lama (REG-01 lama soal "tidak ada registrasi mandiri" **sudah fix, temuan itu sekarang usang**). Yang masih hilang hampir seluruhnya di lapisan *kapasitas dan integritas* yang dimiliki tool standar: tidak ada cap/waitlist entry otomatis, tidak ada cek duplikasi registrasi/roster di level data, dan aturan ukuran roster hanya ditegakkan di form publik.

#### REG-01 — High — Tidak ada konsep kapasitas entry, sehingga status "Waitlisted" hanya dekoratif

`CompetitionCategories.ts` tidak punya field `max_entries` sama sekali, dan `CompetitionEntries.status` menyertakan `waitlisted` tapi tidak ada apa pun yang men-set-nya otomatis - hanya pilihan dropdown manual. Aksi registrasi publik tidak pernah menghitung entry terkonfirmasi yang ada terhadap batas apa pun sebelum menerima submission.

**Perbaikan:** Tambahkan field `max_entries` ke `CompetitionCategories`, cek sebelum create di `submitRegistrationAction` (auto-set `status: 'waitlisted'` begitu penuh), tambahkan aksi promosi-dari-waitlist di antrian approval.

#### REG-02 — High — Tidak ada cek duplikasi registrasi, baik saat submit maupun saat approval

`submitRegistrationAction` tidak pernah mengecek apakah `contact_email`/`display_name` sudah punya submission pending/approved untuk kategori yang sama sebelum menulis baris baru. Sisi reviewer juga sama: `approveRegistrationSubmissionAction` membuat set Club/Team/Player/Entry baru untuk setiap approval tanpa cek terhadap `created_entry_id` yang sudah ada untuk orang/kategori yang sama.

**Perbaikan:** Sebelum insert, query submission pending/approved dengan `category_id`+`contact_email` yang sama (atau nama roster yang cocok) dan tolak/tandai; terapkan cek yang sama sebelum approval membuat entry.

#### REG-03 — Medium — Tidak ada keunikan level-DB pada CompetitionEntries, sehingga entry duplikat mungkin terjadi dari jalur mana pun

`CompetitionEntries.ts` tidak mendeklarasikan `indexes` sama sekali - tidak ada yang mencegah `team_id`/`player_id` yang sama dimasukkan dua kali ke kategori yang sama, baik lewat CRUD workspace, sheet Excel, atau race dua admin. Sheet import "Entries" punya `upsertKeyFields: []` ("kolom id saja") sehingga re-import template yang baru diisi (bukan yang sudah pernah diekspor dengan id) membuat entry duplikat setiap kali diunggah.

**Perbaikan:** Tambahkan unique index komposit `(category_id, team_id)`/`(category_id, player_id)` untuk yang non-null, beri sheet Entries kunci upsert alami (mis. kategori + display_name) alih-alih hanya id.

#### REG-04 — High — `max_roster_size` hanya ditegakkan di form publik, tidak di tempat lain

Batas ukuran roster hanya dicek di dalam aksi registrasi publik. Collection `Rosters` sendiri tidak punya hook/validasi apa pun, begitu pula sheet import roster maupun CRUD roster manual di workspace Participants. Admin yang mengimpor atau menambah roster manual bisa memasukkan 1 pemain atau 20 pemain ke tim futsal 5-lawan-5 tanpa ditolak.

**Perbaikan:** Pindahkan cek ukuran roster ke hook `beforeChange` pada `Rosters` (atau validator bersama yang dipanggil baik oleh aksi CRUD maupun import) agar ditegakkan terlepas dari jalur masuknya.

#### REG-05 — High — Generasi bracket mengecek jumlah entry tapi tidak pernah kelengkapan roster

`generateMatchesAction` sudah benar memblokir generasi saat entry terkonfirmasi kurang dari 2. Tapi tidak pernah mengecek `min_roster_size`/kelengkapan roster sebelum generate; cek itu hanya ada sebagai peringatan advisory di halaman Analytics/Readiness terpisah yang harus diingat admin untuk dikunjungi. Organizer bisa generate - dan publikasikan - bracket di mana entry "tim" beranggotakan nol pemain terdaftar.

**Perbaikan:** Gunakan ulang cek roster-di-bawah-minimum dari `categoryReadiness` sebagai gate keras di dalam `generateMatchesAction`, bukan sekadar peringatan dashboard terpisah.

#### REG-06 — Medium — Collection Rosters mengizinkan pemain yang sama ditambahkan dua kali ke tim yang sama

Tidak ada `indexes` di `Rosters.ts`, sehingga tidak ada yang mencegah baris `(team_id, player_id, category_id)` duplikat lewat CRUD manual (jalur import setidaknya sudah de-dupe lewat `upsertKeyFields`). Klik ganda "Add player to roster" diam-diam menggandakan jumlah roster pemain tersebut.

**Perbaikan:** Tambahkan unique index pada `(team_id, player_id, category_id)` ke `Rosters`.

#### REG-07 — High — Upload import tidak punya batas ukuran file/jumlah baris sebelum parsing

Route handler import hanya menolak file kosong (`size === 0`) - tidak ada batas atas. `XLSX.read(buffer, ...)` dipanggil langsung pada apa pun yang diunggah. Pengaturan `bodySizeLimit: '15mb'` di `next.config.mjs` hanya berlaku untuk Server Actions, tidak untuk Route Handler ini, sehingga efektif tidak ada batas level-aplikasi. Ditambah versi `xlsx@0.18.5` yang punya advisory prototype-pollution/ReDoS yang belum ditambal, upload workbook berbahaya/korup bisa menghabiskan CPU/memory server secara tidak proporsional.

**Perbaikan:** Tambahkan guard ukuran file dan jumlah baris eksplisit sebelum `XLSX.read`, dan pertimbangkan migrasi dari `xlsx` (atau ke parser yang sudah ditambal) mengingat advisory yang masih berlaku.

#### REG-08 — Medium — Dua mesin import Excel paralel yang perilakunya berbeda, didokumentasikan seolah satu

Import peserta di wizard (`participantsImport.ts`) adalah implementasi yang sepenuhnya terpisah dari mesin `collectionIo/engine.ts` bersama yang dipakai halaman list Event Admin, dengan kemampuan berbeda (wizard mendukung shortcut kolom `category_name` dan sheet "Pairs" yang otomatis mendaftarkan entry ke kategori; importer per-list tidak). Dokumentasi user mengklaim keduanya memakai alur yang sama tanpa menyebut perbedaan ini secara eksplisit di bagian atas.

**Perbaikan:** Satukan ke satu mesin import, atau perjelas di dokumentasi bagian import-per-list bahwa `category_name`/Pairs khusus wizard.

#### REG-09 — Low — Antrian submission pending tidak punya paginasi atau pengaman urutan

Halaman registrasi mengambil submission pending dengan `limit: 100` tanpa UI paginasi. Untuk event yang registrasinya viral (skenario persis yang menjadi alasan fitur registrasi mandiri publik dibuat), submission di atas 100 tidak terlihat oleh reviewer tanpa indikator apa pun bahwa daftar terpotong.

**Perbaikan:** Tambahkan paginasi (atau minimal banner "X lagi belum ditampilkan") ke antrian approval.

#### REG-10 — Low, belum pasti — Klaim "biarkan tidak berubah" pada import belum diverifikasi independen

Dokumentasi menyatakan sel opsional kosong saat re-import berarti "biarkan tidak berubah, bukan mengosongkan nilai." Perlu pengecekan empiris (re-import workbook dengan `contact_email` kosong di atas klub yang sudah punya nilai) untuk memastikan Payload benar-benar memperlakukan `undefined` sebagai "lewati kolom ini," bukan "set null."

**Perbaikan:** Tambahkan regression test yang menegaskan sel opsional kosong tidak menghapus nilai yang sudah ada saat update.

## 7. Temuan: Otorisasi & keamanan (paling kritis)

**Status verifikasi ulang AUTH-01/AUTH-02 (audit lama):**
- **AUTH-01: BARU SEBAGIAN DIPERBAIKI.** Model `EventMemberships` + `scopedToUserEvents` di `src/access/eventScope.ts` benar secara desain dan akan berfungsi lewat REST/GraphQL/Admin - tapi **tidak aktif** di Server Action workspace mana pun (lihat SEC-01).
- **AUTH-02: SEBAGIAN BESAR DIPERBAIKI** khusus untuk pemisahan peran matches/match-sets, karena diimplementasikan sebagai hook `beforeChange` (berjalan terlepas dari `overrideAccess`) - bagian ini benar-benar berfungsi lewat UI workspace. Tapi scoping "event mana yang punya data ini" berbagi celah yang sama dengan AUTH-01.

#### SEC-01 — Critical — Scoping keanggotaan-event di-bypass oleh SETIAP Server Action workspace (akar masalah yang membuka-ulang AUTH-01)

`eventScope.ts`'s `scopedToUserEvents`/`scopedCreateToUserEvents` adalah fungsi `Access` Payload yang benar dan sudah terpasang di collection seperti `Matches.ts`. Tapi Local API Payload defaultnya `overrideAccess: true` (dikonfirmasi dari source `payload/dist/collections/operations/local/update.js`), dan grep seluruh repo mengonfirmasi **nol** kemunculan `overrideAccess: false` di ke-33 file `'use server'` di bawah `src/app/(frontend)/workspaces/`. Artinya setiap panggilan `payload.find/update/create/delete` dari UI organizer yang sesungguhnya melewati seluruh boundary `access` - pengecekan EventMemberships tidak pernah berjalan di sana.

**Perbaikan:** Sertakan `overrideAccess: false` (dengan `user` terautentikasi) pada setiap panggilan Local API di Server Action workspace, atau buat wrapper tipis (mis. `scopedPayload(user)`) yang defaultnya begitu, sehingga collection access benar-benar jadi titik penegakan di mana pun, bukan hanya lewat REST/GraphQL/Admin.

#### SEC-02 — Critical — IDOR lintas-event nyata lewat `match_number` di workspace match-officer/scheduler

`matchActions.ts`'s `findMatchByNumber` mencari match hanya berdasarkan `match_number` tanpa filter event, dan `assertWorkspaceActionAccess` hanya mengecek peran *global* pemanggil, tidak pernah memverifikasi keanggotaannya di event match tersebut. Dikombinasikan dengan SEC-01, seorang `match_officer`/`scheduler` yang hanya anggota Event A bisa memanggil aksi transisi status/update skor dengan `match_number` milik Event B (unik secara global) dan berhasil mengubah skor/hasil live Event B lewat UI normal, tanpa perlu akses REST.

**Perbaikan:** Setelah memuat match, verifikasi `match.event_id` ada dalam set event yang bisa diakses pemanggil sebelum melanjutkan (atau tambahkan `overrideAccess: false` sesuai SEC-01, yang sendirinya menutup celah ini).

#### SEC-03 — High — Celah IDOR yang sama pada import Excel (`collectionIo/engine.ts`)

`findExisting` mengembalikan `id` eksplisit dari kolom baris apa adanya **tanpa cek bahwa id tersebut benar-benar milik event aktif**. Template ekspor bahkan menyertakan kolom `id` yang bisa diedit (hanya diperingatkan lewat komentar UI "jangan diedit"). Staf `draw`/`content_admin`/`registration` yang terbatas di Event A bisa mengedit spreadsheet hasil ekspor, menaruh id record dari event lain di kolom `id`, dan meng-impor ulang - membajak dan menimpa record organizer lain ke dalam event mereka sendiri.

**Perbaikan:** Di `findExisting`, saat `row.id` ada, cari dan verifikasi `event_id`-nya sesuai event aktif sebelum dijadikan target update; terapkan `overrideAccess: false` juga.

#### SEC-04 — High — Collection Comments tidak punya scoping per-event sama sekali

Collection ini memakai cek peran global murni, dan tidak punya field `event_id` sama sekali sehingga tidak bisa di-scope dengan cara yang sama seperti collection lain. Bahkan setelah SEC-01 diperbaiki, ini tidak akan tertutup: `scheduler`/`match_officer` mana pun di sistem bisa baca/buat/ubah/hapus komentar (termasuk catatan internal/resmi) di match/artikel/event organizer lain lewat REST/GraphQL/Admin hari ini.

**Perbaikan:** Tambahkan relationship `event_id` ke Comments (didenormalisasi dari entity induk saat penulisan), bungkus akses dengan `scopedToUserEvents`.

#### SEC-05 — High — AuditLogs bisa dibaca lintas semua event oleh peran backoffice mana pun

Akses baca hanya cek peran global, tanpa field `event_id` untuk di-scope. Entry audit menyertakan JSON before/after snapshot yang bisa berisi data match/jadwal/peserta organizer lain. Peran `scheduler`, `match_officer`, `content_admin`, `registration`, atau `draw` mana pun - terlepas dari event mereka - bisa membaca audit trail setiap event lewat REST/GraphQL/Admin.

**Perbaikan:** Tambahkan field `event_id` ke AuditLogs, scope `read` dengan `scopedToUserEvents`.

#### SEC-06 — High — Collection Media tidak punya scoping event; content_admin mana pun bisa menyentuh media event lain

Tidak ada field `event_id`, tidak ada scoping keanggotaan. `content_admin` anggota Event A bisa membuat, menimpa, atau menghapus media (banner, logo, gambar artikel/pengumuman) milik Event B lewat REST/GraphQL/Admin.

**Perbaikan:** Tambahkan `event_id` pemilik (atau turunkan/tegakkan kepemilikan transitif lewat artikel/pengumuman/event yang mereferensikannya) dan scope mutasi sesuai itu.

#### SEC-07 — High — Collection Users membocorkan nama/email setiap akun ke pengguna terautentikasi mana pun

Akses baca mengembalikan `true` untuk *siapa pun* yang sudah login, tanpa filter `where`. Dikombinasikan dengan registrasi mandiri terbuka, siapa pun bisa mendaftar akun `event_admin` gratis lalu meng-query `/api/users`/GraphQL untuk mengenumerasi nama/email setiap pengguna di seluruh sistem - kebocoran PII lintas-tenant tanpa privilese khusus.

**Perbaikan:** Batasi `read` ke `req.user.id === doc.id || super_admin`, atau minimal hilangkan `email` dari field-level read default untuk non-admin.

#### SEC-08 — High — Aktivasi kunci lisensi tidak punya rate limiting meski format rahasianya bisa ditebak paksa (brute-force)

`activateLicenseAction.ts` memvalidasi format `XXXX-XXXX-XXXX` lalu memanggil API `activate()` eksternal tanpa penghitung percobaan, cooldown, atau lockout apa pun - berbeda dari alur sebanding lain di repo ini (`quickBracketRateLimit.ts`, `registrationRateLimit.ts`, `anonymousDraftRateLimit.ts` semuanya ada tapi tidak satu pun dirujuk dari file ini). Penyerang yang sudah login bisa men-script tebakan berulang terhadap kunci pelanggan lain; tebakan yang berhasil membocorkan kunci valid sekaligus berpotensi menguasai/menolak seat itu dari pemilik sahnya.

**Perbaikan:** Tambahkan rate limiter per-user dan per-IP (gunakan ulang pola `registrationRateLimit.ts`/`quickBracketRateLimit.ts`) di sekitar `activateLicenseAction`, dengan lockout singkat setelah beberapa kali gagal.

#### SEC-09 — Medium — Halaman workspace sepenuhnya bergantung pada filter `where` manual, bukan penegakan level-collection

Bahkan di tempat yang sudah benar hari ini (mis. halaman Participants yang membangun klausa `eventWhere` dari cookie event aktif), ini dilakukan tanpa `overrideAccess: false`, sehingga korektnes bergantung sepenuhnya pada setiap penulis query mengingat untuk menambahkan filter itu secara manual - tanpa pertahanan berlapis. Satu klausa `where` yang terlewat di halaman mana pun di masa depan diam-diam jadi kebocoran/penulisan lintas-event.

**Perbaikan:** Sama seperti SEC-01 - begitu `overrideAccess: false` jadi sikap default, filter manual yang terlewat gagal secara aman (hasil kosong/403), bukan gagal secara terbuka.

#### SEC-10 — Medium — Penulisan aktivasi Licenses memang sengaja melewati access control - perlu dikonfirmasi sebagai desain, bukan bug

Collection Licenses sendiri sudah dibangun dengan benar (`create`/`update`/`delete` terbatas `super_admin`, `read` pemilik-atau-super_admin). Tapi setiap penulisan nyata terjadi lewat `overrideAccess: true` yang disengaja dan terdokumentasi - `access` block hanya melindungi Admin/REST/GraphQL, tidak pernah jalur aktivasi aplikasi sendiri. Tidak ditemukan cara bagi non-pemilik mencapai baris lisensi pengguna lain (`user_id` selalu dari sesi terautentikasi, tidak pernah dari input klien) - ditandai sebagai pola aman-terkonfirmasi, bukan bug.

**Perbaikan:** Tidak perlu perubahan kode; pertimbangkan catatan dokumentasi singkat yang membedakan "overrideAccess disengaja oleh aktor sistem" (Licenses, form registrasi publik) dari "overrideAccess tidak sengaja" (kelas SEC-01), agar audit berikutnya tidak perlu menurunkan ulang pembedaan ini.

## 8. Temuan: Quick Bracket UX & Billing (diverifikasi langsung penulis)

Fitur Quick Bracket Schedule/Venue/Score yang dibangun di sesi ini sudah diverifikasi berjalan end-to-end lewat browser sungguhan (Playwright): Save benar-benar menyimpan ke database (bertahan setelah hard reload), dan Cancel benar-benar membatalkan perubahan lokal tanpa memanggil server.

#### QB-UX-01 — Medium — Tidak ada konfirmasi sebelum menimpa hasil yang sudah dipublikasikan di Quick Bracket

`bracketTree.tsx:913,941` (tombol deklarasi pemenang) memanggil `handleSave` (baris 689) langsung tanpa konfirmasi apa pun, bahkan saat `match.state` sudah `'result_published'`. Organizer yang salah klik sisi setelah hasil tercatat diam-diam menimpa hasil asli tanpa langkah "yakin?", dan (sesuai perilaku terdokumentasi `quickBracketAdvancement.ts`) perubahan tidak menjalar ke match downstream yang sudah ter-advance. Tool bracket standar (Challonge) menampilkan konfirmasi saat mengedit hasil yang sudah tercatat.

**Perbaikan:** Tampilkan langkah konfirmasi ringan ("Match ini sudah punya hasil. Timpa?") hanya saat `match.state === 'result_published'` sebelum memanggil `handleSave`.

#### QB-UX-02 — Low — Field Venue Quick Bracket tidak bisa mendeteksi dua match dobel-booking di venue yang sama

`venue_label` adalah teks bebas tanpa entity venue/court terstruktur di baliknya (berbeda dari Venues/Courts pada event asli), sehingga dua match yang dijadwalkan waktu sama dengan teks venue yang sama tidak memicu peringatan konflik apa pun.

**Perbaikan:** Di luar cakupan wajar untuk tool "quick" tanpa login mengingat skemanya; jika suatu saat diperluas, teks venue yang sama + `scheduled_start_at` yang beririsan bisa memicu peringatan lunak.

#### QB-UX-03 — Ditemukan & diperbaiki selama audit — Tab Schedule Quick Bracket sempat round-trip lewat timezone yang salah

Input `<input type="datetime-local">` yang ditambahkan di sesi ini sempat round-trip lewat timezone **browser** pemirsa (`new Date(value)` polos), sementara sisi tampilan (`formatMatchDate`) selalu merender dalam `DEFAULT_EVENT_TIMEZONE` tetap (`'Asia/Jakarta'`, `src/lib/timezone.ts:9`). Pengguna yang browser-nya tidak diset ke WIB akan melihat waktu berbeda saat reload dibanding yang mereka ketik. Ditemukan dan diverifikasi dengan test Playwright memakai konteks browser `America/New_York`, lalu diperbaiki dalam sesi yang sama dengan mengonversi lewat offset eksplisit `+07:00` (Indonesia tidak memakai DST); diverifikasi ulang test yang sama sekarang round-trip dengan benar.

Catatan: SKD-03/SKD-04 di atas menjelaskan kelas bug yang sama pada scheduler REAL (bukan Quick Bracket) dan auto-optimizer, yang **masih belum diperbaiki** - entri ini hanya soal instance Quick Bracket, yang sudah dikoreksi.

#### BILL-01 — Medium — Status masa tenggang (grace period) dilacak tapi tidak pernah ditampilkan ke pengguna

`subscriptionGate.ts` menghitung `grace: bucket === 'grace'`, tapi kedua titik pemanggilnya di `workspaceAuth.tsx` hanya mengecek `!subscription.ok` dan membuang `subscription.grace` begitu saja. Status "grace" Berlanggan artinya "pembayaran terlambat, akses belum dicabut" - tapi tidak ada satu pun bagian aplikasi yang menampilkan ini ke pengguna yang login. Pelanggan dalam masa tenggang tidak dapat peringatan apa pun ("pembayaran Anda terlambat, selesaikan dalam N hari") di mana pun, berbeda dari praktik UI billing SaaS standar (banner dunning gaya Stripe) - mereka baru tahu ada masalah setelah statusnya berubah jadi blocked sepenuhnya.

**Perbaikan:** Tambahkan banner persisten yang bisa ditutup di workspace shell chrome saat `grace === true`, mengarah ke /subscribe atau halaman billing Berlanggan.

#### BILL-02 — Low — Tidak ada tautan untuk mengelola/membatalkan langganan dari dalam aplikasi

Halaman `/subscribe` menawarkan "View plans" dan form aktivasi kunci lisensi, tapi tidak ada tautan ke dashboard akun/billing Berlanggan sendiri untuk pengguna yang ingin cek invoice, ubah metode pembayaran, atau membatalkan. Karena checkout dan billing sepenuhnya di luar situs (by design), pelanggan tidak punya jalur yang mudah ditemukan kembali untuk mengelola apa yang sudah mereka bayar, kecuali mengingat sendiri URL berlanggan.web.id.

**Perbaikan:** Tambahkan tautan "Kelola billing di Berlanggan" (ke base URL yang dikonfigurasi) di halaman /subscribe.

#### BILL-03 — Low — Harga yang ditampilkan tidak punya keterangan inklusi pajak

`pricing/page.tsx:29-30` (`formatPrice`) merender nominal IDR mentah dari katalog Berlanggan tanpa catatan "sudah termasuk PPN"/"belum termasuk pajak". Konvensi e-commerce/perlindungan konsumen Indonesia (dan praktik billing yang baik secara umum) adalah menyatakan dengan jelas apakah harga yang ditampilkan sudah termasuk pajak yang berlaku, terutama karena total checkout sebenarnya dihitung oleh pihak ketiga terpisah (Berlanggan).

**Perbaikan:** Tambahkan baris keterangan kecil di bawah grid harga bahwa total checkout final (termasuk pajak apa pun) dikonfirmasi di halaman checkout Berlanggan sendiri.

## 9. Daftar prioritas perbaikan

**P0 - sebelum sistem dipakai lebih dari satu organizer yang tidak saling percaya (harus selesai lebih dulu):**
- SEC-01 (Server Action bypass `overrideAccess`) - akar dari SEC-02, SEC-03, SEC-09.
- SEC-02 (IDOR match_number lintas-event).
- SEC-07 (kebocoran PII Users lintas-tenant).

**P1 - sebelum dipakai sebagai source of truth pertandingan resmi untuk banyak event:**
- SEC-03, SEC-04, SEC-05, SEC-06, SEC-08 (kelas keamanan lain yang tersisa).
- MATCH-01 (draw tidak bisa dipublikasi - blocker fungsional nyata untuk sepak bola/olahraga dengan hasil seri).
- MATCH-02 (double-elimination tidak bisa dikoreksi).
- SKD-01, SKD-02, SKD-03, SKD-04 (scheduling/timezone).
- SKD-07 (pemenang manual bertentangan dengan skor, standings tidak divalidasi).
- REG-01, REG-02, REG-04, REG-05, REG-07 (kapasitas, duplikasi, validasi roster, ukuran upload).
- BRK-01 (Quick Bracket double-elim tanpa reset, tidak diberitahukan).

**P2 - peningkatan kualitas/konsistensi, tidak mem-blokir penggunaan langsung:**
- Sisanya: BRK-02..06, MATCH-03..09, SKD-05,06,08,09,10, REG-03,06,08,09,10, SEC-09,10, QB-UX-01,02, BILL-01,02,03.

## 10. Catatan metodologi

Audit ini disusun dari 5 sub-agent riset paralel (baca-kode-saja) yang masing-masing diberi cakupan domain, daftar file konkret untuk dibaca, dan daftar konvensi standar dunia nyata untuk dibandingkan (bukan hanya "cari bug") - plus verifikasi langsung penulis untuk fitur yang dibangun di sesi yang sama (Quick Bracket Schedule/Venue/Score), termasuk pengujian browser sungguhan (Playwright, termasuk simulasi konteks timezone berbeda) yang menemukan dan memverifikasi perbaikan satu bug timezone nyata (QB-UX-03) sebelum audit ini selesai ditulis. Setiap temuan menyertakan referensi file:baris konkret dan skenario kegagalan spesifik, bukan generalisasi. Temuan yang levelnya "belum pasti"/butuh verifikasi lanjutan ditandai eksplisit sebagai demikian (MATCH-09, REG-10), bukan diklaim pasti benar.
