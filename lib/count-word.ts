/**
 * "Six", "Five"… for headings that state a real count ("Six people.") — the
 * number comes from data (roster, projects), so the sentence stays true when
 * the CMS changes it. Outside 2–12 returns null and the caller words it
 * without a number.
 */
const WORDS = ["", "", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

export function countWord(n: number): string | null {
  return Number.isInteger(n) && n >= 2 && n < WORDS.length ? WORDS[n] : null;
}
