import { ApiClient } from './api';
import { Simulator } from './simulator';
import { WorldStateManager } from './world';
import path from 'path';

/**
 * Singleton instance manager for the simulation
 * Persists world state to disk to survive API route restarts
 */
class SimulationInstanceManager {
  private simulator: Simulator | null = null;
  private world: WorldStateManager | null = null;
  private apiClient: ApiClient | null = null;
  private readonly STATE_FILE = path.join(process.cwd(), 'data', 'current-simulation.json');

  async initialize() {
    console.log('🔧 SimulationInstanceManager.initialize() called');
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }

    this.apiClient = new ApiClient({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    this.world = new WorldStateManager();

    // Try to load existing state from disk
    try {
      await this.world.load('current-simulation');
      const agentCount = this.world.getAgents().length;
      console.log(`✅ Loaded existing world from disk with ${agentCount} agents`);
    } catch (error) {
      console.log('ℹ️  No existing world state found, starting fresh');
    }

    this.simulator = new Simulator(this.apiClient, this.world);
  }

  async getSimulator(): Promise<Simulator> {
    console.log(`📍 getSimulator() called. Current simulator: ${this.simulator ? 'EXISTS' : 'NULL'}`);
    if (!this.simulator) {
      console.log('⚠️  Simulator was null, initializing...');
      await this.initialize();
    }
    return this.simulator!;
  }

  async getWorld(): Promise<WorldStateManager> {
    console.log(`📍 getWorld() called. Current world: ${this.world ? 'EXISTS' : 'NULL'}`);
    if (!this.world) {
      console.log('⚠️  World was null, initializing...');
      await this.initialize();
    }
    const agentCount = this.world!.getAgents().length;
    console.log(`   World has ${agentCount} agents`);
    return this.world!;
  }

  async saveState() {
    if (this.world) {
      await this.world.save('current-simulation');
      console.log('💾 World state saved to disk');
    }
  }

  reset() {
    console.log('🔄 SimulationInstanceManager.reset() called');
    this.simulator = null;
    this.world = null;
    this.apiClient = null;
  }
}

// Export singleton instance
export const simulationInstance = new SimulationInstanceManager();
