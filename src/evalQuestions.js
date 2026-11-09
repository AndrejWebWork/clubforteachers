export const RATING_SCALE_NOTE = "(5 - најмногу, 1 - најмалку)";

export function ratingPrompt(prompt) {
  const text = String(prompt || "").trim();
  if (!text) return RATING_SCALE_NOTE;
  if (text.includes("најмногу") && text.includes("најмалку")) return text;
  return `${text} ${RATING_SCALE_NOTE}`;
}

export function defaultEvalQuestions() {
  return [
    { prompt: `Оценка од 1 до 5 за обуката ${RATING_SCALE_NOTE}`, kind: "rating", options: [] },
    { prompt: "Дали обуката ви беше корисна?", kind: "choice", options: ["Да", "Делумно", "Не"] },
    { prompt: "Би ја препорачале ли оваа обука на колега?", kind: "choice", options: ["Да", "Не"] },
    { prompt: "Што беше најкорисно во обуката?", kind: "text", options: [] },
    { prompt: "Што би подобриле во следната обука?", kind: "text", options: [] },
  ];
}

export function evalList(training) {
  const list = Array.isArray(training?.evalQuestions)
    ? training.evalQuestions.filter((item) => String(item?.prompt || "").trim())
    : [];
  return list.length ? list : defaultEvalQuestions();
}

export function emptyEvalQuestion() {
  return { prompt: "", kind: "text", options: ["", ""] };
}
