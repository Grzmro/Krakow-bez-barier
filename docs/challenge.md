# Challenge: Kraków bez barier (Miasto Kraków)

**This file is the source of truth for scope.** Every Linear task and every design decision must
trace back to a requirement here. If a task contradicts this file, this file wins — flag it.

Source: HackYeah 2026 partner task by Miasto Kraków ("KRYTERIA Kraków Bez Barier" and
"RULES Cracow Without Barriers" in the organizers' Drive folder). The original brief is in Polish;
this is a faithful English summary — check the original when wording matters.

## One-line pitch

A tool that lets residents and tourists check whether a place or a route in Kraków fits *their*
needs — showing concrete barriers and facilities (steps, ramps, lifts, entrance width, surface,
toilet, rest spots), each with its source, date and reliability — built on open data so the city
doesn't have to maintain a database, and designed to scale to other cities as a business.

## Problem

- People move around the city with very different needs: wheelchair users, parents with strollers,
  anyone for whom steps, thresholds, narrow entrances or certain surfaces are an obstacle.
- The problem isn't only missing data but **how it's presented**: a plain "accessible / not
  accessible" label doesn't let a user judge whether a place or route works for them.
- Data should be as current as possible, and **unconfirmed information must never be presented as
  a formal guarantee of accessibility.**
- The city won't maintain a database by hand and won't give access to internal systems (UMK, MJO).

## What we build

A working prototype that lets a user **search for a place or route and see the accessibility
details relevant to a chosen user group**. Scope the prototype to one group or type of need — e.g.
wheelchair users and parents with strollers. Any form works (web or mobile app) as long as the main
scenario can be demonstrated.

## Requirements

| # | Requirement | Must cover |
|---|---|---|
| R1 | **Concrete barriers & facilities** | Steps, thresholds, ramps, lifts, entrance width, surface, toilet, rest spots — as current as possible; never only "accessible / not accessible" |
| R2 | **Provenance on every fact** | Source, date acquired / last confirmed, reliability status. User reports and other unverified data clearly distinguished from confirmed data. A way to correct wrong or outdated data |
| R3 | **Open data only** | Public data and services on their providers' terms; no manual database maintained by the city; no access to UMK/MJO internal systems. For city data: name the exact datasets / public APIs, how they're fetched, update frequency, and what happens when a source is unavailable |
| R4 | **Needs-based matching** | Results fit the chosen user group's needs. **Don't require disability information** when barrier/facility preferences are enough |
| R5 | **Architecture** | Data acquisition and updates separated from presentation. Document main components, data flow, and how to add new sources, place categories and geographic areas |
| R6 | **Digital accessibility** | WCAG 2.2 AA as the target. Already in the prototype: keyboard support, screen reader support, readable content, sufficient contrast, **text alternative for anything shown only on the map**. List what's done vs. still to do |
| R7 | **Data protection & security** | What user data is collected, how reports and accounts (if any) are protected, secure connections only |
| R8 | **Deployable by others** | Easy to use and to deploy for potential customers (hotels, event organizers…). List external dependencies, data and component licenses, portability to other infrastructure, and how to add another city |

## Required deliverables (submission)

1. Description of the solution and the problem it solves.
2. Working prototype or demo.
3. Target user group and how they use the solution.
4. **Data sources** and how their freshness and reliability are assessed.
5. **Business model** and further development options.
6. PDF presentation, **max 10 slides**.
7. **Video (MP4, max 3 minutes)** showing the project working, published in an accessible, open
   repository.
8. Optional: code repository, screenshots, demo link, other materials.
9. **Plan to run and maintain it outside city infrastructure**: who is responsible for hosting,
   updates, security, handling reports, and running costs. The prototype needn't stay online after
   the hackathon, but the model must allow further development.

## How the jury will evaluate it

Design the demo for exactly this:

- **Live demo for the chosen user group:** state their needs, check at least one place or route,
  show concrete barriers and facilities that let the user judge the result themselves.
- **Show provenance:** where each piece of information comes from, when it was acquired/confirmed,
  how the app marks incomplete, outdated or unverified data. **Sample data must be clearly labeled
  as sample.**
- **Show a failure case:** at least one case with conflicting or incomplete data, or an unavailable
  source — and what the user sees then. **Missing information must never look like confirmed
  accessibility.**
- **Accessibility check of the main scenario:** keyboard, screen reader, contrast, map information
  available as text. State known limitations and the plan to fix them.
- **Prototype → service plan:** who owns the product, how data is acquired and verified, how hosting
  and maintenance are funded, roadmap, conditions for launching in the next city.

## Available data sources

Each source used must be documented: origin, terms of use, freshness, how it's verified. Publicly
available ≠ free to scrape and use commercially.

- **Otwarte Dane Miasta Krakowa** — city datasets (JSON, CSV, XLSX, some APIs):
  https://otwartedane.um.krakow.pl
- **MSIP** (Miejski System Informacji Przestrzennej) — Kraków spatial data catalog, some via WMS/WFS:
  https://msip.krakow.pl
- **dane.gov.pl** — national open data catalog (useful for scaling to other cities):
  https://dane.gov.pl
- **OpenStreetMap** — places and road network, basis for maps and routing; ODbL license, attribution
  required: https://www.openstreetmap.org
- Other open sources, information from venue owners, user reports.

## Evaluation criteria

The two official documents give different weights — design for both.

**Challenge brief (KRYTERIA):**

| Criterion | Weight |
|---|---|
| Fit with the challenge and usefulness for the user group, incl. ease of use | 25% |
| Quality and completeness of the prototype | 20% |
| Data reliability, presentation and updating | 15% |
| Deployment potential and scalability | 20% |
| Business model, commercialization and market potential | 20% |

**Competition rules (RULES):**

| Criterion | Weight |
|---|---|
| Idea — creativity, how far the problem is solved | 30% |
| Technical aspects — technologies, algorithms, code quality | 30% |
| Design — architecture, scalability, production readiness | 20% |
| Relation to the category | 10% |
| WOW factor — originality, extra features beyond the requirements | 10% |

The organizers stress that **business potential** (business model, launch and growth, market) weighs
especially heavily. Commercialization directions they name: services for venue owners, hotels, event
organizers, property managers, booking systems, map and tourist-app providers.

To be eligible for the prize the project must score at least 50%.

## Rules and logistics

- **Time:** start no earlier than Saturday 3 October 2026, 11:00; **submit by Sunday 4 October 2026,
  11:00** on HackTribe (https://hackyeah2026.hacktribe.co/). Changes after the deadline are ignored.
- **Submission:** project title, team ID, project description, PDF (max 10 slides), **MP4 video max
  3 minutes**; optionally screenshots, repo, demo links.
- **Language: Polish** — the submission and the pitch.
- **Team:** 1–6 people.
- **Jury:** at least two members; simple majority.
- **Prize:** PLN 5,000 (gross), paid within 180 days.
- **IP:** after accepting the prize, the authors' economic copyrights to the winning solution are
  **transferred** to the prize sponsor (a transfer agreement is signed by each team member). Mind the
  licenses of everything we include.
- **Mentors** (mentor zone and Discord): Bartłomiej Węglarz, Karolina Grzanka, Michał Janaś.
