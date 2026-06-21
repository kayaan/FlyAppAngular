import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthStore } from '../../../features/auth/store/auth.store';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {

  readonly authStore = inject(AuthStore);

  constructor() {
    this.authStore.loadMe();
  }
}