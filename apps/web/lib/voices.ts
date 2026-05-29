export type VoiceProfile = {
  id: string;
  name: string;
  locale: string;
  language: string;
  type: string;
  description: string;
};

export const VOICE_PROFILES: VoiceProfile[] = [
  {
    id: "auto",
    name: "Auto by target language",
    locale: "Auto",
    language: "Auto",
    type: "Default",
    description: "Uses the default voice for the selected target language.",
  },
  {
    id: "vi-VN-HoaiMyNeural",
    name: "Hoai My",
    locale: "vi-VN",
    language: "Vietnamese",
    type: "Narration",
    description: "Vietnamese female narration voice for localized videos.",
  },
  {
    id: "vi-VN-NamMinhNeural",
    name: "Nam Minh",
    locale: "vi-VN",
    language: "Vietnamese",
    type: "Narration",
    description: "Vietnamese male narration voice for localized videos.",
  },
  {
    id: "en-US-JennyNeural",
    name: "Jenny",
    locale: "en-US",
    language: "English",
    type: "Narration",
    description: "Clear English narration voice for general media.",
  },
  {
    id: "en-US-GuyNeural",
    name: "Guy",
    locale: "en-US",
    language: "English",
    type: "Documentary",
    description: "Lower English voice for documentary-style videos.",
  },
  {
    id: "es-ES-ElviraNeural",
    name: "Elvira",
    locale: "es-ES",
    language: "Spanish",
    type: "Commercial",
    description: "Bright Spanish narration voice.",
  },
  {
    id: "fr-FR-DeniseNeural",
    name: "Denise",
    locale: "fr-FR",
    language: "French",
    type: "Instructional",
    description: "Calm French narration voice.",
  },
  {
    id: "de-DE-KatjaNeural",
    name: "Katja",
    locale: "de-DE",
    language: "German",
    type: "Narration",
    description: "Natural German narration voice.",
  },
  {
    id: "ja-JP-NanamiNeural",
    name: "Nanami",
    locale: "ja-JP",
    language: "Japanese",
    type: "Narration",
    description: "Japanese narration voice.",
  },
  {
    id: "ko-KR-SunHiNeural",
    name: "Sun Hi",
    locale: "ko-KR",
    language: "Korean",
    type: "Narration",
    description: "Korean narration voice.",
  },
  {
    id: "zh-CN-XiaoxiaoNeural",
    name: "Xiaoxiao",
    locale: "zh-CN",
    language: "Chinese",
    type: "Narration",
    description: "Mandarin narration voice.",
  },
];

export function voiceLabel(id: string | null | undefined) {
  const profile = VOICE_PROFILES.find((voice) => voice.id === id);
  if (profile) {
    return `${profile.name} (${profile.locale})`;
  }
  return id || "Auto by target language";
}
