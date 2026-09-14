#!/usr/bin/env node
//
// Bigfoot Express Freight API - end-to-end quickstart (Node.js)
//
// Walks through: authenticate -> look up places -> request a quote ->
// lock in a service -> convert the quote to a collection.
//
// Requirements: Node.js 18+ (uses the built-in `fetch` and `crypto`).
// Run: BASE_URL=... EMAIL=... PASSWORD=... node quickstart.js
//
// See ../../README.md for the full concept walkthrough (auth flow, request
// format, API reference table).

const crypto = require("crypto");

const config = {
  baseUrl: process.env.BASE_URL || "http://adpdemo.pperfect.com/ecomService/v10/Json/",
  email: process.env.EMAIL || "username@parcelperfect.com",
  password: process.env.PASSWORD || "password",
  accnum: process.env.ACCNUM || "PPO",
  originPostcode: process.env.ORIGIN_POSTCODE || "6730",
  destPostcode: process.env.DEST_POSTCODE || "7700",
};

// Every call is a GET to `baseUrl` with class/method/params(/token_id) query
// parameters. URLSearchParams takes care of encoding `params` for us.
async function callApi(cls, method, params, token) {
  const url = new URL(config.baseUrl);
  url.searchParams.set("params", JSON.stringify(params));
  url.searchParams.set("method", method);
  url.searchParams.set("class", cls);
  if (token) url.searchParams.set("token_id", token);

  const response = await fetch(url);
  const body = await response.json();

  if (body.errorcode !== 0) {
    throw new Error(`${cls}.${method} failed: ${body.errormessage}`);
  }
  return body.results[0];
}

function md5(value) {
  return crypto.createHash("md5").update(value).digest("hex");
}

async function main() {
  console.log("1. Authenticating...");
  const { salt } = await callApi("Auth", "getSalt", { email: config.email });
  const passwordHash = md5(config.password + salt);
  const tokenResult = await callApi("Auth", "getSecureToken", {
    email: config.email,
    password: passwordHash,
  });
  // API docs and sample code disagree on the field name, handle both
  const token = tokenResult.tokenid || tokenResult.token_id;
  console.log("   Authenticated. Token:", token);

  console.log("2. Looking up places...");

  // getPlacesByPostcode/getPlacesByName return a *list* in `results`, unlike
  // most other methods which return a single-element array - so we call the
  // raw API directly here instead of going through callApi()'s single-result helper.
  async function lookupPlaces(method, params) {
    const url = new URL(config.baseUrl);
    url.searchParams.set("params", JSON.stringify(params));
    url.searchParams.set("method", method);
    url.searchParams.set("class", "Quote");
    url.searchParams.set("token_id", token);
    const body = await (await fetch(url)).json();
    if (body.errorcode !== 0) throw new Error(`Quote.${method} failed: ${body.errormessage}`);
    return body.results;
  }

  const originPlaces = await lookupPlaces("getPlacesByPostcode", { postcode: config.originPostcode });
  const destPlaces = await lookupPlaces("getPlacesByPostcode", { postcode: config.destPostcode });

  if (!originPlaces.length || !destPlaces.length) {
    throw new Error("No places found for the configured postcodes - try different ORIGIN_POSTCODE/DEST_POSTCODE values.");
  }
  const originPlace = originPlaces[0];
  const destPlace = destPlaces[0];
  console.log(`   Origin: ${originPlace.town} (place ${originPlace.place})`);
  console.log(`   Destination: ${destPlace.town} (place ${destPlace.place})`);

  console.log("3. Requesting a quote...");
  const quote = await callApi(
    "Quote",
    "requestQuote",
    {
      details: {
        specinstruction: "This is a test",
        reference: "Test reference",
        origperadd1: "Address line 1",
        origperphone: "0123456789",
        origplace: originPlace.place,
        origtown: originPlace.town,
        origpers: "TESTCUSTOMER",
        origpercontact: "Origin contact",
        origperpcode: config.originPostcode,
        destperadd1: "Address line 1",
        destperphone: "0123456789",
        destplace: destPlace.place,
        desttown: destPlace.town,
        destpers: "TESTCUSTOMER",
        destpercontact: "Destination contact",
        destperpcode: config.destPostcode,
      },
      // At least one contents line with actmass > 0 is required, or no rate will calculate.
      contents: [{ item: 1, description: "Test parcel", pieces: 1, dim1: 10, dim2: 10, dim3: 10, actmass: 1 }],
      s_ttype: "I",
    },
    token
  );
  console.log(`   Quote ${quote.quoteno}, ${quote.rates.length} service(s) available`);

  const chosenService = quote.rates[0]; // pick the first available service - customise as needed
  console.log(`4. Locking in service ${chosenService.service} (${chosenService.name})...`);
  const updated = await callApi(
    "Quote",
    "updateService",
    { quoteno: quote.quoteno, service: chosenService.service },
    token
  );
  console.log(`   Total: ${updated.total}`);

  console.log("5. Converting quote to a collection...");
  const collection = await callApi(
    "Collection",
    "quoteToCollection",
    {
      quoteno: quote.quoteno,
      starttime: "08:00",
      endtime: "16:30",
      quoteCollectionDate: new Date().toLocaleDateString("en-GB").replace(/\//g, "."),
      notes: "Booked via Node.js quickstart",
      printWaybill: 0,
      printLabels: 0,
    },
    token
  );
  console.log(`   Collection number: ${collection.collectno}, waybill: ${collection.waybillno}`);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
