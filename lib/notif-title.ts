// Notification titles are stored with a leading emoji (for example "🎉 Your club was approved").
// The screens show it as a Loop line icon instead, so this splits the two.
const LEAD = /^((?:\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*)+)\s*/u;

export function splitTitle(title: string): { emoji: string | null; text: string } {
  const m = LEAD.exec(title);
  return m ? { emoji: m[1], text: title.slice(m[0].length) } : { emoji: null, text: title };
}
