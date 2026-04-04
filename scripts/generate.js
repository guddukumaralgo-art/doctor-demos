const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const doctorsFile = path.join(rootDir, "data", "doctors.json");
const templateFile = path.join(rootDir, "template", "clinic-template.html");
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

function readTemplate() {
  const template = fs.existsSync(templateFile)
    ? fs.readFileSync(templateFile, "utf8")
    : "";

  if (template.trim()) {
    return template;
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{name}} | {{clinic}}</title>
</head>
<body>
  <h1>{{name}}</h1>
  <p>{{clinic}}</p>
  <p>{{specialty}}</p>
  <p>{{address}}</p>
  <p>{{city}}</p>
  <img src="{{imagePath}}" alt="{{name}}" />
</body>
</html>`;
}

function normalizeDoctor(doctor) {
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
    slug,
    name,
    clinic,
    city,
    address: doctor.address || city,
    image: imageFileName,
    imagePath: imageFileName ? `./assets/images/${imageFileName}` : "",
    bio: doctor.bio || `${name} is a trusted ${doctor.specialty || "specialist"} serving patients through ${clinic}.`,
    experience: doctor.experience || "10+ years",
    availability: doctor.availability || "By appointment",
    service1: services[0] || "Personalized consultation",
    service2: services[1] || "Preventive care planning",
    service3: services[2] || "Advanced treatment guidance",
    service4: services[3] || "Follow-up and recovery support",
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

function fillTemplate(template, doctor) {
  return template.replace(/{{(\w+)}}/g, (_, key) => escapeHtml(doctor[key] ?? ""));
}

function renderIndex(doctors) {
  const cards = doctors
    .map((doctor) => {
      return `
        <article class="card">
          <img src="${escapeHtml(doctor.imagePath)}" alt="${escapeHtml(doctor.name)}" />
          <div class="content">
            <p class="eyebrow">${escapeHtml(doctor.specialty || "")}</p>
            <h2>${escapeHtml(doctor.name)}</h2>
            <p>${escapeHtml(doctor.clinic)}</p>
            <p class="meta">${escapeHtml(doctor.city)} · ${escapeHtml(doctor.experience)}</p>
            <p class="copy">${escapeHtml(doctor.bio)}</p>
            <a href="./${escapeHtml(doctor.slug)}.html">View Premium Demo</a>
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
    :root {
      --ink: #122033;
      --muted: #64748b;
      --accent: #0f766e;
      --accent-2: #2563eb;
      --card: rgba(255, 255, 255, 0.82);
      --line: rgba(15, 23, 42, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(15, 118, 110, 0.18), transparent 28%),
        radial-gradient(circle at top right, rgba(37, 99, 235, 0.16), transparent 26%),
        linear-gradient(180deg, #f7fbff 0%, #eef4fb 100%);
    }
    .wrap {
      max-width: 1220px;
      margin: 0 auto;
      padding: 42px 20px 60px;
    }
    .hero {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 20px;
      align-items: end;
      margin-bottom: 28px;
    }
    h1 {
      margin: 0 0 10px;
      font-size: clamp(42px, 6vw, 74px);
      line-height: 0.95;
      letter-spacing: -0.05em;
    }
    .sub {
      margin: 0;
      color: var(--muted);
      font-size: 18px;
      max-width: 58ch;
      line-height: 1.7;
    }
    .hero-card {
      padding: 22px;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.72);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.8);
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
    }
    .hero-card p {
      margin: 0 0 14px;
      color: var(--muted);
      line-height: 1.7;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 22px;
    }
    .card {
      overflow: hidden;
      border-radius: 28px;
      background: var(--card);
      border: 1px solid rgba(255,255,255,0.75);
      box-shadow: 0 18px 46px rgba(15, 23, 42, 0.1);
      backdrop-filter: blur(8px);
    }
    .card img {
      width: 100%;
      height: 260px;
      object-fit: cover;
      display: block;
      background: #d9e7f4;
    }
    .content {
      padding: 22px;
    }
    .eyebrow {
      margin: 0 0 12px;
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 28px;
      letter-spacing: -0.03em;
    }
    .content p {
      margin: 0 0 10px;
    }
    .meta {
      color: var(--muted);
      font-weight: 600;
    }
    .copy {
      color: #334155;
      line-height: 1.65;
      min-height: 90px;
    }
    a {
      display: inline-block;
      margin-top: 14px;
      text-decoration: none;
      color: white;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      padding: 12px 16px;
      border-radius: 14px;
      font-weight: 700;
      box-shadow: 0 16px 30px rgba(37, 99, 235, 0.2);
    }
    @media (max-width: 860px) {
      .hero {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <div>
        <h1>Doctor Demo Websites</h1>
        <p class="sub">Six premium demo websites for private practices, each generated from your JSON and ready for outreach, sales demos, or GitHub Pages hosting.</p>
      </div>
      <aside class="hero-card">
        <p><strong>What’s included</strong></p>
        <p>High-end doctor profile pages, premium homepage cards, deploy-safe image assets, and a clean flat docs structure for publishing.</p>
      </aside>
    </section>
    <section class="grid">
      ${cards}
    </section>
  </main>
</body>
</html>`;
}

function main() {
  cleanDocs();

  const template = readTemplate();
  const doctors = readDoctors().map(normalizeDoctor);

  for (const doctor of doctors) {
    copyDoctorImage(doctor);
    const html = fillTemplate(template, doctor);
    const outputFile = path.join(docsDir, `${doctor.slug}.html`);
    fs.writeFileSync(outputFile, html, "utf8");
  }

  const indexHtml = renderIndex(doctors);
  fs.writeFileSync(path.join(docsDir, "index.html"), indexHtml, "utf8");

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
