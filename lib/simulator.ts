import { ApiClient } from './api';
import { WorldStateManager } from './world';
import {
  SIMULATOR_SYSTEM_PROMPT,
  getSeedingPrompt,
  getSimulatorTurnPrompt,
} from './prompts';
import {
  WORLD_SEED_SCHEMA,
  TURN_RESULT_SCHEMA,
  type WorldSeedResult,
  type TurnResult,
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
      'Set up a simulation.',
      getSeedingPrompt(startingConditions, playerInfo),
      'initialize_world',
      'Initialize simulation',
      WORLD_SEED_SCHEMA
    );

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

    const turnResult = await this.apiClient.callSimulatorWithTool<TurnResult>(
      SIMULATOR_SYSTEM_PROMPT,
      getSimulatorTurnPrompt(state.context, state.agents, intervention, playerAction),
      'process_turn',
      'Process turn',
      TURN_RESULT_SCHEMA
    );

    this.applyTurnResult(turnResult);
    this.world.advanceTurn();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Turn ${this.world.getState().turn} done in ${duration}s\n`);
  }


  /**
   * Apply turn result to world state
   */
  private applyTurnResult(result: TurnResult): void {
    // Validate result has required fields
    if (!result.narration || !result.context) {
      console.warn('⚠️ Turn result missing narration or context');
    }

    // Update world context with headline
    if (result.context) {
      this.world.updateContext(result.context, result.worldHeadline);
    }

    // Add turn entry with headline and narration
    if (result.narration) {
      this.world.addTurnEntry(result.headline || 'Turn complete', result.narration);
    }

    // Update agents with actions
    if (result.agentUpdates && Array.isArray(result.agentUpdates)) {
      for (const update of result.agentUpdates) {
        if (update.agentId && update.state) {
          this.world.updateAgentState(update.agentId, update.state, update.action);
        }
      }
    }

    // Add new agents
    if (result.newAgents && Array.isArray(result.newAgents)) {
      for (const agent of result.newAgents) {
        if (agent.name && agent.state) {
          this.world.addAgent({ 
            name: agent.name, 
            type: agent.type || 'Unknown', 
            state: agent.state 
          });
        }
      }
    }

    // Remove agents
    if (result.removedAgents && Array.isArray(result.removedAgents)) {
      for (const id of result.removedAgents) {
        this.world.removeAgent(id);
      }
    }
  }

  /**
   * Get current world state manager
   */
  getWorld(): WorldStateManager {
    return this.world;
  }
}
