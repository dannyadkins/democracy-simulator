export interface AgentAvatar {
  prompt: string;
  description: string;
  imageUrl?: string;
  loading?: boolean;
  error?: string;
}

export interface Agent {
  id: string;
  name: string;
  type: string;
  state: string;
  appearance?: string;
  actionHistory: { turn: number; action: string }[];
  avatar?: AgentAvatar;
}

export interface SimState {
  turn: number;
  context: string;
  worldHeadline: string;
  agents: Agent[];
  history: { turn: number; headline: string; narration: string }[];
}
