import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="scanner-container">
      <h2 class="title">Ticket Scanner</h2>
      
      <div id="reader" class="scanner-box"></div>

      <div *ngIf="scanResult" class="result-box"
           [class.valid]="scanResult.valid"
           [class.invalid]="!scanResult.valid">
        <h3 class="result-title">{{ scanResult.message }}</h3>
        <div *ngIf="scanResult.data" class="result-details">
          <p><strong>Holder:</strong> {{ scanResult.data.holder }}</p>
          <p><strong>Event:</strong> {{ scanResult.data.event }}</p>
          <p><strong>Tier:</strong> {{ scanResult.data.tier }}</p>
        </div>
        <button (click)="resetScan()" class="btn-reset">Scan Next</button>
      </div>
    </div>
  `,
  styles: [`
    .scanner-container { 
        max-width: 600px; 
        margin: 2rem auto; 
        padding: 1rem;
        min-height: 80vh; 
    }
    .title { text-align: center; margin-bottom: 1rem; font-size: 1.5rem; }
    .scanner-box { margin-bottom: 1.5rem; border: 1px solid #ddd; radius: 8px; overflow: hidden; }
    
    .result-box {
        padding: 1.5rem;
        border-radius: 8px;
        text-align: center;
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
    }
    .valid { background-color: #dcfce7; color: #166534; border-color: #bbf7d0; }
    .invalid { background-color: #fee2e2; color: #991b1b; border-color: #fecaca; }

    .result-title { margin-bottom: 0.5rem; font-size: 1.25rem; font-weight: bold; }
    .result-details { text-align: left; background: rgba(255,255,255,0.5); padding: 1rem; border-radius: 4px; margin-top: 0.5rem; }
    
    .btn-reset {
        margin-top: 1rem;
        background-color: #475569;
        color: white;
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    .btn-reset:hover { background-color: #334155; }
  `]
})
export class ScannerComponent implements OnInit, OnDestroy {
  scanner: any;
  scanResult: any = null;
  isScanning = true;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.startScanner();
  }

  startScanner() {
    // Timeout to ensure DOM is ready
    setTimeout(() => {
        this.scanner = new Html5QrcodeScanner(
          "reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );
        this.scanner.render(this.onScanSuccess.bind(this), this.onScanFailure.bind(this));
    }, 100);
  }

  onScanSuccess(decodedText: string, decodedResult: any) {
    if (!this.isScanning) return;
    
    console.log(`Scan result: ${decodedText}`, decodedResult);
    this.isScanning = false;
    this.scanner.clear();

    // Call Backend
    this.validateTicket(decodedText);
  }

  onScanFailure(error: any) {
    // handle scan failure, usually better to ignore and keep scanning.
    // console.warn(`Code scan error = ${error}`);
  }

  validateTicket(token: string) {
      this.http.get<any>(`http://localhost:3000/tickets/validate/${token}`).subscribe({
          next: (res) => {
              this.scanResult = res;
          },
          error: (err) => {
              this.scanResult = { valid: false, message: 'Network Error or Invalid Response' };
              console.error(err);
          }
      });
  }

  resetScan() {
    this.scanResult = null;
    this.isScanning = true;
    this.startScanner();
  }

  ngOnDestroy() {
      if (this.scanner) {
          this.scanner.clear();
      }
  }
}
