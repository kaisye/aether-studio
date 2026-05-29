export const VOICE_RATE_OPTIONS = [
  { value: "-30%", label: "Slow -30%" },
  { value: "-20%", label: "Slow -20%" },
  { value: "-10%", label: "Slow -10%" },
  { value: "+0%", label: "Normal" },
  { value: "+10%", label: "Fast +10%" },
  { value: "+20%", label: "Fast +20%" },
  { value: "+30%", label: "Fast +30%" },
];

export function voiceRateLabel(value: string | null | undefined) {
  return VOICE_RATE_OPTIONS.find((option) => option.value === value)?.label ?? "Normal";
}
