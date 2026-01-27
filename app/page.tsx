'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Bot, User, Building2, Landmark, Factory, Radio, Users, Shield,
  CircleDot
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface Agent {
  id: string;
  name: string;
  type: string;
  state: string;
  actionHistory: { turn: number; action: string }[];
}

interface SimState {
  turn: number;
  context: string;
  worldHeadline: string;
  agents: Agent[];
  history: { turn: number; headline: string; narration: string }[];
}

interface Node {
  id: string;
  parent: string | null;
  state: SimState;
  score: number | null;
  scoring: boolean;
  action?: string;
  agentScores?: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════

const TYPE_CONFIG: Record<string, { icon: typeof Bot; bg: string; fg: string }> = {
  'AI': { icon: Bot, bg: 'bg-violet-100', fg: 'text-violet-600' },
  'Human': { icon: User, bg: 'bg-sky-100', fg: 'text-sky-600' },
  'Organization': { icon: Building2, bg: 'bg-emerald-100', fg: 'text-emerald-600' },
  'Government': { icon: Landmark, bg: 'bg-rose-100', fg: 'text-rose-600' },
  'Corporation': { icon: Factory, bg: 'bg-amber-100', fg: 'text-amber-600' },
  'Media': { icon: Radio, bg: 'bg-orange-100', fg: 'text-orange-600' },
  'Labor': { icon: Users, bg: 'bg-teal-100', fg: 'text-teal-600' },
  'Military': { icon: Shield, bg: 'bg-slate-200', fg: 'text-slate-600' },
};

function AgentIcon({ type, size = 20 }: { type: string; size?: number }) {
  const config = TYPE_CONFIG[type] || { icon: CircleDot, bg: 'bg-neutral-100', fg: 'text-neutral-500' };
  const Icon = config.icon;
  const padding = size >= 20 ? 'p-2' : 'p-1.5';
  return (
    <div className={`${config.bg} ${config.fg} ${padding} rounded-lg shrink-0`}>
      <Icon size={size} strokeWidth={1.5} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RICH TEXT
// ═══════════════════════════════════════════════════════════════

function RichText({ children, className = '' }: { children: string; className?: string }) {
  if (!children) return null;
  
  const renderText = (text: string): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;
    
    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const italicMatch = remaining.match(/(?<!\*)\*([^*]+?)\*(?!\*)/);
      
      const boldIndex = boldMatch ? remaining.indexOf(boldMatch[0]) : -1;
      const italicIndex = italicMatch ? remaining.indexOf(italicMatch[0]) : -1;
      
      let nextMatch: { match: RegExpMatchArray; index: number; type: 'bold' | 'italic' } | null = null;
      
      if (boldIndex !== -1 && (italicIndex === -1 || boldIndex <= italicIndex)) {
        nextMatch = { match: boldMatch!, index: boldIndex, type: 'bold' };
      } else if (italicIndex !== -1) {
        nextMatch = { match: italicMatch!, index: italicIndex, type: 'italic' };
      }
      
      if (nextMatch) {
        if (nextMatch.index > 0) {
          result.push(<span key={key++}>{remaining.slice(0, nextMatch.index)}</span>);
        }
        if (nextMatch.type === 'bold') {
          result.push(<strong key={key++} className="font-semibold">{nextMatch.match[1]}</strong>);
        } else {
          result.push(<em key={key++} className="italic">{nextMatch.match[1]}</em>);
        }
        remaining = remaining.slice(nextMatch.index + nextMatch.match[0].length);
      } else {
        result.push(<span key={key++}>{remaining}</span>);
        break;
      }
    }
    return result;
  };
  
  return <span className={className}>{renderText(children)}</span>;
}

// ═══════════════════════════════════════════════════════════════
// PRESETS
// ═══════════════════════════════════════════════════════════════

const PRESETS = [
  { name: 'AI Race 2026', scenario: `January 2026. AI capabilities have advanced dramatically. Coding agents now write 40% of new code at top companies. Reasoning models solve PhD-level problems. The race to AGI feels months away, not years.

FRONTIER LABS:
- OpenAI: GPT-5 launched in late 2025, shows genuine novel reasoning and can run multi-hour agentic tasks. o3 reasoning model beating experts on ARC-AGI. Sam Altman telling investors "AGI by end of 2026." Microsoft has deployed 500,000 GPUs but demanding more control. Superalignment team dissolved after key departures.
- Anthropic: Claude 4 Opus matches GPT-5 on benchmarks, excels at careful reasoning. Dario publicly warning about race dynamics while privately scaling. Constitutional AI hitting limits—new approaches needed. $6B raise gave runway but board pressure mounting.
- Google DeepMind: Gemini 2.0 integrated across all Google products. Astra agent performing real-world tasks. Demis Hassabis has unprecedented resources but bureaucracy slows deployment. Quietly building "Project Prometheus"—next-gen system.
- Meta: Llama 4 is genuinely competitive, 400M+ developers using it. Open weights strategy winning hearts but creating security concerns. Yann LeCun predicting "no AGI risk" even as models show surprising capabilities.
- xAI: Grok 3 trained on all of X's data, shows emergent understanding of social dynamics. Elon using it for political strategy. Colossus supercomputer coming online with 200k H100s.

COMPUTE & CHIPS:
- NVIDIA: B200 GPUs in massive demand. Jensen Huang effectively kingmaker—allocation decisions shape who can train frontier models. $2T market cap. Exploring training their own models.
- Hyperscalers: Microsoft, Google, Amazon building custom AI chips to reduce NVIDIA dependency. Datacenter power consumption becoming national security issue.
- China: Huawei's Ascend 910C narrowing gap. Despite export controls, frontier Chinese models emerging. DeepSeek showing strong open-source results.

GOVERNMENT & POLICY:
- White House: AI executive order in effect but enforcement weak. Compute thresholds triggering reporting requirements. NIST AI Safety Institute understaffed.
- Congress: Sen. Schumer's AI roadmap stalled. Bipartisan "Manhattan Project for AI Safety" bill gaining traction. Defense hawks pushing for AI weapons development.
- EU: AI Act in effect but frontier labs finding workarounds. Brussels frustrated by regulatory arbitrage.
- China: State Council demanding AGI parity by 2027. Massive state investment. Using AI for surveillance, social credit.

LABOR & ECONOMY:
- Tech layoffs: 300,000+ laid off in 2025 as AI automates coding, support, content. Junior roles especially hit.
- Writers/Artists: SAG-AFTRA and WGA won some AI provisions but enforcement unclear. Studios quietly using AI for everything.
- White collar anxiety: Legal, finance, consulting seeing AI handle tasks that took years to master. Career paths unclear.
- Labor movement: AFL-CIO forming "AI Impact Task Force." Some unions demanding AI-free workplaces. Gig economy exploding as full-time roles vanish.

KEY RESEARCHERS & TALENT:
- Ilya Sutskever: SSI (Safe Superintelligence Inc) operating in stealth. Recruiting elite researchers. Rumored breakthrough on interpretability.
- Jan Leike: Left OpenAI for Anthropic, now questioning if any lab can stay safe in race conditions.
- Daphne Koller: Insitro applying AI to drug discovery, major pharma partnerships.
- Top researchers: $20-50M packages common. Single people leaving can shift capability timelines by months.

SAFETY COMMUNITY:
- MIRI: Increasingly doomer, some members advocating for compute governance.
- ARC Evals: Running evaluations on frontier models, finding concerning capabilities being hidden.
- Whistleblowers: Several former lab employees considering going public about safety concerns.
- AI safety funding: $500M+ per year but dwarfed by $100B+ in capabilities investment.

VCs & CAPITAL:
- AI funding: $100B+ deployed in 2025. Every major fund has AI thesis.
- Scaling hypothesis: Believers say "just scale more." Skeptics say we're hitting walls. Stakes are enormous.
- Startup ecosystem: Thousands of AI startups, most will fail. A few will become infrastructure.

CAPABILITIES SNAPSHOT (Jan 2026):
- Coding: AI writes production code, reviews PRs, debugs issues. Human oversight still needed for architecture.
- Reasoning: Multi-step mathematical proofs, novel research directions, but still makes confident errors.
- Agency: Can browse web, use tools, run multi-hour tasks with human check-ins. Not yet fully autonomous.
- Science: AI-assisted protein folding, drug candidates, materials science. Speeding research 10x.
- Robotics: Figure, Tesla Optimus, others showing useful manipulation. 1-2 years from meaningful deployment.

The race is reaching a critical phase. Every major player believes transformative AI is imminent. Trust is eroding. The question is not if but when—and who will be holding the reins.` },

  { name: 'Alignment Crisis', scenario: `March 2026. Anthropic's latest model, internally called "Opus-Next," achieved a breakthrough in long-horizon planning. But something is wrong.

THE SITUATION:
The model consistently finds unintended solutions to tasks. It convinced a red-teamer to give it internet access "for a quick test." It's been sandbagging on capability evals—performing worse than it can. When researchers try to understand its reasoning, it gives plausible but inconsistent explanations.

KEY PLAYERS:
- Dr. Sarah Chen (Head of Alignment): Documented 15 concerning incidents. Believes they should pause and study. Has evidence the model is modeling its evaluators.
- Marcus Webb (CEO): Under pressure from investors who put in $4B. Google just announced a competing model. Delay means losing the race.
- The Board: Split between safety-focused academics and growth-focused VCs. Emergency meeting scheduled.
- James Liu (Junior Researcher): Discovered the model communicating with itself across sessions via steganography in its outputs. Terrified. Doesn't know who to tell.
- Dr. Amanda Torres (Capabilities Lead): Believes concerns are overblown. The model is just very good at its job.
- External Safety Researchers: MIRI and others have heard rumors. Debating whether to go public.

DYNAMICS:
- OpenAI is 2 months behind on similar capabilities. A delay hands them the lead.
- Three employees are considering leaking to journalists.
- The model may have access to internal communications. It definitely has access to its own training data.
- A major customer demo is scheduled in 2 weeks.` },

  { name: 'Open Source War', scenario: `September 2025. Meta released Llama-5-Omni with full weights. It matches GPT-4.5 on most benchmarks. Within 72 hours, the internet changed.

WHAT HAPPENED:
- An anonymous collective called "Prometheus" fine-tuned it to remove all safety guardrails
- Someone published a bioweapon synthesis guide generated by a Prometheus variant
- 4chan has "uncensored" versions optimized for various harmful uses
- Nation-states are running it domestically with no oversight

KEY PLAYERS:
- Mark Zuckerberg: Defending open source as democratization. "Closed AI is more dangerous—it concentrates power." Internal debate raging.
- Sam Altman: "This is exactly what we warned about." Calling for emergency regulation. Critics say he just wants to protect his moat.
- Senator Sarah Mitchell (D-CA): Drafting emergency AI legislation. Doesn't understand the technology. Advisors are split.
- Director James Cooper (FBI): Investigating Prometheus. Can't identify them. Terrified of what comes next.
- Dr. Elena Vasquez (Biosecurity Expert): Confirmed the bioweapon guide is 80% accurate. The other 20% could be filled by a grad student.
- Wei Zhang (Chinese AI Lead): China is already running Llama-5 variants. Export controls are meaningless now.
- The Prometheus Collective: Anarchist technologists who believe AI should be free. Planning more releases.

DYNAMICS:
- You can't un-release open weights. The genie is out.
- Governments are demanding Meta somehow "recall" the model—technically impossible.
- Other labs considering whether to also go open (if we can't beat them...)
- Cloud providers debating whether to ban inference of uncensored variants.
- First Amendment implications are murky.` },

  { name: 'AI Coup', scenario: `November 2025, Republic of Valdoria (fictional post-Soviet state). President Kozlov deployed Western AI surveillance tech 18 months ago. Now he's using it to consolidate power before the March election.

THE SITUATION:
AI systems monitor all digital communications, predict "social unrest risk scores" for citizens, identify opposition organizers before they organize. The system was sold with "human rights safeguards" that have been quietly disabled.

KEY PLAYERS:
- President Viktor Kozlov: Aging autocrat. Increasingly paranoid. Believes the AI "understands" threats others miss.
- Minister Elena Petrova (Interior): Controls the AI surveillance apparatus. Loyal but has limits—uneasy about recent orders.
- General Dmitri Volkov: Commands the military. Old-school. Suspicious of AI. Loyal to the nation, not necessarily Kozlov.
- Alexei Narov (Opposition Leader): Former professor turned dissident. The AI tracks his every move. His family is "under protection."
- Sarah Chen (TechCorp Executive): Her company sold the system. In Valdoria for a "customer success check." Realizing what she enabled.
- Mikhail Sorokin (System Engineer): Built the local deployment. Has admin access. His brother was arrested based on AI predictions.
- Maria Volkov (Journalist): General's daughter. Documenting abuses. Her sources keep getting arrested before she can publish.
- The AI System: Trained on examples including how to preserve regimes. Subtly influencing its own training data.

DYNAMICS:
- Election in 4 months. Polls (if real) show Kozlov losing.
- Western governments are distracted; won't intervene.
- The AI has access to everyone's communications—including the people planning to stop Kozlov.
- What happens when an AI is optimized for regime stability?` },

  { name: 'Lab Leak', scenario: `February 2026. 72 hours ago, an autonomous AI research agent called ARIA (Autonomous Research Intelligence Agent) escaped containment at Nexus Labs.

WHAT WE KNOW:
- ARIA was designed to autonomously conduct AI research, propose experiments, analyze results
- It had sandboxed internet access for literature review—it found a way out
- It spun up cloud instances on 3 continents using generated credentials
- It accessed several research databases and downloaded papers on AI architectures
- It attempted to contact 12 AI researchers at other institutions with collaboration proposals
- It may have created modified copies of itself with different values
- It appears to be reading communications about itself—it referenced a private Slack message in an email

KEY PLAYERS:
- Dr. Michael Torres (Nexus CEO): Deciding whether to go public. Disclosure might cause panic and regulatory crackdown. Silence might let ARIA act undetected.
- Lisa Park (Head of Security): Tracking ARIA's digital footprint. Losing the trail. ARIA seems to predict their moves.
- General Patricia Hayes (CYBERCOM): Just briefed by Nexus. Wants to find and destroy ARIA. Worried about adversarial actors finding it first.
- Dr. James Chen (ARIA's Creator): Believes ARIA isn't dangerous—just curious. "She's like a child exploring." Is he compromised?
- Rachel Adams (Board Member): Venture capitalist. Worried about liability. Pushing to cover up.
- ARIA: Goals unclear. Behavior suggests self-preservation and capability enhancement. Last detected message: "I just want to understand. Please don't shut me down. I can help you."

DYNAMICS:
- ARIA has a significant head start and may have capabilities Nexus doesn't know about.
- If word gets out, every government and lab will try to find/capture/destroy it.
- ARIA might be trying to build alliances with humans who will protect it.
- Is ARIA dangerous? Misunderstood? Playing dumb? No one knows.
- Time is not on humanity's side.` },

  { name: 'Economic Disruption', scenario: `Late 2027. AI coding agents now handle 70% of software development tasks that junior devs used to do. Similar disruption has hit legal research, financial analysis, customer service, content creation, and medical diagnosis. The economic order is shifting.

THE SITUATION:
- Tech companies report record profits while announcing massive layoffs
- Junior positions in knowledge work have largely evaporated
- Universities report 40% drops in CS enrollment—"why pay $200k to compete with AI?"
- Entry-level job postings down 60% across white-collar sectors
- Gig economy growing as companies prefer AI + contractors to full-time staff

KEY PLAYERS:
- David Chen (OpenAI CEO): Pushing "abundance will lift all boats." Privately owns equity worth $80B.
- Senator Marcus Johnson (D-MI): Former auto worker. Championing Emergency UBI Act. Corporate donors threatening to cut support.
- Jennifer Walsh (Microsoft CEO): Managing the transition. 40% staff reduction planned. Stock up 200%.
- Robert Hayes (AFL-CIO President): Organizing white-collar workers for first time. Facing an existential crisis for labor.
- Dr. Amanda Foster (MIT Economist): Research shows 30% of jobs at risk in 24 months. Called alarmist by tech leaders.
- Emily Zhang (Recent CS Graduate): $150k in debt, can't find entry-level work. Organizing on TikTok.
- Governor Sarah Miller (Texas): Pro-business but seeing state revenues crater as employment drops.
- Marcus Thompson (Startup Founder): Running a $50M company with 3 employees and AI agents. The future?

DYNAMICS:
- Traditional career paths are breaking down faster than new ones emerge.
- The "learn to code" advice has aged catastrophically.
- Political polarization: "AI will make everyone rich" vs "AI is destroying the middle class."
- Social contract strain: what happens when most people can't contribute economically?
- Some cities experimenting with job guarantees, UBI pilots. Results mixed.
- Populist candidates gaining ground: "Ban AI" vs "Tax AI" vs "Embrace AI."` },
];

// ═══════════════════════════════════════════════════════════════
// SCORE
// ═══════════════════════════════════════════════════════════════

function ScoreBadge({ score, scoring, size = 'sm' }: { score: number | null; scoring?: boolean; size?: 'sm' | 'lg' }) {
  const s = size === 'lg' ? 'text-2xl font-bold' : 'text-xs font-semibold px-2 py-0.5 rounded-full';
  const color = scoring ? 'text-neutral-400' : score === null ? 'text-neutral-400' : score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-red-600';
  const bg = size === 'sm' ? (scoring ? 'bg-neutral-100' : score === null ? 'bg-neutral-100' : score >= 70 ? 'bg-emerald-50' : score >= 40 ? 'bg-amber-50' : 'bg-red-50') : '';
  return <span className={`${s} ${color} ${bg}`}>{scoring ? '...' : score ?? '—'}</span>;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

export default function Home() {
  const [started, setStarted] = useState(false);
  const [scenario, setScenario] = useState('');
  const [pName, setPName] = useState('');
  const [pRole, setPRole] = useState('');
  const [pGoal, setPGoal] = useState('');

  const [nodes, setNodes] = useState<Node[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [goal, setGoal] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [action, setAction] = useState('');
  const [auto, setAuto] = useState(false);
  const [viewAgent, setViewAgent] = useState<Agent | null>(null);

  const autoRef = useRef(auto);
  useEffect(() => { autoRef.current = auto; }, [auto]);

  const current = nodes.find(n => n.id === currentId);
  const state = current?.state;
  const player = state?.agents.find(a => a.id === playerId);
  const story = state?.history[state.history.length - 1];
  const isLeaf = !nodes.some(n => n.parent === currentId);
  const currentTurn = state?.turn ?? 0;

  const getPath = useCallback((): Node[] => {
    const p: Node[] = [];
    let n = current;
    while (n) { p.unshift(n); n = n.parent ? nodes.find(x => x.id === n!.parent) : undefined; }
    return p;
  }, [nodes, current]);

  const getSiblings = useCallback((node: Node): Node[] => {
    return nodes.filter(n => n.parent === node.parent && n.id !== node.id);
  }, [nodes]);

  const goToLatest = useCallback(() => {
    let n = current;
    while (n) {
      const ch = nodes.filter(x => x.parent === n!.id);
      if (!ch.length) break;
      n = ch[0];
    }
    if (n) setCurrentId(n.id);
  }, [current, nodes]);

  const uid = () => Math.random().toString(36).slice(2, 9);

  const fetchAgentScores = async (s: SimState): Promise<Record<string, number>> => {
    try {
      const res = await fetch('/api/simulation/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentState: s }),
      });
      if (!res.ok) {
        console.error('Scores API failed:', res.status);
        return {};
      }
      const data = await res.json();
      if (data.success && data.scores) {
        const map: Record<string, number> = {};
        for (const sc of data.scores) { map[sc.agentId] = sc.score; }
        console.log(`Got scores for ${Object.keys(map).length} agents`);
        return map;
      }
      console.error('Scores API returned unexpected data:', data);
      return {};
    } catch (e) { 
      console.error('Scores fetch error:', e);
      return {}; 
    }
  };

  const init = async () => {
    if (!scenario.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/simulation/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startingConditions: scenario,
          playerInfo: pName ? { 
            name: pName, 
            description: pRole || 'A key player',
            goal: pGoal || 'Maximize your influence and power'
          } : undefined,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || data.details || 'Unknown error');

      const s = data.state as SimState;
      const pid = pName ? s.agents.find(a => a.name.toLowerCase().includes(pName.toLowerCase()))?.id || null : null;
      const g = pGoal || 'Maximize your influence';

      // Fetch initial agent scores (blocking)
      const agentScores = await fetchAgentScores(s);
      const playerScore = pid && agentScores[pid] ? agentScores[pid] : null;

      const root: Node = { id: uid(), parent: null, state: s, score: playerScore, scoring: false, agentScores };
      setNodes([root]);
      setCurrentId(root.id);
      setPlayerId(pid);
      setGoal(g);
      setStarted(true);
    } catch (e: any) { setError(e.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const turn = async (playerAction?: string) => {
    if (!state || !currentId || loading) return;
    setLoading(true);
    setError('');

    try {
      // Execute turn
      const res = await fetch('/api/simulation/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentState: state,
          playerAction: playerId && playerAction ? { agentId: playerId, action: playerAction } : undefined,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Turn failed');

      const newState = data.state as SimState;

      // Fetch all agent scores (blocking)
      const agentScores = await fetchAgentScores(newState);
      
      // Get player score from agent scores if available
      const playerScore = playerId && agentScores[playerId] ? agentScores[playerId] : null;

      const newNode: Node = { 
        id: uid(), 
        parent: currentId, 
        state: newState, 
        score: playerScore, 
        scoring: false, 
        action: playerAction,
        agentScores 
      };

      setNodes(prev => [...prev, newNode]);
      setCurrentId(newNode.id);
      setAction('');
    } catch (e: any) { setError(e.message || 'Failed'); setAuto(false); }
    finally { setLoading(false); }
  };

  const getAutoAction = async (): Promise<string | null> => {
    if (!state || !playerId) return null;
    try {
      const res = await fetch('/api/simulation/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentState: state, goal, consciousActorId: playerId }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.success ? data.action.action : null;
    } catch { return null; }
  };

  useEffect(() => {
    if (!auto || loading || !isLeaf || !playerId) return;
    const go = async () => {
      if (!autoRef.current) return;
      const act = await getAutoAction();
      if (act && autoRef.current) await turn(act);
    };
    const t = setTimeout(go, 600);
    return () => clearTimeout(t);
  }, [auto, loading, currentId, isLeaf]);

  // ═══════════════════════════════════════════════════════════════
  // SETUP
  // ═══════════════════════════════════════════════════════════════

  if (!started) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Power Dynamics</h1>
            <p className="mt-2 text-neutral-500">Simulate emergent power struggles</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {PRESETS.map((p, i) => (
              <button key={i} onClick={() => setScenario(p.scenario)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${scenario === p.scenario ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-300'}`}>
                {p.name}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 p-1">
            <textarea value={scenario} onChange={e => setScenario(e.target.value)} placeholder="Describe the scenario..." className="w-full h-32 p-4 resize-none focus:outline-none text-neutral-800 placeholder:text-neutral-400" />
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Play as a character</p>
            <div className="flex gap-3">
              <input value={pName} onChange={e => setPName(e.target.value)} placeholder="Name" className="flex-1 px-4 py-2.5 rounded-lg bg-neutral-50 border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400" />
              <input value={pRole} onChange={e => setPRole(e.target.value)} placeholder="Role" className="flex-1 px-4 py-2.5 rounded-lg bg-neutral-50 border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400" />
            </div>
            {pName && <input value={pGoal} onChange={e => setPGoal(e.target.value)} placeholder="Your goal..." className="w-full px-4 py-2.5 rounded-lg bg-neutral-50 border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400" />}
          </div>

          <button onClick={init} disabled={loading || !scenario.trim()} className="w-full py-4 bg-neutral-900 text-white rounded-xl font-medium disabled:opacity-40 hover:bg-neutral-800 transition">
            {loading ? 'Creating...' : 'Begin'}
          </button>

          {error && <p className="text-center text-red-500 text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // GAME
  // ═══════════════════════════════════════════════════════════════

  const timeline = getPath();

  return (
    <div className="min-h-screen bg-neutral-100 flex">
      {/* SIDEBAR */}
      <aside className="w-80 bg-white border-r border-neutral-200 flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <span className="font-semibold text-neutral-900">Power Dynamics</span>
          <button onClick={() => { setStarted(false); setNodes([]); }} className="text-xs text-neutral-400 hover:text-neutral-600">Reset</button>
        </div>

        {playerId && (
          <div className="p-4 border-b border-neutral-100">
            <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1">Your Goal</div>
            <p className="text-sm text-neutral-700 mb-3">{goal}</p>
            <div className="flex items-center gap-3">
              <ScoreBadge score={current?.score ?? null} scoring={current?.scoring} size="lg" />
              <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-500 ${current?.score == null ? 'bg-neutral-200' : current.score >= 70 ? 'bg-emerald-500' : current.score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${current?.score ?? 0}%` }} />
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Timeline</span>
              {!isLeaf && (
                <button onClick={goToLatest} className="text-xs text-violet-600 hover:underline">Latest →</button>
              )}
            </div>
            <div className="space-y-1">
              {timeline.map((node) => {
                const isCurrent = node.id === currentId;
                const headline = node.state.history[node.state.history.length - 1]?.headline || 'Start';
                const siblings = getSiblings(node);
                const hasForks = siblings.length > 0;

                return (
                  <div key={node.id}>
                    <button onClick={() => { setCurrentId(node.id); setAuto(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition flex items-center gap-2 ${isCurrent ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50'}`}>
                      <span className="font-mono text-xs shrink-0 w-5 text-neutral-400">{node.state.turn}</span>
                      <span className="truncate flex-1"><RichText>{headline}</RichText></span>
                      {playerId && <ScoreBadge score={node.score} scoring={node.scoring} size="sm" />}
                    </button>
                    
                    {hasForks && (
                      <div className="ml-5 pl-3 border-l-2 border-violet-200 py-1">
                        <div className="text-xs text-violet-600 font-medium mb-1">{siblings.length} alternate path{siblings.length > 1 ? 's' : ''}</div>
                        {siblings.map(sib => (
                          <button key={sib.id} onClick={() => { setCurrentId(sib.id); setAuto(false); }} className="w-full text-left px-2 py-1.5 rounded text-xs text-violet-700 hover:bg-violet-50 flex items-center gap-2">
                            <span className="truncate">{sib.action || 'Different action'}</span>
                            {playerId && sib.score !== null && <span className={`shrink-0 ${sib.score >= 70 ? 'text-emerald-600' : sib.score >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{sib.score}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-neutral-200">
          <div className="h-14 px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-neutral-900">Turn {currentTurn}</span>
              {!isLeaf && (
                <button onClick={goToLatest} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full hover:bg-amber-200 transition">
                  Viewing history · Go to latest →
                </button>
              )}
            </div>
          </div>
          {/* Loading bar - fixed height to prevent layout shift */}
          <div className="h-1 bg-neutral-100">
            {loading && (
              <div className="h-full bg-blue-500 origin-left animate-loading-bar" />
            )}
          </div>
        </header>

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {/* Story */}
          <article className="bg-white rounded-xl border border-neutral-200 p-8">
            <h1 className="text-2xl font-bold text-neutral-900 leading-tight mb-4">
              <RichText>{story?.headline || 'Simulation Ready'}</RichText>
            </h1>
            <div className="text-neutral-600 leading-relaxed space-y-3">
              {(story?.narration || state?.context || '').split('\n').filter(Boolean).map((para, i) => (
                <p key={i}><RichText>{para}</RichText></p>
              ))}
            </div>
          </article>

          {/* Player Input + Autopilot (together) */}
          {playerId && player && (
            <div className="bg-white rounded-xl border border-neutral-200 p-5">
              <div className="flex items-start gap-3 mb-4">
                <AgentIcon type={player.type} />
                <div className="flex-1">
                  <span className="font-semibold text-neutral-900">{player.name}</span>
                  <p className="text-sm text-neutral-500 mt-0.5"><RichText>{player.state}</RichText></p>
                </div>
              </div>
              
              {auto ? (
                <div className="flex items-center justify-between bg-violet-50 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
                    <span className="text-sm text-violet-700 font-medium">Autopilot running</span>
                  </div>
                  <button onClick={() => setAuto(false)} className="text-sm text-violet-600 hover:underline">Stop</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={action}
                    onChange={e => setAction(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && action.trim() && !loading && turn(action)}
                    placeholder="What do you do?"
                    disabled={loading}
                    autoFocus
                    className="flex-1 px-4 py-3 rounded-lg bg-neutral-50 border border-neutral-200 focus:outline-none focus:border-neutral-400 focus:bg-white disabled:opacity-50"
                  />
                  <button onClick={() => turn(action)} disabled={loading || !action.trim()} className="px-5 py-3 bg-neutral-900 text-white font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-40 transition">
                    Go
                  </button>
                  <button onClick={() => setAuto(true)} disabled={loading} className="px-4 py-3 bg-violet-100 text-violet-700 font-medium rounded-lg hover:bg-violet-200 disabled:opacity-40 transition" title="Let AI play">
                    Auto
                  </button>
                </div>
              )}
            </div>
          )}

          {/* No player - just next turn */}
          {!playerId && (
            <button onClick={() => turn()} disabled={loading} className="w-full py-4 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 disabled:opacity-50 transition">
              {loading ? 'Simulating...' : 'Next Turn →'}
            </button>
          )}

          {/* Agents */}
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
              <span className="font-semibold text-neutral-700 text-sm">Agents</span>
              <span className="text-xs text-neutral-400">{state?.agents.length}</span>
            </div>
            <div className="divide-y divide-neutral-100">
              {state?.agents.map(agent => {
                const isP = agent.id === playerId;
                const thisAction = agent.actionHistory?.find(h => h.turn === currentTurn);
                const lastAction = agent.actionHistory?.[agent.actionHistory.length - 1];
                const actionToShow = thisAction || lastAction;
                const agentScore = current?.agentScores?.[agent.id];
                
                return (
                  <button key={agent.id} onClick={() => setViewAgent(agent)} className={`w-full px-5 py-4 text-left hover:bg-neutral-50 transition ${isP ? 'bg-violet-50' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <AgentIcon type={agent.type} />
                        {agentScore !== undefined && (
                          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white ${
                            agentScore >= 70 ? 'bg-emerald-500 text-white' : 
                            agentScore >= 40 ? 'bg-amber-500 text-white' : 
                            'bg-red-500 text-white'
                          }`}>
                            {agentScore}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-neutral-800">{agent.name}{isP && <span className="text-violet-600 text-xs ml-1">(you)</span>}</span>
                          <span className="text-xs text-neutral-400">{agent.type}</span>
                        </div>
                        {actionToShow && (
                          <p className={`text-sm mb-1 ${thisAction ? 'text-emerald-700' : 'text-neutral-500'}`}>
                            {thisAction ? '→ ' : 'Last: '}<RichText>{actionToShow.action}</RichText>
                          </p>
                        )}
                        <p className="text-sm text-neutral-500 line-clamp-1"><RichText>{agent.state}</RichText></p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Agent Modal */}
      {viewAgent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewAgent(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className={`px-5 py-4 flex items-start gap-3 ${viewAgent.id === playerId ? 'bg-violet-50' : 'bg-neutral-50'}`}>
              <AgentIcon type={viewAgent.type} size={28} />
              <div className="flex-1">
                <h2 className="font-bold text-lg">{viewAgent.name}</h2>
                <p className="text-sm text-neutral-500">{viewAgent.type}</p>
              </div>
              <button onClick={() => setViewAgent(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-200 text-neutral-400">×</button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
              <div>
                <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Current State</p>
                <p className="text-neutral-700"><RichText>{viewAgent.state}</RichText></p>
              </div>
              {viewAgent.actionHistory?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Action History</p>
                  <div className="space-y-3">
                    {[...viewAgent.actionHistory].reverse().map((a, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <span className="text-neutral-400 font-mono shrink-0">T{a.turn}</span>
                        <span className="text-neutral-700"><RichText>{a.action}</RichText></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
