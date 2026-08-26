# FixIt — Home Services Booking & Dispatch App
### Project Plan · Frontend + Backend + DevOps

> **Working name:** FixIt (swap for anything you like — SevaConnect, Kaam, HandyHub…)
> **What it is:** An on-demand home-services app. A customer books a pro (plumber / electrician / cleaner), the system dispatches the nearest available pro, the job gets done, payment is settled, everyone is notified.
> **Why this project:** It is the single most in-demand app shape on freelancing platforms *and* the richest vehicle for learning the full DevOps stack — because it naturally decomposes into many small services that must talk to each other reliably.

---

## 1. The core idea (in one line)

**Book a service → dispatch the nearest pro → pro completes the job → settle payment → notify everyone.**

Every feature we build hangs off that sentence. The domain (handyman) is just a label; the *system* underneath is the reusable, transferable skill.

---

## 2. Guiding principles (read before every phase)

1. **Always have something running.** We build in thin slices. At the end of every phase there is a working, demoable app. We never spend a month with nothing to show.
2. **Learn the primitive by hand before automating it.** Run containers by hand before Compose. Run Compose before Kubernetes. Each tool must be introduced as the *answer to a pain you personally felt* one layer below. If you can't explain what a tool is automating, you're not ready for it yet.
3. **AI is a tutor you double-check, not an autopilot.** For a DevOps career switch, understanding the *why* matters more than shipping fast. Verify what the AI tells you (run it, check the docs).
4. **Frontend is your strength, backend/DevOps is your growth zone.** Lean on RN to keep momentum; stretch into the ops side deliberately.

---

## 3. The full target system (the destination)

This is where we're headed by the end. Nothing here is cut — it's just built rung by rung.

### 3.1 Backend services

> 📄 **Full per-service spec** (data model, API, core logic, what to learn first) lives in **`SERVICES.md`**. The table below is the summary.

| Service | Responsibility | Key DevOps lesson |
|---|---|---|
| **api-gateway** | Single entry point the apps talk to; routing, TLS, rate limiting | The "front door" pattern; decoupling apps from services |
| **auth-service** | Signup/login for customers + pros, JWT, roles | Stateless services, secrets management |
| **booking-service** | Create/track service requests, lifecycle state machine | Core REST + its own DB, migrations |
| **pro-service** | Pro profiles, skills, availability, live location | Geo-queries (Redis GEO / PostGIS) |
| **dispatch-service** | Offer job → nearest pro → 15s timeout → roll to next → who-accepts-first wins | Queues, background workers, delayed jobs, idempotency |
| **payment-service** | Charge customer, settle pro — the correctness-critical ledger | Idempotency, correctness under retries |
| **notification-service** | Push: "pro on the way", "job done", "₹X paid" | Event-driven pub/sub, fan-out |
| **agent-simulator** | Fake pros so dispatch can be tested/load-tested without real humans | Load testing, chaos |

### 3.2 Frontend (React Native — your turf)

**One single app with role-based UI** (not two separate apps). On login we read the user's role from the JWT and render a different navigation stack:

- **Customer role** — browse services, book, track status, pay, rate.
- **Pro role** — go online/offline, share location, receive & accept job offers, mark jobs done.

> **Why one app, not two:** shared code (auth, profile, API client, notifications) is written once; simpler to build and demo; and the backend doesn't care either way (role-based auth serves both). Split into two apps only *later*, and only if you hit a real reason — pro app needing always-on background location, separate store listings, or independent release cycles. Because screens are already separated by role, splitting later is easy: move each role's screens into its own app and share the common code as a package.

### 3.3 DevOps stack (the real point)

Docker → docker-compose → Kubernetes (minikube → GKE) → Helm → CI/CD → Prometheus/Grafana monitoring → centralized logging → deliberate chaos/incident practice.

### 3.4 System diagram (target state)

```
  [Customer App]        [Pro App]           (React Native)
        \                  /
         \                /
        [ api-gateway ]  ← single entry point
        /   |    |    \    \
   auth  booking pro dispatch  ... 
          |      |     |
        (DBs)  (Redis GEO) (queue/worker)
                             |
                       payment-service → notification-service
                             |                    |
                        (ledger DB)          (push notifications)
```

---

## 4. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Mobile | **React Native (Expo to start)** | Your strength; fast iteration |
| Backend services | **Node.js + Express** (or NestJS later) | Matches your existing skills; fastest to build |
| Databases | **PostgreSQL** (per service), **Redis** (geo + queues) | Industry standard; Redis teaches caching + queues |
| Queue | **Redis / BullMQ** (upgrade to RabbitMQ/Kafka later) | Start simple, feel the need before upgrading |
| Containerization | **Docker** + **docker-compose** | The foundation of everything |
| Orchestration | **Kubernetes** (minikube → GKE), **Helm** | Your K8s learning path |
| CI/CD | **GitHub Actions** | Free, ubiquitous |
| Monitoring | **Prometheus + Grafana** | The standard SRE stack |
| Logging | **Loki** (or ELK later) | Centralized logs |

> Start Node-only for simplicity. Once comfortable, rewrite ONE service (e.g. dispatch) in **Go** to learn polyglot builds + smaller images.

---

## 5. The phased roadmap

Each phase = a working app + one new DevOps muscle. Do NOT start a phase until the previous one runs and is demoable.

### ✅ Phase 1 — Skeleton (the confidence win)
**Goal:** Book a service → it's saved on your own dockerized backend → deployed with a public URL.

- **Frontend (RN):**
  - [ ] Customer app: service picker (Plumber/Electrician/Cleaner) → time slot → address → **Book** button
  - [ ] "My bookings" list screen (status: pending/assigned/done)
  - [ ] Simple admin list screen (see all bookings, change status)
- **Backend:**
  - [ ] `booking-service`: `POST /bookings`, `GET /bookings`, `PATCH /bookings/:id`
  - [ ] PostgreSQL with one `bookings` table
- **DevOps:**
  - [ ] Write your first `Dockerfile` for the backend
  - [ ] `docker-compose.yml` running backend + Postgres together
  - [ ] Deploy to a public URL (Railway/Render, or a cheap VPS)
  - [ ] Point the RN app at the live URL and book from your phone
- **🎉 Done when:** you book a plumber on your phone and it lands in a database running in a container you deployed.

### Phase 2 — Identity
**Goal:** Customers and pros can log in; roles exist.

- **Frontend:** login/signup screens; store JWT; send it on every request.
- **Backend:** `auth-service` (JWT, roles: customer/pro/admin).
- **DevOps:** secrets/env-var management; two services talking to each other; update compose.
- **Done when:** you log in, and only your own bookings show up.

### Phase 3 — The pro side
**Goal:** Pros exist, go online/offline, have a location.

- **Frontend:** add the **pro role UI** to the same app — role-based navigation (customer stack vs pro stack); online/offline toggle, send GPS location.
- **Backend:** `pro-service` (profiles, skills, availability, location); geo-query "who's near this booking?"
- **DevOps:** add Redis (GEO); manage 3+ services locally; healthchecks.
- **Done when:** you can query "available plumbers within 5km of this address."

### Phase 4 — Dispatch (the big one)
**Goal:** Auto-offer a job to the nearest pro with a timeout/reassign loop.

- **Frontend:** pro-role UI receives **push notification** offer → "Accept in 15s" screen. Customer-role UI shows live "finding a pro…" status.
- **Backend:** `dispatch-service` with offer → 15s timeout → roll to next → handle who-accepts-first (locking). Build `agent-simulator` (fake pros that auto-accept/decline).
- **DevOps:** queues + background workers + delayed jobs; idempotency & race conditions; first load test with the simulator.
- **Done when:** you trigger a booking and watch the offer→accept→assigned dance happen automatically.

### Phase 5 — Money + events
**Goal:** Payment settled, everyone notified via events.

- **Frontend:** payment screen; "₹X credited/paid" confirmations.
- **Backend:** `payment-service` (the ledger — must be correct under retries); `notification-service` fires on events (job assigned, en route, done, paid).
- **DevOps:** event-driven pub/sub; correctness under retries; the "never lose or double-count a rupee" discipline.
- **Done when:** completing a job triggers payment + a chain of notifications, reliably.

### Phase 6 — Move to Kubernetes
**Goal:** Run the whole fleet on a cluster (because compose now hurts).

- **DevOps:** migrate all services to K8s (minikube → GKE); pods, deployments, services, ingress, configmaps/secrets, scaling; package with Helm charts; add the api-gateway properly.
- **Frontend:** mostly unchanged — it just points at the gateway (nice lesson: the app doesn't care the backend moved to a cluster).
- **Done when:** the entire app runs on Kubernetes and survives a pod being killed.

### Phase 7 — Production polish (full SRE toolkit)
**Goal:** Observe it, ship it automatically, break it on purpose.

- **DevOps:**
  - [ ] CI/CD pipeline (GitHub Actions: build → test → push image → deploy)
  - [ ] Prometheus + Grafana dashboards (latency, error rate, queue depth)
  - [ ] Centralized logging (Loki)
  - [ ] Chaos practice: kill a service, watch it recover, write a mini post-mortem
- **Done when:** you can push a commit and watch it auto-deploy, and you can see (and explain) a graph of what your system is doing.

---

## 6. Phase 1 — literal first steps (start here)

The exact order to move from empty folder to deployed:

1. [ ] `mkdir` the repo, `git init`, add this plan to it.
2. [ ] **Backend first (so the app has something to talk to):**
   - [ ] `npm init`, install Express + a Postgres client (`pg`)
   - [ ] One file: an Express server with `GET /health` returning `{ ok: true }`
   - [ ] Run it locally, hit `/health` in the browser
3. [ ] **Add the database:**
   - [ ] Install Postgres locally OR skip straight to running it in Docker
   - [ ] Create the `bookings` table (id, service_type, slot, address, status, created_at)
   - [ ] Wire `POST /bookings`, `GET /bookings`, `PATCH /bookings/:id`
4. [ ] **Dockerize (your first real DevOps rep):**
   - [ ] Write a `Dockerfile` for the backend
   - [ ] Write `docker-compose.yml` with two services: `backend` + `postgres`
   - [ ] `docker-compose up` → hit `/health` again, now from the container
5. [ ] **Frontend:**
   - [ ] `npx create-expo-app`
   - [ ] Booking form screen → `POST /bookings` to `http://localhost:PORT`
   - [ ] "My bookings" list → `GET /bookings`
6. [ ] **Deploy:**
   - [ ] Push image / repo to Railway or Render (or a VPS)
   - [ ] Get a public URL
   - [ ] Change the app's API base URL to the public one
   - [ ] Book from your actual phone → 🎉

---

## 7. Tooling & cost notes

- **AI assistant options (~$18–20 entry, all comparable):**
  - Claude Pro ($20) — best reasoning/explanation (best for learning the *why*)
  - Kimi ($19) — cheap tokens, strong agentic coding
  - **GLM (Z.ai)** — cheapest; has **pay-as-you-go** (GLM-4.7 ≈ $0.6/$2.2 per M tokens, a near-free Flash tier) and a **$18 Coding Plan** that runs inside Claude Code
- **Recommendation for a light/irregular learner:** start with **pay-as-you-go** (GLM-4.7 workhorse) — could be just a few dollars/month; switch to a flat plan once daily usage is steady.
- **Deploy cheaply:** Railway/Render free-ish tiers for Phases 1–5; a small GKE cluster only when you reach Phase 6 (watch the meter — GKE costs real money, tear it down when not learning).

---

## 8. Progress log

_Use this to track what you actually did, so future-you (and interviewers) can see the journey._

| Date | Phase | What I did | What I learned |
|---|---|---|---|
| | 1 | | |

---

_This plan is a living document. Update it, tick boxes, and add notes as you go._
