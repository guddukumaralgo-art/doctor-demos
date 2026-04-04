const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const doctorsFile = path.join(rootDir, "data", "doctors.json");
const docsDir = path.join(rootDir, "docs");
const sourceImagesDir = path.join(rootDir, "data", "images");
const outputImagesDir = path.join(docsDir, "assets", "images");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cleanDocs() {
  if (fs.existsSync(docsDir)) {
    fs.rmSync(docsDir, { recursive: true, force: true });
  }
  ensureDir(docsDir);
  ensureDir(outputImagesDir);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char];
  });
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readDoctors() {
  const raw = fs.readFileSync(doctorsFile, "utf8").trim();

  if (!raw) {
    throw new Error("data/doctors.json is empty.");
  }

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("data/doctors.json must contain a non-empty array.");
  }

  return parsed;
}

function normalizeDoctor(doctor, index) {
  const name = doctor.doctor_name || doctor.name;
  const clinic = doctor.clinic_name || doctor.clinic;
  const city = doctor.location || doctor.city;
  const slug = doctor.slug || slugify(name || clinic);
  const imageFileName = doctor.image ? path.basename(doctor.image) : "";
  const services = Array.isArray(doctor.services) ? doctor.services : [];

  if (!name || !clinic || !city || !slug) {
    throw new Error("Each doctor needs doctor_name or name, clinic_name or clinic, location or city, and a valid slug.");
  }

  return {
    ...doctor,
    index,
    slug,
    name,
    clinic,
    city,
    address: doctor.address || city,
    image: imageFileName,
    imagePath: imageFileName ? `./assets/images/${imageFileName}` : "",
    accent: doctor.accent || "#0f766e",
    accent2: doctor.accent2 || "#2563eb",
    surface: doctor.surface || "#eff6ff",
    bio: doctor.bio || `${name} is a trusted ${doctor.specialty || "specialist"} serving patients through ${clinic}.`,
    experience: doctor.experience || "10+ years",
    availability: doctor.availability || "By appointment",
    service1: services[0] || "Personalized consultation",
    service2: services[1] || "Preventive care planning",
    service3: services[2] || "Advanced treatment guidance",
    service4: services[3] || "Follow-up and recovery support",
    services,
  };
}

function copyDoctorImage(doctor) {
  if (!doctor.image) {
    return;
  }

  const sourceFile = path.join(sourceImagesDir, doctor.image);
  const outputFile = path.join(outputImagesDir, doctor.image);

  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Image not found: data/images/${doctor.image}`);
  }

  fs.copyFileSync(sourceFile, outputFile);
}

function servicesList(doctor, className = "services") {
  const items = doctor.services.length
    ? doctor.services
    : [doctor.service1, doctor.service2, doctor.service3, doctor.service4];

  return `<ul class="${className}">${items
    .map((service) => `<li>${escapeHtml(service)}</li>`)
    .join("")}</ul>`;
}

function detailRows(doctor, className = "detail-list") {
  const details = [
    ["Clinic", doctor.clinic],
    ["Address", doctor.address],
    ["Phone", doctor.phone],
    ["Email", doctor.email],
    ["Availability", doctor.availability],
  ];

  return `<div class="${className}">${details
    .map(
      ([label, value]) =>
        `<div class="detail"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
    )
    .join("")}</div>`;
}

function pageShell(title, bodyClass, content) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body class="${bodyClass}">
${content}
</body>
</html>`;
}

function renderLayoutOne(doctor) {
  return pageShell(
    `${doctor.name} | ${doctor.clinic}`,
    "layout-one",
    `<style>
      :root{--accent:${doctor.accent};--accent2:${doctor.accent2};--surface:${doctor.surface};--ink:#102033;--muted:#64748b;}
      *{box-sizing:border-box} body{margin:0;font-family:Georgia,"Times New Roman",serif;background:linear-gradient(180deg,#fffdf9 0%,#eef7ff 100%);color:var(--ink)}
      .page{max-width:1180px;margin:0 auto;padding:28px 18px 60px}
      .nav{display:flex;justify-content:space-between;align-items:center;padding:6px 0 18px}
      .nav a,.nav strong{text-decoration:none;color:var(--ink);font:600 14px/1.2 Arial,sans-serif}
      .hero{display:grid;grid-template-columns:340px 1fr;gap:28px;padding:34px;border-radius:34px;background:linear-gradient(135deg,var(--surface),rgba(255,255,255,.92));box-shadow:0 28px 60px rgba(15,23,42,.1)}
      img{width:100%;aspect-ratio:1/1.15;object-fit:cover;border-radius:28px;background:#fff}
      .tag{display:inline-block;padding:9px 14px;border-radius:999px;background:rgba(255,255,255,.9);color:var(--accent);font:700 12px/1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase}
      h1{margin:16px 0 10px;font-size:clamp(38px,6vw,72px);line-height:.93}
      .clinic{font:600 24px/1.4 Arial,sans-serif;margin-bottom:12px}
      .bio{max-width:58ch;color:var(--muted);font:400 17px/1.75 Arial,sans-serif}
      .quick{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:22px 0}
      .quick div{padding:16px;border-radius:18px;background:rgba(255,255,255,.84)}
      .quick span{display:block;margin-bottom:6px;color:var(--muted);font:700 11px/1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase}
      .quick strong{font:700 17px/1.4 Arial,sans-serif}
      .actions{display:flex;gap:12px;flex-wrap:wrap}.btn{padding:14px 18px;border-radius:16px;text-decoration:none;font:700 14px/1 Arial,sans-serif}.solid{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff}.ghost{background:#fff;color:var(--ink)}
      .grid{display:grid;grid-template-columns:1.1fr .9fr;gap:18px;margin-top:20px}
      .card{background:rgba(255,255,255,.82);padding:24px;border-radius:26px;box-shadow:0 18px 36px rgba(15,23,42,.06)}
      h2{margin:0 0 16px;font-size:22px}
      .services{list-style:none;padding:0;margin:0;display:grid;gap:12px}.services li{padding:14px 16px;border-radius:18px;background:#fff;font:500 15px/1.6 Arial,sans-serif}
      .detail-list{display:grid;gap:14px}.detail span{display:block;color:var(--muted);font:700 11px/1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;margin-bottom:7px}.detail strong{font:500 15px/1.7 Arial,sans-serif}
      @media (max-width:860px){.hero,.grid,.quick{grid-template-columns:1fr}}
    </style>
    <main class="page">
      <div class="nav"><strong>Signature Practice</strong><a href="./index.html">Back to Showcase</a></div>
      <section class="hero">
        <img src="${escapeHtml(doctor.imagePath)}" alt="${escapeHtml(doctor.name)}" />
        <div>
          <span class="tag">${escapeHtml(doctor.specialty)}</span>
          <h1>${escapeHtml(doctor.name)}</h1>
          <div class="clinic">${escapeHtml(doctor.clinic)}</div>
          <p class="bio">${escapeHtml(doctor.bio)}</p>
          <div class="quick">
            <div><span>Experience</span><strong>${escapeHtml(doctor.experience)}</strong></div>
            <div><span>Availability</span><strong>${escapeHtml(doctor.availability)}</strong></div>
            <div><span>Location</span><strong>${escapeHtml(doctor.city)}</strong></div>
          </div>
          <div class="actions">
            <a class="btn solid" href="tel:${escapeHtml(doctor.phone)}">Call Now</a>
            <a class="btn ghost" href="mailto:${escapeHtml(doctor.email)}">Book Appointment</a>
          </div>
        </div>
      </section>
      <section class="grid">
        <article class="card"><h2>Signature Services</h2>${servicesList(doctor)}</article>
        <aside class="card"><h2>Visit Details</h2>${detailRows(doctor)}</aside>
      </section>
    </main>`
  );
}

function renderLayoutTwo(doctor) {
  return pageShell(
    `${doctor.name} | ${doctor.clinic}`,
    "layout-two",
    `<style>
      :root{--accent:${doctor.accent};--accent2:${doctor.accent2};--surface:${doctor.surface};--ink:#f8fafc;--muted:#cbd5e1}
      *{box-sizing:border-box} body{margin:0;font-family:Arial,sans-serif;background:#09090f;color:var(--ink)}
      .hero{min-height:100vh;display:grid;grid-template-columns:1.05fr .95fr}
      .copy{padding:46px 44px 54px;background:radial-gradient(circle at top left,rgba(255,255,255,.08),transparent 26%),linear-gradient(180deg,#0f172a 0%,#111827 100%)}
      .portrait{background:linear-gradient(160deg,var(--accent),var(--accent2));padding:46px;display:flex;align-items:center;justify-content:center}
      .portrait img{width:min(480px,100%);aspect-ratio:1/1.1;object-fit:cover;border-radius:36px;background:#fff;box-shadow:0 32px 80px rgba(0,0,0,.28)}
      .top{display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
      .top a{color:#fff;text-decoration:none}
      .spec{display:inline-block;margin-top:56px;padding:10px 14px;border:1px solid rgba(255,255,255,.16);border-radius:999px;color:#fff;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
      h1{margin:18px 0 12px;font-size:clamp(44px,7vw,92px);line-height:.88;letter-spacing:-.06em}
      .clinic{font-size:26px;font-weight:600;color:#fff}
      .bio{margin:20px 0 28px;max-width:60ch;color:var(--muted);font-size:18px;line-height:1.8}
      .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
      .stat{padding:18px;border-radius:22px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}
      .stat span{display:block;margin-bottom:8px;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
      .stat strong{font-size:18px}
      .stack{display:grid;gap:18px;margin-top:26px}
      .panel{padding:22px;border-radius:24px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}
      .panel h2{margin:0 0 14px;font-size:20px}
      .services{list-style:none;padding:0;margin:0;display:grid;gap:12px}.services li{padding:14px 16px;border-radius:16px;background:rgba(255,255,255,.05);line-height:1.6}
      .detail-list{display:grid;gap:14px}.detail span{display:block;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:7px}.detail strong{font-size:15px;line-height:1.6}
      .actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.btn{padding:14px 18px;border-radius:16px;text-decoration:none;font-weight:700}.solid{background:#fff;color:#111827}.ghost{color:#fff;border:1px solid rgba(255,255,255,.18)}
      @media (max-width:960px){.hero{grid-template-columns:1fr}.stats{grid-template-columns:1fr}}
    </style>
    <section class="hero">
      <div class="copy">
        <div class="top"><span>Private Practice Demo</span><a href="./index.html">Back to Showcase</a></div>
        <span class="spec">${escapeHtml(doctor.specialty)}</span>
        <h1>${escapeHtml(doctor.name)}</h1>
        <div class="clinic">${escapeHtml(doctor.clinic)}</div>
        <p class="bio">${escapeHtml(doctor.bio)}</p>
        <div class="stats">
          <div class="stat"><span>Experience</span><strong>${escapeHtml(doctor.experience)}</strong></div>
          <div class="stat"><span>Availability</span><strong>${escapeHtml(doctor.availability)}</strong></div>
          <div class="stat"><span>Location</span><strong>${escapeHtml(doctor.city)}</strong></div>
        </div>
        <div class="actions">
          <a class="btn solid" href="tel:${escapeHtml(doctor.phone)}">Call Now</a>
          <a class="btn ghost" href="mailto:${escapeHtml(doctor.email)}">Book Appointment</a>
        </div>
        <div class="stack">
          <article class="panel"><h2>Specialized Care</h2>${servicesList(doctor)}</article>
          <article class="panel"><h2>Contact & Access</h2>${detailRows(doctor)}</article>
        </div>
      </div>
      <div class="portrait"><img src="${escapeHtml(doctor.imagePath)}" alt="${escapeHtml(doctor.name)}" /></div>
    </section>`
  );
}

function renderLayoutThree(doctor) {
  return pageShell(
    `${doctor.name} | ${doctor.clinic}`,
    "layout-three",
    `<style>
      :root{--accent:${doctor.accent};--accent2:${doctor.accent2};--surface:${doctor.surface};--ink:#1f2937;--muted:#64748b}
      *{box-sizing:border-box} body{margin:0;font-family:Arial,sans-serif;background:#f8fafc;color:var(--ink)}
      .page{max-width:1220px;margin:0 auto;padding:26px 18px 56px}
      .top{display:grid;grid-template-columns:1.25fr .75fr;gap:18px}
      .mast,.photo,.content,.aside{border-radius:28px;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,.08)}
      .mast{padding:34px;background:linear-gradient(135deg,#fff,var(--surface))}
      .mast a{display:inline-block;margin-bottom:28px;color:var(--ink);text-decoration:none;font-weight:700}
      .eyebrow{display:inline-block;padding:8px 12px;border-radius:999px;background:#fff;color:var(--accent);font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
      h1{margin:16px 0 10px;font-size:clamp(42px,6vw,78px);line-height:.92;letter-spacing:-.05em;font-family:Georgia,"Times New Roman",serif}
      .clinic{font-size:24px;font-weight:600;margin-bottom:12px}
      .bio{max-width:56ch;color:var(--muted);font-size:17px;line-height:1.8}
      .ribbon{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}
      .pill{padding:12px 14px;border-radius:14px;background:#fff;font-size:14px;font-weight:700}
      .photo{background:linear-gradient(180deg,var(--accent),var(--accent2));display:flex;align-items:flex-end;justify-content:center;padding:28px}
      .photo img{width:100%;max-width:380px;aspect-ratio:1/1.15;object-fit:cover;border-radius:24px;background:#fff}
      .bottom{display:grid;grid-template-columns:.85fr 1.15fr;gap:18px;margin-top:18px}
      .aside,.content{background:#fff;padding:24px}
      h2{margin:0 0 16px;font-size:22px;font-family:Georgia,"Times New Roman",serif}
      .detail-list{display:grid;gap:14px}.detail{padding-bottom:14px;border-bottom:1px solid #e2e8f0}.detail:last-child{border-bottom:0;padding-bottom:0}.detail span{display:block;margin-bottom:6px;color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.detail strong{font-size:15px;line-height:1.7}
      .services{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;list-style:none;padding:0;margin:0}.services li{padding:16px;border-radius:18px;background:var(--surface);line-height:1.7}
      .actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}.btn{padding:14px 18px;border-radius:14px;text-decoration:none;font-weight:700}.solid{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff}.ghost{background:#f8fafc;color:var(--ink)}
      @media (max-width:960px){.top,.bottom,.services{grid-template-columns:1fr}}
    </style>
    <main class="page">
      <section class="top">
        <article class="mast">
          <a href="./index.html">Back to Showcase</a>
          <span class="eyebrow">${escapeHtml(doctor.specialty)}</span>
          <h1>${escapeHtml(doctor.name)}</h1>
          <div class="clinic">${escapeHtml(doctor.clinic)}</div>
          <p class="bio">${escapeHtml(doctor.bio)}</p>
          <div class="ribbon">
            <span class="pill">${escapeHtml(doctor.experience)}</span>
            <span class="pill">${escapeHtml(doctor.availability)}</span>
            <span class="pill">${escapeHtml(doctor.city)}</span>
          </div>
          <div class="actions">
            <a class="btn solid" href="tel:${escapeHtml(doctor.phone)}">Call Now</a>
            <a class="btn ghost" href="mailto:${escapeHtml(doctor.email)}">Book Appointment</a>
          </div>
        </article>
        <aside class="photo"><img src="${escapeHtml(doctor.imagePath)}" alt="${escapeHtml(doctor.name)}" /></aside>
      </section>
      <section class="bottom">
        <aside class="aside"><h2>Clinic Information</h2>${detailRows(doctor)}</aside>
        <article class="content"><h2>Treatment Highlights</h2>${servicesList(doctor)}</article>
      </section>
    </main>`
  );
}

function renderLayoutFour(doctor) {
  return pageShell(
    `${doctor.name} | ${doctor.clinic}`,
    "layout-four",
    `<style>
      :root{--accent:${doctor.accent};--accent2:${doctor.accent2};--surface:${doctor.surface};--ink:#0f172a;--muted:#475569}
      *{box-sizing:border-box} body{margin:0;font-family:Arial,sans-serif;background:#ffffff;color:var(--ink)}
      .strip{height:18px;background:linear-gradient(90deg,var(--accent),var(--accent2))}
      .page{max-width:1240px;margin:0 auto;padding:0 20px 56px}
      .nav{display:flex;justify-content:space-between;align-items:center;padding:18px 0}
      .nav a,.nav strong{text-decoration:none;color:var(--ink);font-weight:700}
      .grid{display:grid;grid-template-columns:1fr 320px;gap:24px}
      .hero{display:grid;grid-template-columns:1fr 360px;gap:24px;padding:10px 0 10px}
      h1{margin:0 0 8px;font-size:clamp(44px,6vw,84px);line-height:.92;letter-spacing:-.06em;font-family:Georgia,"Times New Roman",serif}
      .spec{color:var(--accent);font-size:14px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin:14px 0}
      .clinic{font-size:24px;font-weight:700}
      .bio{margin:18px 0 0;max-width:60ch;color:var(--muted);font-size:17px;line-height:1.8}
      .portrait{padding:20px;border-radius:32px;background:linear-gradient(180deg,var(--surface),#fff)}
      .portrait img{width:100%;aspect-ratio:1/1.15;object-fit:cover;border-radius:24px}
      .sidebar{padding:24px;border-radius:28px;background:#0f172a;color:#e2e8f0;align-self:start;position:sticky;top:18px}
      .sidebar h2{margin:0 0 16px;font-size:20px;font-family:Georgia,"Times New Roman",serif}
      .sidebar .detail{padding:14px 0;border-bottom:1px solid rgba(255,255,255,.08)}
      .sidebar .detail:last-child{border-bottom:0}
      .sidebar span{display:block;margin-bottom:6px;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
      .sidebar strong{font-size:15px;line-height:1.7}
      .actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}.btn{padding:14px 18px;border-radius:14px;text-decoration:none;font-weight:700}.solid{background:#fff;color:#111827}.ghost{color:#fff;border:1px solid rgba(255,255,255,.2)}
      .panels{display:grid;gap:18px;margin-top:20px}
      .panel{padding:24px;border-radius:28px;background:#f8fafc}
      .panel h2{margin:0 0 14px;font-size:22px;font-family:Georgia,"Times New Roman",serif}
      .services{list-style:none;padding:0;margin:0;display:grid;gap:12px}.services li{padding:16px;border-radius:18px;background:#fff;border-left:6px solid var(--accent);line-height:1.7}
      .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.metric{padding:16px;border-radius:18px;background:#fff}.metric span{display:block;color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:7px}.metric strong{font-size:17px}
      @media (max-width:1024px){.grid,.hero,.metrics{grid-template-columns:1fr}.sidebar{position:static}}
    </style>
    <div class="strip"></div>
    <main class="page">
      <div class="nav"><strong>Clinical Profile</strong><a href="./index.html">Back to Showcase</a></div>
      <section class="grid">
        <div>
          <section class="hero">
            <div>
              <div class="spec">${escapeHtml(doctor.specialty)}</div>
              <h1>${escapeHtml(doctor.name)}</h1>
              <div class="clinic">${escapeHtml(doctor.clinic)}</div>
              <p class="bio">${escapeHtml(doctor.bio)}</p>
            </div>
            <div class="portrait"><img src="${escapeHtml(doctor.imagePath)}" alt="${escapeHtml(doctor.name)}" /></div>
          </section>
          <section class="panels">
            <article class="panel"><h2>Care Focus</h2>${servicesList(doctor)}</article>
            <article class="panel">
              <h2>Practice Snapshot</h2>
              <div class="metrics">
                <div class="metric"><span>Experience</span><strong>${escapeHtml(doctor.experience)}</strong></div>
                <div class="metric"><span>Availability</span><strong>${escapeHtml(doctor.availability)}</strong></div>
                <div class="metric"><span>Location</span><strong>${escapeHtml(doctor.city)}</strong></div>
              </div>
            </article>
          </section>
        </div>
        <aside class="sidebar">
          <h2>Book & Visit</h2>
          ${detailRows(doctor)}
          <div class="actions">
            <a class="btn solid" href="tel:${escapeHtml(doctor.phone)}">Call Now</a>
            <a class="btn ghost" href="mailto:${escapeHtml(doctor.email)}">Book Appointment</a>
          </div>
        </aside>
      </section>
    </main>`
  );
}

function renderLayoutFive(doctor) {
  return pageShell(
    `${doctor.name} | ${doctor.clinic}`,
    "layout-five",
    `<style>
      :root{--accent:${doctor.accent};--accent2:${doctor.accent2};--surface:${doctor.surface};--ink:#1f2937;--muted:#64748b}
      *{box-sizing:border-box} body{margin:0;font-family:Arial,sans-serif;background:linear-gradient(180deg,var(--surface),#fff);color:var(--ink)}
      .page{max-width:1220px;margin:0 auto;padding:24px 20px 56px}
      .nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
      .nav a,.nav strong{text-decoration:none;color:var(--ink);font-weight:700}
      .hero{display:grid;grid-template-columns:320px 1fr 280px;gap:18px;align-items:stretch}
      .portrait,.center,.rail{border-radius:30px;background:#fff;box-shadow:0 18px 40px rgba(15,23,42,.08)}
      .portrait{padding:18px}.portrait img{width:100%;aspect-ratio:1/1.18;object-fit:cover;border-radius:24px;background:var(--surface)}
      .center{padding:28px;background:linear-gradient(160deg,#fff,rgba(255,255,255,.88))}
      .spec{display:inline-block;padding:9px 14px;border-radius:999px;background:var(--surface);color:var(--accent);font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase}
      h1{margin:18px 0 10px;font-size:clamp(42px,6vw,76px);line-height:.92;letter-spacing:-.05em;font-family:Georgia,"Times New Roman",serif}
      .clinic{font-size:26px;font-weight:700;margin-bottom:12px}
      .bio{color:var(--muted);font-size:17px;line-height:1.8;max-width:56ch}
      .inline{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:20px}.inline div{padding:14px;border-radius:18px;background:#f8fafc}.inline span{display:block;color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:7px}.inline strong{font-size:16px}
      .rail{padding:24px;background:linear-gradient(180deg,var(--accent),var(--accent2));color:#fff}
      .rail h2{margin:0 0 14px;font-size:22px;font-family:Georgia,"Times New Roman",serif}
      .rail .detail{padding:12px 0;border-bottom:1px solid rgba(255,255,255,.18)}.rail .detail:last-child{border-bottom:0}
      .rail span{display:block;color:rgba(255,255,255,.72);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px}.rail strong{font-size:15px;line-height:1.7}
      .actions{display:grid;gap:10px;margin-top:20px}.btn{text-decoration:none;text-align:center;padding:14px 18px;border-radius:14px;font-weight:700}.solid{background:#fff;color:var(--accent)}.ghost{background:rgba(255,255,255,.14);color:#fff}
      .section{margin-top:18px;padding:24px;border-radius:30px;background:#fff;box-shadow:0 18px 40px rgba(15,23,42,.06)}
      .section h2{margin:0 0 16px;font-size:24px;font-family:Georgia,"Times New Roman",serif}
      .services{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;list-style:none;padding:0;margin:0}.services li{padding:16px;border-radius:20px;background:var(--surface);line-height:1.7}
      @media (max-width:1080px){.hero,.inline,.services{grid-template-columns:1fr}}
    </style>
    <main class="page">
      <div class="nav"><strong>Concierge Practice Demo</strong><a href="./index.html">Back to Showcase</a></div>
      <section class="hero">
        <aside class="portrait"><img src="${escapeHtml(doctor.imagePath)}" alt="${escapeHtml(doctor.name)}" /></aside>
        <article class="center">
          <span class="spec">${escapeHtml(doctor.specialty)}</span>
          <h1>${escapeHtml(doctor.name)}</h1>
          <div class="clinic">${escapeHtml(doctor.clinic)}</div>
          <p class="bio">${escapeHtml(doctor.bio)}</p>
          <div class="inline">
            <div><span>Experience</span><strong>${escapeHtml(doctor.experience)}</strong></div>
            <div><span>Hours</span><strong>${escapeHtml(doctor.availability)}</strong></div>
            <div><span>City</span><strong>${escapeHtml(doctor.city)}</strong></div>
          </div>
        </article>
        <aside class="rail">
          <h2>Contact</h2>
          ${detailRows(doctor)}
          <div class="actions">
            <a class="btn solid" href="tel:${escapeHtml(doctor.phone)}">Call Now</a>
            <a class="btn ghost" href="mailto:${escapeHtml(doctor.email)}">Book Appointment</a>
          </div>
        </aside>
      </section>
      <section class="section"><h2>Service Menu</h2>${servicesList(doctor)}</section>
    </main>`
  );
}

function renderLayoutSix(doctor) {
  return pageShell(
    `${doctor.name} | ${doctor.clinic}`,
    "layout-six",
    `<style>
      :root{--accent:${doctor.accent};--accent2:${doctor.accent2};--surface:${doctor.surface};--ink:#111827;--muted:#6b7280}
      *{box-sizing:border-box} body{margin:0;font-family:Arial,sans-serif;background:#f3f4f6;color:var(--ink)}
      .hero{min-height:100vh;display:grid;grid-template-columns:44% 56%}
      .left{padding:42px;background:linear-gradient(180deg,var(--surface),#fff)}
      .right{padding:42px;background:#fff}
      .nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:34px}
      .nav a,.nav strong{text-decoration:none;color:var(--ink);font-weight:700}
      .spec{display:inline-block;padding:10px 14px;border-radius:999px;background:#fff;color:var(--accent);font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase}
      h1{margin:18px 0 10px;font-size:clamp(46px,7vw,88px);line-height:.88;letter-spacing:-.07em;font-family:Georgia,"Times New Roman",serif}
      .clinic{font-size:24px;font-weight:700}
      .bio{margin:18px 0 0;color:var(--muted);font-size:17px;line-height:1.85;max-width:54ch}
      .portrait-wrap{margin-top:34px;padding:20px;border-radius:32px;background:linear-gradient(135deg,var(--accent),var(--accent2))}
      .portrait-wrap img{width:100%;aspect-ratio:1/1.12;object-fit:cover;border-radius:24px;background:#fff}
      .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:24px}
      .metric{padding:16px;border-radius:18px;background:#fff}.metric span{display:block;color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:7px}.metric strong{font-size:16px}
      .actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}.btn{padding:14px 18px;border-radius:16px;text-decoration:none;font-weight:700}.solid{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff}.ghost{background:#f3f4f6;color:var(--ink)}
      .block{padding:24px;border-radius:26px;background:#f9fafb;margin-bottom:18px}
      .block h2{margin:0 0 16px;font-size:24px;font-family:Georgia,"Times New Roman",serif}
      .services{list-style:none;padding:0;margin:0;display:grid;gap:12px}.services li{padding:15px 16px;border-radius:16px;background:#fff;border:1px solid #e5e7eb;line-height:1.7}
      .detail-list{display:grid;grid-template-columns:1fr 1fr;gap:14px}.detail{padding:16px;border-radius:18px;background:#fff}.detail span{display:block;color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:7px}.detail strong{font-size:15px;line-height:1.7}
      @media (max-width:1024px){.hero,.metrics,.detail-list{grid-template-columns:1fr}}
    </style>
    <section class="hero">
      <div class="left">
        <div class="nav"><strong>Modern Practice Profile</strong><a href="./index.html">Back to Showcase</a></div>
        <span class="spec">${escapeHtml(doctor.specialty)}</span>
        <h1>${escapeHtml(doctor.name)}</h1>
        <div class="clinic">${escapeHtml(doctor.clinic)}</div>
        <p class="bio">${escapeHtml(doctor.bio)}</p>
        <div class="metrics">
          <div class="metric"><span>Experience</span><strong>${escapeHtml(doctor.experience)}</strong></div>
          <div class="metric"><span>Availability</span><strong>${escapeHtml(doctor.availability)}</strong></div>
          <div class="metric"><span>Location</span><strong>${escapeHtml(doctor.city)}</strong></div>
        </div>
        <div class="actions">
          <a class="btn solid" href="tel:${escapeHtml(doctor.phone)}">Call Now</a>
          <a class="btn ghost" href="mailto:${escapeHtml(doctor.email)}">Book Appointment</a>
        </div>
        <div class="portrait-wrap"><img src="${escapeHtml(doctor.imagePath)}" alt="${escapeHtml(doctor.name)}" /></div>
      </div>
      <div class="right">
        <div class="block"><h2>Featured Services</h2>${servicesList(doctor)}</div>
        <div class="block"><h2>Practice Details</h2>${detailRows(doctor)}</div>
      </div>
    </section>`
  );
}

const profileLayouts = [
  renderLayoutOne,
  renderLayoutTwo,
  renderLayoutThree,
  renderLayoutFour,
  renderLayoutFive,
  renderLayoutSix,
];

function renderProfile(doctor) {
  const renderer = profileLayouts[doctor.index % profileLayouts.length];
  return renderer(doctor);
}

function renderIndex(doctors) {
  const cards = doctors
    .map((doctor) => {
      return `
        <article class="card" style="--accent:${escapeHtml(doctor.accent)};--accent2:${escapeHtml(doctor.accent2)};--surface:${escapeHtml(doctor.surface)};">
          <img src="${escapeHtml(doctor.imagePath)}" alt="${escapeHtml(doctor.name)}" />
          <div class="content">
            <p class="eyebrow">${escapeHtml(doctor.specialty || "")}</p>
            <h2>${escapeHtml(doctor.name)}</h2>
            <p>${escapeHtml(doctor.clinic)}</p>
            <p class="meta">${escapeHtml(doctor.city)} · ${escapeHtml(doctor.experience)}</p>
            <p class="copy">${escapeHtml(doctor.bio)}</p>
            <a href="./${escapeHtml(doctor.slug)}.html">Open Unique Demo</a>
          </div>
        </article>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Doctor Demo Websites</title>
  <style>
    :root{--ink:#1a1720;--muted:#6d6677}
    *{box-sizing:border-box} body{margin:0;font-family:Georgia,"Times New Roman",serif;color:var(--ink);background:radial-gradient(circle at top left,rgba(236,72,153,.1),transparent 26%),radial-gradient(circle at top right,rgba(37,99,235,.12),transparent 24%),linear-gradient(180deg,#fffdf8 0%,#f7f0e7 100%)}
    .wrap{max-width:1220px;margin:0 auto;padding:42px 20px 68px}
    .hero{display:grid;grid-template-columns:1.2fr .8fr;gap:24px;align-items:end;margin-bottom:34px}
    h1{margin:0 0 10px;font-size:clamp(46px,6vw,82px);line-height:.92;letter-spacing:-.05em}
    .sub{margin:0;color:var(--muted);font-size:18px;max-width:58ch;line-height:1.7;font-family:Arial,sans-serif}
    .hero-card{padding:26px;border-radius:28px;background:rgba(255,250,242,.78);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.82);box-shadow:0 24px 60px rgba(33,24,48,.08)}
    .hero-card p{margin:0 0 14px;color:var(--muted);line-height:1.7;font-family:Arial,sans-serif}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:22px}
    .card{overflow:hidden;position:relative;border-radius:30px;background:linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,255,255,.82));border:1px solid rgba(255,255,255,.76);box-shadow:0 20px 50px rgba(33,24,48,.1)}
    .card::before{content:"";position:absolute;inset:0 0 auto 0;height:220px;background:linear-gradient(135deg,var(--surface),rgba(255,255,255,0));pointer-events:none}
    .card img{width:100%;height:260px;object-fit:cover;display:block;background:linear-gradient(135deg,var(--surface),#fff)}
    .content{position:relative;padding:24px}
    .eyebrow{margin:0 0 12px;color:var(--accent);font:700 12px/1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase}
    h2{margin:0 0 8px;font-size:28px;letter-spacing:-.03em}
    .content p{margin:0 0 10px;font-family:Arial,sans-serif}
    .meta{color:var(--muted);font-weight:600}
    .copy{color:#334155;line-height:1.65;min-height:90px}
    a{display:inline-block;margin-top:14px;text-decoration:none;color:#fff;background:linear-gradient(135deg,var(--accent),var(--accent2));padding:12px 16px;border-radius:14px;font:700 14px/1 Arial,sans-serif}
    @media (max-width:860px){.hero{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <div>
        <h1>Doctor Demo Websites</h1>
        <p class="sub">Every doctor profile now uses a different layout system, so the showcase feels like six separate premium website concepts instead of one repeated template.</p>
      </div>
      <aside class="hero-card">
        <p><strong>What changed</strong></p>
        <p>Distinct hero structures, different content flows, varied card systems, unique page proportions, and separate visual moods for every doctor profile.</p>
      </aside>
    </section>
    <section class="grid">${cards}</section>
  </main>
</body>
</html>`;
}

function main() {
  cleanDocs();

  const doctors = readDoctors().map(normalizeDoctor);

  for (const doctor of doctors) {
    copyDoctorImage(doctor);
    const html = renderProfile(doctor);
    const outputFile = path.join(docsDir, `${doctor.slug}.html`);
    fs.writeFileSync(outputFile, html, "utf8");
  }

  fs.writeFileSync(path.join(docsDir, "index.html"), renderIndex(doctors), "utf8");

  console.log(`Generated ${doctors.length} page(s):`);
  console.log("- docs/index.html");
  for (const doctor of doctors) {
    console.log(`- docs/${doctor.slug}.html`);
  }
}

try {
  main();
} catch (error) {
  console.error(`Generation failed: ${error.message}`);
  process.exitCode = 1;
}
