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
    // Agent actions come FIRST so Claude thinks about what happens before narrating
    agentUpdates: {
      type: 'array',
      description: 'What each agent DOES this turn. Generate this FIRST before writing the narrative.',
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
    // Then the narrative summarizing what happened
    headline: {
      type: 'string',
      description: 'Punchy 5-10 word headline capturing the most dramatic event this turn'
    },
    narration: {
      type: 'string',
      description: 'Dramatic narration of the events described in agentUpdates - power shifts, consequences, emergent dynamics'
    },
    worldHeadline: {
      type: 'string', 
      description: '5-10 word summary of the current world state and power balance'
    },
    context: {
      type: 'string',
      description: 'Updated world context reflecting new power balance, resources, and situation'
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
  required: ['agentUpdates', 'headline', 'narration', 'worldHeadline', 'context'],
};

export const GOAL_SCORE_SCHEMA = {
  type: 'object',
  properties: {
    score: {
      type: 'number',
      description: 'Score from 0-100 indicating progress toward the goal. 0=no progress/worse, 50=neutral, 100=goal achieved'
    },
    reasoning: {
      type: 'string',
      description: 'Brief explanation of why this score was given (1-2 sentences)'
    },
    keyFactors: {
      type: 'array',
      items: { type: 'string' },
      description: 'Top 2-3 factors affecting the score (positive or negative)'
    }
  },
  required: ['score', 'reasoning', 'keyFactors'],
};

export const AUTOPILOT_ACTION_SCHEMA = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      description: 'The action the conscious actor should take this turn to maximize goal progress'
    },
    reasoning: {
      type: 'string',
      description: 'Brief strategic reasoning for this action (1 sentence)'
    }
  },
  required: ['action', 'reasoning'],
};

export const AGENT_SCORES_SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'The agent ID' },
          score: { type: 'number', description: 'Score 0-100 for how well this agent is achieving their goals' },
        },
        required: ['agentId', 'score'],
      },
    },
  },
  required: ['scores'],
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

export interface GoalScoreResult {
  score: number;
  reasoning: string;
  keyFactors: string[];
}

export interface AutopilotActionResult {
  action: string;
  reasoning: string;
}

export interface AgentScoresResult {
  scores: Array<{
    agentId: string;
    score: number;
  }>;
}
