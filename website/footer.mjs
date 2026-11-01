// Shared visitor footer. Both public routes receive the same content and interactions.
export function renderFooter(c, { esc, lines, picture }) {
  return `<footer class="field-footer"><div>${picture("/assets/retreat/DSC_3779.webp", "The main house glowing after sunset")}<div class="field-footer-shade"></div></div><p class="eyebrow">${esc(c.brand.tagline)}</p><h2>${lines(c.brand.welcome.replace(", ", ",\n"))}</h2><button class="field-enter" id="footer-enquire" data-enquire=""><span class="enter-orbit" aria-hidden="true">↗</span>${esc(c.visit.enquiryLabel)}</button><span lang="kn">${esc(c.brand.welcomeKannada)}</span><div class="field-footer-bottom"><a href="/map/">Explore the Living Map</a><a href="/admin/">Host login</a><span>© ${new Date().getFullYear()} ${esc(c.brand.name)}</span><button id="privacy-settings">Privacy & monitoring</button></div></footer>`;
}
export function guestDialogMarkup() {
  return `<dialog id="details-dialog" class="details-dialog" aria-labelledby="dialog-title"><button class="dialog-close" aria-label="Close details">×</button><div id="dialog-content"></div></dialog>`;
}
