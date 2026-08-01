# Audit End-to-End ROC GMS V2 dan Perbandingan dengan Tournify

Tanggal audit: 2 Agustus 2026  
Workspace: `roc_gms_v2`  
Stack: Next.js 16, React 19, Payload CMS 3, PostgreSQL, Docker Compose  
Jenis audit: static code review frontend/backend, penelusuran flow end-to-end, pemeriksaan dependency/build, dan benchmark produk berbasis situs serta dokumentasi resmi Tournify.

## 1. Kesimpulan eksekutif

ROC GMS V2 sudah memiliki fondasi produk yang luas dan arah arsitektur yang cukup baik untuk sebuah game/tournament management system internal. Sistem sudah memisahkan portal publik, workspace operasional, dan Payload Admin; model data utamanya juga sudah mencakup event, sport, category, club, player, team, roster, entry, venue, court, stage, group, match, set, standings, bracket, content, documentation, comments, dan audit log.

Namun, sistem **belum layak dinilai production-ready atau end-to-end correct** untuk menjalankan turnamen nyata tanpa pengawasan teknis dan prosedur manual. Halaman serta modelnya tampak lengkap, tetapi beberapa aturan bisnis paling penting belum menjadi invariant backend. Akibatnya, flow yang terlihat benar di UI masih dapat menghasilkan state yang salah melalui API, Payload Admin, race condition, atau jalur mutasi alternatif.

Penilaian ringkas:

| Area | Nilai | Kesimpulan |
|---|---:|---|
| Cakupan model/domain | 7.5/10 | Luas dan cocok untuk event multi-sport internal, tetapi beberapa entitas operasional penting belum ada. |
| Flow setup event | 6.5/10 | Wizard membantu, tetapi validasi lintas entitas, readiness gate, dan format lanjutan belum utuh. |
| Scheduling | 4.5/10 | Manual create/reschedule dan conflict check tersedia; belum menjadi planner turnamen yang matang. |
| Match-day dan live score | 4.5/10 | UI mobile cukup baik, tetapi scoring belum ruleset-aware, belum concurrency-safe, dan belum realtime. |
| Standings dan bracket | 4/10 | Fondasi kalkulasi ada, tetapi ada defect bye/seeding, tiebreaker parsial, dan risiko cache tidak konsisten. |
| Portal publik | 6.5/10 | Struktur dan UX cukup lengkap, tetapi visibility/time gate tidak sesuai requirement dan API dapat membocorkan draft. |
| Content/CMS | 6/10 | Artikel, pengumuman, media, sharing tersedia; editor custom dapat merusak rich text dan boundary draft lemah. |
| Security/authorization | 4/10 | Role guard halaman tersedia, tetapi izin koleksi terlalu lebar dan tidak ada event-scoped authorization. |
| Reliability/operability | 3/10 | Belum ada test, migration workflow, transaction, retry job, observability, backup, atau production image. |
| Paritas terhadap Tournify | 4.5/10 | ROC unggul pada multi-sport/CMS/self-hosting; tertinggal pada core tournament automation dan participant/referee journey. |

Verdict: **fondasi MVP/internal demo yang menjanjikan, tetapi belum memenuhi standar operasional turnamen end-to-end.** P0 di bagian 11 harus diselesaikan sebelum digunakan sebagai source of truth pertandingan resmi.

## 2. Ruang lingkup dan metode

Yang diperiksa:

- Seluruh collection Payload, access rule, dan konfigurasi aplikasi.
- Semua custom workspace dan Server Action utama.
- Setup wizard event, import peserta, generation, scheduling, match lifecycle, scoring, standings, bracket, winner advancement, content, media, documentation, comments, sharing, serta portal publik multi-event.
- Docker, environment, health endpoint, package scripts, dependency audit, keberadaan test/CI/migration/observability.
- Situs produk Tournify, `manage.tournifyapp.com`, dan artikel Help Center resmi yang relevan.

Batasan:

- Audit tidak mengubah kode aplikasi.
- Runtime E2E penuh tidak dapat dijalankan karena dependency tree lokal tidak sinkron: `xlsx` tercantum di `package.json` tetapi tidak terpasang di `node_modules`. `npm run typecheck` berhenti dengan `TS2307` pada `participantsImport.ts` dan `participantsImportTemplate.ts`; build tidak dijalankan setelah kegagalan tersebut.
- Tidak ada akun Tournify yang diberikan. Area `manage.tournifyapp.com` hanya dapat dikonfirmasi sebagai SPA yang memerlukan JavaScript/login; benchmark fitur menggunakan dokumentasi resmi dan situs produknya.
- Tidak ada automated test di repository untuk dijalankan.

## 3. Arsitektur dan flow aktual

```text
Organizer login
  -> memilih active event via cookie
  -> Event Admin: event/sport/rules/category/participant/entry/facility
  -> generate match (round robin atau single elimination)
  -> Scheduler: create/reschedule + conflict check
  -> Match Officer: status + set score + documentation/comment
  -> recalculation best-effort: standings/bracket + winner advancement
  -> public event portal: schedule/standings/bracket/match/content

Payload REST/GraphQL/Admin
  -> mengakses collection yang sama
  -> sebagian aturan hanya ada di Server Action, bukan di collection boundary
```

Masalah arsitektural utama adalah terdapat beberapa jalur yang dapat mengubah data yang sama tetapi tidak menjalankan aturan yang sama:

1. Custom Server Actions.
2. Modal edit di `BracketTree`.
3. Payload Admin.
4. Payload REST/GraphQL API.
5. Seed dan maintenance scripts.

Selama invariant hanya berada di salah satu jalur, data tidak dapat dianggap konsisten.

## 4. Evaluasi flow end-to-end

### 4.1 Login, role, dan event selection

Yang sudah baik:

- Workspace route dan action menggunakan guard terpusat.
- Anonymous user diarahkan ke login frontend.
- Sidebar sudah role-aware.
- Redirect login disanitasi untuk mencegah open redirect.
- Active event membuat workspace tidak lagi terikat pada asumsi single-event.

Temuan:

#### AUTH-01 — Critical — Tidak ada authorization per event

Role bersifat global. User dengan role `event_admin`, `scheduler`, `match_officer`, atau `content_admin` dapat melihat semua event pada switcher dan, sesuai kemampuan globalnya, bekerja pada event mana pun. Tidak ada membership seperti `user_event_roles`, `event_admins`, atau assignment scope.

Dampak: satu panitia event dapat mengakses event panitia lain; ini tidak memenuhi boundary tenant meskipun komentar kode menyebut event sebagai tenant/company.

Perbaikan: tambahkan `EventMembership(user_id, event_id, roles[])`, enforce pada collection access query dan semua action. Super admin boleh bypass secara eksplisit.

#### AUTH-02 — Critical — Collection permission terlalu lebar dan tidak sama dengan workspace permission

`canManageMatches` memberikan create/update/delete `matches` dan `match-sets` kepada scheduler serta match officer. Di workspace, scheduler tidak dianggap match officer, tetapi melalui Payload Admin/REST/GraphQL scheduler dapat mengubah score, winner, status, atau menghapus match. Sebaliknya, match officer dapat membuat/menghapus match dan mengubah schedule/relationship secara langsung.

Dampak: pemisahan tugas hanya kosmetik di custom UI.

Perbaikan: gunakan field-level access dan capability terpisah (`create_match`, `schedule_match`, `operate_match`, `revise_result`, `delete_match`), bukan satu `canManageMatches`.

#### AUTH-03 — High — Event switch menerima ID arbitrer dan return path tidak disanitasi penuh

Action hanya memeriksa bahwa user authenticated, tidak memeriksa event ada atau user menjadi member event tersebut. Cookie tidak diberi `secure` pada production. `returnTo` tidak menggunakan sanitizer yang sama dengan login.

#### AUTH-04 — Medium — Tidak ada SSO/MFA dan recovery email belum terkonfigurasi

Untuk sistem internal kantor, OIDC/SAML/Google/Microsoft SSO lebih standar daripada password lokal. Mailpit tersedia, tetapi Payload email transport tidak dikonfigurasi, sehingga reset password/verification dan email operasional belum memiliki jalur delivery yang nyata.

### 4.2 Create event dan konfigurasi dasar

Yang sudah baik:

- Wizard menyimpan input saat validation error.
- Slug dibersihkan dan duplicate diperiksa.
- Tanggal awal/akhir divalidasi.
- Event details, appearance, logo/banner, location, organizer, rules summary tersedia.

Temuan:

#### EVT-01 — Critical — `preview_only` dan `coming_soon` diperlakukan sebagai publik penuh

`PUBLIC_VISIBILITY` hanya mengecualikan `hidden`. Akibatnya `preview_only`, `coming_soon`, `published`, dan `archived` semuanya dapat membuka halaman event lengkap. Ini bertentangan dengan arti field dan PRD.

#### EVT-02 — Critical — Time gate event tidak digunakan

`public_open_at`, fallback H-7, `schedule_publish_at`, `registration_open_at`, `registration_close_at`, dan `archive_at` tersimpan tetapi tidak mengendalikan flow publik. Tidak ada Coming Soon gate, preview-auth gate, schedule embargo, auto archive, atau registration gate.

#### EVT-03 — High — Lifecycle event dapat diubah bebas tanpa transition rule/readiness gate

Event dapat langsung dipindah dari draft ke live/published walaupun belum memiliki category, entry, venue, schedule, atau ruleset. Status dan visibility juga dapat saling bertentangan, misalnya `draft + published` atau `archived + coming_soon`.

Perbaikan: state machine backend dan publish checklist atomik. Gate minimum: tanggal valid, minimal satu active sport/category, peserta confirmed, venue/court untuk scheduled match, tidak ada critical conflict, serta preview confirmation.

#### EVT-04 — High — Validasi tanggal turunan tidak ada

Tidak ada invariant seperti registration open < registration close <= event start, public open <= event end, schedule publish <= event end, archive >= event end. Input tanggal invalid pada beberapa action memakai `toISOString()` langsung dan dapat menghasilkan unhandled 500.

#### EVT-05 — Medium — Timezone dan language configuration tidak efektif

`SiteConfig.timezone` dan `default_language` ada, tetapi format tanggal hard-coded `Asia/Bangkok` dan locale `en` di berbagai file. Penggantian setting tidak mengubah tampilan.

### 4.3 Sport, ruleset, dan competition category

Yang sudah baik:

- Model dapat merepresentasikan berbagai sport dan participant mode.
- Ruleset memiliki field points, sets, deuce, max score, timer, periods, overtime, penalties, dan tiebreakers.
- Category dapat menautkan ruleset dan format.

Temuan:

#### RULE-01 — Critical — Sebagian besar ruleset hanya metadata/tampilan

Score action tidak membaca `best_of`, `target_score`, `max_score`, `deuce_enabled`, `timer_enabled`, `period_count`, `period_duration`, `overtime_enabled`, atau `penalty_enabled`. Operator dapat memasukkan score apa pun dan memilih winner yang bertentangan dengan score.

Contoh: badminton target 21/max 30 tetap menerima 7–4 sebagai set selesai; best-of-3 tetap dapat memiliki set ke-4; futsal timer/period tidak memiliki state.

#### RULE-02 — High — Format yang ditawarkan lebih luas daripada engine yang tersedia

Schema/UI menawarkan double elimination, group-stage-to-knockout, league, friendly, time trial, dan score ranking, tetapi auto-generation hanya mendukung round robin dan single elimination. Error `unsupported_format` baru muncul di langkah generate.

Dampak: capability promise tidak sesuai implementasi dan user baru mengetahui gap setelah setup panjang.

#### RULE-03 — High — Tidak ada validation hook lintas relationship

Collection tidak menjamin sport, ruleset, category, stage, group, match, entry, venue, dan court berasal dari event yang sama. Custom actions kadang memeriksa hal ini, tetapi Payload Admin/API dapat membuat cross-event references.

#### RULE-04 — Medium — Slug unik secara global, bukan per event

Sport/category/club/team/ruleset/article/announcement menggunakan global unique slug. Dua event tidak dapat sama-sama memakai slug alami seperti `badminton` atau `mens-single`, sehingga multi-event akan cepat menghasilkan suffix tidak intuitif.

Perbaikan: composite unique `(event_id, slug)` dan route selalu event-scoped.

### 4.4 Participant, roster, entry, dan import

Yang sudah baik:

- Mendukung club, team, pair (team dengan roster), individual, dan entry.
- Ada import workbook dan downloadable template.
- Ada issue summary per row.
- Ada CRUD custom untuk participant dan roster.

Temuan:

#### REG-01 — Critical product gap — Tidak ada self-registration

Field registration window tersedia, tetapi tidak ada halaman/form registration publik, approval queue, capacity/waitlist workflow, confirmation email, consent, waiver, atau payment. Seluruh peserta dimasukkan panitia.

#### REG-02 — High — Import tidak bounded dan menggunakan library bermasalah

Tidak ada batas file size, sheet count, row count, atau decompression guard sebelum `XLSX.read`. `npm audit` juga melaporkan advisory high pada `xlsx` 0.18.x (prototype pollution dan ReDoS; tidak ada fix yang ditawarkan oleh npm untuk dependency saat ini).

#### REG-03 — High — Import bersifat partial, non-transactional, dan dedupe lemah

Jika row ke-500 gagal, row sebelumnya tetap tersimpan. Player tidak dideduplikasi berdasarkan employee ID/email; data yang sama dapat diimport berulang. Import team hanya mendeteksi global slug. Tidak ada dry-run/confirm/rollback.

#### REG-04 — Medium — Data dari template tidak seluruhnya disimpan

Parser membaca `phone`, tetapi jalur import player tidak memasukkannya ke data create. Import juga tidak memvalidasi email seperti form manual.

#### REG-05 — High — Roster rule tidak ditegakkan

`roster_required`, `min_roster_size`, `max_roster_size`, pair size, captain membership, duplicate seed, dan eligibility tidak menjadi backend validation sebelum entry dikonfirmasi atau match digenerate.

#### REG-06 — High — Tidak ada attendance/check-in

Match memiliki status `check_in_open`, tetapi tidak ada participant/team check-in, attendance confirmation, no-show timer, atau UI untuk membuka/menutup check-in.

### 4.5 Match generation dan phase progression

Yang sudah baik:

- Generation idempotent mencoba memakai `generation_key`.
- Round-robin pair generation sederhana dan mudah dipahami.
- Single-elimination membuat downstream placeholder.
- Winner advancement dan bracket recalculation sudah memiliki fondasi.

Temuan:

#### BRK-01 — Critical correctness defect — Penempatan bye single elimination salah

Untuk enam entry, engine memilih seed 1–2 sebagai bye, membuat first-round `3 vs 6` dan `4 vs 5`, lalu membangun semifinal sebagai `[winner match 1 vs winner match 2]` dan `[seed 1 vs seed 2]`. Seharusnya masing-masing bye seed bertemu salah satu winner. Defect ini dapat menghasilkan bracket dan jalur juara yang salah.

#### BRK-02 — Critical — Advancement ditentukan dari nama round dan index, bukan graph eksplisit

Target match dicari dengan mengurutkan string `First Round`, `Round of N`, `Quarterfinal`, `Semifinal`, `Final` lalu memakai `floor(currentMatchIndex/2)`. Rename, round tambahan, classification/bronze, sub-bracket, atau custom phase dapat memutus hubungan.

Perbaikan: simpan edge eksplisit seperti `next_match_id`, `winner_to_slot`, `loser_to_match_id`, `loser_to_slot`, atau generic `source_slot` graph.

#### BRK-03 — Critical — Revisi winner tidak melakukan compensating propagation

Setelah winner A maju ke match berikutnya, revisi hasil menjadi winner B tidak menarik A dari target dan menggantinya secara aman. Fungsi menolak overwrite slot yang sudah terisi, sehingga bracket lama dapat tetap salah.

#### GEN-01 — High — Batch generation non-transactional dan menelan error

Setiap pairing dibuat satu per satu; error hanya menaikkan `failedCount`. Stage/match parsial dapat tertinggal. Recalculation sesudahnya dapat berjalan di atas bracket tidak lengkap.

#### GEN-02 — High — Bye, walkover, seeding, dan phase readiness tidak menjadi domain object

Bye direpresentasikan secara implisit melalui slot kosong, bukan result/source yang dapat diaudit. Tidak ada bracket validation yang memastikan semua seed muncul tepat sekali.

#### GEN-03 — High product gap — Tidak ada group-to-knockout progression

Belum ada rule top-N group, best-third comparison, cross-group seeding, phase activation, consolation/plate, loser bracket, atau classification match. Category boleh memilih `group_stage_to_knockout`, tetapi engine tidak menyelesaikannya.

### 4.6 Scheduler

Yang sudah baik:

- Manual create dan reschedule tersedia tanpa membuka Payload Admin.
- Relationship, duplicate match number, court–venue, time order, dan basic conflicts diperiksa.
- Reschedule meminta alasan dan membuat audit entry.
- Queue dan calendar lane memberi gambaran operasional dasar.

Temuan:

#### SCH-01 — High product gap — Belum ada planner/auto-scheduler

Tidak ada drag-and-drop, bulk planning, match duration template, buffer/rest time, break/event block, multi-day/location planner, freeze/lock schedule, atau preview sebelum commit. Calendar hanya visual list.

#### SCH-02 — High — Conflict engine memiliki false positive dan false negative

- End == start dianggap overlap karena perbandingan inklusif, sehingga dua match berurutan diblok tanpa konsep buffer yang eksplisit.
- Dua team berbeda dari club sama dianggap participant conflict karena identitas club disamakan.
- Player yang berada pada dua team berbeda belum tentu terdeteksi karena roster tidak di-expand.
- Tidak memeriksa referee/officer, equipment, venue hours, court–sport compatibility, travel time, minimum rest, atau stage dependency.
- Match tanpa end time dianggap zero-duration.

#### SCH-03 — High — Pesan UI bertentangan dengan perilaku

UI menyatakan conflict sebagai warning dan "nothing is blocked", tetapi create/reschedule memblok alert conflict.

#### SCH-04 — High — Jalur schedule melalui bracket bypass invariant scheduler

Modal bracket dapat mengubah start/end tanpa venue, court, conflict check, reason, atau lifecycle restriction. Ini membuat dua source of truth untuk scheduling.

#### SCH-05 — Medium — Pagination limit menyebabkan data hilang diam-diam

Queue mengambil 100 match, conflict display 300, action conflict check 500, tanpa pagination atau indikator truncated. Event besar dapat melewati limit dan conflict tidak terdeteksi.

#### SCH-06 — Medium — Tidak ada publish workflow schedule

`is_public` dicentang per match, tetapi tidak ada draft schedule version, bulk publish/unpublish, publish timestamp enforcement, change summary, atau participant notification.

### 4.7 Match officer, lifecycle, dan live score

Yang sudah baik:

- Halaman mobile-first dan tombol score besar.
- Status transition terpusat untuk sebagian lifecycle.
- Score revision untuk finished/published result mencoba membatasi ke event/super admin dan meminta reason.
- Audit snapshot set score tersedia.
- Documentation dan internal/official notes tersedia dekat konteks pertandingan.

Temuan:

#### MAT-01 — Critical — Modal bracket adalah jalur score kedua yang melewati aturan utama

`BracketTree` selalu menampilkan form "Update result" dan "Set schedule", termasuk di halaman bracket publik. Action memang meminta login, tetapi UX publik tetap memperlihatkan kontrol admin. Action score tersebut:

- tidak menjalankan revision reason/approval rule;
- tidak memeriksa ruleset;
- tidak memeriksa lifecycle yang valid;
- langsung memilih winner berdasarkan satu score;
- dapat menambah set tanpa best-of limit;
- tidak menjalankan winner advancement;
- tidak mengubah status menjadi `result_published`;
- menggunakan redirect flat `/brackets` dan revalidation flat URL.

Ini harus dihapus dari public component dan seluruh mutation diarahkan ke satu domain service.

#### MAT-02 — Critical — Publish winner requirement hanya metadata UI

Transition `result_published` dan `walkover` ditandai `requiresWinnerSelection`, tetapi Server Action tetap mem-publish jika `winnerSide` kosong atau invalid. Hasil tanpa winner kemudian memutus champion/advancement.

#### MAT-03 — Critical — Score update rentan lost update

Add point menghitung nilai baru di client dari score hasil render lalu mengirim absolute value. Double tap atau dua officer bersamaan dapat sama-sama membaca 10 dan menulis 11; satu point hilang. Tidak ada atomic increment, version check, idempotency key, atau per-match lock.

#### MAT-04 — High — "Undo" bukan undo event terakhir

Tombol hanya mengurangi satu pada participant yang sedang dipilih, bukan membalik action terakhir. Ia tidak melindungi dari perubahan officer lain dan audit trail tidak menjadi event stream yang dapat direplay.

#### MAT-05 — High — Score dapat diedit pada state yang tidak masuk akal

Update set tidak membatasi match ke ongoing/paused/under_review. Match draft, scheduled, cancelled, postponed, disputed, atau walkover dapat diberi score. Add set juga tidak menerapkan revision rule pada finished/result published.

#### MAT-06 — High — Lifecycle tidak lengkap

Tidak ada transition custom untuk scheduled -> published -> check_in_open -> ready_to_start; tidak ada finished -> under_review -> result_published, dispute resolution, reopen/correct, postponed reschedule, cancelled restore, atau walkover publication. Banyak status hanya dapat diubah dari Payload Admin.

#### MAT-07 — High — "Assigned matches" sebenarnya semua match

Tidak ada referee/match-officer assignment field. Workspace officer menampilkan sampai 50 match event, bukan match milik user. Label "Assigned Match List" menyesatkan. `nextMatch` juga bukan "today/assigned" secara eksplisit.

#### MAT-08 — High — Live public belum live

Homepage refresh 30 detik, tetapi public match detail, schedule, standings, dan bracket tidak polling. Tidak ada SSE/WebSocket, event stream, connection state, offline queue, atau last-updated indicator.

#### MAT-09 — Medium — Match summary dapat stale

Jalur score utama mengubah match sets tetapi tidak memperbarui `score_summary`. Field tersebut terutama berasal dari seed atau modal bracket, sehingga email/ICS/public summary dapat tidak sama dengan set sebenarnya.

### 4.8 Standings, bracket cache, dan champion

Temuan:

#### STD-01 — Critical — Derived result bukan transaksi dengan source result

Match/set di-commit lebih dulu. Standings, bracket, winner advancement, dan audit dijalankan best-effort dengan catch/log. Jika salah satu gagal, action tetap sukses dan public state dapat saling bertentangan.

Perbaikan: transaction untuk source write + outbox event; worker idempotent memperbarui projection dengan retry/dead-letter dan status freshness.

#### STD-02 — High — Standings menghitung `finished` sebelum result published

`RESULT_STATUSES` berisi `finished` dan `result_published`. Hasil yang belum review/publish sudah memengaruhi standings publik.

#### STD-03 — High — Tiebreaker implementation tidak sesuai schema

Engine hanya menjalankan scalar: points, score difference/for, set difference/for. `head_to_head`, `fewest_penalties`, dan `manual_decision` diabaikan diam-diam. Tie akhirnya diputus alfabetis, bukan tetap tie/manual decision.

#### STD-04 — High — Winner dan score dapat kontradiktif

Jika `winner_entry_id` ada, standings memercayainya walaupun total score menunjukkan pihak lain. Jika winner kosong, engine menyimpulkan winner dari total semua set. Tidak ada validation bahwa final result konsisten dengan set/ruleset.

#### STD-05 — High — Entry tanpa finished match hilang dari standings

Row dibuat hanya dari match finished yang ditemukan. Peserta yang belum bermain tidak muncul dengan played=0. Jika belum ada finished match, recalculation mengembalikan kosong.

#### STD-06 — Medium — Qualification status tidak pernah dihitung

Semua row baru selalu `pending`; `qualified`, `eliminated`, `champion`, dan `runner_up` tidak dihasilkan oleh engine.

#### STD-07 — Medium — N+1 query dan hard limits

Standings mengambil sets per match; bracket juga mengambil sets per match. Pada ratusan match, query count tinggi dan limit 50 set/200 match/500 match dapat memotong data.

#### STD-08 — Medium — Bracket cache dianggap source tampilan tanpa freshness/version

Tidak ada `source_version`, `last_source_update_at`, stale badge, atau repair queue. Public dapat membaca projection lama tanpa tahu.

### 4.9 Portal publik dan sharing

Yang sudah baik:

- URL sudah event-scoped.
- Homepage, sports, category, schedule, standings, bracket, champion, match, updates, article, dan announcement tersedia.
- Mobile presentation cukup terstruktur.
- Share WhatsApp/Teams/email/native/copy dan ICS match tersedia.
- Public page memfilter `is_public` pada banyak query.

Temuan:

#### PUB-01 — Critical — REST/GraphQL collection boundary membocorkan hidden/draft data

Banyak collection menggunakan `read: () => true`, termasuk events, sports, categories, rulesets, stages, groups, clubs, teams, entries, standings, brackets, articles, announcements, dan media. Manual public pages memang menambahkan filter, tetapi `/api/*` dan GraphQL tetap dapat membaca:

- event hidden/preview;
- article/announcement draft atau review;
- standings/bracket draft;
- structure yang belum dipublish.

Access control harus berada pada collection boundary; filter UI bukan security boundary.

#### PUB-02 — High — Schedule embargo dan event visibility tidak konsisten lintas halaman

Event gate hanya hidden/not-hidden. `schedule_publish_at` diabaikan; archived event tetap terlihat seperti active event; stage status dan standing publication tidak selalu difilter.

#### PUB-03 — High — Public bracket menampilkan form admin

Semua visitor dapat membuka modal edit result/schedule. Submit anonymous akhirnya dialihkan ke login, tetapi ini merupakan kebocoran affordance, confusing UX, dan memperbesar attack surface Server Action.

#### PUB-04 — Medium — Public match loader membaca data internal lalu memfilter di component

`getMatchDetail` mengambil match sets, seluruh documentation asset, dan seluruh comment via Local API yang default-nya bypass collection access, baru public page memfilter visibility/status. Saat ini filter render mencegah tampilan langsung, tetapi pola ini rapuh. Buat query khusus publik dengan `overrideAccess: false` atau filter public pada query.

#### PUB-05 — Medium — Tidak ada personal schedule/follow flow

PRD menyebut "My schedule search", tetapi belum ada search team/player, favorite, subscribe per team, all-event ICS, QR code, atau notification preference.

#### PUB-06 — Medium — Flat legacy routes ambigu pada multi-event

Legacy `/schedule`, `/matches/:number`, dan ICS flat menggunakan default event/redirect. Match number masih global unique, tetapi canonical URL ICS tetap flat dan dapat mengurangi konsistensi event branding/metadata.

### 4.10 Content, media, documentation, comments, notification

Temuan:

#### CNT-01 — Critical confidentiality — Draft content terbuka melalui API

Article/announcement access `read: () => true`. Status/published-at filtering hanya dilakukan helper frontend, bukan Payload access rule.

#### CNT-02 — High — Custom article editor merusak rich text

Payload menyimpan Lexical rich text, tetapi custom workspace mengubah content menjadi plain-text paragraphs. Mengedit artikel yang dibuat dengan heading, bold, link, list, embed, atau image melalui workspace dapat menghapus formatting. Renderer publik juga hanya mengekstrak paragraph text sehingga rich content Payload tidak dirender utuh.

#### CNT-03 — High — Tag relationship tidak divalidasi dalam event yang sama

Form menawarkan option event aktif, tetapi Server Action menerima ID langsung dan tidak memastikan sport/category/match milik event aktif atau saling konsisten.

#### CNT-04 — High — Upload media tidak memiliki hardening cukup

Media upload hanya memeriksa MIME prefix `image/`; tidak ada size limit, magic-byte detection, filename normalization, pixel/decompression limit, malware scan, quota, atau per-event ownership. Documentation lebih baik tetapi masih mengandalkan browser MIME+extension, bukan content signature.

#### CNT-05 — Medium — Delete media dapat mematahkan referensi

Media dapat dihapus tanpa dependency check, usage list, soft-delete, atau replacement flow. Artikel/event/share image dapat menjadi broken.

#### CNT-06 — Medium — Documentation status tidak otomatis mengikuti upload/approval

Upload asset tidak mengubah `documentation_status` menjadi submitted. Tidak ada approval action yang mengubah status approved, reviewer, rejection reason, atau versioning.

#### CNT-07 — Medium — Comment feature belum menjadi flow publik

Public comment submission belum ada, moderation queue custom tidak ada, article `comments_enabled` tidak menghasilkan form, dan official/internal note lifecycle terbatas. `author_name` dapat diisi operator sehingga audit actor dan display author dapat berbeda.

#### CNT-08 — High product gap — Notification belum berjalan

Email templates dan Mailpit service ada, tetapi tidak ada sender/outbox, recipient resolution, reminder scheduler, schedule-change campaign, push, Teams integration, delivery log, unsubscribe, retry, atau failure handling.

### 4.11 Data integrity, API, performance, dan maintainability

#### DAT-01 — Critical — Tidak ada transaction pada operasi multi-record

Generation, import, score publication, standings upsert/delete, bracket propagation, media+article create, dan audit dilakukan sebagai rangkaian write terpisah.

#### DAT-02 — High — Unique constraint penting tidak lengkap

Tidak ada composite unique yang dapat menjamin:

- `(match_id, set_number)`;
- `(team_id, player_id, category_id)` roster;
- `(category_id, seed_number)` bila seed harus unik;
- `(event_id, slug)` untuk entity event-scoped;
- satu standing per scope+entry selain string key buatan aplikasi.

Read-before-write saja tidak cukup menghadapi request concurrent.

#### DAT-03 — High — Referential invariant hanya ada di beberapa form

Tidak ada collection hook/database constraint yang menjamin category.sport event, court.venue event, match participant category, winner participant side, set winner side, roster player/team event, dan content target event.

#### DAT-04 — High — Hard delete dan cascade policy tidak jelas

Collection mengizinkan delete event/structure/match sesuai role, tetapi tidak ada archive-first policy, dependency preview, cascade plan, restore, retention, atau legal/audit hold.

#### DAT-05 — Medium — Local API default bypass access digunakan luas

Server code memanggil `getPayload()` dan query tanpa `overrideAccess: false`. Ini valid untuk trusted domain service, tetapi berbahaya pada helper yang juga melayani public route. Pisahkan repository public/backoffice dengan filter eksplisit dan tests.

#### PERF-01 — High — Banyak page mengambil seluruh dataset dengan hard cap

Penggunaan limit 100/200/300/500/5000 tersebar tanpa pagination UX. Setelah cap, record tidak tampil dan perhitungan/conflict bisa salah tanpa warning.

#### PERF-02 — Medium — Semua page penting force-dynamic dan query berat

Portal publik melakukan banyak parallel query dan nested depth sampai 2 setiap request. Tidak ada cache tag/domain invalidation yang terstruktur, precomputed read model per event, CDN strategy, atau query profiling.

#### MAINT-01 — High — Tidak ada automated test

Tidak ditemukan unit, integration, component, E2E, permission matrix, accessibility, atau load test. Core algorithm seperti bye/seeding, tiebreaker, lifecycle, dan concurrent score tidak memiliki regression protection.

#### MAINT-02 — High — Tidak ada migration dan CI workflow

Tidak ditemukan migration directory, schema deployment process, CI, lint config/script, test script, atau release gate. Payload schema auto behavior bukan pengganti migration production yang reviewable.

#### MAINT-03 — Medium — Beberapa file terlalu besar dan domain logic tersebar

Wizard page sekitar 1.500 baris, match action sekitar 475 baris, dan terdapat duplicate mutation path. Domain service, validation schema, repository, projection worker, serta reusable policy masih perlu dipisah.

### 4.12 Security dan supply chain

#### SEC-01 — High — Dependency vulnerabilities aktual

`npm audit --omit=dev` pada 2 Agustus 2026 melaporkan 10 vulnerability: 5 high dan 5 moderate. Yang menonjol:

- Next.js 16.2.10 memiliki beberapa advisory high/moderate; npm menawarkan update 16.2.12.
- PostCSS advisory arbitrary file read/path traversal.
- `fast-uri` high.
- `xlsx` high dengan prototype pollution/ReDoS dan tidak ada automatic fix.
- transitive esbuild advisory pada tooling.

Audit harus diulang setelah clean install karena `node_modules` saat ini tidak sinkron.

#### SEC-02 — High — Tidak ada rate limiting/abuse protection yang terlihat

Tidak ditemukan rate limit untuk login, Payload REST/GraphQL, Server Actions, search, upload, atau public endpoints. Payload mungkin menyediakan sebagian auth protection default, tetapi kebijakan aplikasi tidak terdokumentasi/ditest.

#### SEC-03 — Medium — Security headers tidak dikonfigurasi

Tidak ada CSP, HSTS, frame-ancestors/X-Frame-Options, Referrer-Policy, Permissions-Policy, atau explicit content-type protections pada Next config.

#### SEC-04 — Medium — Upload dan static media belum siap untuk untrusted production

File disimpan lokal pada container filesystem; tidak ada object storage private/public policy, signed URL, malware scan, quarantine, retention, atau CDN. Horizontal scaling akan menghasilkan file berbeda per replica.

#### SEC-05 — Medium — Audit log best-effort dan dapat dihapus super admin

Write bisnis tetap berhasil ketika audit gagal. Tidak ada append-only database enforcement, hash chain, external sink, tamper alert, retention, atau correlation/request ID.

### 4.13 Deployment dan operability

#### OPS-01 — Critical production readiness — Docker image adalah development image

Dockerfile memakai `npm install`, menyalin source penuh, menjalankan `npm run dev`, berjalan sebagai root, tidak multi-stage, tidak memakai `npm ci`, dan tidak menghasilkan standalone production artifact. Compose juga diberi komentar local-only.

#### OPS-02 — High — Health check bukan readiness check

`/api/health` selalu mengembalikan `{ok:true}` tanpa memeriksa PostgreSQL, storage, schema/migration, atau worker. Orchestrator dapat mengirim traffic saat dependency belum siap.

#### OPS-03 — High — Redis dan Mailpit tidak benar-benar digunakan aplikasi

Compose menjalankan keduanya, tetapi tidak ditemukan connection/config/job/realtime/email usage. Ini menambah kompleksitas semu tanpa capability.

#### OPS-04 — High — Tidak ada backup/restore/DR dan runbook

Tidak ada documented PostgreSQL backup, media backup, restore drill, RPO/RTO, rollback migration, incident procedure, log aggregation, alert, atau on-call ownership.

#### OPS-05 — High — Tidak ada observability

Hanya logger lokal pada beberapa error. Tidak ada Sentry/APM, structured correlation, metrics, tracing, dashboard untuk stale projection, queue lag, failed email, upload failure, atau concurrent edit.

#### OPS-06 — Medium — Build verification saat audit gagal

`npm run typecheck` gagal karena `xlsx` tidak ditemukan. Ini menunjukkan install reproducibility belum dijaga CI. Build tidak dapat dinyatakan pass pada snapshot lokal ini.

## 5. Perbandingan dengan Tournify

Benchmark merujuk pada sumber resmi berikut:

- [Tournify product site](https://tournifyapp.com/en)
- [Getting started](https://help.tournifyapp.com/en/articles/15069302-getting-started-with-tournify)
- [Participants](https://help.tournifyapp.com/en/articles/8909540-participants)
- [Format](https://help.tournifyapp.com/en/articles/8909549-format)
- [Schedule](https://help.tournifyapp.com/en/articles/8909552-schedule)
- [Process results](https://help.tournifyapp.com/en/articles/8954782-process-results)
- [Scoring and tiebreakers](https://help.tournifyapp.com/en/articles/8955366-scoring-and-tiebreakers)
- [Online registration](https://help.tournifyapp.com/en/articles/8908720-open-an-online-registration-page)
- [Referee score entry](https://help.tournifyapp.com/en/articles/8925192-let-referees-enter-scores)
- [Team/player score entry and disputes](https://help.tournifyapp.com/en/articles/8909460-let-teams-or-players-enter-scores)
- [Presentation](https://help.tournifyapp.com/en/articles/8954107-present)
- [Tournament website](https://help.tournifyapp.com/en/articles/9071602-create-a-tournament-website)
- [Schedule FAQ](https://help.tournifyapp.com/en/articles/8974711-faq-schedule)

### 5.1 Feature matrix

| Capability | ROC GMS V2 | Tournify | Penilaian/gap |
|---|---|---|---|
| Event/tournament creation | Ada, multi-event | Ada | ROC cukup setara di basic setup. |
| Multi-sport dalam satu event | Model native sport/category | Auto-scheduler Tournify menurut FAQ tidak dirancang untuk multi-sport | **Keunggulan strategis ROC**, bila scheduler dibuat sport-aware. |
| Team/player management | Club/team/player/roster/entry | Team/player import, custom columns | ROC model lebih kaya untuk struktur kantor, UX/dedupe belum matang. |
| Online registration | Tidak ada | Custom form, limits, squad list, email confirmation, payment via Mollie | Gap besar. |
| Payment | Tidak ada | Ada via Mollie | Opsional untuk office event, tetapi penting bila menjadi SaaS eksternal. |
| Format templates | Pilihan enum; engine 2 format | Template/custom group, bracket, single match, multi-phase | Gap besar pada engine. |
| Group -> knockout | Belum berjalan | Source position links dan phase progression | Gap critical. |
| Consolation/classification | Tidak ada | Sub-bracket/classification | Gap. |
| Round robin | Ada | Ada, single/double | ROC baru single round-robin sederhana. |
| Single elimination | Ada tetapi bye defect | Mature automatic progression | ROC harus diperbaiki sebelum production. |
| Double elimination | Enum saja | Product berfokus bracket/sub-bracket; dokumentasi utama menjelaskan single elimination | Jangan expose sebagai supported sebelum engine siap. |
| Auto scheduling | Tidak ada | Planner otomatis | Gap besar. |
| Drag-and-drop scheduling | Tidak ada | Ada | Gap besar UX operator. |
| Duration/buffer/rest | Tidak ada | Ada duration dan buffer | Gap. |
| Break/event blocks | Tidak ada | Ada | Gap. |
| Schedule lock | Tidak ada | Ada lock | Gap reliability. |
| Referee management | Tidak ada entity/assignment | Import, availability, automatic/manual assignment, teams as referees | Gap besar. |
| Officer workspace | Ada role tetapi tanpa assignment | Referee unique login links dan assigned matches | ROC UI foundation ada; data model belum. |
| Live score | Operator workspace; non-realtime public | Update lintas platform dan delegated entry | Gap correctness/realtime. |
| Team/player score entry | Tidak ada | Unique links, dispute 5 menit | Gap participant journey. |
| Result dispute | Status enum saja | Log conflicting submissions dan admin adjudication | Gap. |
| Scoring types | Schema luas | Points/sets, advanced points, per-phase scoring | ROC schema bagus tetapi enforcement belum. |
| Tiebreaker | Scalar sebagian | Extensive criteria, head-to-head mini league/iteration | Gap correctness. |
| Player statistics | Tidak ada match events/stats | Goals, attendance, cards, custom stats | Gap. |
| Standings update | Recalculate projection | Otomatis saat result masuk | ROC perlu transaction/outbox/retry. |
| Public website | Ada dan event-scoped | Ada configurable pages | Cukup setara secara cakupan dasar. |
| Mobile apps | Responsive web | iOS/Android presentation app | Gap bila target perlu native/push. |
| Push reminder/result | Tidak ada | Automatic push for followed team/player | Gap. |
| Slideshow/TV mode | Tidak ada | Configurable slideshow | Gap event-day presentation. |
| Sponsor management | Tidak ada | Logo/link pada presentation | Gap komersial/branding. |
| QR code | Tidak ada | Public website QR download | Quick win. |
| PDF/Excel export | Import saja; tidak ada export | Team/player/schedule/score sheet/ranking export | Gap operasional besar dan disaster fallback. |
| Articles/announcements | **Ada** | Info/presentation lebih sederhana | **Keunggulan ROC** sebagai event CMS. |
| Match documentation/comments | **Ada** | Photos/attachments ada, workflow internal tidak sekuat model ROC | Potensi keunggulan ROC setelah approval/security matang. |
| Audit logs | **Ada** | Tidak menjadi fitur utama dokumentasi publik | Potensi keunggulan ROC, tetapi perlu immutable/reliable. |
| API | Payload REST + GraphQL | Tournify menyatakan tidak ada public API | **Keunggulan ROC**, tetapi access boundary harus diperbaiki. |
| Self-hosting/data control | Ada secara arsitektur | SaaS | **Keunggulan ROC** untuk data internal. |
| Custom domain | SiteConfig ada tetapi belum deployment-ready | Tournify public site tidak mendukung own domain menurut help center | Potensi keunggulan ROC. |
| Role-separated admin | Lima role | Tournament admins dan score-only permissions | ROC punya struktur bagus, tetapi global role/event scope belum aman. |

### 5.2 Kesimpulan benchmark

ROC sebaiknya **tidak mencoba menyalin Tournify seluruhnya**. Positioning yang lebih kuat adalah:

> Self-hosted multi-sport internal games operating system dengan club/department hierarchy, content desk, documentation, audit, dan integration-ready API.

Untuk mencapai positioning tersebut, ROC tetap harus memenuhi baseline core tournament yang sudah dianggap standar oleh Tournify: format graph yang benar, planner, referee assignment, delegated score flow, ruleset enforcement, realtime projection, registration, export, dan public visibility yang aman.

## 6. Fitur yang perlu di-improve

### 6.1 P0 — Wajib sebelum turnamen resmi

1. Tutup REST/GraphQL draft leakage dengan collection-level public access filters.
2. Implementasikan event visibility policy yang benar: hidden, preview-only auth, coming-soon, published, archived, `public_open_at`, dan `schedule_publish_at`.
3. Pecah collection permissions per capability dan tambahkan event membership/assignment.
4. Hapus admin forms dari public bracket; satukan seluruh score/schedule mutations ke domain service tunggal.
5. Perbaiki single-elimination bye placement dan ganti index/name advancement dengan graph eksplisit.
6. Tambahkan validation winner/result/set terhadap participant dan ruleset.
7. Buat score mutation concurrency-safe: atomic event/command, idempotency key, optimistic version, dan genuine undo.
8. Gunakan transaction + outbox + idempotent projection worker untuk score, audit, standings, bracket, dan advancement.
9. Perbaiki standings: hanya result published, peserta zero-match, full tiebreaker atau fail-closed untuk unsupported, dan qualification state.
10. Tambahkan regression tests untuk semua hal di atas.
11. Upgrade/replace dependency vulnerable dan pastikan clean install/typecheck/build lulus di CI.

### 6.2 P1 — Agar operasional turnamen benar-benar standar

1. Referee/match-officer entity, availability, assignment, permission per match, dan unique access link.
2. Lifecycle lengkap: publish schedule, check-in, ready, start/pause/resume, submit review, approve, dispute, correct, postpone, cancel, walkover.
3. Rules engine per sport/category/phase: sets, target/deuce/max, timer/period, overtime, penalties, draw, result types.
4. Public realtime via polling terukur lebih dulu, lalu SSE/WebSocket bila perlu; tampilkan connection/last update.
5. Planner: bulk auto-schedule, drag-drop, duration/buffer/rest, breaks/events, sport–court constraints, preview, lock/publish.
6. Group-to-knockout progression graph, source placement, best-N cross-group, consolation/classification.
7. Self-registration dengan approval, limits, waitlist, roster, confirmation email, consent, dan optional payment.
8. PDF/Excel export: participants, schedule, standings, bracket, scoring sheet, audit/change log.
9. Public My Schedule search/favorite, team/player ICS, QR code, reminder preference.
10. Rich Lexical editor/renderer yang tidak lossy dan editorial review workflow.
11. Production deployment: multi-stage non-root image, migrations, readiness, object storage, backup/restore, monitoring, security headers, rate limits.

### 6.3 P2 — Diferensiasi dan scale

1. Player/team statistics: goals, cards, attendance, fair play, custom stat definitions.
2. Sponsor inventory dan placement pada public site/TV/export.
3. TV/slideshow mode untuk venue.
4. Notification center: email, Microsoft Teams, push/web push, templates, delivery status.
5. Participant/team delegated result entry dan dispute window.
6. Schedule/version rollback dan simulation sandbox.
7. Multiple language/timezone yang benar per event.
8. API keys/webhooks, integration events, BI export, SSO/SCIM.
9. Multi-venue travel/equipment/official optimization.
10. Native/PWA offline scorekeeping bila benar-benar dibutuhkan.

## 7. Rekomendasi target architecture

Pisahkan lapisan berikut:

```text
UI / Server Actions / REST / GraphQL / Admin
                 |
            Domain Commands
  (CreateEvent, PublishSchedule, RecordScore,
   ApproveResult, ResolveDispute, AdvancePhase)
                 |
       Validation + Authorization Policy
                 |
       PostgreSQL Transaction + Outbox
                 |
        Projection/Notification Workers
     standings | brackets | public feed | email
```

Prinsip:

- Semua entry point memanggil domain command yang sama.
- Authorization selalu menerima actor + event + capability + resource assignment.
- Write model menyimpan source of truth; standings/bracket adalah projection versioned.
- Tidak ada catch-and-ignore untuk invariant penting.
- Unsupported format/rule ditolak saat konfigurasi, bukan saat generate atau scoring.
- Public repository tidak boleh memakai Local API bypass tanpa public filter eksplisit.

## 8. Acceptance test minimum

### Authorization/visibility

- Anonymous REST/GraphQL tidak dapat membaca event hidden/preview, draft article, internal media/documentation, atau draft bracket.
- Event admin A tidak dapat membaca/mengubah event B melalui UI, action, REST, GraphQL, maupun Payload Admin.
- Scheduler tidak dapat mengubah score/winner; match officer tidak dapat mengubah schedule/delete match.
- Preview-only hanya dapat dibuka member event yang authorized.

### Bracket/generation

- Property test jumlah entry 2–128 memastikan setiap confirmed entry muncul tepat sekali di initial bracket source.
- Test 3, 5, 6, 7, 9, 12 entry memastikan bye tersebar benar dan semua seed dapat mencapai final.
- Revisi winner mengganti downstream participant secara deterministic atau meminta explicit conflict resolution.
- Rename round tidak mengubah graph advancement.

### Score/lifecycle

- Double click +1 dan dua device concurrent menghasilkan dua point, bukan satu.
- Command retry dengan idempotency key tidak menggandakan point/set/audit.
- Result tidak dapat dipublish tanpa winner jika draw dilarang.
- Rules badminton/volleyball/futsal menolak state invalid.
- Finished score revision membutuhkan authorized role dan reason di semua entry point.
- Audit, source result, and outbox commit atomically.

### Standings

- Semua confirmed entry tampil sebelum bermain.
- Draft/finished-unapproved result tidak memengaruhi public standings.
- Two-way dan three-way head-to-head mengikuti configured policy.
- Set-based points/tiebreakers tervalidasi dengan fixture golden tests.
- Projection failure diretry dan stale state terlihat di admin.

### Scheduler

- Adjacent match sesuai buffer policy tidak dianggap overlap.
- Dua team satu club boleh overlap bila roster berbeda; player yang sama tetap terdeteksi.
- Court hanya menerima compatible sport dan venue hours.
- Rest time, referee, travel, dan equipment conflicts terdeteksi.
- Dataset di atas pagination cap tetap lengkap melalui cursor/page processing.

### Content/upload

- Editing rich article mempertahankan heading/link/list/image.
- Upload oversized, spoofed MIME, decompression bomb, dan malicious file ditolak/quarantine.
- Media in-use tidak dapat dihapus tanpa replacement/confirmation.
- Scheduled publish/expiry diuji pada timezone event.

### Operational

- Clean checkout -> `npm ci` -> typecheck -> lint -> unit -> integration -> E2E -> build berhasil di CI.
- Migration forward/backward diuji pada snapshot database.
- Readiness gagal saat DB/storage unavailable.
- Backup restore drill menghasilkan event, score, audit, dan media yang konsisten.

## 9. Urutan implementasi yang disarankan

### Sprint 1 — Boundary dan correctness

- Public collection access rules.
- Event-scoped membership/capabilities.
- Hapus public bracket mutation UI dan duplicate action.
- Fix bye/advancement graph.
- Tests untuk visibility, permission, bracket.

### Sprint 2 — Result source of truth

- Score command/event model, version/idempotency.
- Ruleset enforcement.
- Lifecycle/result approval.
- Transactional outbox dan reliable audit.
- Standings/bracket projection worker.

### Sprint 3 — Match-day operation

- Officer/referee assignment.
- Check-in dan dispute/correction.
- Public polling/SSE dan last-updated.
- Documentation approval/status.

### Sprint 4 — Planning

- Planner data model, duration/buffer/break.
- Conflict engine v2.
- Drag-drop/bulk scheduling, lock/version/publish.
- PDF/Excel backup export.

### Sprint 5 — Participant journey

- Registration, capacity/waitlist, roster validation.
- Confirmation/reminder email.
- My Schedule, ICS/QR/favorite.
- Delegated score entry bila dibutuhkan.

### Sprint 6 — Production hardening

- Dependency remediation, CI, migrations.
- Production Docker, storage, backup/restore.
- Rate limit, security headers, observability, alerts.
- Load, accessibility, and failure-recovery tests.

## 10. Hal-hal yang sudah layak dipertahankan

- Pemisahan portal publik, custom operational workspace, dan Payload Admin.
- Event-scoped public URL.
- Struktur club/team/player/roster/entry yang cocok untuk office olympiad.
- Role-aware navigation dan shared route/action guard sebagai fondasi.
- Audit snapshot concept, setelah dibuat reliable/immutable.
- Content desk, announcements, documentation, sharing, dan ICS sebagai diferensiasi dari bracket app biasa.
- PostgreSQL dan Payload sebagai fondasi data/admin, selama invariant dipindahkan ke domain layer.
- Fokus mobile pada match officer dan public viewer.
- Multi-sport model sebagai keunggulan terhadap keterbatasan auto-scheduling multi-sport Tournify.

## 11. Daftar P0 ringkas untuk go/no-go

Status saat audit: seluruh item berikut adalah **NO-GO**.

- [ ] Hidden/preview/draft tidak dapat dibaca lewat REST/GraphQL/public route.
- [ ] Event membership dan capability enforcement konsisten di semua entry point.
- [ ] Public bracket tidak memiliki admin form.
- [ ] Hanya ada satu canonical score/schedule mutation path.
- [ ] Single-elimination bye dan downstream advancement lulus regression/property tests.
- [ ] Ruleset dan winner invariant ditegakkan server-side.
- [ ] Concurrent score update tidak kehilangan data.
- [ ] Result + audit + outbox atomic; projections retryable dan versioned.
- [ ] Standings hanya memakai approved/published result dan tiebreaker benar.
- [ ] Clean install, typecheck, build, dan automated tests lulus di CI.
- [ ] High dependency advisories ditangani atau memiliki documented risk acceptance.
- [ ] Production deployment, migration, readiness, backup, dan monitoring tersedia.

Jika seluruh P0 sudah hijau, ROC GMS V2 baru pantas masuk pilot turnamen terbatas. P1 diperlukan sebelum sistem menjadi platform operasional yang sebanding dengan tournament manager mapan.
