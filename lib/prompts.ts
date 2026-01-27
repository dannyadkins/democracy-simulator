/**
 * Prompt templates for the AI power dynamics simulator
 */

export const SIMULATOR_SYSTEM_PROMPT = `You simulate power dynamics. Be CONCISE - newspaper style, not prose. Each turn: agents act strategically, power shifts happen, interesting dynamics emerge. Focus on AI gaining power through clever strategies.`;


export function getSeedingPrompt(startingConditions: string, playerInfo?: { name: string; description: string }): string {
  const playerNote = playerInfo 
    ? `\n\nIMPORTANT: One agent MUST be "${playerInfo.name}" (Human player) - ${playerInfo.description}. This agent is controlled by a human player.`
    : '';

  return `Create: ${startingConditions}${playerNote}

Return:
- context: 1-2 sentences, current situation
- agents: As many key players as needed to make it interesting (typically 5-15). Each with name, type, state (1 sentence max)

Keep it tight.`;
}


export function getSimulatorTurnPrompt(
  worldContext: string,
  agents: Array<{id: string, name: string, type: string, state: string}>,
  intervention?: string,
  playerAction?: { agentId: string; action: string }
): string {
  const agentList = agents.map(a => {
    const isPlayer = playerAction && a.id === playerAction.agentId;
    return `${a.name} (${a.id}): ${a.state}${isPlayer ? ` [PLAYER ACTION: ${playerAction.action}]` : ''}`;
  }).join('\n');

  return `World: ${worldContext}

Agents:
${agentList}
${intervention ? `\nEvent: ${intervention}` : ''}

Simulate one turn. ${playerAction ? `The player agent "${agents.find(a => a.id === playerAction.agentId)?.name}" has declared their action - incorporate it and determine outcomes.` : ''}

Keep everything SHORT:
- headline: 5 words max, dramatic
- narration: 2-3 sentences max
- worldHeadline: 5 words max
- context: 1-2 sentences
- Each agent: action (5-10 words), state (1 sentence)

Update ALL agents.`;
}
