import process from "node:process"

// Preload before WXT/Vite reads .env: upstream unit tests use these URL fixtures.
// This module is only loaded by test commands, never by development or builds.
process.env.WXT_WEBSITE_URL = "https://www.readfrog.app"
process.env.WXT_OFFICIAL_SITE_ORIGINS = "https://readfrog.app,https://www.readfrog.app"
