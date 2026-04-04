const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const doctorsFile = path.join(rootDir, "data", "doctors.json");
const templateFile = path.join(rootDir, "template", "clinic-template.html");
const docsDir = path.join(rootDir, "docs");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cleanDocs() {
  if (fs.existsSync(docsDir)) {
    fs.rmSync(docsDir, { recursive: true, force: true });
  }
  ensureDir(docsDir);
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
    imagePath: doctor.image || "",
  };
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
            <p>${escapeHtml(doctor.city)}</p>
            <a href="./${escapeHtml(doctor.slug)}.html">View Profile</a>
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
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f5f7fb;
      color: #1f2937;
    }
    .wrap {
      max-width: 1100px;
      margin: 0 auto;
      padding: 32px 20px 48px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 40px;
    }
    .sub {
      margin: 0 0 28px;
      color: #6b7280;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
    }
    .card {
      overflow: hidden;
      border-radius: 18px;
      background: white;
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.08);
    }
    .card img {
      width: 100%;
      height: 220px;
      object-fit: cover;
      display: block;
      background: #e5e7eb;
    }
    .content {
      padding: 18px;
    }
    .eyebrow {
      margin: 0 0 10px;
      color: #075985;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 24px;
    }
    .content p {
      margin: 0 0 8px;
    }
    a {
      display: inline-block;
      margin-top: 12px;
      text-decoration: none;
      color: white;
      background: #2563eb;
      padding: 10px 14px;
      border-radius: 10px;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <main class="wrap">
    <h1>Doctor Demo Websites</h1>
    <p class="sub">Browse generated doctor profile pages.</p>
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
