// ═══════════════════════════════════════════════════════
// RESOURCES PAGE — Scripts + Objection Handling
// Drop this file into: client/src/pages/Resources.jsx
// Add the route in App.jsx: <Route path="/resources" element={<Resources />} />
// Add to agent sidebar: { path: '/resources', label: 'Resources', icon: '📖' }
// ═══════════════════════════════════════════════════════

import { useState } from "react";
import { useSearchParams } from "react-router-dom";

// ─── ALL CONTENT FROM YOUR REAL PLAYBOOKS ───────────────

const SCRIPTS = [
  {
    id: "opener_1",
    tag: "OPENER · A",
    label: "Radical Honesty Opener",
    badge: "🏆 Highest Converting",
    badgeColor: "#00e5a0",
    when: "Use as your default opener on every first call",
    psych: "By pre-emptively giving him permission to hang up, you remove the one thing creating his anxiety: feeling trapped. Gong data: radically honest openers outperform standard openers by ~47%.",
    script: `"Hey [Name] — this is [Your Name] with PureCode. Full disclosure — this is a cold call. I get it if you want to hang up. Could I have 20 seconds to tell you why I called, then you decide?"`,
    notes: "Pause after 'hang up.' Let the silence land. If they say go ahead — you're in.",
    tonality: "Calm. Conversational. NOT rehearsed. Slight smile in your voice.",
    avoid: ["'How's your day going?' — 7.6% success rate", "'Is this a good time?'", "Upward inflection on any word"]
  },
  {
    id: "opener_3",
    tag: "OPENER · B",
    label: "Math Interrupt",
    badge: "💡 High Impact",
    badgeColor: "#f5c842",
    when: "When the prospect sounds analytical or numbers-driven — let the math do the work",
    psych: "Makes him do the math himself before you've pitched anything. When he calculates the number out loud, he sells himself. Questions close — statements don't.",
    script: `"Hey [Name] — quick question for you. How many estimate calls a week would you say go unanswered or to voicemail?

[Let him answer]

And rough ballpark — what's an average roofing job worth for you?

[Let him answer]

So if even half those missed calls were potential jobs — that's real money walking out the door every week. Is that a problem worth solving?"`,
    notes: "Let him do the math. Don't rush to answer. The longer the silence after his answer, the better — he's sitting with the number himself.",
    tonality: "Genuinely curious. Conversational. Not scripted. Pause between each question.",
    avoid: ["Giving him the math before he gives you his numbers", "Rushing to the next question", "Adding 'potentially' or 'maybe' — kills certainty"]
  },
  {
    id: "pricing",
    tag: "PRICING",
    label: "How To Present The Plans",
    badge: "💰 Know This Cold",
    badgeColor: "#f5c842",
    when: "Any time pricing comes up — always anchor with Elite first, then let them choose",
    psych: "Anchoring: when Elite ($697) is presented first, Growth ($497) feels like a deal. Without the Elite anchor, Growth feels expensive. The middle option always becomes the obvious value pick.",
    script: `ANCHOR STRATEGY — Always present Elite first:

"We have three plans. Elite is $697/month — that's our premium tier with a dedicated success manager, a real human assigned to your account. Most multi-truck operations go there.

Growth at $497 is where most of our roofing clients land — you get everything: AI receptionist 24/7, appointment booking, missed-call text-back, automated review requests, repeat customer recognition, no-show reminders. It pays for itself fastest.

Starter at $397 is for solo operators who just want to stop missing calls — no frills, just the AI answering every call and booking jobs.

Which of those sounds closest to your situation?"

SETUP FEE:
Starter: $997 one-time setup
Growth: $997 one-time setup  
Elite: $1,497 one-time setup
(Covers voice tuning, AI training, calendar/CRM integration, test calls, live deployment)

ADD-ONS (only after base tier is agreed):
+ Bilingual Spanish: $100/month
+ Multi-location: $150/month per location`,
    notes: "Never lead with add-ons. Anchor Elite first every time. Default to recommending Growth. Only push Starter if they're price-sensitive AND low-volume.",
    tonality: "Confident. Matter-of-fact. Like you know exactly what they need and you've seen this situation a hundred times.",
    avoid: ["Leading with the cheapest plan", "Mentioning add-ons before the base tier is agreed", "Saying 'it depends' — always have a recommendation"]
  },
  {
    tag: "DISCOVERY",
    label: "3-Level Pain Funnel",
    badge: "🎯 Core Framework",
    badgeColor: "#a78bfa",
    when: "After opener lands and he's still on the line — this is where the close is actually built",
    psych: "When a roofer articulates his own pain in his own words, he is 80% sold before you pitch. Surface-level pain doesn't close. Drive 3 levels deep.",
    script: `LEVEL 1 — Surface:
"How often do calls actually go unanswered or to voicemail?"
"What kind of issues come up when your wife/admin can't get to the phone in time?"
"Have you had homeowners tell you they tried calling before they finally got through?"

LEVEL 2 — Consequence:
"And when that happens — what usually goes down?"
"Have you lost actual jobs to that?"
"How often would you say that's happening — weekly? Daily?"

LEVEL 3 — The Money Question (THIS IS WHERE THE CLOSE STARTS):
"If you had to put a number on it — what do you think that's costing you monthly?"`,
    notes: "Do NOT move to pitch until you've hit Level 3. Most reps stop at Level 1 and wonder why their close rate sucks. The money question is where he sells himself.",
    tonality: "Genuinely curious. Slow down as you go deeper. Level 3: pause before asking it.",
    avoid: ["Pitching before Level 3", "Answering your own questions", "Moving too fast between levels"]
  },
  {
    id: "pitch",
    tag: "PITCH",
    label: "The 3-Point Close Pitch",
    badge: "⚡ Use After Discovery",
    badgeColor: "#4ea8de",
    when: "Only after he's articulated his own pain at Level 3",
    psych: "Hormozi value stacking — anchor the value before revealing the price. Three points, each one destroying a different objection before it's raised.",
    script: `"Here's exactly what we do. PureCode is a 24/7 AI receptionist built specifically for roofers. Three things matter:

One — every call gets answered, day or night, storm or no storm. Voicemail never picks up again.

Two — it captures the lead, books the estimate straight into your calendar, and texts the customer back so they don't call your competitor while you're on the roof.

Three — it starts at $397 a month. That's less than half of one recovered roofing job. Everything past that is pure profit.

Based on what you just told me — if this recovered even 2 missed estimate calls a month, what does that look like for your business?"`,
    notes: "The final question makes him do the ROI math out loud. Whatever number he says becomes your anchor for the close. Do NOT move to close until he answers.",
    tonality: "Certain. Measured. Pause between each point. Land 'less than ONE recovered job' like it's obvious.",
    avoid: ["Saying 'does that make sense?'", "Adding features after the three points", "Moving to close before he answers the question"]
  },
  {
    id: "close",
    tag: "CLOSE",
    label: "The Assumptive Close",
    badge: "🏁 Final Stage",
    badgeColor: "#00e5a0",
    when: "After pitch lands and he hasn't raised a hard objection",
    psych: "Belfort's straight-line close. Assume the close is happening. Give him a binary choice between two paths forward, not a yes/no on whether to proceed.",
    script: `"So here's what I'd like to do — book you a 20-minute demo call so you can see exactly how it works on a live call with your business number. No commitment, no credit card. Just see it work.

If it makes sense after the demo, getting you set up and live takes about a week. 

Starter plan is $397 a month. Growth — which is what most of our roofers go with — is $497. Both include everything you need to stop missing calls starting day one.

Does Tuesday or Wednesday work better for the demo?"`,
    notes: "The question offers Tuesday vs Wednesday — NOT 'do you want to do this.' He's choosing WHEN, not IF. Never say 'what do you think?' after the close.",
    tonality: "Confident. Warm. Like it's already decided and you're just sorting logistics.",
    avoid: ["'What do you think?' after pitching", "Offering to send info", "Silence after the question — wait him out"]
  },
  {
    id: "voicemail",
    tag: "VOICEMAIL",
    label: "The Value-Drop Voicemail",
    badge: "📱 Leave Every Time",
    badgeColor: "#ff6b35",
    when: "Every no-answer — never skip leaving a voicemail",
    psych: "Open loop + genuine value. Gives him a real reason to call back — not a fake urgency claim. Roofers call back when they think there's something in it for them.",
    script: `"Hey [Name] — [Your Name] with PureCode Agency. I work specifically with roofing companies helping them stop losing jobs to missed calls and voicemail. 

Had a quick thought about your business I wanted to run by you. Takes 2 minutes.

Call me back when you get a chance — [your number], that's [repeat number slowly]. Talk soon."`,
    notes: "Under 25 seconds. Say your number twice — slowly the second time. Never say 'about our product' or 'I wanted to introduce myself.' The phrase 'had a thought about your business' creates genuine curiosity.",
    tonality: "Peer. Calm. Like you're leaving a message for someone you've met before.",
    avoid: ["'I was hoping to talk to you about our services'", "Saying your company name before his name", "Claiming false urgency — it kills trust if he calls back skeptical"]
  }
];

const OBJECTIONS = [
  {
    id: "obj_1",
    trigger: "We're good right now",
    category: "Brush-off",
    difficulty: "Medium",
    color: "#f5c842",
    framework: "NEPQ — turn it into a question",
    script: `"Totally fair. When you say good — are you saying the phones are covered, or just that it hasn't become a big enough problem yet to deal with?"`,
    why: "Forces him to define 'good.' Most roofers saying this haven't measured their missed calls. The question makes him confront that without you pointing it out.",
    followUp: `If he says phones are covered: "Got it. How many calls a day would you say actually go unanswered or to voicemail — rough estimate?"`,
    neverSay: "Most businesses think they're fine until they see the numbers — then watch it become pushy"
  },
  {
    id: "obj_2",
    trigger: "Send me some information",
    category: "Stall",
    difficulty: "Easy",
    color: "#4ea8de",
    framework: "Voss — label + redirect",
    script: `"Happy to. Before I do — I want to make sure I send you the right thing. What's the main concern you'd want it to address? Is it the cost, how it works, or whether it actually fits a roofing operation like yours?"`,
    why: "Sending info without this question guarantees he never reads it. This forces him to name his real objection.",
    followUp: `Whatever he says — that's the real objection. Handle it live on the call before sending anything.`,
    neverSay: "Sure I'll send that right over — then waiting for a reply that never comes"
  },
  {
    id: "obj_3",
    trigger: "I need to think about it",
    category: "Stall",
    difficulty: "Medium",
    color: "#a78bfa",
    framework: "Sandler — trap-door",
    script: `"Of course. What specifically are you thinking about — is it the investment, how it would fit into your operation, or something else entirely?"`,
    why: "Vague stalls die here. He has to name the real concern. If he can't name it, it usually means he's close to a yes and just needs one more push.",
    followUp: `If he says 'just need time': "What would need to be true for this to be an obvious yes for you?"`,
    neverSay: "No problem, I'll follow up next week — then he ghosts"
  },
  {
    id: "obj_4",
    trigger: "Too expensive / What's the cost?",
    category: "Price",
    difficulty: "Easy",
    color: "#00e5a0",
    framework: "Hormozi — ROI anchor before price",
    script: `"Before I give you a number — you mentioned you're missing around [X] calls a week. At your average job value and a standard close rate, that's real money walking out the door every month. 

Our Starter plan is $397 a month. Growth — which is what most of our roofers go with — is $497. 

If this recovers even ONE extra roofing job in the first month, you're already ahead. Does the number still feel expensive from that angle?"`,
    why: "Price without anchored value always feels expensive. Make him do the ROI math himself first using HIS numbers, not industry averages. Then $397 looks small.",
    followUp: `If he still pushes: "What number would feel right to you?" — Then work backwards. "Okay so if the number was $X, what would need to be true about what it delivered?"`,
    neverSay: "I understand it's a big investment — which validates his concern and loses the frame"
  },
  {
    id: "obj_5",
    trigger: "My wife handles the phones",
    category: "Existing Solution",
    difficulty: "Hard",
    color: "#ff6b35",
    framework: "NEPQ — illuminate the unseen problem",
    script: `"That makes sense — a lot of the guys I talk to say the same thing. Quick question though: when she's with the kids, or at school pickup, or just not near the phone — what happens to those calls?"

[Pause — let him answer]

"And do you know roughly how many of those callers actually leave a voicemail vs just call the next roofer?"`,
    why: "He hasn't measured this. 75% of missed callers don't leave voicemails — they just call the next roofer. Once he sits with that number, the wife-handles-it defense collapses.",
    followUp: `"What would your wife say if she didn't have to be the receptionist anymore?"`,
    neverSay: "AI is way better than a person — triggers defensiveness about his wife"
  },
  {
    id: "obj_6",
    trigger: "Already using [other service] / Already have something",
    category: "Existing Solution",
    difficulty: "Hard",
    color: "#ff4d6a",
    framework: "Voss — empathy + gap question",
    script: `"That's great — sounds like you've already solved the coverage piece. One thing I'm curious about though — is it answering every call after hours and weekends, or does it have gaps?"

[Let him answer]

"And when those gaps happen — is it routing to voicemail, or does the lead actually get captured and scheduled?"`,
    why: "Most existing solutions have gaps. You're not attacking their choice — you're diagnosing whether their solution is complete. They'll sell themselves on the gap.",
    followUp: `"We might be redundant for you then — or we might be filling exactly that gap. Want to take 5 minutes to find out which?"`,
    neverSay: "We're better than [competitor] — sounds defensive and unverified"
  },
  {
    id: "obj_7",
    trigger: "Not interested",
    category: "Brush-off",
    difficulty: "Medium",
    color: "#f5c842",
    framework: "Braun — reduce resistance, earn 20 more seconds",
    script: `"Totally fair — and I appreciate you being straight with me. One quick question before I let you go: is it that you've got the missed-call problem handled, or just that now's not the right time to look at something new?"`,
    why: "Splits the objection into two possible real meanings. If timing is the issue, you can re-engage later. If it's genuinely handled, you learn something.",
    followUp: `If timing: "Got it. When would be a better time to circle back — after storm season, or Q1?"`,
    neverSay: "Can I ask why? — sounds defensive and puts him on the spot"
  },
  {
    id: "obj_8",
    trigger: "I don't trust AI / AI feels impersonal",
    category: "Trust / Tech Concern",
    difficulty: "Hard",
    color: "#a78bfa",
    framework: "Social proof + reframe",
    script: `"That's actually the most common thing I hear from roofers — and it makes sense. Here's the thing though: your callers aren't experiencing 'AI.' They're experiencing someone answering the phone on the first ring at 9pm, getting their info, and seeing an estimate booked on their calendar within minutes.

We had a roofer in [City] who thought the same thing. Month one, he captured 19 missed calls, booked 7 estimates, and closed $77K in jobs. His callers never knew — they just knew someone picked up."`,
    why: "Reframes AI from 'robot' to 'someone always answers.' The client story anchors it with a real outcome.",
    followUp: `"Would it help to hear a recorded call so you can judge the experience yourself?"`,
    neverSay: "AI is actually really human these days — sounds defensive and dismissive of his concern"
  },
  {
    id: "obj_9",
    trigger: "Call me back later / I'm busy",
    category: "Timing",
    difficulty: "Easy",
    color: "#4ea8de",
    framework: "Voss — respect + nail down a time",
    script: `"Absolutely — sounds like you're in the middle of something. When specifically would work — tomorrow morning, or would afternoon be better?"`,
    why: "Don't leave without a specific time. 'Call me back' with no time = ghosted. Forcing a specific slot means he either commits or tells you the real objection.",
    followUp: `Confirm the time, set a calendar reminder immediately, call at that exact time.`,
    neverSay: "No problem I'll try you again sometime — which means never and he forgets you"
  },
  {
    id: "obj_10",
    trigger: "I need to talk to my wife / partner first",
    category: "Decision Maker",
    difficulty: "Medium",
    color: "#00e5a0",
    framework: "Sandler — involve the partner",
    script: `"That makes total sense — sounds like she's involved in the business decisions. Is she available now, or would it be easier to set up a quick 15-minute call with both of you together so I can answer her questions directly?"`,
    why: "The close won't happen without her anyway. Get her on the call now rather than letting him 'explain it' to her inaccurately and lose the deal at the kitchen table.",
    followUp: `If she can't join now: "What's the main thing she'd want to know? I can give you the exact answer to bring to her."`,
    neverSay: "No problem just let me know what she thinks — removes you from the equation"
  }
];

const RULES = [
  { num: "01", rule: "Never say 'how's your day going' — 7.6% success rate. Get to the point." },
  { num: "02", rule: "Never pitch before Level 3 pain. Surface pain doesn't close." },
  { num: "03", rule: "Never answer a question with a statement when you can answer with a question." },
  { num: "04", rule: "Never say 'does that make sense?' — implies your pitch was unclear." },
  { num: "05", rule: "Never offer to send info without identifying the real objection first." },
  { num: "06", rule: "Always leave a voicemail. Every single time. No exceptions." },
  { num: "07", rule: "The close happens in discovery. By the time you pitch, he should be 80% sold." },
  { num: "08", rule: "Every objection is a request for more conviction — not a sign to back off." },
  { num: "09", rule: "Your calmness is the prospect's permission to relax. Never let him hear you rattled." },
  { num: "10", rule: "30 dials → 8 conversations → 2 demos → 1 close. The no's are the cost of the yes." },
  { num: "11", rule: "After every no: wait 4 seconds, breathe, reset your frame, dial the next one. Never let one call bleed into the next." },
  { num: "12", rule: "After every no: wait 4 seconds, breathe, smile, dial the next one. No leakage." },
];

// ─── COMPONENTS ──────────────────────────────────────────

function DifficultyBadge({ level }) {
  const colors = {
    Easy: { bg: "rgba(0,229,160,0.12)", color: "#00e5a0", border: "rgba(0,229,160,0.3)" },
    Medium: { bg: "rgba(245,200,66,0.12)", color: "#f5c842", border: "rgba(245,200,66,0.3)" },
    Hard: { bg: "rgba(255,77,106,0.12)", color: "#ff4d6a", border: "rgba(255,77,106,0.3)" },
  };
  const s = colors[level] || colors.Medium;
  return (
    <span style={{
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      borderRadius: 100, padding: "2px 10px",
      fontSize: 10, fontWeight: 700, letterSpacing: ".06em",
      fontFamily: "'DM Mono', monospace"
    }}>{level}</span>
  );
}

function ScriptCard({ s, expanded, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        background: expanded ? "#0e0f14" : "#0e0f14",
        border: `1px solid ${expanded ? "rgba(0,229,160,0.3)" : "rgba(255,255,255,0.06)"}`,
        borderLeft: `3px solid ${s.badgeColor}`,
        borderRadius: 10, cursor: "pointer",
        transition: "all .15s", marginBottom: 10,
        boxShadow: expanded ? `0 0 24px rgba(0,229,160,0.06)` : "none"
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{
          fontFamily: "'DM Mono', monospace", fontSize: 10,
          color: s.badgeColor, letterSpacing: ".14em", fontWeight: 700
        }}>{s.tag}</span>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#edeae3", flex: 1 }}>{s.label}</span>
        <span style={{
          background: `rgba(${s.badgeColor === "#00e5a0" ? "0,229,160" : s.badgeColor === "#ff6b35" ? "255,107,53" : s.badgeColor === "#f5c842" ? "245,200,66" : "167,139,250"},0.12)`,
          color: s.badgeColor,
          border: `1px solid ${s.badgeColor}44`,
          borderRadius: 100, padding: "2px 10px",
          fontSize: 10, fontWeight: 700, letterSpacing: ".04em",
          fontFamily: "'DM Mono', monospace"
        }}>{s.badge}</span>
        <span style={{ color: "#4a4845", fontSize: 16, marginLeft: 4 }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "20px 20px 24px" }}
          onClick={e => e.stopPropagation()}>

          {/* When to use */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#4a4845", letterSpacing: ".1em", marginBottom: 6 }}>WHEN TO USE</div>
            <div style={{ fontSize: 13, color: "#8a8780" }}>{s.when}</div>
          </div>

          {/* Script */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: s.badgeColor, letterSpacing: ".1em", marginBottom: 8 }}>THE SCRIPT</div>
            <div style={{
              background: "#151619", border: `1px solid rgba(255,255,255,0.08)`,
              borderLeft: `3px solid ${s.badgeColor}`,
              borderRadius: 8, padding: "16px 18px",
              fontStyle: "italic", fontSize: 14, color: "#edeae3",
              lineHeight: 1.7, whiteSpace: "pre-line", letterSpacing: ".01em"
            }}>{s.script}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {/* Tonality */}
            <div style={{ background: "#151619", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#4a4845", letterSpacing: ".1em", marginBottom: 8 }}>🎙 TONALITY</div>
              <div style={{ fontSize: 12, color: "#8a8780", lineHeight: 1.6 }}>{s.tonality}</div>
            </div>
            {/* Psychology */}
            <div style={{ background: "#151619", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#4a4845", letterSpacing: ".1em", marginBottom: 8 }}>🧠 WHY IT WORKS</div>
              <div style={{ fontSize: 12, color: "#8a8780", lineHeight: 1.6 }}>{s.psych}</div>
            </div>
          </div>

          {/* Never say */}
          <div style={{ background: "rgba(255,77,106,0.06)", border: "1px solid rgba(255,77,106,0.2)", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#ff4d6a", letterSpacing: ".1em", marginBottom: 8 }}>🚫 NEVER SAY</div>
            {s.avoid.map((a, i) => (
              <div key={i} style={{ fontSize: 12, color: "#ff4d6a88", marginBottom: 4, display: "flex", gap: 8 }}>
                <span>×</span><span>{a}</span>
              </div>
            ))}
          </div>

          {/* Notes */}
          {s.notes && (
            <div style={{ marginTop: 12, fontSize: 12, color: "#8a8780", lineHeight: 1.6, borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 12 }}>
              <span style={{ color: "#f5c842", fontWeight: 700 }}>📌 Notes: </span>{s.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ObjectionCard({ o, expanded, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        background: "#0e0f14",
        border: `1px solid ${expanded ? `${o.color}44` : "rgba(255,255,255,0.06)"}`,
        borderLeft: `3px solid ${o.color}`,
        borderRadius: 10, cursor: "pointer",
        transition: "all .15s", marginBottom: 10
      }}
    >
      {/* Header */}
      <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{
          background: `${o.color}14`, color: o.color,
          border: `1px solid ${o.color}33`,
          borderRadius: 6, padding: "3px 10px",
          fontSize: 10, fontFamily: "'DM Mono', monospace",
          fontWeight: 700, letterSpacing: ".06em", whiteSpace: "nowrap"
        }}>{o.category}</span>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: "#edeae3", flex: 1 }}>
          "{o.trigger}"
        </span>
        <DifficultyBadge level={o.difficulty} />
        <span style={{ color: "#4a4845", fontSize: 14 }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "20px 20px 24px" }}
          onClick={e => e.stopPropagation()}>

          {/* Framework */}
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#4a4845", letterSpacing: ".1em", marginBottom: 4 }}>FRAMEWORK</div>
          <div style={{ fontSize: 12, color: o.color, marginBottom: 16, fontWeight: 600 }}>{o.framework}</div>

          {/* Script */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: o.color, letterSpacing: ".1em", marginBottom: 8 }}>YOUR RESPONSE</div>
            <div style={{
              background: "#151619", borderLeft: `3px solid ${o.color}`,
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 8, padding: "16px 18px",
              fontStyle: "italic", fontSize: 13.5, color: "#edeae3",
              lineHeight: 1.75, whiteSpace: "pre-line"
            }}>{o.script}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            {/* Why */}
            <div style={{ background: "#151619", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#4a4845", letterSpacing: ".1em", marginBottom: 8 }}>🧠 WHY IT WORKS</div>
              <div style={{ fontSize: 12, color: "#8a8780", lineHeight: 1.6 }}>{o.why}</div>
            </div>
            {/* Follow up */}
            <div style={{ background: "#151619", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#4a4845", letterSpacing: ".1em", marginBottom: 8 }}>➜ FOLLOW UP</div>
              <div style={{ fontSize: 12, color: "#8a8780", lineHeight: 1.6, whiteSpace: "pre-line" }}>{o.followUp}</div>
            </div>
          </div>

          {/* Never say */}
          <div style={{ background: "rgba(255,77,106,0.06)", border: "1px solid rgba(255,77,106,0.2)", borderRadius: 8, padding: "10px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ color: "#ff4d6a", fontWeight: 700, marginTop: 1 }}>🚫</span>
            <div>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#ff4d6a", letterSpacing: ".08em", fontWeight: 700 }}>NEVER SAY: </span>
              <span style={{ fontSize: 12, color: "#ff4d6a88" }}>{o.neverSay}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────

export default function Resources() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "scripts");
  const [expandedScript, setExpandedScript] = useState("opener_1");
  const [expandedObj, setExpandedObj] = useState(null);
  const [searchObj, setSearchObj] = useState("");

  const filteredObjs = OBJECTIONS.filter(o =>
    o.trigger.toLowerCase().includes(searchObj.toLowerCase()) ||
    o.category.toLowerCase().includes(searchObj.toLowerCase())
  );

  return (
    <div style={{ padding: "24px 28px", maxWidth: 920, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#4a4845", letterSpacing: ".14em", marginBottom: 8 }}>RESOURCES · ROOFING</div>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 28, color: "#edeae3", letterSpacing: "-.02em", marginBottom: 6 }}>
          Scripts & Objection Handling
        </h1>
        <p style={{ fontSize: 13, color: "#8a8780", lineHeight: 1.6, maxWidth: 560 }}>
          Every script, every objection rebuttal from the PureCode Roofing Sales Playbook — organized so you can pull them during a live call.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, background: "#0e0f14", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 100, padding: 4, width: "fit-content" }}>
        {[
          { id: "scripts", label: "📖 Scripts", count: SCRIPTS.length },
          { id: "objections", label: "💡 Objections", count: OBJECTIONS.length },
          { id: "rules", label: "⚡ 12 Rules", count: RULES.length },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? "#00e5a0" : "transparent",
            color: tab === t.id ? "#000" : "#8a8780",
            border: "none", borderRadius: 100, padding: "7px 18px",
            fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12,
            letterSpacing: ".04em", cursor: "pointer", transition: "all .12s",
            display: "flex", alignItems: "center", gap: 8
          }}>
            {t.label}
            <span style={{
              background: tab === t.id ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.06)",
              borderRadius: 100, padding: "0px 7px", fontSize: 10,
              fontFamily: "'DM Mono', monospace"
            }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* ── SCRIPTS TAB ── */}
      {tab === "scripts" && (
        <div>
          <div style={{ marginBottom: 16, fontSize: 12, color: "#4a4845" }}>
            Click any script to expand the full word track, tonality guide, and psychology breakdown.
          </div>
          {SCRIPTS.map(s => (
            <ScriptCard
              key={s.id}
              s={s}
              expanded={expandedScript === s.id}
              onToggle={() => setExpandedScript(expandedScript === s.id ? null : s.id)}
            />
          ))}
        </div>
      )}

      {/* ── OBJECTIONS TAB ── */}
      {tab === "objections" && (
        <div>
          {/* Search */}
          <div style={{ marginBottom: 16, position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#4a4845", fontSize: 14 }}>🔍</span>
            <input
              value={searchObj}
              onChange={e => setSearchObj(e.target.value)}
              placeholder="Search objections..."
              style={{
                width: "100%", background: "#0e0f14", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, padding: "9px 14px 9px 38px",
                color: "#edeae3", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none"
              }}
            />
          </div>

          {/* Quote */}
          <div style={{
            background: "rgba(0,229,160,0.06)", border: "1px solid rgba(0,229,160,0.15)",
            borderRadius: 8, padding: "12px 18px", marginBottom: 16,
            fontSize: 13, color: "#8a8780", fontStyle: "italic", lineHeight: 1.6
          }}>
            "An objection is the prospect telling you they want to buy — but they need one more reason to make it OK with themselves."
            <div style={{ marginTop: 6, fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#4a4845", fontStyle: "normal" }}>— PureCode Sales Playbook</div>
          </div>

          {/* Framework reminder */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {["1. ACKNOWLEDGE — 'Totally fair.'", "2. REFRAME — Question", "3. ADVANCE — Next step"].map((s, i) => (
              <div key={i} style={{
                background: "#0e0f14", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6, padding: "6px 14px",
                fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#00e5a0"
              }}>{s}</div>
            ))}
          </div>

          {filteredObjs.map(o => (
            <ObjectionCard
              key={o.id}
              o={o}
              expanded={expandedObj === o.id}
              onToggle={() => setExpandedObj(expandedObj === o.id ? null : o.id)}
            />
          ))}

          {filteredObjs.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#4a4845", fontSize: 13 }}>
              No objections found for "{searchObj}"
            </div>
          )}
        </div>
      )}

      {/* ── RULES TAB ── */}
      {tab === "rules" && (
        <div>
          <div style={{
            background: "rgba(245,200,66,0.06)", border: "1px solid rgba(245,200,66,0.2)",
            borderRadius: 8, padding: "14px 18px", marginBottom: 20,
            fontSize: 13, color: "#8a8780", lineHeight: 1.6
          }}>
            <span style={{ color: "#f5c842", fontWeight: 700 }}>Read these before every session.</span> Reps who treat this as a daily reference become the top of the team.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {RULES.map(r => (
              <div key={r.num} style={{
                background: "#0e0f14", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8, padding: "14px 18px",
                display: "flex", alignItems: "flex-start", gap: 16
              }}>
                <span style={{
                  fontFamily: "'Syne', sans-serif", fontWeight: 800,
                  fontSize: 20, color: "rgba(0,229,160,0.25)", lineHeight: 1,
                  flexShrink: 0, minWidth: 28
                }}>{r.num}</span>
                <span style={{ fontSize: 13.5, color: "#8a8780", lineHeight: 1.65 }}>{r.rule}</span>
              </div>
            ))}
          </div>

          {/* Pre-call checklist */}
          <div style={{ marginTop: 24, background: "#0e0f14", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "20px" }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 16, color: "#edeae3" }}>⚡ Pre-Call Ritual</div>
            {[
              "Re-read the 12 rules before your first dial",
              "Speak your top 3 client stories out loud",
              "Roleplay 1 hard objection — out loud, not in your head",
              "Stand up for your first 10 dials",
              "Set your daily numbers: dials, conversations, demos, closes",
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div style={{ width: 20, height: 20, border: "1.5px solid rgba(0,229,160,0.3)", borderRadius: 4, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#8a8780" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
