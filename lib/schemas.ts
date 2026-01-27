/**
 * JSON schemas for Claude tool calling
 */

export const WORLD_SEED_SCHEMA = {
  type: 'object',
  properties: {
    context: {
      type: 'string',
      description: 'Natural language description of the initial world state, power structures, resources, constraints, and dynamics'
    },
    agents: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Agent name' },
          type: { type: 'string', description: 'Category: AI, Human, Organization, Government, Corporation, Media, etc.' },
          state: { type: 'string', description: 'Natural language description - goals, resources, capabilities, strategy, relationships, power level' },
        },
        required: ['name', 'type', 'state'],
      },
    },
  },
  required: ['context', 'agents'],
};

export const TURN_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    headline: {
      type: 'string',
      description: 'Punchy 5-10 word headline capturing the most dramatic event this turn'
    },
    narration: {
      type: 'string',
      description: 'Dramatic narration of key events, power shifts, and emergent dynamics this turn'
    },
    worldHeadline: {
      type: 'string', 
      description: '5-10 word summary of the current world state and power balance'
    },
    context: {
      type: 'string',
      description: 'Updated world context reflecting new power balance, resources, and situation'
    },
    agentUpdates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          action: { type: 'string', description: 'What this agent DID this turn - specific action taken' },
          state: { type: 'string', description: 'Updated state after action - resources, capabilities, relationships' },
        },
        required: ['agentId', 'action', 'state'],
      },
    },
    newAgents: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', description: 'Category: AI, Human, Organization, Government, Corporation, Media, etc.' },
          state: { type: 'string' },
        },
        required: ['name', 'type', 'state'],
      },
    },
    removedAgents: {
      type: 'array',
      items: { type: 'string' },
      description: 'IDs of agents that have been eliminated, absorbed, or otherwise removed'
    },
  },
  required: ['headline', 'narration', 'worldHeadline', 'context', 'agentUpdates'],
};

export interface WorldSeedResult {
  context: string;
  agents: Array<{
    name: string;
    type: string;
    state: string;
  }>;
}

export interface TurnResult {
  headline: string;
  narration: string;
  worldHeadline: string;
  context: string;
  agentUpdates: Array<{
    agentId: string;
    action: string;
    state: string;
  }>;
  newAgents?: Array<{
    name: string;
    type: string;
    state: string;
  }>;
  removedAgents?: string[];
}
