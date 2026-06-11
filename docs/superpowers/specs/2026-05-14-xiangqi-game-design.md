# Xiangqi Game Design

## Goal

Build a pure frontend Chinese chess game where the player plays red against a built-in computer opponent. The first version should feel complete as an offline single-player web app while keeping the data model clean enough for future online sharing or cloud save features.

## Decisions

- Platform: pure frontend single-page app.
- Stack: React, TypeScript, and Vite.
- Gameplay: human vs AI, player controls red and moves first.
- AI level: moderate challenge using shallow search, not a full-strength engine.
- Layout: centered play table with the board as the main focus.
- Visual style: modern Chinese-inspired design with warm paper or wood tones, ink green, and red accents.
- Scope posture: offline first, but state should be serializable for future online features.

## Architecture

The app is split into three primary layers.

The game core owns board state, turn state, move history, captured pieces, check status, win/loss status, undo, restart, and legal move generation. It does not depend on React components and can be tested independently.

The AI core reads legal moves from the game core, searches cloned positions, and returns the best move. It must never mutate the live game state during search.

The UI layer renders the centered board, status display, controls, captured pieces, and move list. It dispatches player actions into the game reducer and asks the AI for a move after the player completes a legal move.

## Data Model

Use a 10 by 9 board model. Each piece has:

- A unique id.
- A side: red or black.
- A type: king, advisor, elephant, horse, rook, cannon, pawn.
- A position with row and column.

Game state contains:

- Board contents.
- Current side to move.
- Move history.
- Captured pieces.
- Last move.
- Selected piece.
- Legal targets for the selected piece.
- Check and game-over status.
- AI difficulty setting.

The state must be serializable to JSON so a future version can create share links or send the game state to a backend without changing the rules engine.

## Rules

Move generation happens in two phases.

First, generate pseudo-legal moves for each piece according to Chinese chess movement rules: rook, horse, cannon, elephant, advisor, king, and pawn.

Second, filter pseudo-legal moves into legal moves by rejecting any move that leaves the moving side in check. This legality layer must also handle the facing kings rule.

The first version should support:

- Legal move highlighting.
- Capture handling.
- Check detection.
- Game-over detection when a side has no legal response or the king is captured according to the chosen internal model.
- Undo by one full human/AI round.
- Restart from the initial position.

## AI

The AI controls black. It uses minimax with alpha-beta pruning at 2 or 3 plies for the default difficulty.

The evaluation function includes:

- Material value by piece type.
- Capture value.
- Pawn advancement, especially after crossing the river.
- King safety.
- Check opportunities.

The UI should show that the computer is thinking and apply a short delay before the AI move is committed. This keeps the experience readable even when the search returns quickly.

## User Experience

The player selects a red piece by clicking it. The board highlights legal target squares. Clicking a highlighted square applies the move. The latest move marks both source and destination.

The main screen uses a centered play table:

- Top area: red player, current turn, black AI status.
- Center: board.
- Bottom or collapsible area: controls, move list, and captured pieces.

Controls include:

- Undo.
- Restart.
- Difficulty selection for the built-in AI.

Status feedback includes:

- Player turn.
- AI thinking.
- Check.
- Win or loss.

The first version uses click-to-move rather than drag-and-drop. Dragging and move animation can be added later without changing the core rules.

## Persistence

The game runs offline and stores lightweight local state in the browser. Local storage can save:

- Current game state.
- AI difficulty setting.
- Basic UI preferences.

No login, server, leaderboard, or online matchmaking is included in the first version.

## Suggested File Structure

```text
src/
  app/
    App.tsx
    gameReducer.ts
  game/
    types.ts
    initialState.ts
    moveGeneration.ts
    legality.ts
    applyMove.ts
    notation.ts
  ai/
    evaluate.ts
    search.ts
  components/
    Board.tsx
    Piece.tsx
    GameStatus.tsx
    MoveList.tsx
    CapturedPieces.tsx
    GameControls.tsx
  storage/
    localSave.ts
  styles/
    theme.css
```

## Testing Strategy

Unit tests should focus on the game core and AI.

Rules tests:

- Each piece generates correct basic moves.
- Horse leg blocking works.
- Cannon screen capture works.
- Elephant cannot cross the river.
- Advisor and king stay inside the palace.
- Pawns move correctly before and after crossing the river.
- Facing kings are illegal.
- A side cannot make a move that leaves its own king in check.

Game flow tests:

- Captures update board state and captured pieces.
- Last move is recorded.
- Undo removes the player's move and the AI response.
- Restart restores the initial position.
- Check and game-over states are detected.

AI tests:

- AI only returns legal moves.
- AI prefers capturing a high-value piece when the choice is obvious.
- AI responds to check with a legal defensive move.
- Search does not mutate the original game state.

UI tests can be lighter and cover the main user flow: select piece, see legal targets, move, wait for AI, undo, and restart.

## First Version Scope

Included:

- Human vs AI game.
- Player red, AI black.
- Moderate AI using 2 to 3 ply search.
- Legal move highlights.
- Last move marker.
- Move list.
- Captured pieces.
- Check and win/loss messages.
- Undo by one full round.
- Restart.
- Local save for settings and the latest game.
- Offline pure frontend operation.

Excluded:

- Online multiplayer.
- Accounts.
- Leaderboards.
- Cloud save.
- Share links.
- Full replay analysis.
- Full standard Chinese chess notation.
- Multiple visual themes.
- Sound effects.

## Open Extension Points

Future online features can be added by serializing game state and move history. Future stronger AI can replace or extend the search and evaluation modules without changing UI components. Future replay or analysis features can build on the existing move history and notation module.
