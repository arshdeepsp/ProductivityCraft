/* A realistic account's worth of data: every quest type, subjects with topics and rating history, a Rulebook,
   busy times, a repeat, a month of logged days with sessions, topic time and plans. Shared by the crawl and the sync spec. */
export const Q = [
  { id: "th", type: "time", label: "Thesis writing", min: 90, roll: 900, addedOn: "2026-10-01", subj: "s1", subjs: ["s1"], topics: ["t1", "t2"] },
  { id: "rd", type: "time", label: "Paper reading", min: 45, lim: 90, addedOn: "2026-10-01", subj: "s1", subjs: ["s1"], topics: ["t1"] },
  { id: "fr", type: "time", label: "French", min: 30, roll: 240, per: "2w", days: [1, 2, 3, 4, 5], addedOn: "2026-10-01", subj: "s2", subjs: ["s2"], topics: ["t3"] },
  { id: "mo", type: "time", label: "Monthly reading", min: 30, roll: 600, per: "month", addedOn: "2026-10-01" },
  { id: "gym", type: "check", label: "Gym", days: [1, 3, 5], addedOn: "2026-10-01" },
  { id: "med", type: "time", label: "Meditation", min: 10, total: 600, addedOn: "2026-10-01" },
  { id: "wk", type: "wake", label: "Up by 7", from: "06:00", to: "07:30", addedOn: "2026-10-01" },
  { id: "wt", type: "target", label: "Water", min: 8, ul: "glasses", step: 1, addedOn: "2026-10-01" },
  { id: "sc", type: "limit", label: "Social media", max: 30, unit: "min", addedOn: "2026-10-01" },
  { id: "jr", type: "weekly", label: "Journal", min: 4, addedOn: "2026-10-01" },
  { id: "cl", type: "check", label: "Call parents", opt: true, addedOn: "2026-10-01" },
  { id: "dl", type: "target", label: "Flashcards", min: 20, ul: "cards", step: 5, dl: { from: "2026-10-20", due: "2026-11-15", total: 400 }, addedOn: "2026-10-20" },
  { id: "td1", type: "todo", label: "Email supervisor about chapter 3", addedOn: "2026-11-02" },
  { id: "td2", type: "todo", label: "Renew library books", addedOn: "2026-11-01" }
];
export const SUBJ = [
  { id: "s1", name: "Machine Learning", topics: [{ id: "t1", name: "Transformers", p: 3, hist: [{ d: "2026-10-01", p: 2 }], target: 4 }, { id: "t2", name: "Optimization", p: 2, hist: [] }] },
  { id: "s2", name: "French", topics: [{ id: "t3", name: "Subjunctive", p: 1, hist: [] }] },
  { id: "s3", name: "Empty subject", topics: [] }
];
export const RULES = [{ title: "Mornings", motto: "Start slow", blocks: [{ h: "No phone", t: "Until coffee.\n- then plan\n1. first\n+ allowed\nx not allowed\n> lead\ncard: A | B | C\nfact: 10 | things\nchips: a, b" }] }, { title: "Evenings", motto: "", blocks: [{ h: "Lights out", t: "- 23:00" }] }];
const at = (d, h) => Date.parse(`${d}T${h}:00:00-05:00`);
export function days() {
  const D = {};
  for (let i = 1; i <= 32; i++) {
    const d = new Date(Date.UTC(2026, 9, i)); if (d.getUTCMonth() !== 9) break;
    const k = `2026-10-${String(i).padStart(2, "0")}`;
    D[k] = { th: 100 + (i % 5) * 10, rd: 30, med: 10, gym: true, wk: "06:50", wt: 8, jr: i % 3 === 0, sc: 10, cl: i % 2 === 0, tt: { t1: 60 + i, t2: 40 }, sess: [{ id: "x", s: at(k, "09"), e: at(k, "11"), m: 120 }], sched: [{ id: "a" + i, q: "th", f: 540, t: 660 }], q: Q };
  }
  D["2026-11-01"] = { th: 100, rd: 45, med: 10, wk: "06:40", wt: 8, fr: 60, tt: { t1: 100, t3: 60 }, q: Q };
  D["2026-11-02"] = { th: 40, rd: 20, wt: 3, sc: 12, q: Q, tt: { t1: 40 }, sched: [{ id: "a", q: "th", f: 540, t: 660 }, { id: "b", q: "rd", f: 780, t: 840 }, { id: "c", q: "fr", f: 1020, t: 1050 }, { id: "d", q: "med", f: 1320, t: 1330, j5: true }] };
  return D;
}
export const busy = [{ id: "bz1", lb: "Lecture", f: 600, t: 720, dows: [1, 3], from: "2026-10-01" }];
export const rep = [{ id: "r1", q: "fr", f: 900, t: 930, dows: [2, 4], from: "2026-10-26" }];
