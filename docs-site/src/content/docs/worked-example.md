---
title: "Worked Example"
description: "One company sports day taken through every step, with real values."
sidebar:
  order: 11
---


This chapter follows one realistic event through every part of InTourney with concrete values, so
you can see exactly what to type and click. The other chapters explain each feature; this one shows
them working together.

## The scenario

**PT Bahari Nusantara** runs an annual sports day. This year:

- **Dates:** Saturday 12 September 2026, 08:00 – 17:00, at GOR Bahari, Jakarta.
- **Contingents (5 departments):** Finance, Operations, IT, Marketing, HR.
- **Three sports:**
  | Sport | Category | Mode | Format |
  |---|---|---|---|
  | Badminton | Men's Singles | Individual | Single Elimination |
  | Badminton | Mixed Doubles | Pair | Single Elimination |
  | Futsal | Open | Team | Group Stage to Knockout |
  | Chess | Open | Individual | Round Robin |
- **People:** ~40 players. Finance and IT also each field a futsal team.
- The organizer, **Sari** (HR committee), has an Event Admin account. **Budi** will handle the
  schedule on the day; **Rina** will be the match officer at the badminton hall.

---

## 1. Create the event (wizard steps 1–2)

Sari signs in, clicks **Create New Event**, and skips the Setup Assistant (she knows her plan).

On the **Event** step she enters:

| Field | Value |
|---|---|
| Event name | `Bahari Nusantara Sports Day 2026` |
| URL slug | *(left as auto:* `bahari-nusantara-sports-day-2026`*)* |
| Start | `2026-09-12 08:00` |
| End | `2026-09-12 17:00` |
| Timezone | `Asia/Jakarta` |
| Location | `GOR Bahari, Jakarta` |
| Organizer name | `PT Bahari Nusantara — HR Committee` |
| Logo | `bahari-logo.png` |

She clicks **Create event**. The event now exists as a **Draft**, becomes her active event, and she
is on step 3.

> **Interruption test:** Sari's laptop dies here. When she signs back in, the Event Admin dashboard
> shows a **"Setup in progress — 1 of 7 steps done"** card. She clicks **Resume Setup** and lands
> back on the Sports step, not the beginning.

---

## 2. Add the sports (wizard step 3)

For **Badminton** and **Chess** she uses **Quick add from catalog** — she picks Badminton, ticks
"Men's Singles" and "Mixed Doubles", and InTourney creates the sport, a starting ruleset (best of 3
games to 21), and both categories in one go.

For **Futsal** she clicks **Add a sport manually**, types `Futsal`, and adds a ruleset:

| Field | Value |
|---|---|
| Ruleset name | `Futsal — 2×15 min` |
| Score type | `goals` |
| Allow draw | `yes` (group stage can draw) |

---

## 3. Fine-tune the categories (wizard step 4)

The catalog created three categories; she adds Futsal Open and adjusts:

| Category | Sport | Mode | Format | Notes |
|---|---|---|---|---|
| Men's Singles | Badminton | Individual | Single Elimination | |
| Mixed Doubles | Badminton | Pair | Single Elimination | |
| Open | Futsal | Team | Group Stage to Knockout | `group_qualify_count` = 2, ruleset = Futsal — 2×15 min |
| Open | Chess | Individual | Round Robin | |

She leaves all four at status **draft** for now — she will open them when the roster is settled.

---

## 4. Load participants by import (wizard step 5)

Rather than 40 forms, Sari clicks **Download template for this event**. It comes back with the
**Sports** and **Categories** sheets already filled in. She fills the rest. An excerpt:

**Clubs**

| name | contact_person | contact_email |
|---|---|---|
| Finance | Dewi | dewi@bahari.co.id |
| Operations | Agus | agus@bahari.co.id |
| IT | Fajar | fajar@bahari.co.id |
| Marketing | Lina | lina@bahari.co.id |
| HR | Sari | sari@bahari.co.id |

**Teams**

| name | club_name | category_name |
|---|---|---|
| Finance FC | Finance | Open |
| IT All-Stars | IT | Open |

**Players** (excerpt — note the `category_name` shortcut doing registration inline)

| name | club_name | gender | identification_number | category_name |
|---|---|---|---|---|
| Andi Pratama | Finance | male | EMP-0417 | Men's Singles |
| Bima Sakti | IT | male | EMP-0091 | Men's Singles, Mixed Doubles |
| Citra Larasati | Marketing | female | EMP-0233 | Mixed Doubles |
| Doni Kurnia | Operations | male | EMP-0155 | Men's Singles |
| Eka Putri | HR | female | EMP-0302 | Mixed Doubles |
| … | | | | |

**Pairs**

| player1_name | player2_name | club_name | category_name |
|---|---|---|---|
| Bima Sakti | Citra Larasati | IT | Mixed Doubles |
| Eka Putri | Doni Kurnia | HR | Mixed Doubles |

She uploads the file. The **preview** shows:

```
Sports        0 new    3 update
Categories    0 new    4 update
Clubs         5 new
Teams         2 new
Players      40 new
Pairs         6 new
Registrations 28 entries will be created

⚠ 1 warning — View details ▾
   Players · "Gilang" — identification_number "EMP-0155" already used by "Doni Kurnia"; row created without an ID
```

She fixes Gilang's ID in the sheet, re-uploads (Players now reads `39 update, 1 new`, no warning),
and clicks **Confirm & import**.

---

## 5. Registration and the draw (wizard steps 6–7)

Most players registered themselves via the `category_name` column. Sari opens the **Registration**
step to check each category, then:

- **Futsal Open** — she uses **Bulk assign across sports** and ticks *Finance FC* and *IT All-Stars*
  into *Futsal → Open*. (Only 2 teams this year, so the "group stage" will be a single group.)
- **Chess Open** — she adds the 6 chess players individually.

In **Draw & Seeding** she sets Men's Singles seeds by last year's ranking: Andi #1, Doni #2, the
rest she leaves and clicks **Shuffle** for a random draw among unseeded entries.

Now she goes back to **Categories** and switches all four to status **open**.

---

## 6. Facilities and match generation (wizard step 8)

Under **Event Setup → Facilities & Venues** Sari adds:

| Venue | Courts |
|---|---|
| GOR Bahari — Hall A | Court 1, Court 2 (sport: Badminton) |
| GOR Bahari — Field | Pitch (sport: Futsal) |
| GOR Bahari — Room 3 | Table 1 (sport: Chess) |

Back on **Generate Matches**:

- **Men's Singles** (16 entries) → **Generate**. InTourney previews "Will generate: 8 first-round
  matches · 2 courts available" and creates a seeded 16-draw.
- **Mixed Doubles** (6 pairs) → creates a 6-pair bracket (top 2 pairs get a bye).
- **Chess Open** (6 players, round robin) → creates 15 matches.
- **Futsal Open** → she opens the **Groups** panel: one group of 2, generates 1 group match, and
  will finalize + promote after it is played.

---

## 7. Publish (wizard step 9)

Sari reviews the brackets, then chooses **Publish event and schedule**. The event goes **Live** and
`bahari-nusantara-sports-day-2026` is now a full public site. She sends the link to all staff and
prints the **poster** from `/events/bahari-nusantara-sports-day-2026/poster`.

Before the day she adds Budi as an **event member** with the **Scheduler** role and Rina as a member
with **Match Officer**, so they can see the event.

---

## 8. Match day — the schedule (Budi, Scheduler)

Budi opens the **Scheduler**. The generated badminton matches have no times yet. He schedules the
first round:

| Match | Time | Venue | Court |
|---|---|---|---|
| MS-R1-1  Andi Pratama vs Gilang | 09:00 | Hall A | Court 1 |
| MS-R1-2  Doni Kurnia vs Rangga | 09:00 | Hall A | Court 2 |
| MS-R1-3  … | 09:40 | Hall A | Court 1 |

He tries to put MS-R1-3 on Court 1 at 09:00 and InTourney blocks it: *"That time would create a
venue or court conflict."* He moves it to 09:40.

He creates the single **Futsal Open** group match by hand (League/knockout-panel matches still need a
slot): Finance FC vs IT All-Stars, 10:00, Field / Pitch.

---

## 9. Match day — running matches (Rina, Match Officer)

At 09:00 Rina opens **Match Officer** on her phone. MS-R1-1 is at the top.

1. She taps **Start Match** → status **Ongoing**, actual start time recorded.
2. She opens **Live Score**. Andi wins game 1 21–15: she taps **Add point to Andi** repeatedly; a
   mis-tap is fixed with **Undo**. The hall Wi-Fi drops for a minute — the banner says
   *"Offline — 4 points queued"* and then *"all points synced"* when it returns.
3. Games go 21–15, 19–21, 21–17. She taps **Finish Match** → **Finished** (result still
   *provisional* on the public site).
4. She taps **Confirm and Publish Result**, selects **Andi Pratama** as the winner, confirms.
   Status → **Result Published**. The bracket advances Andi to the quarter-final, and the public
   **Match Updates** feed shows "result published".

Later, a disputed line call in MS-R1-5: Rina taps **Mark Disputed**. It shows up on the **Command
Center** as urgent. Sari reviews it, the officers agree on the score, and Sari (Event Admin) uses
**Resume Review → Confirm and Publish Result** to close it.

---

## 10. Futsal promotion and finals

After the 10:00 group match (Finance FC 3–2 IT All-Stars, published), Sari opens the Futsal
**Groups** panel:

1. **Finalize & lock group stage** — standings computed, both teams "qualify" (group of 2, qualify
   count 2).
2. **Promote to knockout** — creates the final: Finance FC vs IT All-Stars, which Budi schedules for
   15:00.

The badminton and chess brackets play out through the afternoon the same way as step 9.

---

## 11. After the event

- The public **Champions** page (`/events/bahari-nusantara-sports-day-2026/champions`) lists the
  winner of each category as results are published.
- **Medal Tally** ranks the departments. Sari had enabled it on Event Details with the "gold first,
  then silver, then bronze" method; IT tops it with 2 golds.
- The **Content Admin** publishes a recap **article** and a closing **announcement**.
- Sari sets the event **status** to **Completed**.
- Next year she starts the new event and uses **Copy participants from a previous event** on the
  Clubs page to bring the five departments straight across.
