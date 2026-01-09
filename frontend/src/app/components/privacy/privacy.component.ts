import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './privacy.component.html',
  styles: [`
    .legal-container {
      max-width: 800px;
      margin: 4rem auto;
      padding: 0 1.5rem;
      color: #ddd;
      font-family: inherit;
    }
    h1 { font-size: 2.5rem; margin-bottom: 2rem; color: #fff; }
    h2 { font-size: 1.5rem; margin-top: 2rem; margin-bottom: 1rem; color: #fff; border-bottom: 1px solid #333; padding-bottom: 0.5rem; }
    p, ul { line-height: 1.6; margin-bottom: 1rem; color: #aaa; }
    ul { padding-left: 1.5rem; }
    li { margin-bottom: 0.5rem; }
  `]
})
export class PrivacyComponent {}
