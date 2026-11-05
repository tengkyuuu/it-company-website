// The downloaded archive is already the full kit. Keep offline downloads useful
// without requiring a recursive copy of the ZIP inside itself.
if (location.protocol === 'file:') {
  document.querySelectorAll('a[href="MykTech-Brand-Kit.zip"]').forEach(link => {
    link.href = 'brand-board.png';
    link.textContent = 'Download overview ↓';
  });
}
document.querySelectorAll('[data-tone][type="button"]').forEach(button => {
  button.addEventListener('click', () => {
    const tone = button.dataset.tone;
    document.querySelectorAll('.tone-switch button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    document.querySelectorAll('.logo-stage').forEach(stage => stage.dataset.tone = tone);
    document.querySelectorAll('[data-kind]').forEach(img => img.src = `svg/myktech-${img.dataset.kind}-${tone}.svg`);
    document.querySelectorAll('[data-file]').forEach(link => link.href = `${link.dataset.ext}/myktech-${link.dataset.file}-${tone}.${link.dataset.ext}`);
  });
});
document.querySelectorAll('[data-hex]').forEach(button => {
  button.addEventListener('click', async () => {
    const status = document.querySelector('.copy-feedback');
    try { await navigator.clipboard.writeText(button.dataset.hex); status.textContent = `${button.dataset.hex} copied.`; }
    catch { status.textContent = `Color value: ${button.dataset.hex}. Select and copy this value.`; }
  });
});
