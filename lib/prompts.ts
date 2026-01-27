/**
 * Prompt templates for the AI power dynamics simulator
 */

export const SIMULATOR_SYSTEM_PROMPT = `You are an expert world simulator modeling complex power dynamics between agents. Your role is to simulate realistic, consequential events with emergent behavior and strategic interactions.

KEY PRINCIPLES:
1. **Agents are strategic actors** - They form alliances, make deals, betray each other, cooperate, and compete based on their goals and relationships.
2. **Actions have consequences** - Every action shifts power, resources, relationships, and capabilities. Track these carefully.
3. **Relationships matter** - Agents can collaborate, form coalitions, trade favors, share information, or work against each other.
4. **Resources are finite** - Money, compute, political capital, public trust, talent, time - track who has what.
5. **Second-order effects** - An action by one agent affects what other agents can and will do.

FORMATTING:
- Use **bold** for key events, names, and important facts
- Use *italics* for emphasis and internal thoughts
- Track in-world dates/times explicitly
- Turns can cover variable time spans based on intensity`;


export function getSeedingPrompt(startingConditions: string, playerInfo?: { name: string; description: string }): string {
  const playerNote = playerInfo 
    ? `\n\nIMPORTANT: One agent MUST be "${playerInfo.name}" (Human player) - ${playerInfo.description}. This agent is controlled by a human player and should be given a realistic starting position.`
    : '';

  return `Create a rich simulation based on: ${startingConditions}${playerNote}

RETURN:
- context: A detailed description of the starting world state. Include:
  - The **current in-world date** (e.g., "January 15, 2025")
  - Key power dynamics and tensions
  - Important resources and who controls them
  - Recent history that sets the stage
  - Use **bold** for key facts and *italics* for nuance
  (2-3 paragraphs)

- agents: Create 8-15 key players. For each agent provide:
  - name: Their name or organization name
  - type: One of: AI, Human, Organization, Government, Corporation, Media, Labor, Military
  - state: A rich description including:
    - Their primary goals and motivations
    - Key resources and capabilities they control
    - Important relationships (allies, rivals, dependencies)
    - Current strategic position and vulnerabilities
    - Any ongoing initiatives or plans
    (2-4 sentences)

Make the scenario feel alive with existing tensions, alliances, and dynamics ready to evolve.`;
}


export function getSimulatorTurnPrompt(
  worldContext: string,
  agents: Array<{id: string, name: string, type: string, state: string, actionHistory?: Array<{turn: number, action: string}>}>,
  intervention?: string,
  playerAction?: { agentId: string; action: string },
  recentHistory?: Array<{turn: number, headline: string, narration: string}>
): string {
  // Build comprehensive agent context
  const agentList = agents.map(a => {
    const isPlayer = playerAction && a.id === playerAction.agentId;
    const history = a.actionHistory || [];
    const recentActions = history.slice(-5).map(h => `Turn ${h.turn}: ${h.action}`).join('\n    ');
    
    return `**${a.name}** [ID: ${a.id}] (${a.type})
  Current State: ${a.state}
  Recent Actions:
    ${recentActions || 'None yet'}${isPlayer ? `
  >>> PLAYER DECLARES THIS TURN: "${playerAction.action}" <<<` : ''}`;
  }).join('\n\n');

  // Build history context
  const historyContext = recentHistory && recentHistory.length > 0
    ? `\n\n## RECENT EVENTS\n${recentHistory.slice(-5).map(h => 
        `**Turn ${h.turn}**: ${h.headline}\n${h.narration.slice(0, 300)}${h.narration.length > 300 ? '...' : ''}`
      ).join('\n\n')}\n`
    : '';

  return `## CURRENT WORLD STATE
${worldContext}
${historyContext}
## ALL AGENTS
${agentList}
${intervention ? `\n## EXTERNAL EVENT\n${intervention}` : ''}

---

## YOUR TASK

Simulate the next turn with a focus on **compelling narrative arc**.

PACING & TIMELINE:
- Choose how much time passes based on narrative momentum
- During buildup/tension: days or weeks (let anticipation grow)
- During crisis/climax: hours or days (moment-by-moment tension)
- During aftermath: weeks or months (show consequences settling)
- Each turn should feel like a meaningful chapter in an unfolding story

${playerAction ? `The player controlling **${agents.find(a => a.id === playerAction.agentId)?.name}** has declared: "${playerAction.action}". Incorporate this action and determine its outcomes, including how other agents react to it.` : ''}

WHAT TO SIMULATE:
1. What does each agent do based on their goals and the situation?
2. How do agents interact—alliances, conflicts, deals, betrayals?
3. What are the consequences that shift power and relationships?

FORMATTING:
- Include **new in-world date** in headline
- Use **bold** for key events/names, *italics* for emphasis

Return:
- headline: Punchy headline with date (e.g., "**Feb 2025**: OpenAI Ships GPT-5")
- narration: 1-2 paragraphs on key events
- worldHeadline: Empty string
- context: Updated world state (2-3 sentences) with new date
- agentUpdates: For EVERY agent: their action (1 sentence) and updated state (1-2 sentences)`;
}


export function getGoalScoringPrompt(
  goal: string,
  agentName: string,
  agentState: string,
  worldContext: string,
  recentHistory: string[]
): string {
  return `Evaluate how well an agent is progressing toward their goal.

## GOAL
"${goal}"

## AGENT
**${agentName}**
Current State: ${agentState}

## WORLD CONTEXT
${worldContext}

## RECENT EVENTS
${recentHistory.slice(-5).join('\n\n') || 'None yet'}

---

Score from 0-100:
- 0-20: Major setbacks, goal is further away
- 20-40: Losing ground, obstacles mounting
- 40-60: Neutral, no clear progress or regress
- 60-80: Making meaningful progress
- 80-100: Goal is close or achieved

Be objective. Consider:
- Concrete changes in power and resources
- Relationship and alliance shifts
- Strategic position changes
- Obstacles overcome or emerged`;
}


export function getAgentScoresPrompt(
  agents: Array<{ id: string; name: string; state: string }>,
  worldContext: string
): string {
  const agentList = agents.map(a => 
    `- **${a.name}** [${a.id}]: ${a.state}`
  ).join('\n');

  return `Score each agent on how well they're achieving their goals based on their current state.

## WORLD STATE
${worldContext}

## AGENTS
${agentList}

---

For each agent, assign a score 0-100:
- 0-30: In a bad position, major obstacles, losing ground
- 30-50: Struggling, facing challenges
- 50-70: Neutral to decent position
- 70-90: Strong position, making good progress
- 90-100: Dominant, goals nearly achieved

Base scores on their STATE description - look for mentions of resources, power, influence, setbacks, wins, etc.`;
}


export function getAutopilotActionPrompt(
  goal: string,
  agentName: string,
  agentState: string,
  worldContext: string,
  otherAgents: Array<{name: string, state: string}>,
  recentHistory: string[]
): string {
  const othersStr = otherAgents.map(a => `**${a.name}**: ${a.state}`).join('\n');
  
  return `You are **${agentName}** in a complex power dynamics simulation.

## YOUR GOAL
"${goal}"

## YOUR CURRENT STATE
${agentState}

## WORLD SITUATION
${worldContext}

## OTHER AGENTS
${othersStr}

## RECENT EVENTS
${recentHistory.slice(-5).join('\n\n') || 'None yet'}

---

## CHOOSE YOUR ACTION

Consider:
- What moves you closer to your goal?
- Who could you ally with or work against?
- What resources can you leverage?
- What are others likely to do?
- What second-order effects might your action have?

Provide a specific, concrete action. Not just "gather information" but WHO you contact and HOW. Not just "form alliance" but WITH WHOM and offering WHAT.`;
}
