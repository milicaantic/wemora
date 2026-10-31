// Copy buttons: data-copy holds the command; falls back to selecting the text.
document.querySelectorAll(".copy").forEach((btn) => {
  btn.addEventListener("click", () => {
    const text = btn.dataset.copy;
    const done = () => { btn.textContent = "Copied"; setTimeout(() => (btn.textContent = "Copy"), 1400); };
    const fallback = () => {
      const span = btn.previousElementSibling;
      const range = document.createRange();
      range.selectNodeContents(span);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      btn.textContent = "Press Ctrl+C";
      setTimeout(() => (btn.textContent = "Copy"), 2000);
    };
    try {
      navigator.clipboard.writeText(text).then(done, fallback);
    } catch (e) {
      fallback();
    }
  });
});
