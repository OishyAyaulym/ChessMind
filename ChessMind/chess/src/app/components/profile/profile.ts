import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {
  @Output() play = new EventEmitter<void>();
  @Output() leaderboard = new EventEmitter<void>();
  @Output() signedOut = new EventEmitter<void>();

  profile: any = null;
  games: any[] = [];
  rank: number | null = null;
  loadingGames = true;
  isDarkMode = true;

  constructor(private supabase: SupabaseService, private cdr: ChangeDetectorRef) {}

  async ngOnInit() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    const { data: sessionData } = await this.supabase.supabase.auth.getSession();
    if (!sessionData.session) return;
    const userId = sessionData.session.user.id;
    this.profile = await this.supabase.getProfile(userId);
    this.cdr.detectChanges();
    await this.loadRank(userId);

    await this.loadGames(userId);
  }

  private async loadRank(userId: string) {
    const { data } = await this.supabase.supabase
      .from('profiles')
      .select('id')
      .or('wins.gt.0,losses.gt.0,draws.gt.0')
      .order('rating', { ascending: false })
      .limit(50);
    if (data) {
      const idx = data.findIndex((p: any) => p.id === userId);
      this.rank = idx !== -1 ? idx + 1 : null;
    }
    this.cdr.detectChanges();
  }

  private async loadGames(userId: string) {
    this.loadingGames = true;
    const { data, error } = await this.supabase.supabase
      .from('games')
      .select('id, created_at, winner, game_type, white_player')
      .eq('white_player', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) {
      this.games = data;
    }
    this.loadingGames = false;
    this.cdr.detectChanges();
  }

  getWinRate(): string {
    const total = this.getTotalGames();
    if (total === 0) return '0.0';
    return (((this.profile.wins || 0) / total) * 100).toFixed(1);
  }

  getTotalGames(): number {
    return (this.profile?.wins || 0) + (this.profile?.losses || 0) + (this.profile?.draws || 0);
  }

  getResultLabel(game: any): string {
    if (!game.winner) return 'Draw';
    const iWon = (game.white_player === this.profile?.id && game.winner === 'white')
               || (game.white_player !== this.profile?.id && game.winner === 'black');
    if (game.winner === 'draw') return 'Draw';
    return iWon ? 'Win' : 'Loss';
  }

  getResultClass(game: any): string {
    const label = this.getResultLabel(game);
    if (label === 'Win') return 'result-win';
    if (label === 'Loss') return 'result-loss';
    return 'result-draw';
  }

  getRatingChange(game: any): string {
    const label = this.getResultLabel(game);
    if (label === 'Win') return '+10';
    if (label === 'Loss') return '-8';
    return '+2';
  }

  getRatingChangeClass(game: any): string {
    const label = this.getResultLabel(game);
    if (label === 'Win') return 'change-positive';
    if (label === 'Loss') return 'change-negative';
    return 'change-neutral';
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  goPlay() { this.play.emit(); }
  goLeaderboard() { this.leaderboard.emit(); }

  async signOut() {
    await this.supabase.supabase.auth.signOut();
    this.signedOut.emit();
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    const theme = this.isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }
}