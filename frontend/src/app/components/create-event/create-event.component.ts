import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule, FormArray, FormGroup, ValidatorFn, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { EventsService } from '../../services/events.service';
import { NotifyService } from '../../services/notify.service';
import { CATEGORIES } from '../../shared/catalog';

const atLeastOneSelected: ValidatorFn = (control: AbstractControl) => {
  const group = control as FormGroup;
  return Object.keys(group.controls).some(k => group.controls[k].value === true) ? null : { required: true };
};

const futureDate: ValidatorFn = (control: AbstractControl) => {
  if (!control.value) return null;
  return new Date(control.value) > new Date() ? null : { pastDate: true };
};

/** Cantidad de butacas que salen de la configuración de un lote numerado. */
export function seatCount(b: { seatingType?: string; rows?: number; cols?: number; seatConfig?: string }): number {
  if (b.seatingType === 'custom') {
    return String(b.seatConfig || '').split(',').map(n => parseInt(n.trim(), 10)).filter(n => n > 0).reduce((a, n) => a + n, 0);
  }
  return Math.max(0, Number(b.rows) || 0) * Math.max(0, Number(b.cols) || 0);
}

@Component({
  selector: 'app-create-event',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-event.component.html',
  styleUrls: ['./create-event.component.css']
})
export class CreateEventComponent {
  fb = inject(FormBuilder);
  eventsService = inject(EventsService);
  router = inject(Router);
  notify = inject(NotifyService);

  readonly totalSteps = 5;
  readonly categories = CATEGORIES;
  seatCount = seatCount;
  currentStep = 1;
  submitting = false;

  eventForm = this.fb.group({
    hasNumberedSeating: [false, Validators.required],
    paymentMethods: this.fb.group({
      mercadoPago: [true],
      transfer: [false]
    }, { validators: atLeastOneSelected }),
    paymentInstructions: [''],
    title: ['', [Validators.required, Validators.maxLength(80)]],
    description: [''],
    location: ['', Validators.required],
    category: ['Party', Validators.required],
    date: ['', [Validators.required, futureDate]],
    imageUrl: [''],
    isVisible: [true],
    batches: this.fb.array([])
  });

  get batches() {
    return this.eventForm.get('batches') as FormArray;
  }

  get transferSelected() {
    return !!this.eventForm.get('paymentMethods.transfer')?.value;
  }

  addBatch() {
    const numbered = !!this.eventForm.get('hasNumberedSeating')?.value;
    this.batches.push(this.fb.group({
      name: [this.batches.length === 0 ? 'General' : '', Validators.required],
      price: [null as number | null, [Validators.required, Validators.min(0)]],
      totalQuantity: [100, [Validators.required, Validators.min(1)]],
      hasSeating: [numbered],
      rows: [10],
      cols: [20],
      seatConfig: [''],
      seatingType: ['grid'],
      salesEndDate: [''],
    }));
  }

  removeBatch(index: number) {
    this.batches.removeAt(index);
  }

  private stepValid(step: number): boolean {
    const touch = (names: string[]) => names.forEach(n => this.eventForm.get(n)?.markAsTouched());
    if (step === 2) {
      const g = this.eventForm.get('paymentMethods')!;
      g.markAllAsTouched();
      return g.valid;
    }
    if (step === 3) {
      const names = ['title', 'location', 'category', 'date'];
      touch(names);
      return names.every(n => this.eventForm.get(n)?.valid);
    }
    if (step === 4) {
      this.batches.markAllAsTouched();
      if (this.batches.length === 0) { this.notify.toast('Agregá al menos un tipo de entrada.', 'warning'); return false; }
      const badSeats = this.batches.controls.some(c => c.get('hasSeating')?.value && seatCount(c.value) === 0);
      if (badSeats) { this.notify.toast('Configurá las filas y butacas de la ubicación numerada.', 'warning'); return false; }
      return this.batches.valid;
    }
    return true;
  }

  nextStep() {
    if (!this.stepValid(this.currentStep)) return;
    this.currentStep++;
    if (this.currentStep === 4 && this.batches.length === 0) this.addBatch();
  }

  prevStep() {
    this.currentStep--;
  }

  onSubmit() {
    if (this.currentStep !== this.totalSteps || this.submitting) return;
    const v = this.eventForm.value as any;
    const eventData = {
      title: v.title.trim(),
      description: v.description,
      location: v.location.trim(),
      date: new Date(v.date).toISOString(),
      category: v.category,
      imageUrl: v.imageUrl?.trim() || null,
      isVisible: v.isVisible,
      paymentInstructions: this.transferSelected ? v.paymentInstructions?.trim() || null : null,
      paymentMethods: [
        ...(v.paymentMethods.mercadoPago ? ['MercadoPago'] : []),
        ...(v.paymentMethods.transfer ? ['Cash / Bank Transfer'] : []),
      ],
      batches: v.batches.map((b: any) => {
        const seated = !!b.hasSeating;
        return {
          name: b.name.trim(),
          price: Number(b.price),
          // En un lote numerado el stock es la cantidad de butacas.
          totalQuantity: seated ? seatCount(b) : Number(b.totalQuantity),
          hasSeating: seated,
          rows: seated && b.seatingType === 'grid' ? Number(b.rows) : null,
          cols: seated && b.seatingType === 'grid' ? Number(b.cols) : null,
          seatConfig: seated && b.seatingType === 'custom' ? b.seatConfig : null,
          salesEndDate: b.salesEndDate ? new Date(b.salesEndDate).toISOString() : null,
        };
      }),
    };

    this.submitting = true;
    this.eventsService.createEvent(eventData).subscribe({
      next: () => {
        this.notify.success('¡Evento creado!', v.isVisible ? 'Ya está a la venta.' : 'Quedó oculto: publicalo desde tu panel cuando quieras.');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.submitting = false;
        this.notify.error('No se pudo crear el evento', this.notify.messageOf(err));
      }
    });
  }
}
