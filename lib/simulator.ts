import { ApiClient } from './api';
import { WorldStateManager } from './world';
import {
  SIMULATOR_SYSTEM_PROMPT,
  getSeedingPrompt,
  getSimulatorTurnPrompt,
  getGoalScoringPrompt,
  getAutopilotActionPrompt,
  getAgentScoresPrompt,
} from './prompts';
import {
  WORLD_SEED_SCHEMA,
  TURN_RESULT_SCHEMA,
  GOAL_SCORE_SCHEMA,
  AUTOPILOT_ACTION_SCHEMA,
  AGENT_SCORES_SCHEMA,
  type WorldSeedResult,
  type TurnResult,
  type GoalScoreResult,
  type AutopilotActionResult,
  type AgentScoresResult,
} from './schemas';


export class Simulator {
  private apiClient: ApiClient;
  private world: WorldStateManager;

  constructor(apiClient: ApiClient, world: WorldStateManager) {
    this.apiClient = apiClient;
    this.world = world;
  }

  /**
   * Initialize a new simulation from starting conditions
   */
  async initializeWorld(
    startingConditions: string,
    playerInfo?: { name: string; description: string }
  ): Promise<void> {
    const startTime = Date.now();
    console.log('🌍 Initializing...');

    const seedData = await this.apiClient.callSimulatorWithTool<WorldSeedResult>(
      'Set up a detailed simulation with rich context.',
      getSeedingPrompt(startingConditions, playerInfo),
      'initialize_world',
      'Initialize simulation',
      WORLD_SEED_SCHEMA
    );

    // Validate seed data
    if (!seedData.agents || !Array.isArray(seedData.agents)) {
      console.error('Invalid seed data:', JSON.stringify(seedData, null, 2).slice(0, 500));
      throw new Error('Seed data missing agents array');
    }
    if (!seedData.context) {
      throw new Error('Seed data missing context');
    }

    this.world.initializeFromSeed(seedData);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Initialized in ${duration}s with ${seedData.agents.length} agents`);
  }

  /**
   * Execute one turn of the simulation
   */
  async executeTurn(
    intervention?: string,
    playerAction?: { agentId: string; action: string }
  ): Promise<void> {
    const startTime = Date.now();
    const state = this.world.getState();
    console.log(`\n🎬 Turn ${state.turn} → ${state.turn + 1}`);

    // Build agents with their action history for context
    const agentsWithHistory = state.agents.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      state: a.state,
      actionHistory: a.actionHistory,
    }));

    const turnResult = await this.apiClient.callSimulatorWithTool<TurnResult>(
      SIMULATOR_SYSTEM_PROMPT,
      getSimulatorTurnPrompt(
        state.context, 
        agentsWithHistory, 
        intervention, 
        playerAction,
        state.history  // Pass recent history for context
      ),
      'process_turn',
      'Process turn with detailed narration',
      TURN_RESULT_SCHEMA
    );

    this.applyTurnResult(turnResult);
    this.world.advanceTurn();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Turn ${this.world.getState().turn} done in ${duration}s\n`);
  }

  /**
   * Score goal progress for conscious actor
   */
  async scoreGoal(
    goal: string,
    consciousActorId: string
  ): Promise<GoalScoreResult> {
    const state = this.world.getState();
    const actor = state.agents.find(a => a.id === consciousActorId);
    
    if (!actor) {
      return { score: 50, reasoning: 'Actor not found', keyFactors: [] };
    }

    const recentHistory = state.history.slice(-5).map(h => h.narration);

    const result = await this.apiClient.callSimulatorWithTool<GoalScoreResult>(
      'You objectively evaluate goal progress in simulations.',
      getGoalScoringPrompt(goal, actor.name, actor.state, state.context, recentHistory),
      'score_goal',
      'Score goal progress',
      GOAL_SCORE_SCHEMA
    );

    return result;
  }

  /**
   * Score all agents on how well they're achieving their goals
   */
  async scoreAllAgents(): Promise<AgentScoresResult> {
    const state = this.world.getState();
    
    const agents = state.agents.map(a => ({
      id: a.id,
      name: a.name,
      state: a.state,
    }));

    console.log(`📊 Scoring ${agents.length} agents...`);

    const result = await this.apiClient.callSimulatorWithTool<AgentScoresResult>(
      'You objectively evaluate how well each agent is achieving their goals.',
      getAgentScoresPrompt(agents, state.context),
      'score_agents',
      'Score all agents',
      AGENT_SCORES_SCHEMA
    );

    // Validate we got scores for all agents
    const returnedIds = new Set(result.scores?.map(s => s.agentId) || []);
    const missingAgents = agents.filter(a => !returnedIds.has(a.id));
    if (missingAgents.length > 0) {
      console.warn(`⚠️ Missing scores for: ${missingAgents.map(a => a.name).join(', ')}`);
    }
    console.log(`📊 Got ${result.scores?.length || 0} scores`);

    return result;
  }

  /**
   * Get autopilot action for conscious actor
   */
  async getAutopilotAction(
    goal: string,
    consciousActorId: string
  ): Promise<AutopilotActionResult> {
    const state = this.world.getState();
    const actor = state.agents.find(a => a.id === consciousActorId);
    
    if (!actor) {
      return { action: 'Observe situation', reasoning: 'Actor not found' };
    }

    const otherAgents = state.agents
      .filter(a => a.id !== consciousActorId)
      .map(a => ({ name: a.name, state: a.state }));

    const recentHistory = state.history.slice(-5).map(h => h.narration);

    const result = await this.apiClient.callSimulatorWithTool<AutopilotActionResult>(
      'You are a strategic actor in a simulation, choosing actions to achieve your goal.',
      getAutopilotActionPrompt(goal, actor.name, actor.state, state.context, otherAgents, recentHistory),
      'choose_action',
      'Choose strategic action',
      AUTOPILOT_ACTION_SCHEMA
    );

    return result;
  }

  /**
   * Apply turn result to world state
   */
  private applyTurnResult(result: TurnResult): void {
    if (!result.narration || !result.context) {
      console.warn('⚠️ Turn result missing narration or context');
    }

    if (result.context) {
      this.world.updateContext(result.context, result.worldHeadline || '');
    }

    if (result.narration) {
      this.world.addTurnEntry(result.headline || 'Turn complete', result.narration);
    }

    if (result.agentUpdates && Array.isArray(result.agentUpdates)) {
      for (const update of result.agentUpdates) {
        if (update.agentId && update.state) {
          this.world.updateAgentState(update.agentId, update.state, update.action);
        }
      }
    }

    if (result.newAgents && Array.isArray(result.newAgents)) {
      for (const agent of result.newAgents) {
        if (agent.name && agent.state) {
          this.world.addAgent({ 
            name: agent.name, 
            type: agent.type || 'Unknown', 
            state: agent.state,
            appearance: agent.appearance,
          });
        }
      }
    }

    if (result.removedAgents && Array.isArray(result.removedAgents)) {
      for (const id of result.removedAgents) {
        this.world.removeAgent(id);
      }
    }
  }

  getWorld(): WorldStateManager {
    return this.world;
  }
}
