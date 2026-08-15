# CodeSearch × Sarvam AI — startup credits request

> One-line: **CodeSearch is a voice-first, vernacular AI tutor for competitive
> programming — built on Sarvam AI so Indian students can learn DSA in their own
> language.** We're requesting Sarvam startup credits to run a pilot.

**Live product:** https://das.boats/ · **Repo:** this repository

*(Placeholders in «angle brackets» to fill before sending.)*
Founder: «name» · Contact: «email / phone» · Stage: «pre-seed / bootstrapped»

---

## 1. What it is

An AI-native platform where learners practice real problems (Codeforces, CodeChef,
CSES, LeetCode) with an AI **tutor** that gives progressive hints instead of
solutions, reviews their code, teaches the underlying pattern, and quizzes them —
**by voice, in 11 Indian languages.** Spaced-repetition reviews and a progress
dashboard keep learning sticky.

It is **already built and deployed** — vernacular voice tutoring, multi-judge
problem bank, in-browser C++ runner, auth, spaced repetition, and an analytics
dashboard are all live.

## 2. Why Sarvam (strategic fit)

- **Vernacular is the moat, and Sarvam is best-in-class for Indian languages.**
  The entire value prop — a patient tutor that speaks Hindi, Tamil, Telugu, Bengali,
  Marathi, and more — rides on Sarvam's STT/TTS and Indian-language LLM quality.
- **Voice-first learning** for students who are more fluent speaking their mother
  tongue than typing English — exactly Sarvam's speech stack.
- **Made-in-India, for Bharat.** Target users are Tier-2/3 college students; a
  domestic model provider aligns with the mission and the data-residency story.

## 3. How we use Sarvam today (in production)

| Capability | Sarvam model | Role in the product |
|---|---|---|
| Speech-to-text | `saaras:v3` | Transcribe spoken questions; auto-detect the language |
| Text-to-speech | `bulbul:v2` | Read tutor replies aloud in the learner's language |
| Tutor chat (LLM) | `sarvam-105b` | Generate vernacular, hint-gated tutoring (default brain) |

Sarvam is the **default and hero**; an OpenAI fallback exists but the product is
Sarvam-native.

## 4. Consumption model (what credits fund)

*All figures are illustrative unit-estimates from how the app actually calls Sarvam;
adjust to your real funnel. They intentionally use **units** (tokens, characters,
audio-seconds) so you can multiply by Sarvam's current published rates.*

**Per tutor interaction**
- **Text message → 1 chat completion:** ~3,000 input tokens (pedagogy + problem
  statement + learner code + short history) + ~400 output ≈ **~3.4K tokens/message**.
- **Spoken question → 1 STT call:** ~8–12s of audio ≈ **~10 audio-seconds**.
- **Spoken reply → 1 TTS call:** ~500–700 characters ≈ **~600 characters**.

**Per active learner-day** (assume ~12 messages/day; ~40% use voice in/out):
| Signal | Estimate |
|---|---|
| Chat tokens | 12 × 3.4K ≈ **~41K tokens** |
| STT audio | ~5 calls × 10s ≈ **~50 seconds** |
| TTS characters | ~5 calls × 600 ≈ **~3,000 characters** |

*(Cost is capped per user by `DAILY_MESSAGE_CAP = 50` messages/day — a built-in
guardrail against runaway spend.)*

**Per active learner-month** (assume ~12 active days/month):
- Chat: **~490K tokens** · STT: **~10 minutes** · TTS: **~36K characters**

**At scale** (monthly, same per-user assumptions):
| Monthly active learners | Chat tokens | STT audio | TTS characters |
|---|---|---|---|
| 500 | ~245M | ~83 hrs | ~18M |
| 2,000 | ~980M | ~333 hrs | ~72M |
| 10,000 | ~4.9B | ~1,667 hrs | ~360M |

> Fill the ₹/unit column from Sarvam's pricing to convert the table above into a
> rupee ask:
>
> | Unit | Sarvam rate | 500 MAU/mo | 2,000 MAU/mo |
> |---|---|---|---|
> | Chat (per 1M tokens) | ₹«rate» | ₹«245 × rate» | ₹«980 × rate» |
> | STT (per hour/min) | ₹«rate» | ₹«…» | ₹«…» |
> | TTS (per 1K chars) | ₹«rate» | ₹«…» | ₹«…» |
> | **Total / month** | | **₹«…»** | **₹«…»** |

## 5. The ask

We're requesting **₹«amount» in Sarvam credits** (or «N» months of usage) to fund a
**«3-month» pilot at «~500» monthly active learners** across «target cohort — e.g.
2–3 partner colleges». This covers the consumption in §4 with headroom, and lets us:

- Run free vernacular tutoring for students who can't pay per-token costs.
- Gather usage + language-adoption data to prove the Bharat learning thesis.
- Tune prompts and voices per language with real learner feedback.

**Milestones we'll report back on:** MAU, messages/learner, language mix,
retention (spaced-repetition return rate), and problems solved.

## 6. Why now

The product works and is deployed. The only thing between us and putting a
free, voice-based, mother-tongue coding tutor in front of thousands of students is
inference cost. Sarvam credits remove that barrier and put Sarvam's models at the
center of a mission-aligned, India-first education product.

---

*Appendix: architecture, data model, and setup are documented in
[`README.md`](README.md); deployment in [`DEPLOY.md`](DEPLOY.md).*
