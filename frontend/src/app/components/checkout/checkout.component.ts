import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { OrdersService } from '../../services/orders.service';
import { EventsService } from '../../services/events.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css'
})
export class CheckoutComponent {
  route = inject(ActivatedRoute);
  fb = inject(FormBuilder);
  ordersService = inject(OrdersService);
  eventsService = inject(EventsService); // Injected to fetch details
  router = inject(Router);

  eventId = this.route.snapshot.queryParamMap.get('eventId');
  batchId = this.route.snapshot.queryParamMap.get('batchId');
  quantity = Number(this.route.snapshot.queryParamMap.get('quantity')) || 1;

  event: any = null;
  batch: any = null;

  // Pricing
  unitPrice = 0;
  subTotal = 0;
  serviceFee = 0;
  discountAmount = 0;
  finalTotal = 0;
  
  promoCode = '';
  promoApplied = false;
  discountPercentage = 0;

  // Timer
  timeLeft: number = 600; // 10 minutes in seconds
  timerDisplay = '10:00';
  intervalId: any;

  checkoutForm = this.fb.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    documentId: ['', Validators.required],
    confirmEmail: ['', [Validators.required, Validators.email]], // Added per screenshot
    paymentMethod: ['mercadopago', Validators.required] // Added per screenshot
  });

  purchaseSuccess = false;
  purchasedTickets: any[] = [];
  purchasedOrder: any = null;

  ngOnInit() {
      if (this.eventId) {
          this.fetchDetails();
      }
      this.startTimer();
  }

  ngOnDestroy() {
      if (this.intervalId) clearInterval(this.intervalId);
  }

  fetchDetails() {
      if (!this.eventId) return;
      this.eventsService.getEvent(this.eventId).subscribe(ev => {
          this.event = ev;
          // Find batch
          if (this.batchId && this.event.batches) {
              this.batch = this.event.batches.find((b: any) => b.id === this.batchId);
              if (this.batch) {
                  this.unitPrice = Number(this.batch.price);
                  this.calculateTotals();
              }
          }
      });
  }

  startTimer() {
      this.intervalId = setInterval(() => {
          if (this.timeLeft > 0) {
              this.timeLeft--;
              const m = Math.floor(this.timeLeft / 60);
              const s = this.timeLeft % 60;
              this.timerDisplay = `${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`;
          } else {
              clearInterval(this.intervalId);
              alert('Time expired!');
              this.router.navigate(['/']);
          }
      }, 1000);
  }

  calculateTotals() {
      this.subTotal = this.unitPrice * this.quantity;
      
      // Discount applies to Subtotal only
      this.discountAmount = this.promoApplied ? (this.subTotal * (this.discountPercentage / 100)) : 0;
      
      // Service Fee is 15% of SubTotal (usually fee is on base price, prompt says "bajar precio entrada, no servicio")
      this.serviceFee = this.subTotal * 0.15;

      this.finalTotal = (this.subTotal - this.discountAmount) + this.serviceFee;
  }

  applyPromo() {
      const code = this.checkoutForm.get('promoCode')?.value;
      if (!code) return;
      
      this.ordersService.validatePromo(code).subscribe({
          next: (res) => {
              if (res.valid) {
                  this.promoApplied = true;
                  this.discountPercentage = res.discountPercentage;
                  this.calculateTotals(); // Recalculate
                  alert(`Promo applied! ${res.discountPercentage}% off ticket price.`);
              }
          },
          error: (err) => {
              console.error(err);
              alert('Invalid promo code');
              this.promoApplied = false;
              this.discountPercentage = 0;
              this.calculateTotals();
          }
      });
  }

  onSubmit() {
    if (this.checkoutForm.valid) {
      const formValue = this.checkoutForm.value;
      
      if (formValue.email !== formValue.confirmEmail) {
          alert('Emails do not match');
          return;
      }

      const orderData = {
        items: [{
            batchId: this.batchId!,
            quantity: this.quantity
        }],
        customerInfo: {
            name: formValue.fullName,
            email: formValue.email,
            phone: formValue.phone,
            docId: formValue.documentId
        },
        promoCode: this.promoApplied ? this.promoCode : undefined
      };

      this.ordersService.createOrder(orderData).subscribe({
        next: (res) => {
          this.purchaseSuccess = true;
          this.purchasedOrder = res.order;
          this.purchasedTickets = res.tickets;
          clearInterval(this.intervalId);
        },
        error: (err) => {
          console.error(err);
          alert('Error processing order: ' + err.message);
        }
      });
    }
  }
}
