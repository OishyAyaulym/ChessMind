import {
  Component, ElementRef, AfterViewInit, ViewChild, OnDestroy,
  OnInit, Output, EventEmitter, ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chessground } from 'chessground';
import { Api } from 'chessground/api';
import { Key } from 'chessground/types';
import { Chess } from 'chess.js';
import { SupabaseService } from '../../services/supabase.service';
import { ChessAIService } from '../../services/chess-ai.service';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './board.html',
  styleUrl: './board.css',
})
export class Board implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('boardContainer') boardContainer!: ElementRef;
  @ViewChild('moveListEl') moveListEl!: ElementRef;
  @Output() goLeaderboard = new EventEmitter<void>();
  @Output() signedOut = new EventEmitter<void>();
  @Output() goProfile = new EventEmitter<void>();

  private cgApi?: Api;
  private chess = new Chess();

  gameMode: 'pvp' | 'ai' = 'pvp';
  difficulty = 'medium';
  currentTurn: 'white' | 'black' = 'white';
  isDarkMode = true;
  moveHistory: string[] = [];
  gameOver = false;
  gameStarted = false;
  statusMessage = '';
  aiThinking = false;
  profile: any = null;
  userId: string | null = null;

  get movePairs(): [string, string?][] {
    const pairs: [string, string?][] = [];
    for (let i = 0; i < this.moveHistory.length; i += 2) {
      pairs.push([this.moveHistory[i], this.moveHistory[i + 1]]);
    }
    return pairs;
  }

  constructor(
    private supabase: SupabaseService,
    private aiService: ChessAIService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  async ngOnInit() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    const { data } = await this.supabase.supabase.auth.getSession();
    if (data.session) {
      this.userId = data.session.user.id;
      this.profile = await this.supabase.getProfile(this.userId!);
      this.cdr.detectChanges();
    }
  }

  ngAfterViewInit() {
    this.initBoard();
  }

  ngOnDestroy() {}

  onProfile() {
    this.goProfile.emit();
  }

  private initBoard() {
    this.cgApi = Chessground(this.boardContainer.nativeElement, {
      orientation: 'white',
      fen: this.chess.fen(),
      movable: {
        free: false,
        color: this.gameStarted ? 'white' : undefined, 
        dests: this.gameStarted ? this.getValidDests() : new Map(),
      },
      highlight: { lastMove: true, check: true },
      animation: { enabled: true, duration: 200 },
      events: {
        move: (orig, dest) => {
          this.ngZone.run(() => this.onMove(orig, dest));
        },
      },
    });
  }

  private getValidDests(): Map<Key, Key[]> {
    const dests = new Map<Key, Key[]>();
    this.chess.moves({ verbose: true }).forEach((m: any) => {
      const ms = dests.get(m.from as Key) || [];
      ms.push(m.to as Key);
      dests.set(m.from as Key, ms);
    });
    return dests;
  }

  private onMove(orig: Key, dest: Key) {
    if (!this.gameStarted || this.gameOver) {
      this.cgApi?.set({ fen: this.chess.fen() });
      return;
    }
    if (this.gameMode === 'ai' && this.aiThinking) return;
    const piece = this.chess.get(orig as any);
    let promotion: 'q' | undefined;
    if (piece?.type === 'p') {
      const rank = dest[1];
      if ((piece.color === 'w' && rank === '8') || (piece.color === 'b' && rank === '1')) {
        promotion = 'q';
      }
    }
    const move = this.chess.move({ from: orig as any, to: dest as any, promotion });
    if (!move) return;
    this.moveHistory = [...this.moveHistory, move.san];
    this.currentTurn = this.chess.turn() === 'w' ? 'white' : 'black';
    this.scrollMoveList();
    if (this.checkGameOver()) {
      this.cdr.detectChanges();
      return;
    }
    if (this.gameMode === 'pvp') {
      this.cgApi?.set({
        orientation: this.currentTurn,
        turnColor: this.currentTurn,
        movable: {
          color: this.currentTurn,
          dests: this.getValidDests(),
        },
      });
      this.cdr.detectChanges();
    } else {
      this.aiThinking = true;
      this.statusMessage = '🤖 AI is thinking...';
      this.cgApi?.set({ movable: { color: undefined } });
      this.cdr.detectChanges();
      setTimeout(() => {
        this.ngZone.run(() => this.runAiMove());
      }, 400);
    }
  }

  private runAiMove() {
    const aiMove = this.aiService.getNextMove(this.chess, this.difficulty);
    if (!aiMove.from) {
      this.aiThinking = false;
      return;
    }
    this.applyAiMove(aiMove.from, aiMove.to, aiMove.promotion as any);
  }

  private applyAiMove(from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') {
    const move = this.chess.move({ from: from as any, to: to as any, promotion: promotion || 'q' });
    if (!move) {
      this.aiThinking = false;
      return;
    }
    this.moveHistory = [...this.moveHistory, move.san];
    this.currentTurn = 'white';
    this.scrollMoveList();
    this.cgApi?.move(from as Key, to as Key);
    this.cgApi?.set({
      turnColor: 'white',
      movable: {
        color: 'white',
        dests: this.getValidDests(),
      },
    });
    this.aiThinking = false;
    this.statusMessage = '';
    this.checkGameOver();
    this.cdr.detectChanges();
  }

  private checkGameOver(): boolean {
    if (this.chess.isCheckmate()) {
      let result: 'win' | 'loss';
      const winner = this.chess.turn() === 'w' ? 'Black' : 'White';
      if (this.gameMode === 'pvp') {
        this.statusMessage = `🎉 Checkmate! ${winner} wins!`;
        result = this.chess.turn() === 'b' ? 'win' : 'loss'; 
      } else {
        const playerWon = this.chess.turn() === 'b'; 
        this.statusMessage = playerWon ? '🎉 Checkmate! You win!' : '💀 Checkmate! AI wins.';
        result = playerWon ? 'win' : 'loss';
      }
      if (this.userId) {
        this.supabase.recordGame(this.userId, result, this.chess.pgn(), this.gameMode);
        this.refreshProfile();
      }
      this.gameOver = true;
      this.cgApi?.set({ movable: { color: undefined } });
      return true;
    }
    if (this.chess.isDraw()) {
      this.statusMessage = '🤝 Draw!';
      this.gameOver = true;
      this.cgApi?.set({ movable: { color: undefined } });
      if (this.userId) {
        this.supabase.recordGame(this.userId, 'draw', this.chess.pgn(), this.gameMode);
        this.refreshProfile();
      }
      return true;
    }
    if (this.chess.inCheck()) {
      this.statusMessage = '⚠️ Check!';
    } else {
      this.statusMessage = '';
    }
    return false;
  }

  newGame() {
    this.gameStarted = true; 
    this.chess.reset();
    this.moveHistory = [];
    this.gameOver = false;
    this.statusMessage = 'Game started! Good luck.';
    this.cgApi?.set({
      fen: this.chess.fen(),
      orientation: 'white',
      movable: {
        color: 'white',
        dests: this.getValidDests(),
      },
    });
    this.cdr.detectChanges();
  }

  undoMove() {
    if (this.aiThinking || this.moveHistory.length === 0) return;
    if (this.gameMode === 'ai') {
      this.chess.undo();
      if (this.chess.turn() === 'b') this.chess.undo();
      this.moveHistory = this.moveHistory.slice(0, -2);
    } else {
      this.chess.undo();
      this.moveHistory = this.moveHistory.slice(0, -1);
    }
    this.gameOver = false;
    this.statusMessage = '';
    this.currentTurn = this.chess.turn() === 'w' ? 'white' : 'black';
    this.cgApi?.set({
      fen: this.chess.fen(),
      orientation: this.gameMode === 'pvp' ? this.currentTurn : 'white',
      turnColor: this.currentTurn,
      movable: {
        color: this.gameMode === 'pvp' ? this.currentTurn : 'white',
        dests: this.getValidDests(),
      },
    });
    this.cdr.detectChanges();
  }

  resign() {
    if (!this.gameStarted || this.gameOver) return;
    this.gameOver = true;
    this.gameStarted = false; 
    this.statusMessage = this.gameMode === 'ai' 
      ? '🏳️ You resigned. AI wins.' 
      : '🏳️ You resigned. Opponent wins.';
    this.cgApi?.set({ viewOnly: true }); 
    if (this.userId) {
      this.supabase.recordGame(this.userId, 'loss', this.chess.pgn());
      this.refreshProfile(); 
    }
    this.cdr.detectChanges();
  }

  changeDifficulty() { this.newGame(); }
  onGameModeChange() { this.newGame(); }
  goToLeaderboard() { this.goLeaderboard.emit(); }

  async signOut() {
    await this.supabase.supabase.auth.signOut();
    this.signedOut.emit();
  }

  private async refreshProfile() {
    if (this.userId) {
      this.profile = await this.supabase.getProfile(this.userId);
      this.cdr.detectChanges();
    }
  }

  private scrollMoveList() {
    setTimeout(() => {
      if (this.moveListEl?.nativeElement) {
        this.moveListEl.nativeElement.scrollTop = this.moveListEl.nativeElement.scrollHeight;
      }
    }, 50);
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    const theme = this.isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }
}