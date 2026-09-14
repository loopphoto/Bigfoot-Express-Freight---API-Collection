# Bigfoot Express Freight - API Collection

A Postman collection for customers integrating with the Bigfoot Express Freight
shipping API (powered by Parcel Perfect's Ecommerce Service).

## Postman collection

See [`postman/`](postman/):

- `Bigfoot Express Freight API.postman_collection.json` - import into Postman.
- `Bigfoot Express Freight - My Account.postman_environment.json` - companion
  environment for your account credentials.

### Quick start

1. Import both files into Postman, then select the **Bigfoot Express Freight -
   My Account** environment (top-right environment picker).
2. Fill in `email`, `password` and `accnum` in that environment, and update
   the collection's `baseUrl` variable to your production service URL (ask
   Bigfoot Express Freight if you don't have it - it defaults to Parcel
   Perfect's public demo endpoint).
3. Run **1. Authentication > 1 - Get Salt**, then **2 - Get Secure Token**.
   Your auth token is saved automatically and reused by every other request.
4. From there: look up places, request a quote (or submit a collection
   directly), and convert it to a waybill or collection.

Full usage notes, the authentication flow, and the request/response envelope
are documented inside the collection itself (collection description, and each
folder/request's description).

## Reference material

[`refs/API/Parcel Perfect/`](refs/API/Parcel%20Perfect/) contains the source
material the collection was built from: the full field-level API
specification (v27, PDF/XLSX) and Parcel Perfect's own PHP/SOAP/JSON example
scripts.
