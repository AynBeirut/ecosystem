/** Open WhatsApp on device (native app on Android/iOS, wa.me on desktop). */
export function shareViaWhatsApp(text: string, phone?: string): void {
  const encoded = encodeURIComponent(text);
  const digits = phone?.replace(/\D/g, '') || '';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    const url = digits
      ? `whatsapp://send?phone=${digits}&text=${encoded}`
      : `whatsapp://send?text=${encoded}`;
    window.location.href = url;
    return;
  }

  if (digits) {
    window.open(`https://wa.me/${digits}?text=${encoded}`, '_blank', 'noopener,noreferrer');
    return;
  }

  if (typeof navigator.share === 'function') {
    void navigator.share({ text });
    return;
  }

  window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer');
}
