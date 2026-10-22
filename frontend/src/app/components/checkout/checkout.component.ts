import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, FormsModule, ValidationErrors, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { OrdersService, CheckoutConfig } from '../../services/orders.service';
import { EventsService } from '../../services/events.service';
import { AuthService } from '../../services/auth.service';
import { NotifyService } from '../../services/notify.service';
import { EVENT_PLACEHOLDER } from '../../shared/catalog';

export const MP_METHOD = 'MercadoPago';
export const CASH_METHOD = 'Cash / Bank Transfer';

function sameEmail(group: AbstractControl): ValidationErrors | null {
    const a = String(group.get('email')?.value || '').trim().toLowerCase();
    const b = String(group.get('confirmEmail')?.value || '').trim().toLowerCase();
    return a && b && a !== b ? { emailMismatch: true } : null;
}

@Component({
    selector: 'app-checkout',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
    templateUrl: './checkout.component.html',
    styleUrl: './checkout.component.css'
})
export class CheckoutComponent {
    private route = inject(ActivatedRoute);
    private fb = inject(FormBuilder);
    private ordersService = inject(OrdersService);
    private eventsService = inject(EventsService);
    private auth = inject(AuthService);
    private notify = inject(NotifyService);
    private router = inject(Router);

    readonly MP = MP_METHOD;
    readonly CASH = CASH_METHOD;
    placeholder = EVENT_PLACEHOLDER;

    eventId = this.route.snapshot.queryParamMap.get('eventId');
    batchId = this.route.snapshot.queryParamMap.get('batchId');
    quantity = Math.max(1, Math.min(50, Number(this.route.snapshot.queryParamMap.get('quantity')) || 1));
    seatsParam = this.route.snapshot.queryParamMap.get('seats');
    seats: { row: string; number: string }[] = this.parseSeats();

    event: any = null;
    batch: any = null;
    config: CheckoutConfig = { serviceFeePercent: 15, mercadoPago: false, paymentWindowMinutes: 30 };
    loadError = '';

    unitPrice = 0;
    subTotal = 0;
    serviceFee = 0;
    discountAmount = 0;
    finalTotal = 0;

    promoCode = '';
    promoApplied = false;
    discountPercentage = 0;

    checkoutForm = this.fb.group({
        fullName: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        confirmEmail: ['', [Validators.required, Validators.email]],
        phone: ['', Validators.required],
        documentId: ['', Validators.required],
        paymentMethod: ['', Validators.required],
        acceptTerms: [false, Validators.requiredTrue],
    }, { validators: sameEmail });

    isSubmitting = false;

    ngOnInit() {
        const user = this.auth.currentUser;
        if (user) {
            this.checkoutForm.patchValue({ fullName: user.fullName || '', email: user.email || '', confirmEmail: user.email || '' });
        }
        if (!this.eventId || !this.batchId) {
            this.loadError = 'Elegí primero el evento y las entradas.';
            return;
        }
        this.ordersService.config$.subscribe({ next: c => { this.config = c; this.setup(); }, error: () => this.setup() });
        this.eventsService.getEvent(this.eventId).subscribe({
            next: ev => { this.event = ev; this.setup(); },
            error: () => this.loadError = 'No encontramos este evento.',
        });
    }

    private parseSeats() {
        try { return this.seatsParam ? JSON.parse(this.seatsParam) : []; } catch { return []; }
    }

    /** Medios de pago que el productor aceptó y que la plataforma puede cobrar. */
    get paymentMethods(): string[] {
        const accepted: string[] = this.event?.paymentMethods?.length ? this.event.paymentMethods : [CASH_METHOD];
        return accepted.filter(m => m !== MP_METHOD || this.config.mercadoPago);
    }

    private setup() {
        if (!this.event) return;
        this.batch = this.event.batches?.find((b: any) => b.id === this.batchId) ?? null;
        if (!this.batch) { this.loadError = 'Esa entrada ya no está disponible.'; return; }
        this.unitPrice = Number(this.batch.price);
        const methods = this.paymentMethods;
        const current = this.checkoutForm.get('paymentMethod')!.value;
        if (!current || !methods.includes(current)) {
            this.checkoutForm.get('paymentMethod')!.setValue(methods.length === 1 ? methods[0] : '');
        }
        this.calculateTotals();
    }

    calculateTotals() {
        const r = (n: number) => Math.round(n * 100) / 100;
        this.subTotal = r(this.unitPrice * this.quantity);
        this.discountAmount = this.promoApplied ? r(this.subTotal * (this.discountPercentage / 100)) : 0;
        // El cargo por servicio se calcula sobre el precio de lista, igual que en el servidor.
        this.serviceFee = r(this.subTotal * (this.config.serviceFeePercent / 100));
        this.finalTotal = r(this.subTotal - this.discountAmount + this.serviceFee);
    }

    applyPromo() {
        const code = this.promoCode.trim();
        if (!code) return;
        this.ordersService.validatePromo(code).subscribe({
            next: (res) => {
                this.promoApplied = true;
                this.promoCode = res.code;
                this.discountPercentage = res.discountPercentage;
                this.calculateTotals();
                this.notify.toast(`Descuento del ${res.discountPercentage}% aplicado`);
            },
            error: (err) => {
                this.promoApplied = false;
                this.discountPercentage = 0;
                this.calculateTotals();
                this.notify.toast(this.notify.messageOf(err, 'Ese código no es válido.'), 'error');
            }
        });
    }

    removePromo() {
        this.promoApplied = false;
        this.discountPercentage = 0;
        this.promoCode = '';
        this.calculateTotals();
    }

    invalid(name: string) {
        const c = this.checkoutForm.get(name);
        return !!c && c.invalid && c.touched;
    }

    onSubmit() {
        if (this.checkoutForm.invalid || !this.batch) {
            this.checkoutForm.markAllAsTouched();
            return;
        }
        const v = this.checkoutForm.value;
        const orderData = {
            items: [{ batchId: this.batchId!, quantity: this.quantity, seats: this.seatsParam || undefined }],
            customerInfo: {
                name: v.fullName!.trim(),
                email: v.email!.trim(),
                phone: v.phone!.trim(),
                docId: v.documentId!.trim(),
            },
            promoCode: this.promoApplied ? this.promoCode : undefined,
            paymentMethod: v.paymentMethod,
        };

        this.isSubmitting = true;
        this.ordersService.createOrder(orderData).subscribe({
            next: (res) => {
                if (res.paymentLink) {
                    // A Mercado Pago. Al volver, /checkout/resultado confirma el pago.
                    window.location.href = res.paymentLink;
                    return;
                }
                this.router.navigate(['/checkout/resultado'], { queryParams: { orden: res.order.id } });
            },
            error: (err) => {
                this.isSubmitting = false;
                this.notify.error('No pudimos tomar tu pedido', this.notify.messageOf(err));
            }
        });
    }
}
