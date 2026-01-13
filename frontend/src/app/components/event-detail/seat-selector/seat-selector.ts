import { Component, Input, Output, EventEmitter, inject, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-seat-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seat-selector.html',
  styleUrl: './seat-selector.css'
})
export class SeatSelectorComponent {
  @Input() batchId!: string;
  @Output() selectionChange = new EventEmitter<any[]>();

  http = inject(HttpClient);
  seats: any[] = [];
  selectedSeats: any[] = [];
  loading = false;
  
  rows: string[] = [];
  cols: number = 0;

  ngOnChanges(changes: SimpleChanges) {
      if (changes['batchId'] && this.batchId) {
          this.loadSeats();
      }
  }

  loadSeats() {
      this.loading = true;
      this.http.get<any[]>(`http://localhost:3000/seats/${this.batchId}`).subscribe({
          next: (data) => {
              this.seats = data;
              this.processGrid();
              this.loading = false;
          },
          error: (err) => console.error(err)
      });
  }

  processGrid() {
      // Extract unique rows and max col for grid dimensions
      this.rows = [...new Set(this.seats.map(s => s.row))];
      this.cols = Math.max(...this.seats.map(s => parseInt(s.number)));
  }

  toggleSeat(seat: any) {
      if (seat.status !== 'AVAILABLE') return;

      const index = this.selectedSeats.findIndex(s => s.id === seat.id);
      if (index > -1) {
          this.selectedSeats.splice(index, 1);
      } else {
          this.selectedSeats.push(seat);
      }
      this.selectionChange.emit(this.selectedSeats);
  }

  isSelected(seat: any) {
      return this.selectedSeats.some(s => s.id === seat.id);
  }
}
