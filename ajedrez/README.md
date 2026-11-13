# Between Bishops · Learn from your mistakes

[Español](LEEME.md)

A chess opponent and trainer built around your own mistakes. This static HTML, CSS, JavaScript and WebAssembly app runs on GitHub Pages without an application server.

## Play, review, solve

Every new game starts from the standard initial position. Your color is random. Both sides have ten minutes with no increment and no takebacks. The opponent's clock includes engine calculation, the hidden review of your last move and API waiting time. Closing or refreshing the page loses the active game.

**Thinking…** appears in a clear neutral banner above the board. Pieces animate between squares, including the rook when castling. Reduced-motion preferences are respected.

Stockfish analyzes your moves while the opponent thinks. Results stay hidden during play. When the game ends, choose **Review game** or **Play again**. No written self-assessment is required. The review reuses saved analysis and shows real processing stages up to 100%; missing analyses are retried if necessary. A generative explanation may still require an API wait.

The review counts blunders, mistakes and inaccuracies, explains what to look for next time and selects up to three moments for puzzles. The first detected error is included. These labels use short engine searches and are approximate: inaccuracies start at 50 centipawns, mistakes at 100 and blunders at 200.

Each puzzle tells you how many of your moves to solve, from one to four depending on the available legal variation. The preceding opponent move is shown first when one exists. Sound alternatives within half a pawn of the best engine option are accepted; the opponent replies between steps. A wrong move briefly colors its origin and destination soft red and returns to the pending step. **Restart puzzle** returns to the beginning without deleting attempts. **Hint** highlights the recommended piece in blue without revealing its destination. Attempts using a hint are marked. Completing a puzzle never erases earlier failures or changes the original game.

## Opponents and adaptive learning

- **Generative AI (uses tokens):** OpenAI, Gemini or Claude chooses among engine-verified candidates. The app does not accept arbitrary or illegal model moves.
- **No GPT connection (free):** the local Stockfish engine plays and analyzes without a paid API. Files still need to load before the app starts.

Choose a reference Elo or request a rough estimate after playing. At least eight evaluated moves of yours are required for an estimate. This experimental practice index is not calibrated to official, Chess.com or Lichess Elo. Opponent candidates are kept within the existing evaluation tolerance; deliberate gifts are not added.

Reviewed errors build a browser-local profile of approximate patterns: king safety, exposed pieces, finding captures and calculating replies. A new opponent game can prioritize a pattern due for review among already-filtered sound candidates. The generative opponent receives the goal and verified signals; the local opponent uses rules. A useful opportunity is not guaranteed to occur.

Only concrete, observed opportunities are scored after a game. Two good responses without new errors of that pattern can space the next review by 1, 3, 7, 14, 30 or 60 days. A failure prioritizes it again after ten minutes. No improvement is credited without enough opportunities or merely for winning. Puzzle attempts are tracked separately. These indicators and intervals are experimental and need calibration.

## Language, data and API costs

English is the initial language. Click the flag button (**EN / ES**) in the header to switch between English and Spanish. The preference is saved in this browser. Local reviews and puzzle feedback are available in both languages. AI explanations are requested in the selected language. Switching languages does not make a paid request: if a generated review exists only in the other language, the local engine review is shown instead.

Your mistake journal, training profile and practice index remain in this browser. They are not synced and are lost if site data is cleared. A language change preserves them. Download the game's PGN to keep its moves. Historical personal notes stay in the language in which they were written.

Every person uses their own provider API key. It stays in session memory, is sent directly to the selected provider and is never published or stored by this site. Changing providers requires the appropriate key. Board positions and notes are sent to the provider only when an AI feature is used.

The estimated budget defaults to US$0.02 per game. Before requesting the API the app reserves a conservative amount, then records reported token use. Missing usage or a failed request is charged conservatively against the local estimate. Paid requests are never automatically retried. This browser limit is not a provider billing cap and does not limit other apps using the same key. Model availability, browser access, quotas and provider billing depend on your account. Use the official catalog links in settings for current details.

## Engine and licenses

Stockfish 19 lite single-threaded runs in a Web Worker. A normal opponent turn uses about 1,100 ms for the position before your move and 950 ms for the resulting position and candidates. Puzzle searches use about 1,800 ms per position; hint analysis is reused for the next attempt. The app needs a modern browser with WebAssembly, Web Workers and HTTPS access to your selected API.

Application code: GPL-3.0. [Stockfish.js 19.0.1](https://github.com/nmrugg/stockfish.js/tree/v19.0.1): GPL-3.0, unchanged engine compilation from the npm package; corresponding source is linked at that version. See `vendor/STOCKFISH-LICENSE`. [chess.js 1.4.0](https://github.com/jhlywa/chess.js/tree/v1.4.0): BSD-2-Clause; see `vendor/CHESS-LICENSE`.

The pieces use Colin M. L. Burnett's Cburnett design. The bishop logo adapts its colors. Distributed here under GPL-3.0; see [piece credits](pieces/CREDITOS.md).

Provider contracts are tested with simulated responses and do not prove live account access. Pedagogical quality and the adaptive rules still need validation over many real games.
