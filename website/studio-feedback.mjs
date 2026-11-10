export function studioStatus(element, message, pending = false) {
  element.toggleAttribute("data-studio-progress", pending);
  element.textContent = message;
}

export function openStudioDialog(dialog) {
  const pointer = dialog.ownerDocument.documentElement.hasAttribute("data-studio-pointer");
  dialog.toggleAttribute("data-studio-enter", pointer);
  dialog.showModal();
}
