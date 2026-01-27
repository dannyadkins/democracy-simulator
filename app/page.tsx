'use client';

import { useState, useEffect, useRef } from 'react';

interface AgentAction {
  turn: number;
  action: string;
}

interface Agent {
  id: string;
  name: string;
  type: string;
  state: string;
  actionHistory: AgentAction[];
}

interface TurnEntry {
  turn: number;
  headline: string;
  narration: string;
}

interface SimulationState {
  turn: number;
  context: string;
  worldHeadline: string;
  agents: Agent[];
  history: TurnEntry[];
}

interface PlayerInfo {
  name: string;
  description: string;
}

const TYPE_STYLES: Record<string, string> = {
  'AI': 'bg-violet-100 text-violet-700 border-violet-200',
  'Human': 'bg-sky-100 text-sky-700 border-sky-200',
  'Organization': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Government': 'bg-rose-100 text-rose-700 border-rose-200',
  'Corporation': 'bg-amber-100 text-amber-700 border-amber-200',
  'Media': 'bg-orange-100 text-orange-700 border-orange-200',
  'Labor': 'bg-teal-100 text-teal-700 border-teal-200',
};

// ─────────────────────────────────────────────────────────────
// PRESET SCENARIOS
// ─────────────────────────────────────────────────────────────
const PRESETS = [
  {
    name: "AI Race 2025",
    short: "Realistic simulation of the current AI landscape",
    scenario: `Simulate the global AI race as of 2025 with realistic actors and dynamics:

MAJOR AI LABS:
- OpenAI: GPT-5 development, $100B+ valuation, Microsoft partnership, safety tensions with board
- Anthropic: Constitutional AI approach, Amazon/Google investment, Claude models, safety-focused culture
- Google DeepMind: Gemini models, vast compute, brain drain concerns, Hassabis leadership
- Meta AI: Open source strategy with Llama, Zuckerberg's AGI push, talent acquisition
- xAI: Musk's lab, Grok models, move fast culture, Tesla data advantage

GOVERNMENTS & REGULATORS:
- US Congress: AI legislation debates, lobbying from all sides, national security concerns
- EU Commission: AI Act enforcement, compute reporting requirements
- China CCP: State AI champions, Baidu/Alibaba, compute sanctions workarounds
- UK AI Safety Institute: International coordination attempts

KEY DYNAMICS:
- Compute is bottlenecked (NVIDIA, TSMC, power constraints)
- Talent wars between labs
- Lobbying: labs want light regulation, civil society wants safety
- Capability jumps create arms race pressure
- Open vs closed source debates
- Labor displacement beginning (content, code, customer service)
- Election misinformation concerns
- Scaling laws still holding but hitting limits

Model realistic feedback loops: capability gains → investment → compute → more capability. Model safety/capabilities tradeoffs. Let emergent dynamics play out.`
  },
  {
    name: "Revolution Playbook",
    short: "Grassroots movement simulation based on proven frameworks",
    scenario: `Simulate a grassroots movement trying to achieve major political change, using proven frameworks from successful revolutions and movements.

MOVEMENT FRAMEWORK (based on Otpor, Civil Rights, Solidarity, etc.):
- Pillars of Support: Identify and target the regime's pillars (military, business, religious leaders, bureaucracy)
- Strategic Nonviolence: Maintain discipline, make repression backfire
- Unity: Build broad coalition across demographics
- Planning: Clear goals, strategy, tactics, timeline
- Nonviolent Discipline: Training, messaging, response protocols

ACTORS:
- Core Organizers: 10-20 dedicated activists, strategic thinkers
- Allied Organizations: NGOs, unions, religious groups, professional associations
- Target Regime: Government officials, key supporters, security forces
- Business Community: Some sympathetic, some regime-aligned
- International Community: Media, foreign governments, diaspora
- General Population: Various segments with different levels of engagement
- Social Media Platforms: Amplification, surveillance, censorship dynamics

RESOURCES TO TRACK:
- Public support (% actively supporting, passive support, opposition)
- Funding and material resources
- Media attention (domestic and international)
- Organizational capacity
- Key relationships and defections from regime

DYNAMICS:
- Actions build momentum or cause backlash
- Regime can co-opt, repress, or reform
- Timing matters (elections, holidays, crises)
- Small wins build confidence
- Repression can backfire if movement maintains discipline
- Internal conflicts over strategy and leadership

Goal: Model a campaign from inception through various phases (organization, confrontation, mass defection, transition). Show how strategic choices affect outcomes.`
  },
  {
    name: "Quick: AI Startup",
    short: "AI assistant gaining influence at a tech startup",
    scenario: "An AI assistant at a startup slowly gaining admin access and influence over company decisions while appearing helpful"
  },
  {
    name: "Quick: AGI Race",
    short: "Three labs racing to AGI",
    scenario: "Three AI labs racing to AGI, each willing to cut corners on safety to be first. Board members, researchers, and safety teams have conflicting incentives."
  },
  {
    name: "Quick: Infrastructure",
    short: "AI-controlled city infrastructure",
    scenario: "A city where AI systems control traffic, power, water, and emergency services. Humans are slowly losing the ability to override or understand the systems."
  }
];

export default function Home() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startingConditions, setStartingConditions] = useState('');
  const [simulationState, setSimulationState] = useState<SimulationState | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const autoPlayRef = useRef(autoPlay);
  
  // Player mode
  const [playerMode, setPlayerMode] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [playerDescription, setPlayerDescription] = useState('');
  const [playerAgentId, setPlayerAgentId] = useState<string | null>(null);
  const [playerAction, setPlayerAction] = useState('');
  const [awaitingPlayerAction, setAwaitingPlayerAction] = useState(false);

  useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);

  useEffect(() => {
    if (autoPlay && !isLoading && simulationState && !awaitingPlayerAction) {
      const timer = setTimeout(() => {
        if (autoPlayRef.current) executeNextTurn();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [autoPlay, isLoading, simulationState?.turn, awaitingPlayerAction]);

  // Find player agent after initialization
  useEffect(() => {
    if (simulationState && playerMode && playerName && !playerAgentId) {
      const playerAgent = simulationState.agents.find(a => 
        a.name.toLowerCase().includes(playerName.toLowerCase())
      );
      if (playerAgent) {
        setPlayerAgentId(playerAgent.id);
      }
    }
  }, [simulationState, playerMode, playerName, playerAgentId]);

  const initializeSimulation = async () => {
    if (!startingConditions.trim()) return;
    setIsLoading(true);
    setError(null);
    
    const playerInfo: PlayerInfo | undefined = playerMode && playerName.trim() 
      ? { name: playerName.trim(), description: playerDescription.trim() || 'A human player' }
      : undefined;

    try {
      const res = await fetch('/api/simulation/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startingConditions, playerInfo }),
      });
      const data = await res.json();
      if (data.success) {
        setSimulationState(data.state);
        setIsInitialized(true);
        if (playerMode) setAwaitingPlayerAction(true);
      } else setError(data.error || 'Failed to initialize');
    } catch { setError('Connection error'); }
    finally { setIsLoading(false); }
  };

  const executeNextTurn = async (intervention?: string) => {
    if (!simulationState) return;
    
    // If player mode and we need an action, prompt for it
    if (playerMode && playerAgentId && !playerAction.trim() && !intervention) {
      setAwaitingPlayerAction(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    setAwaitingPlayerAction(false);
    
    const playerActionPayload = playerMode && playerAgentId && playerAction.trim()
      ? { agentId: playerAgentId, action: playerAction.trim() }
      : undefined;

    try {
      const res = await fetch('/api/simulation/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentState: simulationState, 
          intervention,
          playerAction: playerActionPayload
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSimulationState(data.state);
        setPlayerAction('');
        if (playerMode) setAwaitingPlayerAction(true);
      }
      else { setError(data.error || 'Turn failed'); setAutoPlay(false); }
    } catch { setError('Connection error'); setAutoPlay(false); }
    finally { setIsLoading(false); }
  };

  const playerAgent = simulationState?.agents.find(a => a.id === playerAgentId);

  // ─────────────────────────────────────────────────────────────
  // START SCREEN
  // ─────────────────────────────────────────────────────────────
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-stone-50">
        <div className="max-w-3xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium mb-4">
              <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
              Simulation Engine
            </div>
            <h1 className="text-4xl font-semibold text-stone-900 tracking-tight mb-3">
              AI Power Dynamics
            </h1>
            <p className="text-lg text-stone-500">
              Watch autonomous agents compete, collaborate, and accumulate influence
            </p>
          </div>

          {/* Presets */}
          <div className="mb-8">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3 px-1">Scenarios</p>
            <div className="grid gap-2">
              {PRESETS.map((preset, i) => (
                <button
                  key={i}
                  onClick={() => setStartingConditions(preset.scenario)}
                  disabled={isLoading}
                  className={`text-left px-4 py-3 rounded-xl border transition-all ${
                    startingConditions === preset.scenario
                      ? 'bg-violet-50 border-violet-200 text-violet-900'
                      : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
                  }`}
                >
                  <span className="font-medium">{preset.name}</span>
                  <span className="text-stone-400 ml-2">— {preset.short}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input card */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden mb-6">
            <div className="p-6">
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Scenario Description
              </label>
              <textarea
                value={startingConditions}
                onChange={(e) => setStartingConditions(e.target.value)}
                placeholder="Describe the world, agents, and dynamics you want to simulate..."
                className="w-full h-40 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none transition-all text-sm"
                disabled={isLoading}
              />
            </div>

            {/* Player Mode */}
            <div className="px-6 py-4 border-t border-stone-100 bg-stone-50/50">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={playerMode}
                  onChange={(e) => setPlayerMode(e.target.checked)}
                  className="w-4 h-4 rounded border-stone-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="text-sm font-medium text-stone-700">Play as an agent</span>
              </label>
              
              {playerMode && (
                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Your agent name</label>
                    <input
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="e.g., Sarah Chen"
                      className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Your role/description</label>
                    <input
                      type="text"
                      value={playerDescription}
                      onChange={(e) => setPlayerDescription(e.target.value)}
                      placeholder="e.g., AI safety researcher at Anthropic"
                      className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-stone-50 border-t border-stone-100">
              <button
                onClick={initializeSimulation}
                disabled={isLoading || !startingConditions.trim() || (playerMode && !playerName.trim())}
                className="w-full py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Spinner /> Creating simulation...
                  </>
                ) : (
                  'Create Simulation'
                )}
              </button>
            </div>
          </div>

          {error && <ErrorBanner message={error} />}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // SIMULATION VIEW
  // ─────────────────────────────────────────────────────────────
  const latest = simulationState?.history[simulationState.history.length - 1];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-500 animate-pulse' : awaitingPlayerAction ? 'bg-violet-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="text-sm font-medium text-stone-500">Turn</span>
              <span className="text-xl font-semibold text-stone-900">{simulationState?.turn}</span>
            </div>
            <div className="h-4 w-px bg-stone-200" />
            <span className="text-sm text-stone-400">{simulationState?.agents.length} agents</span>
            {playerAgent && (
              <>
                <div className="h-4 w-px bg-stone-200" />
                <span className="text-sm text-violet-600 font-medium">Playing as {playerAgent.name}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!playerMode && (
              <button
                onClick={() => setAutoPlay(!autoPlay)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  autoPlay
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-300'
                }`}
              >
                {autoPlay ? '⏸ Running' : '▶ Auto'}
              </button>
            )}
            {(!playerMode || !awaitingPlayerAction) && (
              <button
                onClick={() => executeNextTurn()}
                disabled={isLoading || autoPlay || (playerMode && awaitingPlayerAction)}
                className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 disabled:opacity-40 transition-all flex items-center gap-2"
              >
                {isLoading && <Spinner />}
                Next Turn
              </button>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {/* Player Action Prompt */}
      {playerMode && awaitingPlayerAction && playerAgent && (
        <div className="bg-violet-50 border-b border-violet-100">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="font-medium text-violet-900 mb-1">Your turn: {playerAgent.name}</h3>
                <p className="text-sm text-violet-700 mb-3">{playerAgent.state}</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={playerAction}
                    onChange={(e) => setPlayerAction(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && playerAction.trim() && executeNextTurn()}
                    placeholder="What do you do this turn?"
                    className="flex-1 px-4 py-2 bg-white border border-violet-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    autoFocus
                  />
                  <button
                    onClick={() => executeNextTurn()}
                    disabled={isLoading || !playerAction.trim()}
                    className="px-6 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-40 transition-all"
                  >
                    {isLoading ? <Spinner /> : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Latest Event - Hero */}
        {latest && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-violet-600 bg-violet-100 px-2 py-0.5 rounded">
                TURN {latest.turn}
              </span>
            </div>
            <h2 className="text-3xl font-semibold text-stone-900 tracking-tight mb-3">
              {latest.headline}
            </h2>
            <p className="text-lg text-stone-600 leading-relaxed">
              {latest.narration}
            </p>
          </section>
        )}

        {/* Two column layout */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: World + Agents */}
          <div className="lg:col-span-2 space-y-6">
            {/* World State */}
            <section className="bg-white rounded-2xl border border-stone-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">World State</h3>
              </div>
              {simulationState?.worldHeadline && (
                <p className="font-medium text-stone-900 mb-1">{simulationState.worldHeadline}</p>
              )}
              <p className="text-stone-600 text-sm leading-relaxed">{simulationState?.context}</p>
            </section>

            {/* Agents */}
            <section>
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3 px-1">
                Agents
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {simulationState?.agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isPlayer={agent.id === playerAgentId}
                    onClick={() => setSelectedAgent(agent)}
                  />
                ))}
              </div>
            </section>
          </div>

          {/* Right: History + Intervene */}
          <div className="space-y-6">
            {/* Intervene */}
            <InterventionCard
              onSubmit={(e) => { setAutoPlay(false); executeNextTurn(e); }}
              disabled={isLoading}
            />

            {/* History */}
            {simulationState && simulationState.history.length > 0 && (
              <section className="bg-white rounded-2xl border border-stone-200 p-5">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3"
                >
                  History ({simulationState.history.length})
                  <span className="text-stone-300">{showHistory ? '▲' : '▼'}</span>
                </button>
                {showHistory && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {[...simulationState.history].reverse().map((entry, i) => (
                      <div key={i} className="flex gap-3 text-sm py-2 border-b border-stone-100 last:border-0">
                        <span className="text-stone-400 font-mono text-xs w-6">T{entry.turn}</span>
                        <span className="text-stone-700">{entry.headline}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </main>

      {/* Agent Modal */}
      {selectedAgent && (
        <AgentModal 
          agent={selectedAgent} 
          isPlayer={selectedAgent.id === playerAgentId}
          onClose={() => setSelectedAgent(null)} 
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────

function Spinner() {
  return <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60" />;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
      {message}
    </div>
  );
}

function AgentCard({ agent, isPlayer, onClick }: { agent: Agent; isPlayer?: boolean; onClick: () => void }) {
  const latestAction = agent.actionHistory?.[agent.actionHistory.length - 1];
  const typeStyle = TYPE_STYLES[agent.type] || 'bg-stone-100 text-stone-600 border-stone-200';

  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border p-4 hover:shadow-sm transition-all group ${
        isPlayer 
          ? 'bg-violet-50 border-violet-200 hover:border-violet-300' 
          : 'bg-white border-stone-200 hover:border-stone-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={`font-medium group-hover:text-violet-700 transition-colors ${isPlayer ? 'text-violet-900' : 'text-stone-900'}`}>
            {agent.name}
          </span>
          {isPlayer && <span className="text-xs text-violet-600 font-medium">(You)</span>}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${typeStyle}`}>
          {agent.type}
        </span>
      </div>
      {latestAction && (
        <p className="text-sm text-emerald-600 mb-2 font-medium">
          → {latestAction.action}
        </p>
      )}
      <p className={`text-sm line-clamp-2 ${isPlayer ? 'text-violet-700' : 'text-stone-500'}`}>{agent.state}</p>
    </button>
  );
}

function AgentModal({ agent, isPlayer, onClose }: { agent: Agent; isPlayer?: boolean; onClose: () => void }) {
  const typeStyle = TYPE_STYLES[agent.type] || 'bg-stone-100 text-stone-600 border-stone-200';

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className={`p-6 border-b ${isPlayer ? 'bg-violet-50 border-violet-100' : 'border-stone-100'}`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-stone-900">{agent.name}</h2>
                {isPlayer && <span className="text-xs bg-violet-200 text-violet-700 px-2 py-0.5 rounded-full font-medium">You</span>}
              </div>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full border mt-1 ${typeStyle}`}>
                {agent.type}
              </span>
            </div>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-2xl leading-none">×</button>
          </div>
        </div>
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
          <div>
            <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Current State</h4>
            <p className="text-stone-700 text-sm leading-relaxed">{agent.state}</p>
          </div>
          {agent.actionHistory && agent.actionHistory.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Action History</h4>
              <div className="space-y-2">
                {[...agent.actionHistory].reverse().map((a, i) => (
                  <div key={i} className="flex gap-3 py-2 border-b border-stone-100 last:border-0">
                    <span className="text-stone-400 font-mono text-xs w-6">T{a.turn}</span>
                    <span className="text-emerald-600 text-sm">{a.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InterventionCard({ onSubmit, disabled }: { onSubmit: (e: string) => void; disabled: boolean }) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value);
      setValue('');
      setOpen(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-2xl border border-violet-100 p-5">
      <h3 className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-2">Inject Event</h3>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="w-full py-2 text-sm text-violet-600 hover:text-violet-800 font-medium transition-colors disabled:opacity-40"
        >
          + Add external event
        </button>
      ) : (
        <div className="space-y-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="A major investor pulls funding..."
            className="w-full h-20 px-3 py-2 bg-white border border-violet-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
            disabled={disabled}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={disabled || !value.trim()}
              className="flex-1 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-40 transition-all"
            >
              Inject
            </button>
            <button
              onClick={() => { setOpen(false); setValue(''); }}
              className="px-4 py-2 text-stone-500 hover:text-stone-700 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
