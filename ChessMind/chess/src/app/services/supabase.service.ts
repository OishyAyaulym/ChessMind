import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/enrivonment.prod';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  public supabase: SupabaseClient;
  public sessionActive = signal<boolean>(false);
  constructor() {
    this.supabase = createClient('https://livvwohgnlkfqapxfutq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpdnZ3b2hnbmxrZnFhcHhmdXRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNjk5MDYsImV4cCI6MjA5Mjc0NTkwNn0.AxKUMYDvoDHa6jc54V_C3uiWtTIIvpQuo2E8GzOxU-A');
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.sessionActive.set(!!session);
    });
  }

  async signUp(
    email: string,
    password: string,
    username: string,
    country: string,
    fullName: string
  ) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, full_name: fullName, country },
      },
    });
    if (error) return { data, error };
    if (data?.user) {
      const { error: profileError } = await this.supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          username: username.trim(),
          full_name: fullName.trim() || username.trim(),
          email: email.toLowerCase().trim(),
          country: country,
          rating: 1200,
          wins: 0,
          losses: 0,
          draws: 0,
          avatar_url: '',
        });
      if (profileError) {
        console.error('Profile creation error:', profileError.message);
      }
    }
    return { data, error: null };
  }

  async signIn(email: string, password: string) {
    return await this.supabase.auth.signInWithPassword({ email, password });
  }

  async getProfile(userId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Get profile error:', error.message);
      return null;
    }
    return data;
  }

  async recordGame(userId: string, result: 'win' | 'loss' | 'draw', pgn: string, gameType: string = 'pvp') {
    await this.supabase.from('games').insert({
      white_player: userId,
      black_player: null,
      winner: result === 'win' ? 'white' : result === 'loss' ? 'black' : 'draw',
      pgn: pgn,
      game_type: gameType,
    });
    const profile = await this.getProfile(userId);
    if (!profile) return;
    const update: any = { updated_at: new Date().toISOString() };
    if (result === 'win') {
      update.wins = (profile.wins || 0) + 1;
      update.rating = (profile.rating || 1200) + 10;
    } else if (result === 'loss') {
      update.losses = (profile.losses || 0) + 1;
      update.rating = Math.max(100, (profile.rating || 1200) - 8);
    } else {
      update.draws = (profile.draws || 0) + 1;
      update.rating = (profile.rating || 1200) + 2;
    }
    const { error } = await this.supabase
      .from('profiles')
      .update(update)
      .eq('id', userId);

    if (error) console.error('Profile update error:', error.message);
  }
}