import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

/** Avisos y confirmaciones con el estilo de la app (reemplaza alert/confirm del navegador). */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  private base = {
    background: '#1e293b',
    color: '#f1f5f9',
    confirmButtonColor: '#6366f1',
    cancelButtonColor: '#475569',
  };

  success(title: string, text?: string) {
    return Swal.fire({ ...this.base, icon: 'success', title, text, confirmButtonText: 'Listo' });
  }

  error(title: string, text?: string) {
    return Swal.fire({ ...this.base, icon: 'error', title, text, confirmButtonText: 'Entendido' });
  }

  toast(title: string, icon: 'success' | 'error' | 'info' | 'warning' = 'success') {
    return Swal.fire({ ...this.base, toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 3000, timerProgressBar: true });
  }

  async confirm(title: string, text: string, confirmText = 'Sí, continuar'): Promise<boolean> {
    const r = await Swal.fire({ ...this.base, icon: 'question', title, text, showCancelButton: true, confirmButtonText: confirmText, cancelButtonText: 'Cancelar' });
    return r.isConfirmed;
  }

  /** Mensaje legible de un error HTTP de la API. */
  messageOf(err: any, fallback = 'Algo salió mal. Probá de nuevo.'): string {
    const m = err?.error?.message;
    if (Array.isArray(m)) return m.join(' ');
    if (typeof m === 'string' && m && !/^Internal server error$/i.test(m)) return m.replace(/^SoldOutException:\s*/, '');
    if (err?.status === 0) return 'No hay conexión con el servidor.';
    return fallback;
  }
}
