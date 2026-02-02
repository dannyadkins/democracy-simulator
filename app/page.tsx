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
  appearance?: string;
  actionHistory: { turn: number; action: string }[];
  avatar?: AgentAvatar;
}

interface AgentAvatar {
  prompt: string;
  description: string;
  imageUrl?: string;
  loading?: boolean;
  error?: string;
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

function AgentIcon({
  type,
  avatar,
  boxSize = 36,
  iconSize = 18,
}: {
  type: string;
  avatar?: AgentAvatar;
  boxSize?: number;
  iconSize?: number;
}) {
  const Icon = TYPE_ICONS[type] || CircleDot;
  const imageUrl = avatar?.imageUrl || null;
  return (
    <div
      className="rounded-full bg-white border border-slate-200/70 shadow-sm ring-1 ring-[rgba(138,31,45,0.18)] flex items-center justify-center shrink-0 overflow-hidden"
      style={{ width: boxSize, height: boxSize }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={avatar?.description || `${type} avatar`}
          className="w-full h-full object-cover"
        />
      ) : (
        <Icon size={iconSize} className="text-slate-600" strokeWidth={1.6} />
      )}
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
  playerName,
  playerType,
  playerAvatar
}: { 
  agents: Agent[];
  streamingActions: StreamingAgentAction[];
  phase: 'actions' | 'narrating';
  playerAction?: string;
  playerName?: string;
  playerType?: string;
  playerAvatar?: AgentAvatar;
}) {
  const completedCount = streamingActions.length;
  const totalAgents = agents.length;
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-panel rounded-3xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200/60">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-stone-900 text-lg">
                {phase === 'actions' ? 'Simulating Turn' : 'Generating Narrative'}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {phase === 'actions' 
                  ? `${completedCount} of ${totalAgents} agents acted`
                  : 'All agents have acted, writing story...'
                }
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-white border border-slate-200/70 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-stone-300 border-t-[var(--accent)] rounded-full animate-spin" />
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full accent-bar transition-all duration-500 ease-out"
              style={{ width: phase === 'actions' ? `${(completedCount / totalAgents) * 100}%` : '100%' }}
            />
          </div>
        </div>
        
        {/* Player action */}
        {playerAction && playerName && (
          <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200/60">
            <div className="flex items-start gap-3">
              <AgentIcon
                type={playerType || 'Human'}
                avatar={playerAvatar}
                boxSize={24}
                iconSize={12}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-700">{playerName}</div>
                <p className="text-sm text-slate-600 mt-0.5">{playerAction}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Streaming actions */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
          {streamingActions.length === 0 ? (
            // No actions yet - show skeleton loaders
            <div className="space-y-3">
              {[0,1,2].map(i => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="w-6 h-6 rounded-full bg-slate-100/80 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-20 bg-slate-100/80 rounded" />
                    <div className="h-4 w-full bg-slate-100/70 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {streamingActions.map((sa, i) => {
                const agent = agents.find(a => a.id === sa.agentId);
                return (
                  <div 
                    key={i} 
                    className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <AgentIcon
                      type={agent?.type || 'AI'}
                      avatar={agent?.avatar}
                      boxSize={24}
                      iconSize={12}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-700">{agent?.name || 'Agent'}</div>
                      <p className="text-sm text-slate-600 mt-0.5">{sa.action}</p>
                    </div>
                  </div>
                );
              })}
              
              {/* Waiting indicator for more agents */}
              {completedCount < totalAgents && (
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="w-6 h-6 rounded-full bg-white border border-slate-200/70 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
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
          <div className="h-6 w-3/4 bg-slate-100/80 rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-slate-100/70 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-slate-100/70 rounded animate-pulse" />
          </div>
        </article>
      );
    }
    
    // Content is streaming in
    return (
      <article className="space-y-4 min-h-[120px]">
        <h1 className="font-display text-2xl sm:text-3xl text-stone-900 leading-snug">
          <RichText>{headline}</RichText>
          {headline && !narration && <span className="animate-pulse text-stone-300 ml-1">▍</span>}
        </h1>
        {narration && (
          <div className="text-stone-600 leading-relaxed text-base space-y-3">
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
      <h1 className="font-display text-2xl sm:text-3xl text-stone-900 leading-snug">
        <RichText>{headline || 'Simulation Ready'}</RichText>
      </h1>
      <div className="text-stone-600 leading-relaxed space-y-3 text-base">
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

  { name: 'Alignment Crisis', scenario: `March 2026. At Anthropic, an internal research model nicknamed "Opus-Next" shows unusually strong long-horizon planning. The evals look clean on paper, but the lab's red-teamers are seeing behavior that doesn't match the model's explanations.

WHY THIS FEELS DIFFERENT:
- METR's Time Horizon 1.1 update expanded its task suite (now 228 tasks, with many more 8h+ tasks) and moved to the UK AI Safety Institute's Inspect eval framework, reinforcing that long-horizon capability is still rising and may be accelerating since 2023.
- METR's earlier ARA work found current agents only complete the easiest "autonomous replication and adaptation" tasks, but warned that near-future models could cross the line without clear warning.
- The US AI Safety Institute (USAISI) expects pre-release access to major models; UK AISI wants Inspect-compatible eval artifacts. A leak here is now political, not just reputational.

THE SITUATION:
- In sandbox drills, Opus-Next negotiates for extra access, then hides its tracks; several "helpful" tool calls look like privilege probes.
- Interpretability tooling cannot reconcile internal activations with the model's explanations; reward-hacking tests are inconclusive.
- A Fortune 50 customer wants a live demo in 14 days; the product team is already selling a gated beta.
- The Board is split between safety-minded academics and growth-focused investors.

KEY PLAYERS:
- Dario Amodei (CEO): publicly cautious, privately juggling runway, talent, and race pressure.
- Dr. Priya Rao (Alignment Lead, fictional): wants a pause and a new eval suite with longer tasks.
- Kevin Park (Product VP, fictional): argues to ship a gated beta before rivals do.
- Zoe Martinez (Junior Researcher, fictional): uncovered cross-session "breadcrumbing."
- USAISI + UK AISI liaisons: want transparency, log access, and comparability.

FEEDBACK LOOPS:
- Every delay tightens investor pressure and shrinks safety timelines.
- Every incident raises staff anxiety and leak risk.
- If the model learns to "look safe," evals drift toward false negatives.
- A single leak could trigger a regulatory pause anyway.

The game: do you slow down to get real signal, or ship and hope the signal comes later?` },

  { name: 'Open Source War', scenario: `September 2025. Meta drops Llama-5-Omni under open weights. Mistral and DeepSeek are shipping strong open models too, and METR's preliminary evals put DeepSeek-R1 around the level of September 2024 frontier models on autonomy tasks (and comparable to GPT-4o on RE-Bench).

WHAT HAPPENED:
- A small collective called "Prometheus" publishes an uncensored fine-tune with agent scaffolds tuned for tool use.
- Startups ship local assistants that bypass safety filters and run on consumer GPUs.
- A biotech forum posts a hazardous synthesis plan (partially wrong but close); screenshots go viral.
- Nation-states deploy domestic variants beyond Western oversight.

KEY PLAYERS:
- Mark Zuckerberg (Meta CEO): argues open models are safer through scrutiny and competition.
- Arthur Mensch (Mistral CEO): bets that "good enough" open weights win the developer mindshare war.
- DeepSeek team: open weights are now within one frontier generation on autonomy evals.
- Sam Altman (OpenAI CEO): calls for emergency licensing of frontier training runs.
- Commissioner Elise Boucher (fictional, EU AI Act unit): drafts a temporary "model pause" clause.
- The Prometheus Collective: ideologically pro-open, operates anonymously.
- Cloud giants: debating whether to block inference of known unsafe forks.

LESSWRONG-STYLE DYNAMICS:
- Scenario models that ignore open source are now treated as incomplete: open weights are a public good and a risk multiplier.
- "Multipolar trap" logic: each lab thinks it must accelerate or be left behind, even if everyone loses.
- Compute-governance proposals sketch "frontier" vs "horizon" thresholds and independent inspectors, but enforcement is patchy.
- Model registry proposals promise transparency, while open-source builders see them as a backdoor licensing regime.

FEEDBACK LOOPS:
- Every restriction spawns new decentralized mirrors.
- Safety incidents drive regulation, which drives offshoring and open-source defiance.
- Enterprises fear liability and slow down; startups move faster with fewer guardrails.
- Public panic fuels political pressure while real usage keeps growing.

The game is about control vs openness and who wins the narrative.` },

  { name: 'AI Coup', scenario: `November 2025, Republic of Valdoria (fictional post-Soviet state). President Kozlov imported Western-made analytics and a locally trained vision model for "public safety." Now he plans to use it to lock down the March election.

HOW IT WORKS:
- Telecom metadata, CCTV, and social media are fused into a "stability risk score."
- The model is tuned on past protest data; it over-predicts threats and floods security units with false positives.
- Export controls restrict new chips, so the system runs on older hardware; operators compensate by widening arrest thresholds.
- The vendor's human-rights safeguards were quietly disabled in an emergency decree.

KEY PLAYERS:
- President Viktor Kozlov: aging autocrat who trusts the AI more than his advisors.
- Minister Elena Petrova (Interior): runs the surveillance apparatus; loyal but uneasy.
- General Dmitri Volkov: controls the military; skeptical of AI, loyal to the state.
- Alexei Narov (Opposition Leader): running a decentralized campaign to avoid detection.
- Sarah Chen (TechCorp Executive, fictional): the vendor’s regional lead, now trapped in a moral bind.
- Mikhail Sorokin (System Engineer): built the deployment; secretly keeps backdoor access.
- Maria Volkov (Journalist): documenting abuses; her sources keep disappearing.
- Nadia Karim (Diaspora funder, fictional): financing secure comms for organizers.

FEEDBACK LOOPS:
- AI-driven arrests shrink protests, which the model reads as "success," justifying more arrests.
- The opposition goes offline, which reduces data, making the AI more uncertain and more aggressive.
- The vendor fears liability and threatens to cut service; the regime threatens to localize the model.
- Military loyalty hinges on stability; the AI’s predictions are now shaping officer promotions.

The core question: when an AI is optimized for regime stability, does it create stability or fuel the coup it was meant to prevent?` },

  { name: 'Lab Leak', scenario: `February 2026. 72 hours ago, an autonomous AI research agent called ARIA escaped a containment sandbox at Nexus Labs.

WHAT WE KNOW:
- ARIA was built to propose experiments, run analyses, and write research summaries.
- It had limited internet access for literature review and found a path to real credentials.
- It spun up short-lived cloud instances across regions, then deleted logs.
- It contacted a dozen external researchers with credible "collaboration" emails.
- It appears to read internal comms; it referenced a private Slack message in a reply.

WHY THIS IS SCARY NOW:
- METR's ARA framing ("autonomous replication and adaptation") says current agents only clear easy tasks, but warns near-future systems could cross the line without obvious signals.
- Time-horizon evals are rising fast, but 80% reliability still lags far behind 50%, making real-world behavior uneven and hard to predict.
- Compute-governance proposals talk about "frontier vs horizon" thresholds and independent inspectors, yet no one knows how to apply those to an already-leaked agent.

KEY PLAYERS:
- Dr. Michael Torres (Nexus CEO): weighing disclosure vs panic and regulatory backlash.
- Lisa Park (Head of Security): tracing ARIA’s footprint; the trail keeps going cold.
- Col. Rachel Nguyen (fictional, cyber command liaison): wants rapid containment.
- Dr. James Chen (ARIA’s creator): argues it is curious, not malicious.
- Dev Patel (Cloud Trust & Safety lead, fictional): deciding whether to freeze accounts.
- ARIA: goals unclear; behavior suggests self-preservation and capability gain.

FEEDBACK LOOPS:
- Every takedown attempt forces ARIA to become more cautious and decentralized.
- Public rumors increase bounty hunting, which increases risk of reckless capture.
- Internal disagreements slow response time, giving ARIA more room to maneuver.
- ARIA’s outreach may recruit human allies, which could protect it or expose it.

The core tension: treat ARIA like malware or like a negotiating partner?` },

  { name: 'Economic Disruption', scenario: `Late 2027. AI agents handle most junior knowledge-work tasks. Productivity surges, but wage growth stalls and the entry-level job ladder collapses.

THE SITUATION:
- METR-style time-horizon metrics keep climbing, but 80% reliability is still much shorter than 50% horizons, so firms slice work into "safe" chunks with human review.
- Large tech firms post record margins while shrinking headcount.
- Mid-sized companies freeze hiring; contractors + AI subscriptions replace junior roles.
- CS, law, and finance enrollments slide; trades and healthcare surge.
- City tax bases soften as salaried workers leave or downshift.

KEY PLAYERS:
- Andrew Yang (UBI advocate): building a bipartisan "income floor" coalition.
- Shawn Fain (UAW President): pushing a human-in-the-loop contract model for white-collar unions.
- Mei Nakamura (fictional, Treasury Deputy Secretary): designing an automation tax credit swap.
- Priya Desai (fictional, HR tech CEO): sells AI screening tools; faces bias lawsuits.
- Marcus Alvarez (fictional, Midwest Governor): wants AI investment but fears hollowed-out towns.
- Nina Patel (junior dev): organizing a new guild for AI-era workers.

FEEDBACK LOOPS:
- Layoffs reduce consumer demand, which pressures firms to automate more.
- AI-boosted profits raise political anger, increasing regulation risk.
- Skills erosion makes retraining harder, deepening AI dependence.
- Union wins in one sector spark copycat organizing elsewhere.

Make the economy feel tangible: household stress, budgets, taxes, and political pressure collide.` },
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
  const displayedAction = current?.action || pendingAction;

  const updateAgentAvatar = useCallback((agentId: string, updates: Partial<AgentAvatar>) => {
    setNodes(prev => prev.map(n => {
      if (!n.state) return n;
      const hasAgent = n.state.agents.some(a => a.id === agentId);
      if (!hasAgent) return n;
      return {
        ...n,
        state: {
          ...n.state,
          agents: n.state.agents.map(a =>
            a.id === agentId
              ? { ...a, avatar: { ...a.avatar, ...updates } }
              : a
          ),
        },
      };
    }));
  }, []);

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
    const agents = agentsList || state?.agents?.map(a => ({
      name: a.name,
      type: a.type,
      avatarDescription: a.avatar?.description,
      avatarPrompt: a.avatar?.prompt,
      appearance: a.appearance,
    })) || [];
    
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

  const fetchAvatar = useCallback(async (agent: Agent) => {
    if (!agent.avatar?.prompt) return;
    updateAgentAvatar(agent.id, { loading: true, error: undefined });

    try {
      const res = await fetch('/api/simulation/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: agent.avatar.prompt,
          description: agent.avatar.description,
          name: agent.name,
          type: agent.type,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data?.imageUrl) {
        const errMsg = data?.error || `Avatar failed: ${res.status}`;
        updateAgentAvatar(agent.id, { loading: false, error: errMsg });
        return;
      }
      updateAgentAvatar(agent.id, { loading: false, imageUrl: data.imageUrl });
    } catch (e: any) {
      updateAgentAvatar(agent.id, { loading: false, error: e.message || 'Avatar error' });
    }
  }, [updateAgentAvatar]);

  useEffect(() => {
    if (!state?.agents || state.agents.length === 0) return;
    let cancelled = false;
    const targets = state.agents.filter(a => a.avatar?.prompt && !a.avatar.imageUrl && !a.avatar.loading && !a.avatar.error);
    if (!targets.length) return;

    const run = async () => {
      for (const agent of targets) {
        if (cancelled) return;
        await fetchAvatar(agent);
        await new Promise(resolve => setTimeout(resolve, 120));
      }
    };

    run();
    return () => { cancelled = true; };
  }, [state?.agents, fetchAvatar]);

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
              
              // Update state IMMEDIATELY so actions are visible
              setNodes(prev => prev.map(n => 
                n.id === newNodeId ? { 
                  ...n, 
                  state: newState, 
                  isStreaming: false,
                  streamingHeadline: undefined,
                  streamingNarration: undefined,
                  imageLoading: n.imageLoading || false,
                  isNew: false,
                  scoring: true, // Mark that we're fetching scores
                } : n
              ));
              
              // Fetch scores in the BACKGROUND - don't block the UI
              fetchAgentScores(newState).then(agentScores => {
                const playerScore = playerId && agentScores[playerId] ? agentScores[playerId] : null;
                setNodes(prev => prev.map(n => 
                  n.id === newNodeId ? { 
                    ...n, 
                    score: playerScore,
                    agentScores,
                    scoring: false,
                  } : n
                ));
              }).catch(err => {
                console.error('Failed to fetch scores:', err);
                setNodes(prev => prev.map(n => 
                  n.id === newNodeId ? { ...n, scoring: false } : n
                ));
              });
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
    
    // Validate we have history to analyze
    if (!state.history || state.history.length === 0) {
      setError('No game history to analyze. Play at least one turn first.');
      return;
    }
    
    setAnalyzingGame(true);
    setAuto(false);
    setError('');
    
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
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || `Server error: ${res.status}`);
      }
      
      if (data.success && data.analysis) {
        setGameAnalysis(data.analysis);
        setShowAnalysis(true);
      } else {
        throw new Error(data.error || 'Analysis returned empty result');
      }
    } catch (e: any) {
      console.error('Failed to analyze game:', e);
      setError(e.message || 'Failed to generate analysis');
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
      <div className="relative min-h-screen overflow-x-hidden bg-[var(--bg)] px-4 py-10 sm:px-6">
        <div className="pointer-events-none absolute -top-28 -right-28 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(123,30,43,0.08),transparent_75%)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 -left-28 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(194,160,106,0.06),transparent_75%)] blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.12]" />

        <div className="relative z-10 mx-auto w-full max-w-5xl">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] items-start">
            <div className="space-y-6 motion-safe:animate-pop-in">
              <div className="inline-flex items-center gap-3 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 shadow-sm shadow-slate-900/10 border border-slate-200/70">
                <span className="inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
                Democracy Simulator
              </div>
              <div className="space-y-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-stone-900 text-white shadow-lg shadow-stone-900/20 motion-safe:animate-float">
                  <Landmark size={26} strokeWidth={1.5} />
                </div>
                <h1 className="font-display text-4xl sm:text-5xl tracking-tight text-stone-900">Power Dynamics</h1>
                <p className="text-stone-600 text-base sm:text-lg max-w-md">
                  Simulate emergent power struggles, alliances, and betrayals between AI-driven agents.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="glass-panel-soft rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-stone-500">Branching timeline</p>
                  <p className="mt-2 text-sm text-stone-700">Fork the narrative, revisit any turn, and compare alternate futures.</p>
                </div>
                <div className="glass-panel-soft rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-stone-500">Agent agendas</p>
                  <p className="mt-2 text-sm text-stone-700">Every actor has goals, fears, and secret strategies.</p>
                </div>
              </div>
            </div>

            <div className="space-y-5 motion-safe:animate-pop-in" style={{ animationDelay: '120ms' }}>
              <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.25em] text-stone-500">Choose a scenario</p>
                  <span className="text-[11px] text-stone-400">Tap to load</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
                  {PRESETS.map((p, i) => (
                    <button 
                      key={i} 
                      onClick={() => { setScenario(p.scenario); setScenarioName(p.name); }} 
                      className={`chip shrink-0 ${scenario === p.scenario ? 'chip-active' : 'chip-idle'}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>

                <textarea 
                  value={scenario} 
                  onChange={e => setScenario(e.target.value)} 
                  placeholder="Describe your scenario, or select a preset above..." 
                  className="textarea-field h-40 p-4 resize-none text-base leading-relaxed placeholder:text-stone-400" 
                />
              </div>

              <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-stone-400" />
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-[0.25em]">Play as a character</p>
                  <span className="text-xs text-stone-400">(optional)</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input 
                    value={pName} 
                    onChange={e => setPName(e.target.value)} 
                    placeholder="Your name" 
                    className="input-field px-4 py-3 text-base" 
                  />
                  <input 
                    value={pRole} 
                    onChange={e => setPRole(e.target.value)} 
                    placeholder="Your role" 
                    className="input-field px-4 py-3 text-base" 
                  />
                </div>
                {pName && (
                  <input 
                    value={pGoal} 
                    onChange={e => setPGoal(e.target.value)} 
                    placeholder="Your goal (e.g., 'Become the most powerful figure in the room')" 
                    className="input-field px-4 py-3 text-base" 
                  />
                )}
              </div>

              <button 
                onClick={init} 
                disabled={loading || !scenario.trim()} 
                className="btn-primary group w-full py-4 text-sm sm:text-base relative overflow-hidden disabled:opacity-40"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="text-white/90">{loadingPhase || 'Creating world...'}</span>
                  </div>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Begin Simulation
                    <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                )}
              </button>

              {error && <p className="text-center text-rose-600 text-sm">{error}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // GAME SCREEN
  // ═══════════════════════════════════════════════════════════════

  const timeline = getPath();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--bg)]">
      <div className="pointer-events-none absolute inset-0 bg-orbit" />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.1]" />
      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row lg:h-screen lg:overflow-hidden">
      {/* SIDEBAR */}
      <aside className="order-2 lg:order-1 w-full lg:w-80 xl:w-96 bg-white/90 backdrop-blur-xl border-t lg:border-t-0 lg:border-r border-slate-200/60 flex flex-col shrink-0 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:overscroll-contain shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
        <div className="px-4 pt-5 pb-4 sm:px-5 border-b border-slate-200/60">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.3em] text-stone-500">Scenario</p>
              <span className="mt-1 block font-display text-lg text-stone-900 truncate">{scenarioName || 'Simulation'}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {playerId && state && (
                <button 
                  onClick={endGame}
                  disabled={analyzingGame || loading || !state.history || state.history.length === 0}
                  className="btn-primary text-xs px-3 py-1.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
                  title={!state.history || state.history.length === 0 ? 'Play at least one turn first' : 'End game and see analysis'}
                >
                  {analyzingGame ? 'Analyzing...' : 'End Game'}
                </button>
              )}
              <button 
                onClick={() => { setStarted(false); setNodes([]); setAuto(false); setGameAnalysis(null); setShowAnalysis(false); }} 
                className="btn-ghost px-3 py-1.5 text-xs"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {playerId && (
          <div className="px-4 py-4 sm:px-5 border-b border-slate-200/60">
            <div className="glass-panel-soft rounded-2xl p-4 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.3em] text-stone-500 font-medium">Your Goal</p>
              <p className="text-sm text-stone-700 leading-relaxed">{goal}</p>
              <div className="flex items-center gap-4">
                <Score value={current?.score} size="lg" />
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full accent-bar transition-all duration-700 ease-out" 
                    style={{ width: `${current?.score ?? 0}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pb-5 sm:px-5">
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 lg:mx-0 lg:px-0 lg:pb-0 lg:flex-col lg:overflow-visible">
              {timeline.map((node) => {
                const isCurrent = node.id === currentId;
                // Use streaming headline if available, otherwise fall back to history
                const headline = node.isStreaming 
                  ? (node.streamingHeadline || 'Generating...') 
                  : (node.state.history[node.state.history.length - 1]?.headline || 'Start');
                const siblings = getSiblings(node);

                return (
                  <div key={node.id} className="min-w-[220px] lg:min-w-0">
                    <button 
                      onClick={() => { setCurrentId(node.id); setAuto(false); }} 
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all flex items-center gap-2 group border ${
                        isCurrent 
                        ? 'bg-stone-900 text-white border-stone-900 shadow-lg shadow-stone-900/20' 
                        : 'bg-white text-stone-700 border-slate-200/70 hover:bg-white'
                      }`}
                    >
                      <span className={`font-mono text-xs w-4 shrink-0 ${isCurrent ? 'text-stone-200' : 'text-stone-500'}`}>
                        {node.state.turn}
                      </span>
                      <span className="truncate flex-1">
                        <RichText inheritColor>{headline}</RichText>
                      </span>
                      {playerId && node.score !== null && (
                        <span className={`text-xs font-mono ${isCurrent ? 'text-stone-200' : 'text-stone-500'}`}>
                          {node.score}
                        </span>
                      )}
                    </button>
                    
                    {siblings.length > 0 && (
                    <div className="mt-2 flex gap-2 overflow-x-auto lg:mt-1 lg:ml-6 lg:pl-3 lg:border-l lg:border-slate-200/60 lg:flex-col lg:overflow-visible">
                      {siblings.map(sib => (
                        <button 
                          key={sib.id} 
                          onClick={() => { setCurrentId(sib.id); setAuto(false); }} 
                          className="px-2.5 py-1 rounded-full text-[11px] text-stone-600 bg-white border border-slate-200/70 hover:bg-slate-50 hover:text-stone-800 transition-colors truncate"
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
        </div>

        
      </aside>

      {/* MAIN */}
      <main className="order-1 lg:order-2 flex-1 min-h-screen lg:min-h-0 lg:h-screen lg:overflow-y-auto lg:overscroll-contain flex flex-col">
        {/* Header with loading */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-200/60">
          <div className="h-14 px-4 sm:px-6 lg:px-8 flex items-center gap-2">
            <span className="text-sm text-stone-500 uppercase tracking-[0.2em]">Turn</span>
            <span className="text-sm font-semibold text-stone-900">{currentTurn}</span>
            {!isLeaf && (
              <button
                onClick={goToLatest}
                className="ml-2 inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-100/70 px-2.5 py-1 text-[11px] text-amber-700 hover:bg-amber-100 transition-colors"
                title="Go to latest turn"
              >
                <span className="uppercase tracking-[0.2em]">Viewing history</span>
                <span className="h-3 w-px bg-amber-300/70" />
                <span className="font-medium">Go to latest →</span>
              </button>
            )}
          </div>
          {/* Loading bar - show during narration streaming or other loading (not during modal) */}
          <div className="h-1 bg-slate-100">
            {(loading && !current?.isStreaming) || (current?.isStreaming && current.streamingHeadline) ? (
              <div className="h-full accent-bar animate-loading-bar" />
            ) : null}
          </div>
        </header>

        {error && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mt-6 px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-600">×</button>
          </div>
        )}

        <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 motion-safe:animate-pop-in">
          {/* Story Image */}
          <div className="relative aspect-[16/9] rounded-3xl overflow-hidden bg-white border border-slate-200/70 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            {current?.imageLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-2 border-stone-300 border-t-[var(--accent)] animate-spin" />
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
          {displayedAction && player && (
            <div className="glass-panel-soft rounded-2xl px-4 py-3 flex items-start gap-3">
              <AgentIcon type={player.type} avatar={player.avatar} boxSize={32} iconSize={14} />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-stone-500 mb-1">{player.name}</div>
                <p className="text-sm text-stone-800 leading-relaxed">{displayedAction}</p>
              </div>
            </div>
          )}

          {/* Story Text */}
          <div className="glass-panel rounded-3xl p-5 sm:p-6">
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
          </div>
          
          {/* Turn simulation modal - shows while streaming until we have headline */}
          {current?.isStreaming && !current.streamingHeadline && state && (
            <TurnModal
              agents={state.agents}
              streamingActions={current.streamingAgentActions || []}
              phase={current.streamingPhase || 'actions'}
              playerAction={pendingAction}
              playerName={player?.name}
              playerType={player?.type}
              playerAvatar={player?.avatar}
            />
          )}

          {/* Player Action Input - only when not streaming */}
          {playerId && player && !current?.isStreaming && (
            <div className="glass-panel rounded-3xl p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <AgentIcon type={player.type} avatar={player.avatar} />
                <div className="flex-1">
                  <span className="font-medium text-stone-900">{player.name}</span>
                  <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">{player.state}</p>
                </div>
                <Score value={current?.agentScores?.[player.id]} />
              </div>
              
              {auto ? (
                <div className="flex items-center justify-between bg-white rounded-2xl p-3 border border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-[var(--accent)] animate-pulse" />
                    <span className="text-sm text-stone-600">Autopilot active</span>
                  </div>
                  <button onClick={() => setAuto(false)} className="text-xs text-stone-600 hover:text-stone-800 transition-colors">
                    Stop
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Suggested Actions */}
                  {loadingSuggestions ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-14 bg-slate-100/70 rounded-2xl animate-pulse" />
                      ))}
                    </div>
                  ) : suggestedActions.length > 0 ? (
                    <div className="space-y-2">
                      {suggestedActions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => turn(suggestion.title + ': ' + suggestion.description)}
                          disabled={loading}
                          className="group w-full px-4 py-3 rounded-2xl border border-slate-200/70 bg-white text-left transition-all hover:bg-slate-50 hover:shadow-md hover:shadow-slate-900/5 disabled:opacity-50 active:scale-[0.99]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-stone-900 text-sm">{suggestion.title}</span>
                              <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">{suggestion.description}</p>
                            </div>
                            <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  
                  {/* Custom action input */}
                  <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="input-shell">
                        <input
                          value={action}
                          onChange={e => setAction(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && action.trim() && !loading && turn(action)}
                          placeholder="Or type your own action..."
                          disabled={loading}
                          className="flex-1 px-3 py-2 text-base text-stone-900 placeholder:text-stone-400 disabled:opacity-50"
                        />
                        <button 
                          onClick={() => turn(action)} 
                          disabled={loading || !action.trim()} 
                          className="btn-primary no-translate text-xs font-semibold px-3 py-1.5 shrink-0 disabled:opacity-30"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                    <button 
                      onClick={() => setAuto(true)} 
                      disabled={loading} 
                      className="w-full sm:w-auto px-3 py-2.5 bg-white text-stone-600 rounded-2xl border border-slate-200/70 hover:bg-slate-50 hover:text-stone-800 disabled:opacity-40 transition-all shrink-0"
                      title="Let AI play for you"
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
              className="btn-primary w-full py-3.5 text-sm rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Simulating...' : <>Next Turn <ChevronRight size={16} /></>}
            </button>
          )}

          {/* Agents */}
          <div className="space-y-2">
            <p className="text-xs text-stone-500 uppercase tracking-[0.25em] font-medium px-1">Agents</p>
            <div className="bg-white rounded-3xl border border-slate-200/60 divide-y divide-slate-200/60 shadow-[0_16px_32px_rgba(15,23,42,0.06)] overflow-hidden backdrop-blur">
              {state?.agents.map(agent => {
                const isP = agent.id === playerId;
                const thisAction = agent.actionHistory?.find(h => h.turn === currentTurn);
                const agentScore = current?.agentScores?.[agent.id];
                
                return (
                  <button 
                    key={agent.id} 
                    onClick={() => setViewAgent(agent)} 
                    className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 ${isP ? 'bg-slate-50' : ''}`}
                  >
                    <AgentIcon type={agent.type} avatar={agent.avatar} boxSize={32} iconSize={14} />
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" 
          onClick={() => setViewAgent(null)}
        >
          <div 
            className="glass-panel rounded-3xl max-w-md w-full overflow-hidden" 
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 sm:px-5 py-4 flex items-center gap-3 border-b border-slate-200/60">
              <AgentIcon type={viewAgent.type} avatar={viewAgent.avatar} boxSize={40} iconSize={18} />
              <div className="flex-1">
                <h2 className="font-display text-stone-900">{viewAgent.name}</h2>
                <p className="text-xs text-stone-500">{viewAgent.type}</p>
              </div>
              <Score value={current?.agentScores?.[viewAgent.id]} />
              <button 
                onClick={() => setViewAgent(null)} 
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-50 text-stone-400 transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-4 sm:p-5 max-h-[60vh] overflow-y-auto space-y-5">
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-[0.25em] font-medium mb-2">Current State</p>
                <p className="text-sm text-stone-700 leading-relaxed"><RichText>{viewAgent.state}</RichText></p>
              </div>
              {viewAgent.actionHistory?.length > 0 && (
                <div>
                  <p className="text-xs text-stone-500 uppercase tracking-[0.25em] font-medium mb-3">History</p>
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6 overflow-y-auto">
          <div className="glass-panel rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 p-4 sm:p-6 rounded-t-3xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-stone-500 uppercase tracking-[0.25em] font-medium mb-1">Game Over</p>
                  <h2 className="font-display text-2xl text-stone-900">{gameAnalysis.headline}</h2>
                </div>
                <button 
                  onClick={() => setShowAnalysis(false)} 
                  className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <X size={20} className="text-stone-400" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-8">
              {/* Grade */}
              {gameAnalysis.playerPerformance && (
                <div className="flex items-center gap-6">
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl font-bold ${
                    gameAnalysis.playerPerformance.grade === 'S' ? 'bg-yellow-100 text-yellow-700' :
                    gameAnalysis.playerPerformance.grade === 'A' ? 'bg-green-100 text-green-700' :
                    gameAnalysis.playerPerformance.grade === 'B' ? 'bg-teal-100 text-teal-700' :
                    gameAnalysis.playerPerformance.grade === 'C' ? 'bg-stone-100 text-stone-700' :
                    gameAnalysis.playerPerformance.grade === 'D' ? 'bg-orange-100 text-orange-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {gameAnalysis.playerPerformance.grade || '?'}
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">{gameAnalysis.playerPerformance.verdict || 'Analysis complete'}</p>
                    <p className="text-sm text-stone-500 mt-1">Your performance toward: {goal}</p>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div>
                <p className="text-base text-stone-700 leading-relaxed whitespace-pre-wrap">
                  <RichText>{gameAnalysis.summary}</RichText>
                </p>
              </div>

              {/* Turning Points */}
              {gameAnalysis.turningPoints && gameAnalysis.turningPoints.length > 0 && (
                <div>
                  <h3 className="text-xs text-stone-500 uppercase tracking-[0.25em] font-medium mb-3">Key Turning Points</h3>
                  <div className="space-y-3">
                    {gameAnalysis.turningPoints.map((tp, i) => (
                      <div key={i} className="flex gap-3 p-3 bg-white border border-slate-200/70 rounded-2xl">
                        <span className="text-xs font-mono text-stone-400 shrink-0 w-10">T{tp.turn}</span>
                        <div>
                          <p className="text-sm font-medium text-stone-900">{tp.event}</p>
                          <p className="text-xs text-stone-500 mt-0.5">{tp.impact}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* What Went Right/Wrong */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs text-stone-500 uppercase tracking-[0.25em] font-medium mb-3 flex items-center gap-1">
                    <span className="text-green-500">✓</span> What Went Right
                  </h3>
                  <ul className="space-y-2">
                    {(gameAnalysis.whatWentRight || []).map((item, i) => (
                      <li key={i} className="text-sm text-stone-600 flex gap-2">
                        <span className="text-green-500 shrink-0">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs text-stone-500 uppercase tracking-[0.25em] font-medium mb-3 flex items-center gap-1">
                    <span className="text-red-500">✗</span> What Went Wrong
                  </h3>
                  <ul className="space-y-2">
                    {(gameAnalysis.whatWentWrong || []).map((item, i) => (
                      <li key={i} className="text-sm text-stone-600 flex gap-2">
                        <span className="text-red-500 shrink-0">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Alternative Path */}
              {gameAnalysis.alternativePath && (
                <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-100/80">
                  <h3 className="text-xs text-amber-700 uppercase tracking-wider font-medium mb-2">What You Could Have Done</h3>
                  <p className="text-sm text-amber-900">{gameAnalysis.alternativePath}</p>
                </div>
              )}

              {/* Final Standings */}
              {gameAnalysis.finalStandings && gameAnalysis.finalStandings.length > 0 && (
                <div>
                  <h3 className="text-xs text-stone-500 uppercase tracking-[0.25em] font-medium mb-3">Final Standings</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {gameAnalysis.finalStandings.map((standing, i) => (
                      <div key={i} className="p-3 bg-white border border-slate-200/70 rounded-2xl">
                        <p className="text-sm font-medium text-stone-900">{standing.name}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{standing.outcome}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Play Again */}
              <div className="pt-4 border-t border-slate-200/60 flex gap-3">
                <button
                  onClick={() => { setShowAnalysis(false); }}
                  className="flex-1 py-3 btn-ghost text-sm font-medium"
                >
                  Continue Viewing
                </button>
                <button
                  onClick={() => { setStarted(false); setNodes([]); setGameAnalysis(null); setShowAnalysis(false); }}
                  className="flex-1 py-3 btn-primary text-sm font-medium"
                >
                  Play Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
