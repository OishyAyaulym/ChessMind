import { Component, NgZone, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class Auth implements OnInit {
  @Output() loginSuccess = new EventEmitter<void>();
  isLogin = true;
  showAuthForm = false;
  showEmailConfirm = false;
  email = '';
  password = '';
  username = '';
  fullName = '';
  country = 'Kazakhstan';
  loading = false;
  message = '';
  messageClass = '';
  isDarkMode = true;

  constructor(
    private supabase: SupabaseService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }

  openForm(loginMode: boolean) {
    this.isLogin = loginMode;
    this.showAuthForm = true;
    this.showEmailConfirm = false;
    this.message = '';
  }

  resetToLanding() {
    this.showAuthForm = false;
    this.showEmailConfirm = false;
    this.message = '';
  }

  switchToLogin() {
    this.isLogin = true;
    this.showEmailConfirm = false;
    this.showAuthForm = true;
    this.message = '';
    this.password = '';
  }

  async handleAuth(event?: Event) {
    if (event) event.preventDefault();
    this.loading = true;
    this.message = '';
    this.cdr.detectChanges();
    try {
      if (this.isLogin) {
        //SIGN IN
        console.log('Attempting sign in...');
        const { data, error } = await this.supabase.signIn(this.email, this.password);
        console.log('Sign in result:', { data, error });
        if (error) throw error;
        if (data.session) {
          this.ngZone.run(() => {
            this.loginSuccess.emit();
          });
        } else {
          this.message = 'Please confirm your email before logging in.';
          this.messageClass = 'error-text';
        }
      } else {
        //SIGN UP
        console.log('Attempting sign up...');
        if (!this.username.trim()) {
          throw { message: 'Username is required' };
        }
        const { data, error } = await this.supabase.signUp(
          this.email, this.password, this.username, this.country, this.fullName
        );
        console.log('Sign up result:', { data, error });
        if (error) throw error;
        this.message = 'Account created! Check your email and confirm your registration.';
        this.messageClass = 'success-text';
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      this.message = error.message || 'An error occurred. Please try again.';
      this.messageClass = 'error-text';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    const theme = this.isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }
}