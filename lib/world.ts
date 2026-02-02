import fs from 'fs/promises';
import path from 'path';
import { createAvatarPrompt, type AgentAvatar } from './avatars';

export interface AgentAction {
  turn: number;
  action: string;
}

export interface Agent {
  id: string;
  name: string;
  type: string; // Category: AI, Human, Organization, Government, etc.
  state: string; // Everything about this agent in natural language
  appearance?: string; // Explicit visual description
  actionHistory: AgentAction[]; // History of actions taken
  avatar?: AgentAvatar;
}

export interface TurnEntry {
  turn: number;
  headline: string;
  narration: string;
}

export interface WorldState {
  turn: number;
  context: string; // Everything about the world in natural language
  worldHeadline: string; // Current headline for world state
  agents: Agent[];
  history: TurnEntry[]; // Rich history with headlines
}

export class WorldStateManager {
  private state: WorldState;
  private savesDir: string;

  constructor(savesDir: string = './data/saves') {
    this.savesDir = savesDir;
    this.state = this.getEmptyState();
  }

  private getEmptyState(): WorldState {
    return {
      turn: 0,
      context: '',
      worldHeadline: '',
      agents: [],
      history: [],
    };
  }

  /**
   * Initialize world state from seeding response
   */
  initializeFromSeed(seedData: {
    context: string;
    agents: Array<{ name: string; type: string; state: string; appearance?: string }>;
  }): void {
    this.state = {
      turn: 0,
      context: seedData.context,
      worldHeadline: 'Simulation begins...',
      agents: seedData.agents.map((agent, index) => {
        const id = `agent-${Date.now()}-${index}`;
        return {
          id,
          name: agent.name,
          type: agent.type,
          state: agent.state,
          appearance: agent.appearance,
          actionHistory: [],
          avatar: createAvatarPrompt(agent.name, agent.type, id, agent.appearance),
        };
      }),
      history: [],
    };
  }

  /**
   * Restore world state from client (proper React pattern)
   */
  restoreState(state: WorldState): void {
    this.state = { ...state };
  }

  /**
   * Get current world state
   */
  getState(): WorldState {
    return { ...this.state };
  }

  /**
   * Get all agents
   */
  getAgents(): Agent[] {
    return [...this.state.agents];
  }

  /**
   * Get specific agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.state.agents.find((a) => a.id === agentId);
  }

  /**
   * Add a new agent
   */
  addAgent(agent: { name: string; type: string; state: string; appearance?: string }): Agent {
    const id = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newAgent: Agent = {
      id,
      name: agent.name,
      type: agent.type,
      state: agent.state,
      appearance: agent.appearance,
      actionHistory: [],
      avatar: createAvatarPrompt(agent.name, agent.type, id, agent.appearance),
    };
    this.state.agents.push(newAgent);
    return newAgent;
  }

  /**
   * Remove an agent
   */
  removeAgent(agentId: string): void {
    this.state.agents = this.state.agents.filter((a) => a.id !== agentId);
  }

  /**
   * Update agent state and record action
   */
  updateAgentState(agentId: string, newState: string, action?: string): void {
    const agent = this.state.agents.find((a) => a.id === agentId);
    if (agent) {
      agent.state = newState;
      if (action) {
        agent.actionHistory.push({
          turn: this.state.turn + 1, // +1 because we haven't advanced yet
          action,
        });
      }
    }
  }

  /**
   * Update world context and headline
   */
  updateContext(newContext: string, worldHeadline?: string): void {
    this.state.context = newContext;
    if (worldHeadline) {
      this.state.worldHeadline = worldHeadline;
    }
  }

  /**
   * Add turn entry to history
   */
  addTurnEntry(headline: string, narration: string): void {
    this.state.history.push({
      turn: this.state.turn + 1, // +1 because we haven't advanced yet
      headline,
      narration,
    });
  }

  /**
   * Advance to next turn
   */
  advanceTurn(): void {
    this.state.turn += 1;
  }

  /**
   * Save current state to file
   */
  async save(filename: string): Promise<void> {
    const filepath = path.join(this.savesDir, `${filename}.json`);
    await fs.mkdir(this.savesDir, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  /**
   * Load state from file
   */
  async load(filename: string): Promise<void> {
    const filepath = path.join(this.savesDir, `${filename}.json`);
    const data = await fs.readFile(filepath, 'utf-8');
    this.state = JSON.parse(data);
  }

  /**
   * List available save files
   */
  async listSaves(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.savesDir);
      return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
    } catch {
      return [];
    }
  }

  /**
   * Get formatted world summary
   */
  getWorldSummary(): string {
    return `Turn ${this.state.turn}

${this.state.context}

Agents: ${this.state.agents.length}`;
  }
}
