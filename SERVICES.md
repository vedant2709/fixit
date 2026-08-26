# FixIt — Service-by-Service Specification

> Companion to `PROJECT_PLAN.md`. This describes **what each service is responsible for**, its data, its API, who it talks to, and the concepts to learn before building it. Read the service for the phase you're about to start — don't try to absorb all 8 at once.

**Legend for each service:**
- **Purpose** — the one job it owns
- **Owns data** — its private tables (each service owns its own DB — no shared database)
- **API** — the main endpoints it exposes
- **Core logic** — the interesting behaviour to get right
- **Talks to** — its dependencies (other services, DB, queue)
- **Events** — messages it publishes/consumes (from Phase 5 onward)
- **Build in phase** — when it first appears
- **Prep / learn first** — concepts to understand before coding it

---

## Cross-cutting rule: database-per-service

Each service owns its **own database**. `booking-service` never reaches into `pro-service`'s tables. If it needs pro data, it *asks the pro-service via API* (or listens to an event). This is a core microservices principle — it's what lets services deploy and scale independently. It feels like extra work at first; that "friction" is the lesson.

---

## 1. auth-service

- **Purpose:** Identity. Register users, log them in, issue & verify JWTs, manage roles.
- **Owns data:**
  - `users` — `id`, `phone/email`, `password_hash`, `role` (customer | pro | admin), `name`, `created_at`
- **API:**
  - `POST /auth/register` — create a user with a role
  - `POST /auth/login` — verify credentials → return a signed **JWT** (contains `user_id` + `role`)
  - `GET /auth/me` — return the current user from their token
  - `POST /auth/verify` — (internal) other services call this, or verify the JWT signature themselves
- **Core logic:**
  - Hash passwords with **bcrypt** (never store plaintext).
  - Sign a JWT with a secret; put `user_id` and `role` in the payload.
  - Every other service trusts a valid JWT — so this service is the root of trust.
- **Talks to:** its own `auth` Postgres DB.
- **Build in phase:** 2
- **Prep / learn first:** what a JWT actually is (header.payload.signature), why it's stateless, bcrypt hashing, where to store secrets (env vars, not code). Understand the difference between **authentication** (who are you) and **authorization** (what are you allowed to do — the `role`).

---

## 2. booking-service

- **Purpose:** The heart of the app. Create and track a service request through its lifecycle.
- **Owns data:**
  - `bookings` — `id`, `customer_id`, `service_type` (plumber/electrician/cleaner), `slot_time`, `address`, `lat`, `lng`, `status`, `assigned_pro_id` (nullable), `created_at`, `updated_at`
- **API:**
  - `POST /bookings` — customer creates a request (status starts `pending`)
  - `GET /bookings` — list *my* bookings (customer) or all (admin)
  - `GET /bookings/:id` — one booking + its current status
  - `PATCH /bookings/:id/status` — move it along the lifecycle
- **Core logic — the lifecycle state machine (learn this well):**
  ```
  pending → assigned → en_route → in_progress → completed
                     ↘ cancelled (from most states)
  ```
  Only *valid* transitions are allowed (e.g. you can't go `completed → pending`). Enforcing this is the single most important idea in the service.
- **Talks to:** its own `booking` Postgres DB. From Phase 4, it hands new `pending` bookings to `dispatch-service`. From Phase 5, it emits events.
- **Events (phase 5+):** publishes `booking.created`, `booking.completed`.
- **Build in phase:** 1 (basic CRUD), enriched in 4 & 5.
- **Prep / learn first:** what a **state machine** is and why you enforce valid transitions; REST resource design; DB migrations (how to evolve the `bookings` table over time).

---

## 3. pro-service

- **Purpose:** Everything about the pros (service providers) — profile, skills, availability, live location.
- **Owns data:**
  - `pros` — `id` (= user_id from auth), `name`, `skills` (e.g. `[plumber, electrician]`), `status` (online | offline | busy), `rating`
  - live location stored in **Redis** (GEO), not Postgres — it changes constantly
- **API:**
  - `POST /pros/me/status` — go online/offline
  - `POST /pros/me/location` — push current GPS (updates Redis GEO)
  - `GET /pros/nearby?lat=&lng=&skill=&radius=` — **the key query:** "which online pros with this skill are within X km?"
  - `GET /pros/:id` — a pro's profile/rating
- **Core logic:**
  - **Geo-query:** given a booking's location + required skill, return candidate pros sorted by distance. This is what dispatch depends on.
  - Location is high-write, ephemeral → Redis `GEOADD` / `GEOSEARCH`, not a relational table.
- **Talks to:** its own `pro` Postgres DB (profiles) + **Redis** (live location).
- **Build in phase:** 3
- **Prep / learn first:** Redis basics, Redis **GEO** commands (`GEOADD`, `GEOSEARCH`), why hot/ephemeral data doesn't belong in your main relational DB, and the idea that a single query ("who's nearby?") can be the crux of a whole feature.

---

## 4. dispatch-service ⭐ (the hard, interesting one)

- **Purpose:** Match a `pending` booking to an actual pro using the **offer → timeout → reassign** loop.
- **Owns data:**
  - `dispatch_jobs` — `id`, `booking_id`, `status` (searching | offered | accepted | failed), `current_offer_pro_id`, `attempt_count`, `offered_at`
  - a **queue** (Redis/BullMQ) holding jobs and delayed timeout checks
- **API / triggers:**
  - Consumes new bookings (called by booking-service or via a `booking.created` event)
  - `POST /dispatch/:jobId/accept` — a pro accepts an offer (only the *first* wins)
  - `POST /dispatch/:jobId/decline` — a pro declines → immediately try next
- **Core logic — the dispatch loop:**
  1. Ask `pro-service` for nearby candidate pros (sorted by distance).
  2. **Offer** the job to candidate #1 → send a push via `notification-service` → set a **15s delayed timeout job** on the queue.
  3. If the pro **accepts** first → mark `accepted`, tell booking-service to set booking `assigned`, stop.
  4. If they **decline** or the **timeout fires** → move to candidate #2, repeat.
  5. If the list runs out → mark `failed` (notify customer "no pros available").
- **The tricky bits (this is the SRE gold):**
  - **Race condition:** two pros tap Accept at the same instant → only one may win. Use a **lock / atomic update** (`UPDATE ... WHERE status='offered'` returning affected rows).
  - **Idempotency:** the same accept request arriving twice must not double-assign.
  - **Delayed jobs:** the 15s timeout is a *scheduled* queue job, not a `setTimeout` in memory (which dies if the process restarts).
- **Talks to:** `pro-service` (find candidates), `notification-service` (send offers), `booking-service` (report assignment), Redis/BullMQ (queue + locks).
- **Build in phase:** 4
- **Prep / learn first:** message **queues** & **workers**, **delayed/scheduled jobs**, **idempotency**, **race conditions & locking**, and why in-memory timers are unreliable in a distributed system. This is the phase that teaches the most about distributed systems — go slow here.

---

## 5. payment-service 💰 (correctness-critical)

- **Purpose:** Charge the customer, settle the pro, keep a correct ledger. Never lose or double-count money.
- **Owns data:**
  - `ledger_entries` — `id`, `booking_id`, `type` (charge | payout), `amount`, `status`, `idempotency_key`, `created_at`
  - (start with a simple internal wallet/ledger; real gateway like Stripe/Razorpay comes later)
- **API:**
  - `POST /payments/charge` — charge for a completed booking (with an **idempotency key**)
  - `POST /payments/settle` — credit the pro
  - `GET /payments/booking/:id` — payment status for a booking
- **Core logic:**
  - Use a **DB transaction**: "record the charge AND mark it settled" — both succeed or both roll back.
  - **Idempotency key** on every write: if the same request arrives twice (retry, double-tap), it executes **once**. This is the whole point of the service.
- **Talks to:** its own `payment` Postgres DB; consumes `booking.completed`; emits `payment.completed`.
- **Events:** consumes `booking.completed`, publishes `payment.completed`.
- **Build in phase:** 5
- **Prep / learn first:** ACID **transactions**, **idempotency keys**, why financial code must be correct under retries/concurrency, double-entry ledger basics. This service is where the "SRE mindset" (correctness under failure) really lands.

---

## 6. notification-service

- **Purpose:** Send the right message to the right person when something happens — decoupled from everyone else.
- **Owns data:**
  - `notifications` — `id`, `user_id`, `type`, `payload`, `sent_at`, `read_at` (optional history)
  - device push tokens per user
- **API / triggers:**
  - Mostly **event-driven**: it *listens* rather than being called directly.
  - `POST /notifications/register-token` — app registers its push token
- **Core logic:**
  - Subscribe to events (`booking.assigned`, `dispatch.offer`, `payment.completed`, …) → look up the user → send a push notification (Expo Push / FCM).
  - **Fan-out:** one event may notify several people (customer *and* pro).
- **Talks to:** the event bus (Redis pub/sub or a queue), a push provider (Expo/FCM), its own small DB.
- **Events:** consumes many; publishes none (it's a sink).
- **Build in phase:** 4 (basic push for offers) → 5 (full event-driven).
- **Prep / learn first:** **pub/sub** vs direct calls, **event-driven architecture**, why decoupling notifications from business logic matters (booking-service shouldn't know *how* a push is sent), push notifications in Expo/FCM.

---

## 7. api-gateway

- **Purpose:** One front door. The mobile app talks *only* to the gateway; the gateway routes to the right service.
- **Owns data:** none (it's stateless).
- **Responsibilities:**
  - **Routing:** `/auth/*` → auth-service, `/bookings/*` → booking-service, etc.
  - **TLS termination** (HTTPS in one place).
  - **Auth check** (optionally verify JWT once here, so each service doesn't re-implement it).
  - **Rate limiting** (basic abuse protection).
- **Talks to:** every service (as a reverse proxy).
- **Build in phase:** 6 (introduce it properly when you have several services + move to K8s). Early on the app can call services directly; the gateway earns its place once there are many.
- **Prep / learn first:** what a **reverse proxy** is (nginx / Traefik / a small Express gateway), why a single entry point decouples the app from your internal service layout, TLS basics.

---

## 8. agent-simulator (a tool, not a product feature)

- **Purpose:** Fake pros so you can test & load-test dispatch without real humans driving around.
- **Responsibilities:**
  - Spin up N virtual pros: log in as pros, go online, sit at random lat/lngs around your city.
  - Receive offers → auto-accept or auto-decline after a random delay.
  - Let you fire many bookings at once and watch the whole dispatch dance + measure it.
- **Talks to:** the same public API as a real pro app (auth, pro-service, dispatch-service).
- **Build in phase:** 4 (alongside dispatch).
- **Prep / learn first:** basic scripting of API calls, the idea of **load testing**, and simulating concurrency. Bonus: containerize it and scale it up to stress the system — great DevOps practice.

---

## How the services collaborate — one booking, end to end (Phase 5 target)

```
1. Customer app → api-gateway → booking-service:  POST /bookings           (status: pending)
2. booking-service → emits booking.created  → dispatch-service picks it up
3. dispatch-service → pro-service: GET /pros/nearby?skill=plumber          (candidates)
4. dispatch-service → offers job to pro #1 → notification-service → push to pro
5. dispatch-service sets a 15s timeout job on the queue
6a. Pro accepts → dispatch-service (lock: first wins) → tells booking-service → status: assigned
6b. Timeout/decline → offer to pro #2 → repeat
7. Pro marks job done → booking-service: status: completed → emits booking.completed
8. payment-service consumes booking.completed → charges customer, settles pro (idempotent, in a txn)
9. payment-service emits payment.completed → notification-service pushes "₹X paid" to both
```

Trace this flow whenever you feel lost — it's the whole system in 9 steps.

---

## Suggested prep order (before coding each phase)

| Phase | Services to study | Core concept to nail first |
|---|---|---|
| 1 | booking-service | REST + state machine + Docker |
| 2 | auth-service | JWT + roles + secrets |
| 3 | pro-service | Redis GEO + geo-queries |
| 4 | dispatch-service, agent-simulator, notification (basic) | queues, workers, delayed jobs, race conditions |
| 5 | payment-service, notification (full) | transactions, idempotency, pub/sub |
| 6 | api-gateway | reverse proxy, Kubernetes |
| 7 | (all — operate them) | CI/CD, monitoring, logging, chaos |

Study only the row you're about to build. Everything else can wait.
