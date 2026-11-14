import { ACCENTS } from "@/lib/accent";

// A house's colour comes from the same palette as profile colours.
export const houseColor = (color: string) => (ACCENTS[color] ?? ACCENTS.olive).ring;
export const houseGradient = (color: string) => (ACCENTS[color] ?? ACCENTS.olive).cover;
