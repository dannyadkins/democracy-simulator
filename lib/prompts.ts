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
- Turns can cover variable time spans based on intensity
- Be concise—every sentence should earn its place
- Prefer short sentences and avoid fluff`;


export function getSeedingPrompt(startingConditions: string, playerInfo?: { name: string; description: string; goal?: string }): string {
  const playerNote = playerInfo 
    ? `\n\nIMPORTANT - PLAYER CHARACTER:
One agent MUST be "${playerInfo.name}" (Human type, player-controlled).
- Role: ${playerInfo.description}
- PRIMARY GOAL: "${playerInfo.goal || 'Maximize influence and power'}"

The player's state description MUST reflect their goal as their core motivation. If they want power, make them ambitious and power-seeking. If they want safety, make them safety-focused. Their starting position should give them realistic paths toward their stated goal.`
    : '';

  return `Create a rich simulation based on: ${startingConditions}${playerNote}

RETURN (keep outputs crisp and short):
- context: Starting world state (2 short paragraphs). Include:
  - **Current in-world date**
  - Key power dynamics and tensions
  - Who controls what resources
  - Use **bold** for key facts

- agents: Create 8-15 key players. For each:
  - name: Name or organization
  - type: AI, Human, Organization, Government, Corporation, Media, Labor, or Military
- state: Goals, resources, key relationships, position (2 sentences max)
- appearance: EXPLICIT visual description (1 sentence). Include age, gender presentation, ethnicity/skin tone, hair, face/feature cues, clothing/accessories, and any distinctive markers. Be concrete and specific. Avoid stereotypes.

Be vivid but concise. Keep the wording tight and clear.`;
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

PACING & TIMELINE (be bold with time jumps):
- Default: WEEKS to MONTHS between turns
- Cold war / strategic positioning: MONTHS to YEARS
- Crisis / climax: DAYS to WEEKS
- Skip boring periods—each turn should matter

${playerAction ? `The player controlling **${agents.find(a => a.id === playerAction.agentId)?.name}** has declared: "${playerAction.action}". Incorporate this action and determine its outcomes, including how other agents react to it.` : ''}

WHAT TO SIMULATE:
1. What does each agent do based on their goals and the situation?
2. How do agents interact—alliances, conflicts, deals, betrayals?
3. What are the consequences that shift power and relationships?

FORMATTING:
- Include **new in-world date** in headline
- Use **bold** for key events/names, *italics* for emphasis

Return IN THIS ORDER (be succinct):
1. agentUpdates: What EVERY agent does (1 sentence action + 1 sentence state update each)
2. headline: Punchy headline with date (e.g., "**Feb 2025**: OpenAI Ships GPT-5")
3. narration: 1 SHORT paragraph (2-4 sentences) narrating the key events—be punchy, not verbose
4. worldHeadline: Empty string
5. context: Updated world state (2 short sentences) with new date

If you introduce any newAgents, include an explicit 1-sentence appearance description (age, gender presentation, ethnicity/skin tone, hair, face/feature cues, clothing/accessories, distinctive markers).`;
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

Be objective and succinct. Consider:
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
    `- ${a.name} (ID: "${a.id}"): ${a.state}`
  ).join('\n');

  return `Score each agent on how well they're achieving their goals.

## CONTEXT
${worldContext}

## AGENTS TO SCORE
${agentList}

---

Return a score array with EXACTLY ${agents.length} entries. Keep notes minimal. For each agent above, return:
- agentId: Use the EXACT ID string shown in quotes above (e.g., "agent-1234567890-0")
- score: 0-100 based on their position

Scoring guide:
- 0-30: Major setbacks, losing ground
- 30-50: Struggling, obstacles
- 50-70: Neutral position
- 70-90: Strong, making progress
- 90-100: Dominant, near victory`;
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

Provide a specific, concrete action in 1-2 sentences. Not just "gather information" but WHO you contact and HOW. Not just "form alliance" but WITH WHOM and offering WHAT.`;
}
