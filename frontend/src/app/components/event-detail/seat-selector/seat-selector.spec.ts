import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SeatSelectorComponent } from './seat-selector';

describe('SeatSelectorComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [SeatSelectorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(SeatSelectorComponent);
    const http = TestBed.inject(HttpTestingController);
    const cmp = fixture.componentInstance;
    cmp.batchId = 'b1';
    cmp.loadSeats();
    return { cmp, http };
  }

  it('ordena las butacas por número, no como texto', () => {
    const { cmp, http } = setup();
    http.expectOne(r => r.url.endsWith('/seats/b1')).flush([
      { id: '3', row: 'A', number: '10', status: 'AVAILABLE' },
      { id: '1', row: 'A', number: '2', status: 'AVAILABLE' },
      { id: '2', row: 'A', number: '1', status: 'AVAILABLE' },
    ]);
    expect(cmp.seats.map(s => s.number)).toEqual(['1', '2', '10']);
  });

  it('no deja elegir butacas ocupadas ni más de 10', () => {
    const { cmp, http } = setup();
    const seats = Array.from({ length: 12 }, (_, i) => ({ id: String(i), row: 'A', number: String(i + 1), status: 'AVAILABLE' }));
    seats.push({ id: 'x', row: 'B', number: '1', status: 'SOLD' });
    http.expectOne(() => true).flush(seats);

    cmp.toggleSeat(seats[12]);
    expect(cmp.selectedSeats).toHaveLength(0);
    seats.slice(0, 12).forEach(s => cmp.toggleSeat(s));
    expect(cmp.selectedSeats).toHaveLength(10);
  });
});
