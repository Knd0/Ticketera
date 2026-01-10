import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';

@Component({
    selector: 'app-producer-dashboard',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule, BaseChartDirective],
    template: `
    <div class="container fade-in">
      <header class="dashboard-header">
        <div>
            <h1>Producer Dashboard</h1>
            <p class="subtitle">Manage your events and track performance.</p>
        </div>
        <a routerLink="/create-event" class="btn btn-primary glow-effect">+ Create New Event</a>
      </header>
      
      <div *ngIf="loading" class="loading-container">
          <div class="spinner"></div>
          <p>Loading dashboard data...</p>
      </div>

      <div *ngIf="!loading">
        <!-- Summary Stats & Charts -->
        <div class="stats-overview" *ngIf="events.length > 0">
           <div class="stat-card">
              <h3>Total Events</h3>
              <p class="stat-value">{{ events.length }}</p>
           </div>
           <div class="stat-card">
               <h3>Total Tickets Sold</h3>
               <p class="stat-value">{{ getTotalStats(events).sold }}</p>
           </div>
           <div class="stat-card">
               <h3>Estimated Revenue</h3>
               <p class="stat-value highlight">{{ getTotalStats(events).revenue | currency }}</p>
           </div>
        </div>

        <!-- Chart Section -->
        <div class="chart-section" *ngIf="events.length > 0">
            <div class="chart-header">
                <h3>Revenue Analytics</h3>
            </div>
            <div class="chart-wrapper">
                <canvas baseChart
                  [data]="barChartData"
                  [options]="barChartOptions"
                  [type]="'bar'">
                </canvas>
            </div>
        </div>

        <section class="events-section">
          <h2 class="section-title">Active Events</h2>
          <div class="events-grid">
              <div *ngFor="let event of activeEvents" class="event-card active-card">
                  <div class="card-header">
                      <h3 title="{{ event.title }}">{{ event.title }}</h3>
                      <span class="status-badge" [ngClass]="event.isVisible ? 'active' : 'hidden-badge'">
                          {{ event.isVisible ? 'Active' : 'Hidden' }}
                      </span>
                  </div>
                  <p class="event-date">
                     <i class="fas fa-calendar"></i> {{ event.date | date:'mediumDate' }} 
                     <span class="separator">•</span>
                     <i class="fas fa-clock"></i> {{ event.date | date:'shortTime' }}
                  </p>
                  <div class="event-stats">
                      <div class="stat-row">
                          <span>Tickets Sold</span>
                          <strong>{{ getEventStats(event).sold }}</strong>
                      </div>
                      <div class="stat-row">
                          <span>Revenue</span>
                          <span class="rev">{{ getEventStats(event).revenue | currency }}</span>
                      </div>
                  </div>
                  <div class="card-actions">
                     <button (click)="editEvent(event)" class="btn btn-outline full-width">
                        Edit / Manage Batches
                     </button>
                     <a [routerLink]="['/scanner']" class="btn btn-secondary full-width">Scanner</a>
                  </div>
              </div>
              <div *ngIf="activeEvents.length === 0" class="empty-state">
                  <p>No active events found. <a routerLink="/create-event">Create one now!</a></p>
              </div>
          </div>

          <h2 class="section-title mt-5">Past Events</h2>
          <div class="events-grid">
               <div *ngFor="let event of finishedEvents" class="event-card finished">
                  <div class="card-header">
                      <h3 title="{{ event.title }}">{{ event.title }}</h3>
                      <span class="status-badge finished">Finished</span>
                  </div>
                  <p class="event-date">{{ event.date | date:'mediumDate' }}</p>
                  <div class="event-stats">
                       <div class="stat-row">
                          <span>Final Sales</span>
                          <strong>{{ getEventStats(event).sold }}</strong>
                      </div>
                  </div>
                  <button (click)="editEvent(event)" class="btn btn-sm btn-outline full-width">View Details</button>
              </div>
              <div *ngIf="finishedEvents.length === 0" class="empty-state">No past events.</div>
          </div>
        </section>
      </div>

      <!-- Edit Modal -->
      <div class="modal-backdrop" *ngIf="editingEvent" (click)="cancelEdit()">
          <div class="modal-content" (click)="$event.stopPropagation()">
              <div class="modal-header">
                  <h2>Edit Event</h2>
                  <button class="close-btn" (click)="cancelEdit()">×</button>
              </div>

              <div class="modal-body">
                  <div class="form-group">
                      <label>Event Title</label>
                      <input [(ngModel)]="editingEvent.title" class="form-control large-input">
                  </div>
                  <div class="form-group">
                      <label>Description</label>
                      <textarea [(ngModel)]="editingEvent.description" class="form-control" rows="3"></textarea>
                  </div>
                  
                  <div class="form-group">
                      <label>Visibility</label>
                      <div class="toggle-container" style="align-items: flex-start; flex-direction: row;">
                           <label class="toggle-switch">
                               <input type="checkbox" [(ngModel)]="editingEvent.isVisible">
                               <span class="slider round"></span>
                           </label>
                           <span class="toggle-label" [class.danger]="!editingEvent.isVisible" style="font-size: 0.9rem;">
                               {{ editingEvent.isVisible ? 'Public (Visible)' : 'Hidden (Private)' }}
                           </span>
                      </div>
                  </div>

                  <div class="batches-section">
                      <div class="section-header-row">
                          <h3>Ticket Tiers & Batches</h3>
                          <button (click)="addBatch()" class="btn btn-sm btn-outline">+ Add Batch</button>
                      </div>
                      
                      <div class="batches-list">
                          <div *ngFor="let batch of editingEvent.batches" class="batch-edit-card" [class.sold-out-edit]="batch.isManualSoldOut">
                              
                              <div class="batch-grid">
                                  <div class="input-group name-col">
                                      <label>Tier Name</label>
                                      <input [(ngModel)]="batch.name" class="form-control" placeholder="e.g. VIP">
                                  </div>
                                  <div class="input-group">
                                      <label>Price ($)</label>
                                      <input type="number" [(ngModel)]="batch.price" class="form-control">
                                  </div>
                                  <div class="input-group">
                                      <label>Total Stock</label>
                                      <input type="number" [(ngModel)]="batch.totalQuantity" class="form-control">
                                  </div>
                              </div>

                              <div class="batch-footer">
                                  <div class="batch-stat">
                                      <span class="label">Sold so far:</span>
                                      <span class="value">{{ batch.soldQuantity }}</span>
                                  </div>
                                  
                                  <div class="batch-controls">
                                       <div class="date-control">
                                           <label>Sales End Date</label>
                                           <input type="datetime-local" [(ngModel)]="batch.salesEndDate" class="form-control compact">
                                       </div>

                                       <div class="toggle-container">
                                           <label class="toggle-switch">
                                               <input type="checkbox" [(ngModel)]="batch.isManualSoldOut">
                                               <span class="slider round"></span>
                                           </label>
                                           <span class="toggle-label" [class.danger]="batch.isManualSoldOut">
                                               {{ batch.isManualSoldOut ? 'Sold Out' : 'Available' }}
                                           </span>
                                       </div>
                                  </div>
                              </div>

                          </div>
                      </div>
                  </div>
              </div>

              <div class="modal-actions">
                  <span *ngIf="saving" class="saving-text"><div class="mini-spinner"></div> Saving changes...</span>
                  <div class="btn-group">
                      <button (click)="cancelEdit()" class="btn btn-text" [disabled]="saving">Cancel</button>
                      <button (click)="saveEvent()" class="btn btn-primary" [disabled]="saving">
                          Save Changes
                      </button>
                  </div>
              </div>
          </div>
      </div>

    </div>
  `,
    styles: [`
    /* General Layout */
    .container { margin-top: 2rem; max-width: 1200px; margin-left: auto; margin-right: auto; padding: 0 20px; padding-bottom: 4rem; }
    .fade-in { animation: fadeIn 0.4s ease-in; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .dashboard-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
    .dashboard-header h1 { margin: 0; font-size: 2rem; color: var(--text-main); letter-spacing: -0.5px; }
    .subtitle { color: var(--text-muted); margin: 0.5rem 0 0 0; font-size: 1rem; }

    /* Buttons */
    .btn { padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 500; cursor: pointer; transition: all 0.2s; border: none; font-size: 0.95rem; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
    .btn-primary { background: var(--primary); color: white; display: inline-block; }
    .btn-primary:hover { background: var(--primary-hover); transform: translateY(-1px); box-shadow: 0 0 15px rgba(99,102,241, 0.4); }
    
    .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text-muted); }
    .btn-outline:hover { border-color: var(--text-main); background: var(--surface-hover); color: var(--text-main); }
    
    .btn-secondary { background: var(--surface); color: var(--text-muted); border: 1px solid var(--border); }
    .btn-secondary:hover { background: var(--surface-hover); color: var(--text-main); }
    .btn-text { background: transparent; color: var(--text-muted); }
    .btn-text:hover { color: var(--text-main); }
    .full-width { width: 100%; }

    /* Stats */
    .stats-overview { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; margin-bottom: 2.5rem; }
    .stat-card { background: var(--surface); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border); box-shadow: var(--shadow); }
    .stat-card h3 { font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 0.5rem 0; font-weight: 600; }
    .stat-value { font-size: 2.2rem; font-weight: 700; color: var(--text-main); margin: 0; line-height: 1; }
    .stat-value.highlight { color: #10b981; text-shadow: 0 0 20px rgba(16, 185, 129, 0.2); }

    /* Charts */
    .chart-section { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin-bottom: 3rem; box-shadow: var(--shadow); }
    .chart-header { margin-bottom: 1rem; }
    .chart-header h3 { margin: 0; font-size: 1.1rem; color: var(--text-main); }
    .chart-wrapper { height: 320px; width: 100%; }

    /* Events Grid */
    .section-title { font-size: 1.4rem; color: var(--text-main); margin-bottom: 1.5rem; font-weight: 600; }
    .events-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px; }
    .mt-5 { margin-top: 3rem; }

    .event-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 1.5rem; transition: all 0.2s ease; position: relative; overflow: hidden; }
    .event-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); border-color: var(--primary); }
    .active-card { border-top: 4px solid var(--primary); }
    .finished { opacity: 0.6; background: #1e293b; border-color: #334155; }

    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
    .card-header h3 { margin: 0; font-size: 1.15rem; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
    
    .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .status-badge.active { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .status-badge.hidden-badge { background: rgba(99, 102, 241, 0.1); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.3); }
    .status-badge.finished { background: rgba(148, 163, 184, 0.2); color: #94a3b8; }

    .event-date { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px; }
    .separator { color: var(--border); }

    .event-stats { background: rgba(15, 23, 42, 0.5); border-radius: 8px; padding: 12px; margin-bottom: 1.2rem; border: 1px solid var(--border); }
    .stat-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.9rem; color: var(--text-muted); }
    .stat-row:last-child { margin-bottom: 0; }
    .rev { color: #10b981; font-weight: 600; }

    .card-actions { display: flex; gap: 10px; }

    .empty-state { grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--surface); border-radius: 12px; border: 2px dashed var(--border); color: var(--text-muted); }
    .empty-state a { color: var(--primary); font-weight: 600; }

    /* Modal - Premium Logic */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 2000; animation: fadeIn 0.2s; }
    .modal-content { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; width: 95%; max-width: 650px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.5); overflow: hidden; }
    
    .modal-header { padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: var(--surface); }
    .modal-header h2 { margin: 0; font-size: 1.5rem; color: var(--text-main); }
    .close-btn { background: none; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer; padding: 0; line-height: 1; }
    .close-btn:hover { color: var(--text-main); }

    .modal-body { padding: 2rem; overflow-y: auto; flex: 1; }
    
    .form-group { margin-bottom: 1.5rem; }
    .form-group label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.5px; }
    .form-control { width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem; color: var(--text-main); background: #0f172a; transition: all 0.2s; box-sizing: border-box; }
    .form-control:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2); }
    .large-input { font-size: 1.1rem; padding: 0.85rem 1rem; }

    /* Batches Section */
    .batches-section { margin-top: 2rem; border-top: 1px solid var(--border); padding-top: 1.5rem; }
    .section-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .section-header-row h3 { margin: 0; font-size: 1.1rem; color: var(--text-main); }

    .batch-edit-card { background: #0f172a; border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; transition: border-color 0.2s; position: relative; }
    .batch-edit-card:hover { border-color: var(--text-muted); }
    
    /* Sold Out Edit State */
    .batch-edit-card.sold-out-edit { 
        border-color: #ef4444; 
        background: rgba(239, 68, 68, 0.05); 
    }
    .batch-edit-card.sold-out-edit::after {
        content: 'SOLD OUT';
        position: absolute;
        top: 10px;
        right: 10px;
        background: #ef4444;
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: 700;
        pointer-events: none;
    }
    .batch-edit-card.sold-out-edit .input-group input:not([type="checkbox"]) {
        opacity: 0.5;
    }
    
    .batch-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 16px; margin-bottom: 1rem; }
    .name-col { grid-column: 1 / 2; }
    
    .input-group label { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px; }
    .input-group input { padding: 0.6rem; font-size: 0.9rem; }

    .batch-footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid var(--border); padding-top: 1rem; margin-top: 0.5rem; }
    .batch-stat { display: flex; flex-direction: column; }
    .batch-stat .label { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 2px; }
    .batch-stat .value { font-size: 1.1rem; font-weight: 700; color: var(--text-main); }

    .batch-controls { display: flex; align-items: center; gap: 20px; }
    
    .date-control { display: flex; flex-direction: column; }
    .date-control label { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px; }
    .compact { padding: 0.4rem; font-size: 0.8rem; width: auto; }

    /* Toggle */
    .toggle-container { display: flex; align-items: center; gap: 8px; flex-direction: column; }
    .toggle-label { font-size: 0.75rem; font-weight: 600; color: #10b981; }
    .toggle-label.danger { color: #ef4444; }
    
    .toggle-switch { position: relative; display: inline-block; width: 44px; height: 24px; }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--border); transition: .4s; border-radius: 34px; }
    .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    input:checked + .slider { background-color: #ef4444; }
    input:checked + .slider:before { transform: translateX(20px); }

    .modal-actions { padding: 1.5rem 2rem; background: var(--surface); border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
    .btn-group { display: flex; gap: 12px; }
    .saving-text { color: var(--text-muted); font-size: 0.9rem; display: flex; align-items: center; gap: 8px; }
    
    /* Loading Spinner */
    .loading-container { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem; color: var(--text-muted); }
    .spinner, .mini-spinner { border: 3px solid #334155; border-top: 3px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite; }
    .spinner { width: 40px; height: 40px; margin-bottom: 1rem; }
    .mini-spinner { width: 16px; height: 16px; border-width: 2px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  `]
})
export class ProducerDashboardComponent {
    http = inject(HttpClient);
    cdr = inject(ChangeDetectorRef); // Manually trigger change detection

    events: any[] = [];
    activeEvents: any[] = [];
    finishedEvents: any[] = [];
    loading = true;
    saving = false;

    // Chart Data
    public barChartData: ChartConfiguration<'bar'>['data'] = {
        labels: [],
        datasets: []
    };
    public barChartOptions: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' }
        }
    };

    // Edit State
    editingEvent: any = null;

    ngOnInit() {
        this.loadEvents();
    }

    loadEvents() {
        this.loading = true;
        // Force change detection just in case
        this.cdr.detectChanges();

        this.http.get<any[]>('http://localhost:3000/events/my/all').subscribe({
            next: (data) => {
                console.log('Events loaded:', data.length); // Debug
                this.events = data;
                this.processEvents();
                this.setupCharts();
                this.loading = false;
                this.cdr.detectChanges(); // Ensure UI updates
            },
            error: (err) => {
                console.error('Error loading events:', err);
                this.loading = false;
                this.cdr.detectChanges();
            }
        });
    }

    processEvents() {
        const now = new Date();
        this.activeEvents = this.events.filter(e => new Date(e.date) >= now);
        this.finishedEvents = this.events.filter(e => new Date(e.date) < now);
    }

    setupCharts() {
        const labels = this.events.map(e => e.title.substring(0, 15) + (e.title.length > 15 ? '...' : ''));
        const revenueData = this.events.map(e => this.getEventStats(e).revenue);
        const soldData = this.events.map(e => this.getEventStats(e).sold);

        this.barChartData = {
            labels: labels,
            datasets: [
                {
                    data: revenueData,
                    label: 'Revenue ($)',
                    backgroundColor: 'rgba(37, 99, 235, 0.7)',
                    hoverBackgroundColor: 'rgba(37, 99, 235, 1)',
                    borderRadius: 4
                },
                {
                    data: soldData,
                    label: 'Tickets Sold',
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    hoverBackgroundColor: 'rgba(16, 185, 129, 1)',
                    borderRadius: 4
                }
            ]
        };
        // Force chart update if needed, but binding should handle it
    }

    // Stats Helpers
    getTotalStats(events: any[]) {
        let sold = 0;
        let revenue = 0;
        events.forEach(e => {
            e.batches.forEach((b: any) => {
                sold += b.soldQuantity;
                revenue += (b.soldQuantity * Number(b.price));
            });
        });
        return { sold, revenue };
    }

    getEventStats(event: any) {
        let sold = 0;
        let revenue = 0;
        event.batches.forEach((b: any) => {
            sold += b.soldQuantity;
            revenue += (b.soldQuantity * Number(b.price));
        });
        return { sold, revenue };
    }

    // Actions
    addBatch() {
        if (!this.editingEvent.batches) this.editingEvent.batches = [];
        this.editingEvent.batches.push({
            name: '',
            price: 0,
            totalQuantity: 100,
            soldQuantity: 0,
            isManualSoldOut: false
        });
    }

    editEvent(event: any) {
        this.editingEvent = JSON.parse(JSON.stringify(event)); // Deep copy
    }

    cancelEdit() {
        this.editingEvent = null;
    }

    saveEvent() {
        if (!this.editingEvent) return;
        this.saving = true;
        this.cdr.detectChanges();

        this.http.post(`http://localhost:3000/events/${this.editingEvent.id}`, this.editingEvent)
            .subscribe({
                next: () => {
                    this.editingEvent = null;
                    this.saving = false;
                    this.loadEvents(); // Reload to show updates
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error(err);
                    alert('Error updating event');
                    this.saving = false;
                    this.cdr.detectChanges();
                }
            });
    }
}
