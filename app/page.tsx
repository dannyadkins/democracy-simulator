'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Bot, User, Building2, Landmark, Factory, Radio, Users, Shield,
  CircleDot, ChevronRight, Zap, X
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

interface StreamingAgentAction {
  agentId: string;
  action: string;
}

interface Node {
  id: string;
  parent: string | null;
  state: SimState;
  score: number | null;
  scoring: boolean;
  action?: string;
  agentScores?: Record<string, number>;
  imageUrl?: string;
  imageLoading?: boolean;
  imageError?: string;
  isNew?: boolean; // For typewriter animation
  streamingHeadline?: string; // Real-time streaming content
  streamingNarration?: string;
  streamingPhase?: 'actions' | 'narrating'; // Current generation phase
  streamingAgentActions?: StreamingAgentAction[]; // Actions as they stream
  isStreaming?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════

const TYPE_ICONS: Record<string, typeof Bot> = {
  'AI': Bot,
  'Human': User,
  'Organization': Building2,
  'Government': Landmark,
  'Corporation': Factory,
  'Media': Radio,
  'Labor': Users,
  'Military': Shield,
};

function AgentIcon({ type, size = 18 }: { type: string; size?: number }) {
  const Icon = TYPE_ICONS[type] || CircleDot;
  return (
    <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
      <Icon size={size} className="text-stone-500" strokeWidth={1.5} />
    </div>
  );
}

function RichText({ children, className = '', inheritColor = false }: { children: string; className?: string; inheritColor?: boolean }) {
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
          // Use inherit color in contexts where parent controls text color (like timeline)
          result.push(<strong key={key++} className={inheritColor ? "font-semibold" : "font-medium text-stone-900"}>{nextMatch.match[1]}</strong>);
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

function Score({ value, size = 'sm' }: { value: number | null | undefined; size?: 'sm' | 'lg' }) {
  if (value === null || value === undefined) return null;
  const color = value >= 70 ? 'text-emerald-600' : value >= 40 ? 'text-stone-600' : 'text-rose-600';
  return (
    <span className={`font-mono ${color} ${size === 'lg' ? 'text-3xl font-light' : 'text-xs'}`}>
      {value}
    </span>
  );
}

// Turn simulation modal - shows agent actions as they stream
function TurnModal({ 
  agents, 
  streamingActions, 
  phase,
  playerAction,
  playerName
}: { 
  agents: Agent[];
  streamingActions: StreamingAgentAction[];
  phase: 'actions' | 'narrating';
  playerAction?: string;
  playerName?: string;
}) {
  const completedCount = streamingActions.length;
  const totalAgents = agents.length;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium text-stone-900">
                {phase === 'actions' ? 'Simulating Turn' : 'Generating Narrative'}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {phase === 'actions' 
                  ? `${completedCount} of ${totalAgents} agents acted`
                  : 'All agents have acted, writing story...'
                }
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1 bg-stone-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-stone-900 transition-all duration-500 ease-out"
              style={{ width: phase === 'actions' ? `${(completedCount / totalAgents) * 100}%` : '100%' }}
            />
          </div>
        </div>
        
        {/* Player action */}
        {playerAction && playerName && (
          <div className="px-6 py-3 bg-stone-50 border-b border-stone-100">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User size={12} className="text-stone-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-stone-700">{playerName}</div>
                <p className="text-sm text-stone-600 mt-0.5">{playerAction}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Streaming actions */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {streamingActions.length === 0 ? (
            // No actions yet - show skeleton loaders
            <div className="space-y-3">
              {[0,1,2].map(i => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="w-6 h-6 rounded-full bg-stone-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-20 bg-stone-100 rounded" />
                    <div className="h-4 w-full bg-stone-50 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {streamingActions.map((sa, i) => {
                const agent = agents.find(a => a.id === sa.agentId);
                const Icon = TYPE_ICONS[agent?.type || ''] || CircleDot;
                return (
                  <div 
                    key={i} 
                    className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon size={12} className="text-stone-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-stone-700">{agent?.name || 'Agent'}</div>
                      <p className="text-sm text-stone-600 mt-0.5">{sa.action}</p>
                    </div>
                  </div>
                );
              })}
              
              {/* Waiting indicator for more agents */}
              {completedCount < totalAgents && (
                <div className="flex items-center gap-3 text-stone-400">
                  <div className="w-6 h-6 rounded-full bg-stone-50 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-stone-300 animate-pulse" />
                  </div>
                  <span className="text-sm">{totalAgents - completedCount} more agents thinking...</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Story text with real streaming support
function StoryText({ 
  headline, 
  narration, 
  isNew,
  isStreaming,
  onViewed 
}: { 
  headline: string; 
  narration: string; 
  isNew: boolean;
  isStreaming: boolean;
  onViewed: () => void;
}) {
  const viewedRef = useRef(false);
  
  // Mark as viewed once we have content
  useEffect(() => {
    if (!isStreaming && !isNew && !viewedRef.current && headline) {
      viewedRef.current = true;
      onViewed();
    }
  }, [isStreaming, isNew, headline, onViewed]);
  
  // Streaming mode - show skeleton or content
  if (isStreaming) {
    const hasContent = headline || narration;
    
    // No content yet - show skeleton (modal handles the waiting state)
    if (!hasContent) {
      return (
        <article className="space-y-4 min-h-[120px]">
          <div className="h-6 w-3/4 bg-stone-100 rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-stone-50 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-stone-50 rounded animate-pulse" />
          </div>
        </article>
      );
    }
    
    // Content is streaming in
    return (
      <article className="space-y-4 min-h-[120px]">
        <h1 className="text-xl font-medium text-stone-900 leading-snug">
          <RichText>{headline}</RichText>
          {headline && !narration && <span className="animate-pulse text-stone-300 ml-1">▍</span>}
        </h1>
        {narration && (
          <div className="text-stone-600 leading-relaxed text-[15px] space-y-3">
            {narration.split('\n').filter(Boolean).map((para, i, arr) => (
              <p key={i}>
                <RichText>{para}</RichText>
                {i === arr.length - 1 && <span className="animate-pulse text-stone-300 ml-0.5">▍</span>}
              </p>
            ))}
          </div>
        )}
      </article>
    );
  }
  
  // Normal mode - static text with markdown
  return (
    <article className="space-y-4">
      <h1 className="text-xl font-medium text-stone-900 leading-snug">
        <RichText>{headline || 'Simulation Ready'}</RichText>
      </h1>
      <div className="text-stone-600 leading-relaxed space-y-3 text-[15px]">
        {(narration || '').split('\n').filter(Boolean).map((para, i) => (
          <p key={i}><RichText>{para}</RichText></p>
        ))}
      </div>
    </article>
  );
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
// MAIN
// ═══════════════════════════════════════════════════════════════

export default function Home() {
  const [started, setStarted] = useState(false);
  const [scenario, setScenario] = useState('');
  const [scenarioName, setScenarioName] = useState('');
  const [pName, setPName] = useState('');
  const [pRole, setPRole] = useState('');
  const [pGoal, setPGoal] = useState('');

  const [nodes, setNodes] = useState<Node[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [goal, setGoal] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const [error, setError] = useState('');
  const [action, setAction] = useState('');
  const [auto, setAuto] = useState(false);
  const [viewAgent, setViewAgent] = useState<Agent | null>(null);
  
  // Suggested actions for player
  interface SuggestedAction {
    title: string;
    description: string;
    strategy: 'aggressive' | 'defensive' | 'diplomatic';
  }
  const [suggestedActions, setSuggestedActions] = useState<SuggestedAction[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  // Game analysis
  interface GameAnalysis {
    headline: string;
    summary: string;
    playerPerformance: { grade: string; verdict: string };
    turningPoints: { turn: number; event: string; impact: string }[];
    whatWentRight: string[];
    whatWentWrong: string[];
    alternativePath: string;
    finalStandings: { name: string; outcome: string }[];
  }
  const [gameAnalysis, setGameAnalysis] = useState<GameAnalysis | null>(null);
  const [analyzingGame, setAnalyzingGame] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

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

  const fetchImage = async (nodeId: string, headline: string, narration: string, agentsList?: Agent[]) => {
    console.log('🎨 Fetching image for:', headline.slice(0, 50));
    // Mark as loading
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, imageLoading: true, imageError: undefined } : n));
    
    // Get agents from state if not provided
    const agents = agentsList || state?.agents?.map(a => ({ name: a.name, type: a.type })) || [];
    
    try {
      const res = await fetch('/api/simulation/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline, narration, agents }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error || `Image failed: ${res.status}`;
        console.error('Image API failed:', errMsg);
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, imageLoading: false, imageError: errMsg } : n));
        return;
      }
      if (data.success && data.imageUrl) {
        console.log('✅ Image loaded successfully');
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, imageUrl: data.imageUrl, imageLoading: false } : n));
      } else {
        const errMsg = data.error || 'No image returned';
        console.error('❌ Image error:', errMsg);
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, imageLoading: false, imageError: errMsg } : n));
      }
    } catch (e: any) {
      console.error('❌ Image fetch error:', e);
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, imageLoading: false, imageError: e.message || 'Network error' } : n));
    }
  };

  const init = async () => {
    if (!scenario.trim()) return;
    setLoading(true);
    setLoadingPhase('Analyzing scenario...');
    setError('');
    
    // Set default scenario name for custom scenarios
    if (!scenarioName) {
      setScenarioName('Custom Simulation');
    }

    try {
      // Show progress through phases
      const phaseTimer = setInterval(() => {
        setLoadingPhase(prev => {
          if (prev === 'Analyzing scenario...') return 'Generating agents...';
          if (prev === 'Generating agents...') return 'Building relationships...';
          if (prev === 'Building relationships...') return 'Setting the stage...';
          return prev;
        });
      }, 2500);
      
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
      
      clearInterval(phaseTimer);
      
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || data.details || 'Unknown error');

      const s = data.state as SimState;
      const pid = pName ? s.agents.find(a => a.name.toLowerCase().includes(pName.toLowerCase()))?.id || null : null;
      const g = pGoal || 'Maximize your influence';

      setLoadingPhase('Evaluating positions...');
      const agentScores = await fetchAgentScores(s);
      const playerScore = pid && agentScores[pid] ? agentScores[pid] : null;

      const rootId = uid();
      const root: Node = { id: rootId, parent: null, state: s, score: playerScore, scoring: false, agentScores, imageLoading: true, isNew: true };
      setNodes([root]);
      setCurrentId(rootId);
      setPlayerId(pid);
      setGoal(g);
      setStarted(true);

      // Generate image for initial state (non-blocking)
      const story = s.history[s.history.length - 1];
      if (story?.headline && story?.narration) {
        fetchImage(rootId, story.headline, story.narration);
      } else if (s.worldHeadline || s.context) {
        // Fallback if no history yet
        fetchImage(rootId, s.worldHeadline || 'Simulation begins', s.context || '');
      } else {
        // No content to generate image from - mark as not loading
        setNodes(prev => prev.map(n => n.id === rootId ? { ...n, imageLoading: false } : n));
      }
    } catch (e: any) { setError(e.message || 'Failed'); }
    finally { setLoading(false); setLoadingPhase(''); }
  };

  const turn = async (playerAction?: string) => {
    if (!state || !currentId || loading) return;
    setLoading(true);
    setLoadingPhase('');
    setPendingAction(playerAction || '');
    setError('');

    // Create placeholder node
    const newNodeId = uid();
    const placeholderState: SimState = {
      ...state,
      turn: state.turn + 1,
      history: [...state.history, { turn: state.turn + 1, headline: '', narration: '' }]
    };
    const placeholderNode: Node = {
      id: newNodeId,
      parent: currentId,
      state: placeholderState,
      score: null,
      scoring: false,
      action: playerAction,
      isStreaming: true,
      streamingPhase: 'actions',
      streamingAgentActions: [],
      streamingHeadline: '',
      streamingNarration: '',
    };
    
    setNodes(prev => [...prev, placeholderNode]);
    setCurrentId(newNodeId);
    setAction('');

    try {
      // ═══════════════════════════════════════════════════════════════
      // PHASE 1: Generate agent actions in PARALLEL
      // ═══════════════════════════════════════════════════════════════
      const agentActions: { agentId: string; action: string }[] = [];
      const playerActionData = playerId && playerAction ? { agentId: playerId, action: playerAction } : undefined;
      
      // Prepare requests for all agents
      const agentRequests = state.agents.map(agent => ({
        agent: { id: agent.id, name: agent.name, type: agent.type, state: agent.state },
        worldContext: state.context,
        otherAgents: state.agents.filter(a => a.id !== agent.id).map(a => ({ name: a.name, type: a.type, state: a.state })),
        playerAction: playerActionData,
        recentHistory: state.history.slice(-3)
      }));

      // Fire all requests and show results as they complete
      const fetchAndUpdate = async (reqBody: any) => {
        try {
          const res = await fetch('/api/simulation/agent-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqBody),
          });
          if (!res.ok) throw new Error(`Agent action failed: ${res.status}`);
          const result = await res.json();
          
          if (result?.success) {
            const action = { agentId: result.agentId, action: result.action };
            agentActions.push(action);
            // Update UI immediately when this agent completes
            setNodes(prev => prev.map(n => 
              n.id === newNodeId ? { 
                ...n, 
                streamingAgentActions: [...(n.streamingAgentActions || []), action]
              } : n
            ));
          }
          return result;
        } catch (e) {
          console.error(`Failed to get action for agent:`, e);
          return null;
        }
      };

      // Fire all requests - each updates UI when it completes
      await Promise.all(agentRequests.map(fetchAndUpdate));

      // ═══════════════════════════════════════════════════════════════
      // PHASE 2: Generate narrative with streaming
      // ═══════════════════════════════════════════════════════════════
      setNodes(prev => prev.map(n => 
        n.id === newNodeId ? { ...n, streamingPhase: 'narrating' } : n
      ));

      const narrateRes = await fetch('/api/simulation/narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentState: state,
          agentActions,
          playerAction: playerActionData,
        }),
      });
      
      if (!narrateRes.ok) throw new Error(`Narration failed: ${narrateRes.status}`);
      if (!narrateRes.body) throw new Error('No response body');

      const reader = narrateRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          
          try {
            const event = JSON.parse(jsonStr);
            
            if (event.type === 'headline') {
              setNodes(prev => prev.map(n => 
                n.id === newNodeId ? { ...n, streamingHeadline: event.content } : n
              ));
            } else if (event.type === 'narration') {
              setNodes(prev => prev.map(n => 
                n.id === newNodeId ? { ...n, streamingNarration: event.content } : n
              ));
            } else if (event.type === 'image_ready') {
              setNodes(prev => prev.map(n => 
                n.id === newNodeId ? { ...n, imageLoading: true } : n
              ));
              fetchImage(newNodeId, event.headline, event.narration);
            } else if (event.type === 'done') {
              const newState = event.state as SimState;
              
              setLoadingPhase('Evaluating...');
              const agentScores = await fetchAgentScores(newState);
              const playerScore = playerId && agentScores[playerId] ? agentScores[playerId] : null;
              
              setNodes(prev => prev.map(n => 
                n.id === newNodeId ? { 
                  ...n, 
                  state: newState, 
                  score: playerScore,
                  agentScores,
                  isStreaming: false,
                  streamingHeadline: undefined,
                  streamingNarration: undefined,
                  // Only set imageLoading if not already started
                  imageLoading: n.imageLoading || false,
                  isNew: false,
                } : n
              ));
            } else if (event.type === 'error') {
              throw new Error(event.message);
            }
          } catch (parseError) {
            console.warn('Failed to parse SSE:', jsonStr);
          }
        }
      }
    } catch (e: any) { 
      setError(e.message || 'Failed'); 
      setAuto(false);
      // Remove placeholder node on error
      setNodes(prev => prev.filter(n => n.id !== newNodeId));
      setCurrentId(currentId);
    }
    finally { setLoading(false); setLoadingPhase(''); setPendingAction(''); }
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

  const fetchSuggestions = async () => {
    if (!state || !playerId || !player) return;
    setLoadingSuggestions(true);
    try {
      const res = await fetch('/api/simulation/suggest-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: { id: player.id, name: player.name, type: player.type, state: player.state },
          worldContext: state.context,
          otherAgents: state.agents.filter(a => a.id !== playerId).map(a => ({ name: a.name, type: a.type, state: a.state })),
          goal,
          recentHistory: state.history.slice(-3)
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) setSuggestedActions(data.actions);
      }
    } catch (e) {
      console.error('Failed to fetch suggestions:', e);
    }
    setLoadingSuggestions(false);
  };

  const endGame = async () => {
    if (!state || !player || loading) return;
    setAnalyzingGame(true);
    setAuto(false);
    
    try {
      const res = await fetch('/api/simulation/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameHistory: state.history,
          playerName: player.name,
          playerGoal: goal,
          agents: state.agents,
          finalContext: state.context
        }),
      });
      
      if (!res.ok) throw new Error('Failed to analyze game');
      const data = await res.json();
      
      if (data.success) {
        setGameAnalysis(data.analysis);
        setShowAnalysis(true);
      }
    } catch (e) {
      console.error('Failed to analyze game:', e);
      setError('Failed to generate analysis');
    }
    setAnalyzingGame(false);
  };

  // Fetch suggestions when ready to act
  useEffect(() => {
    // Clear old suggestions first
    setSuggestedActions([]);
    setLoadingSuggestions(false);
    
    // Only fetch if conditions are right
    if (!isLeaf || !playerId || !state || loading || auto) {
      return;
    }
    
    // Fetch suggestions after a small delay
    setLoadingSuggestions(true);
    const t = setTimeout(() => {
      fetchSuggestions();
    }, 300);
    
    return () => clearTimeout(t);
  }, [currentId, isLeaf, playerId, state?.turn, loading, auto]);

  useEffect(() => {
    if (!auto || loading || !isLeaf || !playerId) return;
    const go = async () => {
      if (!autoRef.current) return;
      setLoadingPhase('AI thinking...');
      setLoading(true);
      const act = await getAutoAction();
      setLoading(false);
      setLoadingPhase('');
      if (act && autoRef.current) await turn(act);
    };
    const t = setTimeout(go, 600);
    return () => clearTimeout(t);
  }, [auto, loading, currentId, isLeaf]);

  // ═══════════════════════════════════════════════════════════════
  // SETUP SCREEN
  // ═══════════════════════════════════════════════════════════════

  if (!started) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="w-full max-w-xl space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-light text-stone-900 tracking-tight">Power Dynamics Simulator</h1>
            <p className="text-stone-500 text-sm">Model emergent power struggles between agents</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {PRESETS.map((p, i) => (
              <button 
                key={i} 
                onClick={() => { setScenario(p.scenario); setScenarioName(p.name); }} 
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  scenario === p.scenario 
                    ? 'bg-stone-900 text-white' 
                    : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
            <textarea 
              value={scenario} 
              onChange={e => setScenario(e.target.value)} 
              placeholder="Describe the scenario..." 
              className="w-full h-40 p-5 resize-none focus:outline-none text-stone-700 placeholder:text-stone-400 text-sm leading-relaxed" 
            />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 space-y-4">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Play as a character (optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <input 
                value={pName} 
                onChange={e => setPName(e.target.value)} 
                placeholder="Your name" 
                className="px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:border-stone-400 focus:bg-white transition-colors" 
              />
              <input 
                value={pRole} 
                onChange={e => setPRole(e.target.value)} 
                placeholder="Your role" 
                className="px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:border-stone-400 focus:bg-white transition-colors" 
              />
            </div>
            {pName && (
              <input 
                value={pGoal} 
                onChange={e => setPGoal(e.target.value)} 
                placeholder="Your goal (e.g., 'Amass power and influence')" 
                className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:border-stone-400 focus:bg-white transition-colors" 
              />
            )}
          </div>

          <div className="space-y-2">
            <button 
              onClick={init} 
              disabled={loading || !scenario.trim()} 
              className="w-full py-4 bg-stone-900 text-white rounded-2xl font-medium disabled:opacity-40 hover:bg-stone-800 transition-colors relative overflow-hidden"
            >
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-900">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{loadingPhase || 'Creating world...'}</span>
                  </div>
                </div>
              )}
              <span className={loading ? 'opacity-0' : ''}>Begin Simulation</span>
            </button>
            {loading && (
              <div className="h-1 bg-stone-200 rounded-full overflow-hidden">
                <div className="h-full bg-stone-500 animate-loading-bar" />
              </div>
            )}
          </div>

          {error && <p className="text-center text-rose-600 text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // GAME SCREEN
  // ═══════════════════════════════════════════════════════════════

  const timeline = getPath();

  return (
    <div className="min-h-screen bg-stone-100 flex">
      {/* SIDEBAR */}
      <aside className="w-72 bg-white border-r border-stone-200 flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="p-5 border-b border-stone-100">
          <div className="flex items-center justify-between">
            <span className="font-medium text-stone-900 truncate">{scenarioName || 'Simulation'}</span>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {playerId && state && (
                <button 
                  onClick={endGame}
                  disabled={analyzingGame || loading || state.turn === 0}
                  className="text-xs bg-stone-800 text-white hover:bg-stone-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={state.turn === 0 ? 'Play at least one turn first' : 'End game and see analysis'}
                >
                  {analyzingGame ? 'Analyzing...' : 'End Game'}
                </button>
              )}
              <button 
                onClick={() => { setStarted(false); setNodes([]); setAuto(false); setGameAnalysis(null); setShowAnalysis(false); }} 
                className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {playerId && (
          <div className="p-5 border-b border-stone-100 space-y-3">
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium">Your Goal</p>
            <p className="text-sm text-stone-700 leading-relaxed">{goal}</p>
            <div className="flex items-center gap-4">
              <Score value={current?.score} size="lg" />
              <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-stone-900 transition-all duration-700 ease-out" 
                  style={{ width: `${current?.score ?? 0}%` }} 
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-1">
            {timeline.map((node, idx) => {
              const isCurrent = node.id === currentId;
              // Use streaming headline if available, otherwise fall back to history
              const headline = node.isStreaming 
                ? (node.streamingHeadline || 'Generating...') 
                : (node.state.history[node.state.history.length - 1]?.headline || 'Start');
              const siblings = getSiblings(node);

              return (
                <div key={node.id}>
                  <button 
                    onClick={() => { setCurrentId(node.id); setAuto(false); }} 
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 group ${
                      isCurrent 
                        ? 'bg-stone-900 text-white' 
                        : 'hover:bg-stone-50 text-stone-600'
                    }`}
                  >
                    <span className={`font-mono text-xs w-4 shrink-0 ${isCurrent ? 'text-stone-300' : 'text-stone-400'}`}>
                      {node.state.turn}
                    </span>
                    <span className="truncate flex-1">
                      <RichText inheritColor>{headline}</RichText>
                    </span>
                    {playerId && node.score !== null && (
                      <span className={`text-xs font-mono ${isCurrent ? 'text-stone-300' : 'text-stone-500'}`}>
                        {node.score}
                      </span>
                    )}
                  </button>
                  
                  {siblings.length > 0 && (
                    <div className="ml-6 pl-3 border-l border-stone-200 py-1 space-y-0.5">
                      {siblings.map(sib => (
                        <button 
                          key={sib.id} 
                          onClick={() => { setCurrentId(sib.id); setAuto(false); }} 
                          className="w-full text-left px-2 py-1 rounded text-xs text-stone-500 hover:bg-stone-50 hover:text-stone-700 transition-colors truncate"
                        >
                          {sib.action || 'Alt'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {!isLeaf && (
          <div className="p-4 border-t border-stone-100">
            <button 
              onClick={goToLatest} 
              className="w-full text-center text-xs text-stone-500 hover:text-stone-700 transition-colors py-2"
            >
              Go to latest →
            </button>
          </div>
        )}
      </aside>

      {/* MAIN */}
      <main className="flex-1 min-h-screen flex flex-col bg-stone-50">
        {/* Header with loading */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-stone-200">
          <div className="h-14 px-8 flex items-center">
            <span className="text-sm text-stone-500">Turn</span>
            <span className="text-sm font-medium text-stone-900 ml-1.5">{currentTurn}</span>
            {!isLeaf && (
              <span className="ml-3 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                Viewing history
              </span>
            )}
          </div>
          {/* Loading bar - show during narration streaming or other loading (not during modal) */}
          <div className="h-0.5 bg-stone-100">
            {(loading && !current?.isStreaming) || (current?.isStreaming && current.streamingHeadline) ? (
              <div className="h-full bg-stone-400 animate-loading-bar" />
            ) : null}
          </div>
        </header>

        {error && (
          <div className="mx-8 mt-6 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-600">×</button>
          </div>
        )}

        <div className="flex-1 max-w-2xl mx-auto w-full px-8 py-8 space-y-6">
          {/* Story Image */}
          <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-stone-100 border border-stone-200">
            {current?.imageLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
                </div>
                <span className="text-sm text-stone-500 animate-pulse">Generating scene...</span>
              </div>
            ) : current?.imageError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
                <span className="text-rose-500 text-sm font-medium">Image failed</span>
                <span className="text-xs text-stone-500 text-center max-w-xs line-clamp-3">{current.imageError}</span>
                <button 
                  onClick={() => {
                    const s = current?.state?.history?.[current.state.history.length - 1];
                    if (s && current) fetchImage(current.id, s.headline, s.narration);
                  }}
                  className="mt-2 text-xs text-stone-600 hover:text-stone-900 underline"
                >
                  Retry
                </button>
              </div>
            ) : current?.imageUrl ? (
              <img 
                src={current.imageUrl} 
                alt={story?.headline || 'Scene'} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-stone-400">
                <span className="text-xs">No image</span>
              </div>
            )}
          </div>

          {/* Player's submitted action - only during narrating phase (modal handles actions phase) */}
          {current?.isStreaming && current.streamingPhase === 'narrating' && pendingAction && player && (
            <div className="bg-stone-100 rounded-xl px-4 py-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0">
                <AgentIcon type={player.type} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-stone-500 mb-1">{player.name}</div>
                <p className="text-sm text-stone-800 leading-relaxed">{pendingAction}</p>
              </div>
            </div>
          )}

          {/* Story Text */}
          <StoryText
            headline={current?.isStreaming ? (current.streamingHeadline || '') : (story?.headline || 'Simulation Ready')}
            narration={current?.isStreaming ? (current.streamingNarration || '') : (story?.narration || state?.context || '')}
            isNew={current?.isNew || false}
            isStreaming={current?.isStreaming || false}
            onViewed={() => {
              if (currentId && current?.isNew) {
                setNodes(prev => prev.map(n => n.id === currentId ? { ...n, isNew: false } : n));
              }
            }}
          />
          
          {/* Turn simulation modal - shows while streaming until we have headline */}
          {current?.isStreaming && !current.streamingHeadline && state && (
            <TurnModal
              agents={state.agents}
              streamingActions={current.streamingAgentActions || []}
              phase={current.streamingPhase || 'actions'}
              playerAction={pendingAction}
              playerName={player?.name}
            />
          )}

          {/* Player Action Input - only when not streaming */}
          {playerId && player && !current?.isStreaming && (
            <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <AgentIcon type={player.type} />
                <div className="flex-1">
                  <span className="font-medium text-stone-900">{player.name}</span>
                  <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">{player.state}</p>
                </div>
                <Score value={current?.agentScores?.[player.id]} />
              </div>
              
              {auto ? (
                <div className="flex items-center justify-between bg-stone-50 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-stone-500 animate-pulse" />
                    <span className="text-sm text-stone-600">Autopilot active</span>
                  </div>
                  <button onClick={() => setAuto(false)} className="text-xs text-stone-500 hover:text-stone-700 transition-colors">
                    Stop
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Suggested Actions */}
                  {loadingSuggestions ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 bg-stone-50 rounded-xl animate-pulse" />
                      ))}
                    </div>
                  ) : suggestedActions.length > 0 ? (
                    <div className="space-y-2">
                      {suggestedActions.map((suggestion, idx) => {
                        const strategyColors = {
                          aggressive: 'border-red-200 hover:border-red-300 hover:bg-red-50/50',
                          defensive: 'border-blue-200 hover:border-blue-300 hover:bg-blue-50/50',
                          diplomatic: 'border-green-200 hover:border-green-300 hover:bg-green-50/50'
                        };
                        const strategyIcons = {
                          aggressive: '⚡',
                          defensive: '🛡️',
                          diplomatic: '🤝'
                        };
                        return (
                          <button
                            key={idx}
                            onClick={() => turn(suggestion.title + ': ' + suggestion.description)}
                            disabled={loading}
                            className={`w-full p-3 rounded-xl border bg-white text-left transition-all ${strategyColors[suggestion.strategy]} disabled:opacity-50`}
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-base">{strategyIcons[suggestion.strategy]}</span>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-stone-900 text-sm">{suggestion.title}</span>
                                <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{suggestion.description}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  
                  {/* Custom action input */}
                  <div className="flex gap-2">
                    <input
                      value={action}
                      onChange={e => setAction(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && action.trim() && !loading && turn(action)}
                      placeholder="Or type your own action..."
                      disabled={loading}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:border-stone-400 focus:bg-white disabled:opacity-50 transition-colors"
                    />
                    <button 
                      onClick={() => turn(action)} 
                      disabled={loading || !action.trim()} 
                      className="px-4 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 disabled:opacity-40 transition-colors"
                    >
                      Go
                    </button>
                    <button 
                      onClick={() => setAuto(true)} 
                      disabled={loading} 
                      className="px-3 py-2.5 bg-stone-100 text-stone-600 rounded-xl hover:bg-stone-200 disabled:opacity-40 transition-colors"
                      title="Let AI play"
                    >
                      <Zap size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No player */}
          {!playerId && (
            <button 
              onClick={() => turn()} 
              disabled={loading} 
              className="w-full py-3.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? 'Simulating...' : <>Next Turn <ChevronRight size={16} /></>}
            </button>
          )}

          {/* Agents */}
          <div className="space-y-2">
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium px-1">Agents</p>
            <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 shadow-sm overflow-hidden">
              {state?.agents.map(agent => {
                const isP = agent.id === playerId;
                const thisAction = agent.actionHistory?.find(h => h.turn === currentTurn);
                const agentScore = current?.agentScores?.[agent.id];
                
                return (
                  <button 
                    key={agent.id} 
                    onClick={() => setViewAgent(agent)} 
                    className={`w-full px-4 py-3 text-left hover:bg-stone-50 transition-colors flex items-center gap-3 ${isP ? 'bg-stone-50' : ''}`}
                  >
                    <AgentIcon type={agent.type} size={16} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-stone-800 truncate">
                          {agent.name}
                          {isP && <span className="text-stone-400 font-normal ml-1">(you)</span>}
                        </span>
                      </div>
                      {thisAction && (
                        <p className="text-xs text-stone-500 truncate mt-0.5">
                          → <RichText>{thisAction.action}</RichText>
                        </p>
                      )}
                    </div>
                    <Score value={agentScore} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Agent Modal */}
      {viewAgent && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" 
          onClick={() => setViewAgent(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" 
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 flex items-center gap-3 border-b border-stone-100">
              <AgentIcon type={viewAgent.type} />
              <div className="flex-1">
                <h2 className="font-medium text-stone-900">{viewAgent.name}</h2>
                <p className="text-xs text-stone-500">{viewAgent.type}</p>
              </div>
              <Score value={current?.agentScores?.[viewAgent.id]} />
              <button 
                onClick={() => setViewAgent(null)} 
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-400 transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-5">
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-2">Current State</p>
                <p className="text-sm text-stone-700 leading-relaxed"><RichText>{viewAgent.state}</RichText></p>
              </div>
              {viewAgent.actionHistory?.length > 0 && (
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-3">History</p>
                  <div className="space-y-2">
                    {[...viewAgent.actionHistory].reverse().map((a, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <span className="text-stone-400 font-mono text-xs shrink-0 w-6">{a.turn}</span>
                        <span className="text-stone-600 leading-relaxed"><RichText>{a.action}</RichText></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Game Analysis Modal */}
      {showAnalysis && gameAnalysis && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-stone-100 p-6 rounded-t-3xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-1">Game Over</p>
                  <h2 className="text-2xl font-medium text-stone-900">{gameAnalysis.headline}</h2>
                </div>
                <button 
                  onClick={() => setShowAnalysis(false)} 
                  className="p-2 hover:bg-stone-100 rounded-xl transition-colors"
                >
                  <X size={20} className="text-stone-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Grade */}
              <div className="flex items-center gap-6">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold ${
                  gameAnalysis.playerPerformance.grade === 'S' ? 'bg-yellow-100 text-yellow-700' :
                  gameAnalysis.playerPerformance.grade === 'A' ? 'bg-green-100 text-green-700' :
                  gameAnalysis.playerPerformance.grade === 'B' ? 'bg-blue-100 text-blue-700' :
                  gameAnalysis.playerPerformance.grade === 'C' ? 'bg-stone-100 text-stone-700' :
                  gameAnalysis.playerPerformance.grade === 'D' ? 'bg-orange-100 text-orange-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {gameAnalysis.playerPerformance.grade}
                </div>
                <div>
                  <p className="font-medium text-stone-900">{gameAnalysis.playerPerformance.verdict}</p>
                  <p className="text-sm text-stone-500 mt-1">Your performance toward: {goal}</p>
                </div>
              </div>

              {/* Summary */}
              <div>
                <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
                  <RichText>{gameAnalysis.summary}</RichText>
                </p>
              </div>

              {/* Turning Points */}
              <div>
                <h3 className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-3">Key Turning Points</h3>
                <div className="space-y-3">
                  {gameAnalysis.turningPoints.map((tp, i) => (
                    <div key={i} className="flex gap-3 p-3 bg-stone-50 rounded-xl">
                      <span className="text-xs font-mono text-stone-400 shrink-0 w-10">T{tp.turn}</span>
                      <div>
                        <p className="text-sm font-medium text-stone-900">{tp.event}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{tp.impact}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* What Went Right/Wrong */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-3 flex items-center gap-1">
                    <span className="text-green-500">✓</span> What Went Right
                  </h3>
                  <ul className="space-y-2">
                    {gameAnalysis.whatWentRight.map((item, i) => (
                      <li key={i} className="text-sm text-stone-600 flex gap-2">
                        <span className="text-green-500 shrink-0">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-3 flex items-center gap-1">
                    <span className="text-red-500">✗</span> What Went Wrong
                  </h3>
                  <ul className="space-y-2">
                    {gameAnalysis.whatWentWrong.map((item, i) => (
                      <li key={i} className="text-sm text-stone-600 flex gap-2">
                        <span className="text-red-500 shrink-0">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Alternative Path */}
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <h3 className="text-xs text-blue-600 uppercase tracking-wider font-medium mb-2">What You Could Have Done</h3>
                <p className="text-sm text-blue-900">{gameAnalysis.alternativePath}</p>
              </div>

              {/* Final Standings */}
              <div>
                <h3 className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-3">Final Standings</h3>
                <div className="grid grid-cols-2 gap-2">
                  {gameAnalysis.finalStandings.map((standing, i) => (
                    <div key={i} className="p-3 bg-stone-50 rounded-xl">
                      <p className="text-sm font-medium text-stone-900">{standing.name}</p>
                      <p className="text-xs text-stone-500 mt-0.5">{standing.outcome}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Play Again */}
              <div className="pt-4 border-t border-stone-100 flex gap-3">
                <button
                  onClick={() => { setShowAnalysis(false); }}
                  className="flex-1 py-3 bg-stone-100 text-stone-700 text-sm font-medium rounded-xl hover:bg-stone-200 transition-colors"
                >
                  Continue Viewing
                </button>
                <button
                  onClick={() => { setStarted(false); setNodes([]); setGameAnalysis(null); setShowAnalysis(false); }}
                  className="flex-1 py-3 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 transition-colors"
                >
                  Play Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
