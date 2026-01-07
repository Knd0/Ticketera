import { Controller, Post, Body } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() createOrderDto: any) {
    return this.ordersService.createOrder(createOrderDto);
  }

  @Post('webhook/mercadopago')
  async handleWebhook(@Body() body: any) {
      console.log('Received Webhook:', body);
      // Mock logic: assume body has { id: orderId, status: 'approved' }
      // In real scenario, verify signature and fetch payment details
      if (body.status === 'approved' && body.id) {
          await this.ordersService.confirmPayment(body.id);
      }
      return { received: true };
  }

  @Post('validate-promo')
  async validatePromo(@Body('code') code: string) {
      const promo = await this.ordersService.validatePromoCode(code);
      return { 
          valid: true, 
          discountPercentage: promo.discountPercentage,
          code: promo.code 
      };
  }
}
