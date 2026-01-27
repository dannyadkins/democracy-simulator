# AI Power Dynamics Simulator

An emergent simulation exploring how AI agents, organizations, and humans compete for power, influence, and resources. Watch strategic dynamics unfold as agents pursue their goals.

## Features

- **Dynamic Simulations** - Create any scenario with AI systems, humans, organizations, and governments
- **Player Mode** - Play as an agent yourself, making decisions each turn
- **Emergent Behavior** - Watch alliances form, strategies evolve, and power shift
- **Preset Scenarios** - Detailed simulations including the AI Race 2025 and Revolution Playbook
- **Event Injection** - Add external events to test how systems respond to shocks

## Preset Scenarios

### AI Race 2025
A realistic simulation of the current AI landscape with OpenAI, Anthropic, Google DeepMind, Meta, xAI, governments, and regulators. Models compute constraints, talent wars, lobbying dynamics, and capability feedback loops.

### Revolution Playbook
Simulate a grassroots movement using proven frameworks from successful revolutions (Otpor, Civil Rights, Solidarity). Track public support, resources, media attention, and regime responses.

## Getting Started

### Prerequisites

- Node.js 18+
- Anthropic API key ([get one here](https://console.anthropic.com/))

### Local Development

```bash
# Clone the repo
git clone https://github.com/yourusername/ai-power-simulator.git
cd ai-power-simulator

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/ai-power-simulator&env=ANTHROPIC_API_KEY&envDescription=Your%20Anthropic%20API%20key%20for%20Claude)

Or manually:

1. Push to GitHub
2. Import to [Vercel](https://vercel.com/new)
3. Add `ANTHROPIC_API_KEY` environment variable
4. Deploy

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Yes |

## How It Works

1. **Describe a scenario** - Define the world, agents, and dynamics
2. **Watch turns unfold** - Each turn, agents take strategic actions based on their goals
3. **See power shift** - Track how influence, resources, and capabilities change
4. **Inject events** - Add external shocks to test system resilience
5. **Play as an agent** - Enable player mode to make decisions yourself

## Tech Stack

- **Next.js 14** - React framework
- **Claude Haiku 4.5** - Fast AI responses via Anthropic API
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

## Project Structure

```
/app
  /api/simulation   # API routes
  page.tsx          # Main UI
/lib
  api.ts            # Anthropic SDK wrapper
  simulator.ts      # Core simulation logic
  world.ts          # State management
  prompts.ts        # AI prompts
  schemas.ts        # Structured output schemas
```

## License

MIT
