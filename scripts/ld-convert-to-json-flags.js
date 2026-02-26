#!/usr/bin/env node
/**
 * Converts LaunchDarkly category flags from boolean to JSON multivariate.
 *
 * Each category flag's JSON value will contain a "pages" object listing every
 * demo page in that category, all set to true (enabled) by default.
 *
 * The script:
 *   1. Deletes each existing boolean category flag (safe if it doesn't exist)
 *   2. Creates a new JSON multivariate flag with the same key
 *   3. Turns the flag ON in the target environment
 *
 * Usage:
 *   export LD_API_TOKEN="api-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 *   export LD_PROJECT_KEY="your-project-key"
 *   export LD_ENVIRONMENT_KEY="production"        # optional, defaults to "production"
 *   node scripts/ld-convert-to-json-flags.js
 *
 * Or via npm:
 *   LD_API_TOKEN=... LD_PROJECT_KEY=... npm run ld:convert
 *
 * To get an API token: LaunchDarkly > Account settings > Authorization > Create token
 * The token needs at least "Writer" role permissions.
 */

const fs = require("fs");
const path = require("path");

const LD_API_TOKEN = process.env.LD_API_TOKEN;
const LD_PROJECT_KEY = process.env.LD_PROJECT_KEY;
const LD_ENVIRONMENT_KEY = process.env.LD_ENVIRONMENT_KEY || "production";
const API_BASE = "https://app.launchdarkly.com/api/v2";

const FLAG_TO_CATEGORY = {
  "category-3d-mesh": "3D Mesh",
  "category-esri": "ESRI",
  "category-dashboards": "Dashboards",
  "category-storymaps": "Storymaps",
  "category-arcgis-js": "Arcgis Javascript SDK",
  "category-mapbox": "Mapbox",
  "category-openlayers": "Openlayers",
  "category-cesium": "Cesium",
  "category-google-maps": "Google Maps",
  "category-widgets": "Custom Nearmap Widget",
  "category-tx-api": "Transactional API",
  "category-video-gallery": "Video Gallery",
  "category-video-renders": "Video Renders",
  "category-engineering": "Engineering Design",
  "category-archived": "Archived",
};

async function ldApi(method, endpoint, body) {
  const opts = {
    method,
    headers: {
      Authorization: LD_API_TOKEN,
      "Content-Type": "application/json",
    },
  };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${endpoint}`, opts);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (_) {
    json = null;
  }
  return { status: res.status, body: json, text };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!LD_API_TOKEN) {
    console.error(
      "Error: Set LD_API_TOKEN environment variable.\n" +
        "  Go to: LaunchDarkly > Account settings > Authorization > Create token"
    );
    process.exit(1);
  }
  if (!LD_PROJECT_KEY) {
    console.error(
      "Error: Set LD_PROJECT_KEY environment variable.\n" +
        "  This is the project key from your LaunchDarkly project settings."
    );
    process.exit(1);
  }

  const filesPath = path.join(__dirname, "..", "examples", "files.json");
  const files = JSON.parse(fs.readFileSync(filesPath, "utf8"));

  console.log("Converting category flags to JSON multivariate...");
  console.log(
    `Project: ${LD_PROJECT_KEY}  |  Environment: ${LD_ENVIRONMENT_KEY}\n`
  );

  let success = 0;
  let failed = 0;

  for (const [flagKey, categoryName] of Object.entries(FLAG_TO_CATEGORY)) {
    const pages = files[categoryName];
    if (!pages || pages.length === 0) {
      console.log(
        `  - ${flagKey}: no pages for "${categoryName}", skipping`
      );
      continue;
    }

    const allEnabled = {};
    const allDisabled = {};
    for (const page of pages) {
      allEnabled[page] = true;
      allDisabled[page] = false;
    }

    console.log(`  ${flagKey} (${pages.length} pages):`);

    // 1. Delete existing flag
    const delRes = await ldApi(
      "DELETE",
      `/flags/${LD_PROJECT_KEY}/${flagKey}`
    );
    if (delRes.status === 204) {
      console.log("    Deleted existing boolean flag");
    } else if (delRes.status === 404) {
      console.log("    No existing flag (will create new)");
    } else {
      console.log(`    Warning: delete returned HTTP ${delRes.status}`);
    }
    await sleep(300);

    // 2. Create JSON multivariate flag
    const createBody = {
      name: `Category - ${categoryName}`,
      key: flagKey,
      kind: "multivariate",
      description: `Controls visibility of individual pages in the "${categoryName}" category. Edit the JSON "pages" object to toggle pages on/off.`,
      variations: [
        {
          value: { pages: allEnabled },
          name: "All pages enabled",
          description: "Every page in this category is visible",
        },
        {
          value: { pages: allDisabled },
          name: "All pages disabled",
          description: "Every page in this category is hidden",
        },
      ],
      defaults: {
        onVariation: 0,
        offVariation: 1,
      },
      clientSideAvailability: {
        usingEnvironmentId: true,
        usingMobileKey: false,
      },
      temporary: false,
    };

    const createRes = await ldApi(
      "POST",
      `/flags/${LD_PROJECT_KEY}`,
      createBody
    );
    if (createRes.status === 201) {
      console.log("    Created JSON multivariate flag");
    } else {
      console.log(`    ERROR creating flag: HTTP ${createRes.status}`);
      if (createRes.body)
        console.log(
          `    ${JSON.stringify(createRes.body).slice(0, 300)}`
        );
      failed++;
      continue;
    }
    await sleep(300);

    // 3. Turn ON in the target environment (serves variation 0 = all pages enabled)
    const patchRes = await ldApi(
      "PATCH",
      `/flags/${LD_PROJECT_KEY}/${flagKey}`,
      [
        {
          op: "replace",
          path: `/environments/${LD_ENVIRONMENT_KEY}/on`,
          value: true,
        },
      ]
    );
    if (patchRes.status === 200) {
      console.log(`    Turned ON in "${LD_ENVIRONMENT_KEY}"`);
    } else {
      console.log(
        `    Warning: could not turn on (HTTP ${patchRes.status})`
      );
      if (patchRes.body)
        console.log(
          `    ${JSON.stringify(patchRes.body).slice(0, 200)}`
        );
    }

    success++;
    await sleep(300);
  }

  console.log(`\nDone! ${success} converted, ${failed} failed.`);
  if (success > 0) {
    console.log(
      "\nTo toggle individual pages, edit the flag's JSON in the " +
        "LaunchDarkly dashboard.\nSet a page to false to hide it, " +
        "or true to show it."
    );
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
