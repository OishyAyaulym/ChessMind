import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ChessAIService {
  private weights: Record<string, number> = {
    p: 10, n: 30, b: 30, r: 50, q: 90, k: 900
  };

  getNextMove(game: any, difficulty: string = 'medium'): { from: string; to: string; promotion?: string } {
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return { from: '', to: '' };

    if (difficulty === 'easy') {
      const m = moves[Math.floor(Math.random() * moves.length)];
      return { from: m.from, to: m.to, promotion: m.promotion };
    }

    let bestMove = moves[0];
    let bestValue = -99999;

    for (const move of moves) {
      game.move(move);
      let value = this.evaluateBoard(game.board(), difficulty);
      game.undo();

      value += Math.random() * 0.1;

      if (value > bestValue) {
        bestValue = value;
        bestMove = move;
      }
    }

    return { from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion };
  }

  private evaluateBoard(board: any[][], difficulty: string): number {
    let total = 0;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (!piece) continue;
        const value = this.weights[piece.type] || 0;
        total += piece.color === 'b' ? value : -value;
        if (difficulty === 'hard') {
          const centerBonus = (i >= 3 && i <= 4 && j >= 3 && j <= 4) ? 2 : 0;
          total += piece.color === 'b' ? centerBonus : -centerBonus;
        }
      }
    }
    return total;
  }
}