export function studioTable(caption, columns, rows) {
  return `<div class="studio-table-region" role="region" aria-label="${caption}" tabindex="0">
    <table class="studio-table">
      <caption class="sr-only">${caption}</caption>
      <thead><tr>${columns.map(([title, align]) => `<th scope="col"${align ? ` class="${align}"` : ""}>${title}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}
