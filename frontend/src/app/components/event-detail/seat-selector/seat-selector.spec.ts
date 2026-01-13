import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeatSelector } from './seat-selector';

describe('SeatSelector', () => {
  let component: SeatSelector;
  let fixture: ComponentFixture<SeatSelector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeatSelector]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SeatSelector);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
