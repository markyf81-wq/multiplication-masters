export const TABLES = Array.from({ length: 12 }, (_, index) => index + 1);

export function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function normaliseEquation(value) {
  return String(value).toLowerCase().replace(/\s/g, "").replace(/×/g, "x");
}

export function newGame(table, studentId) {
  if (!TABLES.includes(table)) throw new Error("Choose a table between 1 and 12.");
  return {
    id: crypto.randomUUID(), studentId, table,
    startedAt: new Date().toISOString(), completedAt: null,
    phase: "flash", index: 0, score: 0,
    cards: shuffle(TABLES).map(multiplier => ({
      multiplier, initialCorrect: null, timedOut: false,
      initialAnswer: "", responseMs: 0, retries: [], points: 0,
    })),
    quiz: null,
  };
}

export function currentCard(game) {
  return game.phase === "retry" ? game.cards.filter(card => !card.initialCorrect)[game.index] : game.cards[game.index];
}

export function markFlash(game, answer, responseMs, timedOut) {
  const card = currentCard(game);
  const correct = !timedOut && /^\d+$/.test(answer.trim()) && Number(answer) === game.table * card.multiplier;
  Object.assign(card, { initialAnswer: answer, initialCorrect: correct, timedOut, responseMs, points: correct ? 5 : 0 });
  game.score += card.points;
  return correct;
}

export function markRetry(game, answer, responseMs) {
  const card = currentCard(game);
  const expected = `${game.table}x${card.multiplier}=${game.table * card.multiplier}`;
  const correct = normaliseEquation(answer) === expected;
  card.retries.push({ answer, correct, responseMs });
  if (correct) {
    card.points = Math.max(1, 4 - card.retries.length);
    game.score += card.points;
  }
  return correct;
}

export function startQuiz(game) {
  game.phase = "quiz";
  game.index = 0;
  // Every fact appears at least once; eight shuffled repeats bring it to 20.
  game.quiz = {
    questions: shuffle([...shuffle(TABLES), ...shuffle(TABLES).slice(0, 8)]),
    answers: [], correct: 0, wrong: 0, passed: false,
    durationMs: 0, endedBecause: null,
  };
}

export function markQuiz(game, answer, responseMs) {
  const multiplier = game.quiz.questions[game.index];
  const correct = /^\d+$/.test(answer.trim()) && Number(answer) === game.table * multiplier;
  game.quiz.answers.push({ multiplier, answer, correct, responseMs });
  if (correct) game.quiz.correct++;
  else game.quiz.wrong++;
  game.index++;
  return correct;
}

export function finishGame(game) {
  game.phase = "complete";
  game.completedAt = new Date().toISOString();
  return structuredClone(game);
}

export function gameStats(game) {
  const correct = game.cards.filter(card => card.initialCorrect).length;
  const answered = game.cards.filter(card => card.initialCorrect !== null);
  return {
    correct, accuracy: Math.round(correct / 12 * 100),
    averageMs: answered.length ? Math.round(answered.reduce((total, card) => total + card.responseMs, 0) / answered.length) : 0,
    retries: game.cards.reduce((total, card) => total + card.retries.length, 0),
    medal: !!game.quiz?.passed,
  };
}
