import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="profile-page">

      <!-- ── Avatar + info ─────────────────────────────────── -->
      <div class="avatar-section">
        <button class="avatar-wrap" type="button" (click)="openUploadModal()" title="Cambiar foto">
          @if (auth.avatarUrl() && !avatarImgError) {
            <img
              [src]="auth.avatarUrl()!"
              alt="Foto de perfil"
              class="avatar-img"
              (error)="avatarImgError = true"
            />
          } @else {
            <span class="avatar-initials">{{ auth.avatarInitials() }}</span>
          }
          <span class="avatar-edit-badge" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
            </svg>
          </span>
        </button>

        <div class="user-info">
          <div class="name-row">
            <strong class="user-name">{{ auth.displayName() || 'Sin nombre' }}</strong>
            <button type="button" class="edit-btn" (click)="openNameModal()" title="Editar nombre">
              <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
              </svg>
            </button>
          </div>
          <small class="user-email">{{ auth.user()?.email }}</small>
        </div>
      </div>

      <!-- ── Logout ─────────────────────────────────────────── -->
      <button type="button" class="logout-btn" (click)="logout()">Cerrar sesión</button>

      <!-- ── Modal: subir foto ──────────────────────────────── -->
      @if (uploadModalOpen) {
        <div class="modal-backdrop" (click)="closeUploadModal()"></div>
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Cambiar foto de perfil</h3>
          <p>Sube una imagen cuadrada o usa el zoom para ajustarla.</p>

          <input type="file" accept="image/*" (change)="onFileSelected($event)" />

          @if (previewUrl()) {
            <div
              class="preview-wrap"
              (wheel)="onWheel($event)"
              (touchstart)="onTouchStart($event)"
              (touchmove)="onTouchMove($event)"
              (touchend)="onTouchEnd()"
            >
              <img
                [src]="previewUrl()!"
                alt="Vista previa"
                [style.transform]="'scale(' + zoom() + ')'"
              />
            </div>
            <small class="zoom-hint">Rueda del ratón o pellizco para hacer zoom</small>
          }

          @if (uploadError()) {
            <p class="form-error">{{ uploadError() }}</p>
          }

          <div class="modal-actions">
            <button type="button" (click)="closeUploadModal()" [disabled]="uploading()">Cancelar</button>
            <button
              type="button"
              class="primary"
              (click)="confirmUpload()"
              [disabled]="!previewUrl() || uploading()"
            >{{ uploading() ? 'Subiendo…' : 'Guardar foto' }}</button>
          </div>
        </div>
      }

      <!-- ── Modal: editar nombre ───────────────────────────── -->
      @if (nameModalOpen) {
        <div class="modal-backdrop" (click)="closeNameModal()"></div>
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Editar nombre</h3>
          <label>
            Nombre completo
            <input
              [(ngModel)]="nameInput"
              placeholder="Tu nombre"
              (keyup.enter)="saveName()"
              autocomplete="name"
            />
          </label>

          @if (nameError()) {
            <p class="form-error">{{ nameError() }}</p>
          }

          <div class="modal-actions">
            <button type="button" (click)="closeNameModal()" [disabled]="nameSaving()">Cancelar</button>
            <button
              type="button"
              class="primary"
              (click)="saveName()"
              [disabled]="!nameInput.trim() || nameSaving()"
            >{{ nameSaving() ? 'Guardando…' : 'Guardar' }}</button>
          </div>
        </div>
      }

    </section>
  `,
  styles: [`
    .profile-page {
      display: grid;
      gap: 1.5rem;
      max-width: 480px;
    }

    /* ── Avatar section ────────────────────────────────────── */
    .avatar-section {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .avatar-wrap {
      position: relative;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      border: 2px solid #e5e7eb;
      overflow: visible;
      background: #111;
      color: #fff;
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }

    .avatar-initials {
      font-size: 1.4rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      pointer-events: none;
    }

    .avatar-edit-badge {
      position: absolute;
      bottom: 1px;
      right: 1px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #111;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1.5px solid #fff;
      pointer-events: none;
    }

    /* ── User info ─────────────────────────────────────────── */
    .user-info {
      min-width: 0;
    }

    .name-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .user-name {
      font-size: 1rem;
      font-weight: 700;
      color: #111;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 220px;
    }

    .edit-btn {
      border: none;
      background: transparent;
      color: #9ca3af;
      cursor: pointer;
      padding: 2px;
      display: inline-flex;
      align-items: center;

      &:hover { color: #111; }
    }

    .user-email {
      font-size: 0.8rem;
      color: #6b7280;
    }

    /* ── Logout ────────────────────────────────────────────── */
    .logout-btn {
      justify-self: start;
      border: 1px solid #fecaca;
      border-radius: 10px;
      background: #fff;
      color: #dc2626;
      padding: 0.5rem 0.85rem;
      font: inherit;
      font-size: 0.84rem;
      font-weight: 600;
      cursor: pointer;

      &:hover { background: #fee2e2; }
    }

    /* ── Modals ────────────────────────────────────────────── */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.3);
      z-index: 200;
    }

    .modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 210;
      background: #fff;
      border-radius: 14px;
      padding: 1.2rem 1.2rem 1rem;
      width: min(360px, 92vw);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
      display: grid;
      gap: 0.75rem;
    }

    .modal h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
    }

    .modal p {
      margin: 0;
      font-size: 0.82rem;
      color: #6b7280;
    }

    .modal label {
      display: grid;
      gap: 0.3rem;
      font-size: 0.82rem;
      color: #374151;
      font-weight: 500;
    }

    .modal input[type="text"],
    .modal input[type="file"] {
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 0.5rem 0.65rem;
      font: inherit;
      font-size: 0.88rem;
      width: 100%;
      box-sizing: border-box;
    }

    /* ── Preview zoom ──────────────────────────────────────── */
    .preview-wrap {
      width: 220px;
      height: 140px;
      border-radius: 10px;
      overflow: hidden;
      background: #000;
      position: relative;
      cursor: zoom-in;
    }

    .preview-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform-origin: center;
      transition: transform 0.1s ease;
    }

    .preview-wrap::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: radial-gradient(
        circle at center,
        transparent 0,
        transparent 40%,
        rgba(0,0,0,0.55) 43%,
        rgba(0,0,0,0.7) 100%
      );
    }

    .zoom-hint {
      font-size: 0.74rem;
      color: #9ca3af;
    }

    /* ── Form error ────────────────────────────────────────── */
    .form-error {
      margin: 0;
      font-size: 0.8rem;
      color: #dc2626;
    }

    /* ── Modal actions ─────────────────────────────────────── */
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    .modal-actions button {
      border: 1px solid #e5e7eb;
      border-radius: 9px;
      background: #fff;
      padding: 0.45rem 0.8rem;
      font: inherit;
      font-size: 0.84rem;
      cursor: pointer;

      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }

    .modal-actions button.primary {
      background: #111;
      color: #fff;
      border-color: #111;

      &:hover:not(:disabled) { background: #222; }
    }
  `]
})
export class ProfilePage {
  constructor(readonly auth: AuthService, private readonly router: Router) {}

  /* ── Avatar upload state ─────────────────────────────────── */
  avatarImgError = false;
  uploadModalOpen = false;
  previewUrl = signal<string | null>(null);
  zoom = signal(1);
  uploading = signal(false);
  uploadError = signal<string | null>(null);

  private _previewBlobUrl: string | null = null;
  private _lastTouchDist: number | null = null;
  private _uploadFileName = 'avatar.webp';

  /* ── Name edit state ─────────────────────────────────────── */
  nameModalOpen = false;
  nameInput = '';
  nameSaving = signal(false);
  nameError = signal<string | null>(null);

  /* ── Upload modal ────────────────────────────────────────── */
  openUploadModal(): void {
    this.uploadError.set(null);
    this.zoom.set(1);
    const current = this.auth.avatarUrl();
    this.previewUrl.set(current);
    this._uploadFileName = 'avatar.webp';
    this.uploadModalOpen = true;
  }

  closeUploadModal(): void {
    this.uploadModalOpen = false;
    this._revokeBlobUrl();
    this.previewUrl.set(null);
    this.zoom.set(1);
    this.uploadError.set(null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this._revokeBlobUrl();
    this._previewBlobUrl = URL.createObjectURL(file);
    this._uploadFileName = file.name;
    this.previewUrl.set(this._previewBlobUrl);
    this.zoom.set(1);
    this.uploadError.set(null);
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    this.zoom.update(z => Math.min(3, Math.max(1, z + delta)));
  }

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      this._lastTouchDist = Math.hypot(dx, dy);
    }
  }

  onTouchMove(event: TouchEvent): void {
    if (event.touches.length !== 2 || this._lastTouchDist === null) return;
    event.preventDefault();
    const dx = event.touches[0].clientX - event.touches[1].clientX;
    const dy = event.touches[0].clientY - event.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const scale = dist / this._lastTouchDist;
    this.zoom.update(z => Math.min(3, Math.max(1, z * scale)));
    this._lastTouchDist = dist;
  }

  onTouchEnd(): void {
    this._lastTouchDist = null;
  }

  async confirmUpload(): Promise<void> {
    const src = this.previewUrl();
    if (!src) return;
    this.uploading.set(true);
    this.uploadError.set(null);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
      });

      const z = Math.min(3, Math.max(1, this.zoom()));
      const side = Math.min(img.width, img.height) / z;
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, 256, 256);

      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Error al procesar imagen.')), 'image/webp')
      );

      const { error } = await this.auth.uploadAvatar(blob, this._uploadFileName);
      if (error) { this.uploadError.set(error.message); return; }

      this.avatarImgError = false;
      this.closeUploadModal();
    } catch (e: any) {
      this.uploadError.set(e?.message ?? 'Error al subir la imagen.');
    } finally {
      this.uploading.set(false);
    }
  }

  /* ── Name modal ──────────────────────────────────────────── */
  openNameModal(): void {
    this.nameInput = this.auth.displayName();
    this.nameError.set(null);
    this.nameModalOpen = true;
  }

  closeNameModal(): void {
    this.nameModalOpen = false;
    this.nameError.set(null);
  }

  async saveName(): Promise<void> {
    if (!this.nameInput.trim()) return;
    this.nameSaving.set(true);
    this.nameError.set(null);
    const { error } = await this.auth.updateProfile(this.nameInput.trim());
    this.nameSaving.set(false);
    if (error) { this.nameError.set(error.message); return; }
    this.closeNameModal();
  }

  /* ── Logout ──────────────────────────────────────────────── */
  async logout(): Promise<void> {
    await this.auth.signOut();
    void this.router.navigateByUrl('/login');
  }

  private _revokeBlobUrl(): void {
    if (this._previewBlobUrl) {
      URL.revokeObjectURL(this._previewBlobUrl);
      this._previewBlobUrl = null;
    }
  }
}
