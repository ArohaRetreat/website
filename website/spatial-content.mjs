const price = (n) => "₹" + Number(n).toLocaleString("en-IN");
export function spatialStories(c) {
  const j = (id) => c.journey.find((x) => x.id === id) || c.journey[0] || {name:c.brand.name,title:c.hero.title,description:c.intro.description};
  const exp = (id) => c.experiences.find((x) => x.id === id);
  const well=c.packages.find(x=>x.id==="wellness")||c.packages.at(-1);
  const packageFacts = c.packages.map((p) => ({
    label: p.name,
    value: `From ${price(p.price)} · ${p.unit}`,
  }));
  return [
    {
      k: c.hero.eyebrow,
      t: c.hero.title,
      d: c.hero.description,
      a: c.hero.primaryLabel,
      more: "About Aroha & getting here",
      facts: packageFacts,
    },
    {
      k: "01 / " + j("path").name,
      t: j("path").title,
      d: j("path").description,
      a: "Continue to the cottages",
      more: "Explore the farm & facilities",
      facts: [
        {
          label: "Nature & farm walks",
          value: exp("walk")?.name || c.brand.tagline,
        },
        { label: "Swimming & seasonal food", value: c.visit.note },
      ],
    },
    {
      k: "02 / " + j("cottages").name,
      t: j("cottages").title,
      d: j("cottages").description,
      a: "Compare cottage styles",
      more: "Visit packages & inclusions",
      facts: c.cottages.map((x) => ({
        label: x.name,
        value: "View photographs & details",
        cottage: x.id,
      })),
    },
    {
      k: "03 / " + j("stillness").name,
      t: j("stillness").title,
      d: j("stillness").description,
      a: "Wellness programme & inclusions",
      more: "Compare all ways to visit",
      facts: (well?.inclusions||[])
        .filter((x) => /meditation|wellness|mountain/i.test(x))
        .slice(0, 2)
        .map((x) => ({ label: x, value: well?.name||c.brand.name }))
        .concat(well?[{label:"Retreat from "+price(well.price),value:well.unit}]:[]),
    },
    {
      k: "04 / " + j("farm").name,
      t: j("farm").title,
      d: j("farm").description,
      a: "Explore all farm experiences",
      more: "Meals, stays & visit packages",
      facts: c.experiences
        .filter((x) => ["animals", "food", "pool"].includes(x.id))
        .map((x) => ({
          label: x.name,
          value: "Explore this experience",
          experience: x.id,
        })),
    },
    {
      k: c.brand.tagline,
      t: c.sections.find((x) => x.id === "packages")?.title || c.brand.welcome,
      d: c.visit.priceNote,
      a: "Compare packages & inclusions",
      more: "Getting here & practical details",
      facts: packageFacts,
    },
  ];
}
export function renderSpatialFacts(facts, esc) {
  return facts
    .map(
      (x) =>
        `<${x.cottage || x.experience ? 'button type="button"' : "div"} class="spatial-fact" ${x.cottage ? `data-spatial-cottage="${esc(x.cottage)}"` : x.experience ? `data-spatial-experience="${esc(x.experience)}"` : ""}><strong>${esc(x.label)}</strong><span>${esc(x.value)}${x.cottage || x.experience ? ' <b aria-hidden="true">↗</b>' : ""}</span></${x.cottage || x.experience ? "button" : "div"}>`,
    )
    .join("");
}
export function renderJourneyGuide(c, index, { esc, money, picture }) {
  const mode =
    index === 0
      ? "arrival"
      : index === 2
        ? "cottages"
        : index === 3
          ? "wellness"
          : index === 5
            ? "packages"
            : "farm";
  const images = {
    arrival: { image: c.hero.image, imageAlt: c.hero.imageAlt },
    cottages: c.cottages[0]||c.intro,
    wellness: c.intro,
    farm: {
      image: "/assets/retreat/DSC_3823.webp",
      imageAlt: "Farm animals at Aroha",
    },
    packages: c.gallery[0]||c.intro,
  };
  const titles = {
    arrival: c.brand.welcome,
    cottages: "Find your own quiet corner.",
    wellness: "Make room for stillness.",
    farm: "Choose your own rhythm.",
    packages: "Three ways to visit Aroha.",
  };
  const blocks = (items) =>
    items
      .map(
        (x) =>
          `<article class="guide-experience"><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p></article>`,
      )
      .join("");
  const packageCards = () =>
    `<div class="guide-packages">${c.packages.map((p) => `<article><p class="eyebrow">${esc(p.subtitle)}</p><h3>${esc(p.name)}</h3><p class="guide-price">${money(p.price)} <small>${esc(p.unit)}</small></p><p>${esc(p.description)}</p><ul>${p.inclusions.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p class="guide-package-note">${esc(p.note)}</p><button class="button" data-guide-package="${esc(p.id)}">Enquire about ${esc(p.name)} ↗</button></article>`).join("")}</div><p class="guide-disclaimer">${esc(c.visit.priceNote)}</p>`;
  let body = "";
  if (mode === "arrival")
    body = `<p class="guide-lede">${esc(c.intro.description)}</p><div class="guide-split"><div><h3>A place for your own pace</h3><p>${esc(c.brand.tagline)}</p><p>Choose ${c.packages.map((x) => esc(x.name)).join(", ")}. Join what interests you and leave time to simply enjoy the farm.</p><p><strong>${esc(c.visit.note)}</strong></p><button class="button" data-guide-section="packages">Explore ways to visit ↗</button></div><div><h3>Getting here</h3><p>${esc(c.visit.description)}</p><a class="text-link" href="${esc(c.visit.mapUrl)}" target="_blank" rel="noopener noreferrer">Open directions ↗</a><p>Guests arrange their own transport. The hosts can recommend a reliable driver.</p><a href="tel:+${esc(c.visit.phone)}">+${esc(c.visit.phone)}</a><br><a href="mailto:${esc(c.visit.email)}">${esc(c.visit.email)}</a></div></div>`;
  if (mode === "cottages")
    body = `<p class="guide-lede">Private, en-suite accommodation is included with Farm Stay and Meditation & Wellness. Tell the hosts your preferred cottage; they will confirm availability personally.</p><div class="guide-cottages">${c.cottages.map((x) => `<article>${picture(x.image, x.imageAlt)}<h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><p class="guide-package-note">${esc(x.detail)}</p><button class="button outline" data-guide-cottage="${esc(x.id)}">View photos & details ↗</button></article>`).join("")}</div><p class="guide-disclaimer">Day visits do not include an overnight room. Photographs are supplied farm views; ask the hosts for the current room interiors and access details.</p>`;
  if (mode === "wellness")
    body = `<p class="guide-lede">${esc(c.journey.find((x) => x.id === "stillness")?.description || c.intro.description)}</p><div class="guide-split">${blocks(c.experiences.filter((x) => ["meditation", "walk", "food"].includes(x.id)))}</div><h3 class="guide-subheading">Your retreat, with the details</h3>${packageCards()}`;
  if (mode === "farm")
    body = `<p class="guide-lede">${esc(c.intro.description)}</p><div class="guide-experiences">${blocks(c.experiences)}</div><div class="guide-policy"><strong>${esc(c.visit.note)}</strong><p>Participation is relaxed. Join the activities that interest you and leave room for an unhurried day.</p></div><button class="button" data-guide-section="packages">Compare visits & inclusions ↗</button>`;
  if (mode === "packages")
    body = `<p class="guide-lede">A day away, an overnight farm stay, or a meditation retreat. Your hosts confirm the dates, cottage preference and availability personally. There is no online payment.</p>${packageCards()}<div class="guide-split"><div><h3>Children & groups</h3><p>Children below five stay free when sharing with parents. Child and group tariffs are shown with each package; confirm current prices with the hosts.</p></div><div><h3>Before you travel</h3><p>${esc(c.visit.description)}</p><p><strong>${esc(c.visit.note)}</strong></p><a class="text-link" href="${esc(c.visit.mapUrl)}" target="_blank" rel="noopener noreferrer">Find your way ↗</a></div></div>`;
  const photo = images[mode];
  return `<div class="journey-guide">${picture(photo.image, photo.imageAlt, "guide-cover")}<div class="guide-content"><p class="eyebrow">${esc(c.brand.name)} · EXPLORE A LITTLE FURTHER</p><h2 id="dialog-title">${esc(titles[mode])}</h2>${body}<div class="guide-end"><span>${esc(c.brand.welcome)}</span><button class="button outline" data-guide-enquiry>${esc(c.visit.enquiryLabel)} ↗</button></div></div></div>`;
}
