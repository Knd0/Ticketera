import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule, FormArray, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { EventsService } from '../../services/events.service';

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

  currentStep = 1;

  // Form Group validating all steps
  eventForm = this.fb.group({
    eventType: ['sale', Validators.required], // 'sale' | 'invite'
    hasNumberedSeating: [false, Validators.required],
    paymentMethods: this.fb.group({
      mercadoPago: [false],
      nave: [false],
      uala: [false],
      transfer: [false]
    }),
    title: ['', Validators.required],
    description: [''],
    location: ['', Validators.required],
    category: ['Concert', Validators.required],
    date: ['', Validators.required],
    imageUrl: [''],
    batches: this.fb.array([])
  });

  get batches() {
    return this.eventForm.get('batches') as FormArray;
  }

  addBatch() {
    const batchGroup = this.fb.group({
      name: ['General Admission', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      totalQuantity: [100, [Validators.required, Validators.min(1)]]
    });
    this.batches.push(batchGroup);
  }

  removeBatch(index: number) {
    this.batches.removeAt(index);
  }

  nextStep() {
    this.currentStep++;
    if (this.currentStep === 5 && this.batches.length === 0) {
      this.addBatch(); // Auto-add one batch if arriving at batch step empty
    }
  }

  prevStep() {
    this.currentStep--;
  }

  onSubmit() {
    if (this.eventForm.valid) {
      // Logic to transform form value to backend entity structure
      // Note: Backend expects { title, description, date, location, imageUrl, batches: [...] }
      // Payment methods and other wizard fields are currently frontend-only or need backend schema updates.
      // For now, we simulate sending the core fields.
      const formVal = this.eventForm.value;
      const eventData = {
        title: formVal.title,
        description: formVal.description,
        location: formVal.location,
        date: new Date(formVal.date!).toISOString(), // Ensure date format
        category: formVal.category,
        imageUrl: formVal.imageUrl,
        batches: formVal.batches
      };

      this.eventsService.createEvent(eventData).subscribe({
        next: () => {
          alert('Event Created Successfully!');
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          console.error(err);
          alert('Failed to create event.');
        }
      });
    }
  }
}
