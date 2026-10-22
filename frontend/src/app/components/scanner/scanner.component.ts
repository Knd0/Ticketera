import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="scanner-container">
      <h2 class="title">Control de acceso</h2>
      <p class="hint" *ngIf="!scanResult">Apuntá la cámara al QR de la entrada. Cada entrada se puede usar una sola vez.</p>
      
      <div id="reader" class="scanner-box"></div>

      <div *ngIf="scanResult" class="result-box"
           [class.valid]="scanResult.valid"
           [class.invalid]="!scanResult.valid">
        <div class="result-icon">{{ scanResult.valid ? '✅' : '⛔' }}</div>
        <h3 class="result-title">{{ scanResult.message }}</h3>
        <div *ngIf="scanResult.data" class="result-details">
          <p *ngIf="scanResult.data.holder"><strong>Titular:</strong> {{ scanResult.data.holder }}</p>
          <p *ngIf="scanResult.data.event"><strong>Evento:</strong> {{ scanResult.data.event }}</p>
          <p *ngIf="scanResult.data.tier"><strong>Entrada:</strong> {{ scanResult.data.tier }}</p>
        </div>
        <button (click)="resetScan()" class="btn-reset">Escanear la siguiente</button>
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
    .title { text-align: center; margin-bottom: 0.5rem; font-size: 1.5rem; }
    .hint { text-align: center; color: #94a3b8; margin-bottom: 1rem; }
    .result-icon { font-size: 3.5rem; }
    .scanner-box { margin-bottom: 1.5rem; border: 1px solid #334155; border-radius: 8px; background: #fff; color: #111; overflow: hidden; }
    
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
      this.http.get<any>(`${environment.apiUrl}/tickets/validate/${encodeURIComponent(token)}`).subscribe({
          next: (res) => {
              this.scanResult = res;
              // Vibración distinta para entrada válida o rechazada (útil con ruido en la puerta).
              navigator.vibrate?.(res.valid ? 120 : [80, 60, 80, 60, 200]);
          },
          error: (err) => {
              this.scanResult = { valid: false, message: err?.status === 0 ? 'Sin conexión: revisá internet y volvé a escanear' : 'No se pudo validar la entrada' };
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
