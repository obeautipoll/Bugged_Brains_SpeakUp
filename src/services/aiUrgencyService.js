import { loadLexicons } from "./loadLexicons.js";

const urgencyKeywords = [
  // English
  "urgent", "asap", "immediately", "emergency", "danger",
  "help", "unsafe", "harass", "threat", "violence", "kill", "hurry", "extremely",

  // Cebuano
  "tabang", "karon", "karon dayon", "palihog dali", "paspas", "hinay-hinay", 
  "peligro", "hulga", "pagdali",  

  // Tagalog
  "tulong", "ngayon", "agad", "madali", "delikado", "banta"
];

let lexicons = null;

export const analyzeComplaintUrgency = async (text) => {
  // SAFETY: avoid undefined errors
  if (!text || typeof text !== "string") return null;

  if (!lexicons) lexicons = await loadLexicons();
  const lexicon = lexicons.englishLexicon;

  // Normalize text
  const cleanText = text.toLowerCase().replace(/[^\w\s-]/g, "");
  const words = cleanText.split(/\s+/);

  // SENTIMENT SCORING
  let score = 0;
  words.forEach((w) => {
    const val = lexicon[w];
    if (typeof val === "number") score += val;
  });

  const sentiment = score > 0 ? "positive" : score < 0 ? "negative" : "neutral";

  // CHECK URGENCY WORDS
  const hasUrgentWord = words.some((w) =>
    urgencyKeywords.some((kw) => w.includes(kw))
  );

  // URGENCY LOGIC
  let urgency = null;

  if (hasUrgentWord && score <= -2) urgency = "Critical";  // strong negative + urgent word
  else if (hasUrgentWord) urgency = "High";               // urgent keyword only
  else if (sentiment === "negative" && score <= -2)
    urgency = "High";                                     // very negative

  // ❗ Return ONLY High or Critical
  if (urgency === "High" || urgency === "Critical") {
    return { text, sentiment, score, urgency };
  }

  return null; // LOW or no urgency → not displayed
};
