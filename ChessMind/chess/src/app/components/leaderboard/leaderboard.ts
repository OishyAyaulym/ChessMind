import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.css',
})
export class Leaderboard implements OnInit {
  @Output() back = new EventEmitter<void>();
  @Output() signedOut = new EventEmitter<void>();
  @Output() goProfile = new EventEmitter<void>();

  players: any[] = [];
  loading = true;
  errorMsg = '';
  currentUserId: string | null = null;
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
    const { data } = await this.supabase.supabase.auth.getSession();
    if (data.session) {
      this.currentUserId = data.session.user.id;
    }
    await this.loadLeaderboard();
  }

  onProfile() {
    this.goProfile.emit();
  }
  async loadLeaderboard() {
    this.loading = true;
    this.errorMsg = '';
    this.cdr.detectChanges();
    try {
      const { data, error } = await this.supabase.supabase
        .from('profiles')
        .select('id, username, country, rating, wins, losses, draws')
        .or('wins.gt.0,losses.gt.0,draws.gt.0')
        .order('rating', { ascending: false })
        .limit(50);
      if (error) {
        console.error('Leaderboard error:', error);
        this.errorMsg = error.message;
        this.players = [];
      } else {
        this.players = data || [];
      }
    } catch (e: any) {
      this.errorMsg = 'Unexpected error.';
      this.players = [];
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  getWinRate(player: any): string {
    const total = (player.wins || 0) + (player.losses || 0) + (player.draws || 0);
    if (total === 0) return '0.0';
    return ((player.wins / total) * 100).toFixed(1);
  }

  goBack() { this.back.emit(); }

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