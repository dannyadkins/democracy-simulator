export interface AgentAvatar {
  prompt: string;
  description: string;
  imageUrl?: string;
  loading?: boolean;
  error?: string;
}

type ColorToken = { name: string; hex: string };

const BG_COLORS: ColorToken[] = [
  { name: 'periwinkle', hex: '#EEF2FF' },
  { name: 'mist', hex: '#F1F5F9' },
  { name: 'mint', hex: '#ECFDF3' },
  { name: 'apricot', hex: '#FFF7ED' },
  { name: 'lavender', hex: '#F5F3FF' },
];

const pick = <T,>(arr: T[], seed: number, offset: number) => {
  return arr[(seed + offset) % arr.length];
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash);
};

export function createAvatarPrompt(
  name: string,
  type: string,
  seedHint: string = '',
  appearance?: string,
): AgentAvatar {
  const seed = hashString(`${name}|${type}|${seedHint}`);
  const bg = pick(BG_COLORS, seed, 4);

  const appearanceHint = (appearance || '').trim();
  const description = appearanceHint || `neutral cartoon portrait of ${name}`;

  const prompt = [
    `Polished cartoon avatar portrait of "${name}" (${type}).`,
    appearanceHint
      ? `Appearance cues: ${appearanceHint}.`
      : 'Appearance not provided: create a neutral, understated portrait without guessing specific ethnicity or age.',
    'Keep face shape, hair, complexion, and signature features faithful when cues are provided; avoid randomizing distinctive traits.',
    'Head-and-shoulders only, centered, friendly but realistic expression, clean linework, soft shading.',
    `Background: soft ${bg.name} circle or gradient. Minimal, modern, high-quality.`,
    'Style: polished, slightly whimsical, not childish, no text, no watermark.',
  ].join(' ');

  return { prompt, description };
}
