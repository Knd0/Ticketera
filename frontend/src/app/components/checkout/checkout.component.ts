import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { OrdersService } from '../../services/orders.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css'
})
export class CheckoutComponent {
  route = inject(ActivatedRoute);
  fb = inject(FormBuilder);
  ordersService = inject(OrdersService);
  router = inject(Router);

  eventId = this.route.snapshot.queryParamMap.get('eventId');
  batchId = this.route.snapshot.queryParamMap.get('batchId');
  quantity = this.route.snapshot.queryParamMap.get('quantity');

  promoCode = '';
  promoApplied = false;
  discountPercentage = 0;

  checkoutForm = this.fb.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    documentId: ['', Validators.required],
    promoCode: ['']
  });

  purchaseSuccess = false;
  purchasedTickets: any[] = [];
  purchasedOrder: any = null;

  applyPromo() {
      const code = this.checkoutForm.get('promoCode')?.value;
      if (!code) return;
      
      this.ordersService.validatePromo(code).subscribe({
          next: (res) => {
              if (res.valid) {
                  this.promoApplied = true;
                  this.discountPercentage = res.discountPercentage;
                  alert(`Promo applied! ${res.discountPercentage}% off.`);
              }
          },
          error: (err) => {
              console.error(err);
              alert('Invalid promo code');
              this.promoApplied = false;
              this.discountPercentage = 0;
          }
      });
  }

  onSubmit() {
    if (this.checkoutForm.valid) {
      const formValue = this.checkoutForm.value;
      
      const orderData = {
        items: [{
            batchId: this.batchId,
            quantity: Number(this.quantity)
        }],
        customerInfo: {
            name: formValue.fullName,
            email: formValue.email,
            phone: formValue.phone,
            docId: formValue.documentId
        },
        // eventId is strictly not needed by createOrder if batch links to event, 
        // but if we want to track it or validate, we can keep it. 
        // However, backend OrdersService only looks at items.
        
        promoCode: this.promoApplied ? formValue.promoCode : undefined
      };

      this.ordersService.createOrder(orderData).subscribe({
        next: (res) => {
          this.purchaseSuccess = true;
          this.purchasedOrder = res.order;
          this.purchasedTickets = res.tickets;
        },
        error: (err) => {
          console.error(err);
          alert('Error processing order: ' + err.message);
        }
      });
    }
  }
}
