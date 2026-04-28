import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Board } from './components/board/board';
import { Auth } from './components/auth/auth';
import { Leaderboard } from './components/leaderboard/leaderboard';
import { Profile } from './components/profile/profile';
import { SupabaseService } from './services/supabase.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Board, CommonModule, Auth, Leaderboard, Profile],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  currentView: 'play' | 'leaderboard' | 'profile' = 'play';

  constructor(public supabase: SupabaseService, private ngZone: NgZone) {}

  async ngOnInit() {
    const { data } = await this.supabase.supabase.auth.getSession();
    this.supabase.sessionActive.set(!!data.session);

    this.supabase.supabase.auth.onAuthStateChange((event, session) => {
      this.ngZone.run(() => {
        this.supabase.sessionActive.set(!!session);
        if (session) {
          this.currentView = 'play';
        }
      });
    });
  }

  onSignedOut() {
    this.supabase.sessionActive.set(false);
    this.currentView = 'play';
  }
}