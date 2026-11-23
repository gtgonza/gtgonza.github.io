# Between Bishops · Imported-game trainer (draft)

[Español](LEEME.md)

Paste one PGN from Chess.com, Lichess or another chess app. Enter your exact player name or choose your color. The app reads your game date, result and your own Elo, then analyzes only your moves with the local Stockfish engine. No account, generative model or paid API is required.

## The learning loop

1. **Import and review.** Your PGN and its metadata enter the game log. The engine evaluates the positions before and after each of your moves, with visible progress and cancellation. Completed calculations are saved, so reimporting a partial game resumes the missing work. Importing an already analyzed game reuses its record.
2. **Keep up to three useful moments.** Blunders, ordinary mistakes and missed opportunities can become puzzles. PGN annotations such as `$2`, `$4` or `$9` are ignored as verdicts: the app uses its own engine search. Positions already heavily lost are not selected. Repeated patterns are prioritized, with variety between categories. Large numerical changes in already winning positions are downweighted. If there are fewer than three useful errors, fewer puzzles are saved. An unchanged game never expands past three or resets its existing review history.
3. **Grow the bank.** Each puzzle retains its game, date, original position and move number, error type, source game Elo, attempts, hint use and review dates. The source game Elo is contextual information, not a calibrated puzzle rating.
4. **Train your personal streak.** Due puzzles and recurring weaknesses are prioritized at your current level. Current Elo comes from the most recent game by PGN date; importing an older game does not replace it. Unknown dates use import time. Puzzles from games over 400 Elo above the current reference are left out of the automatic queue but remain accessible in the bank.
5. **Review again later.** Clean completions when due schedule intervals of 1, 3, 7, 14, 30 and 60 days. Wrong attempts and hints reset the stage and bring the puzzle back after ten minutes. A later correct answer never deletes earlier failures. Extra practice before a review is due does not advance its schedule or add streak points.

## Puzzles and patterns

Puzzles start from a real decision in your imported game. The preceding opponent move is animated when available. The player solves up to two own moves below Elo 600, three below 1100 and four above, depending on the engine variation available. Opponent replies are calculated between steps. Sound alternatives within half a pawn of the best engine option are accepted. A forced winning mate is not penalized merely for taking a different number of moves.

A wrong move briefly colors its squares soft red and returns to the pending position. **Restart** does not erase the current run's earlier errors or hint use. **Hint** colors only the recommended piece blue. Successful completion does not change the original PGN. The bank displays a dated attempt/review log, with the most recent twelve events visible and the complete history retained in backups.

Pattern summaries include all evaluated errors, not just the three selected puzzles. Categories include king safety, exposed material, missed captures, calculation, mating chances, double attacks, opening decisions and forcing moves. Labels are rule-based, provisional interpretations of verified engine lines. One game is an initial signal; recurrence across multiple games is shown separately. This is not a scientifically calibrated diagnosis or Elo estimator.

The default search is about 850 ms per position; puzzle validation uses about 1300 ms per position. Labels and even counts can change with search depth. Inaccuracy starts at a 50-centipawn loss, mistake at 100 and blunder at 200. These are practical training thresholds. An import of 26 own moves may take roughly a minute depending on the device.

In a streak, the theme appears after the first attempt. A session mixes themes when possible and suggests one habit for the next game. The progress panel separates first encounters with the theme hidden from scheduled reviews. It compares up to five recent games with up to five earlier games by the same player and TimeControl. Puzzle length starts from source Elo guidance and can adjust by one step based on recent unassisted performance.

## Your data

The bank is stored in this browser's IndexedDB, with a localStorage fallback if IndexedDB is unavailable. Earlier prototype storage keys are preserved. Export JSON backups to keep or transfer games, puzzles, attempt logs and schedules. Restoring merges records without duplicating games or attempt IDs. This version has no cloud synchronization or account. Clearing browser/site data removes its local database. Current limits are 500 games, 1500 puzzles and a 100 MB backup import.

The English/Spanish flag button saves your language preference. No PGN data is sent to an external API. Source and assets still need to load before the app can run.

## Running and publication

Run `node preview-pages.cjs` from the project and open `http://127.0.0.1:8766/ajedrez/`. The app's public homepage link has been removed and its published entry page shows a maintenance notice. This redesigned version remains a draft until publication is requested.

## Licenses

Application: GPL-3.0. [Stockfish.js 19.0.1](https://github.com/nmrugg/stockfish.js/tree/v19.0.1): GPL-3.0, unchanged engine compilation from the npm package; corresponding source is linked at that version. See `vendor/STOCKFISH-LICENSE`. [chess.js 1.4.0](https://github.com/jhlywa/chess.js/tree/v1.4.0): BSD-2-Clause; see `vendor/CHESS-LICENSE`. Pieces and recolored bishop logo use Colin M. L. Burnett's Cburnett design, distributed here under GPL-3.0; see [piece credits](pieces/CREDITOS.md).
