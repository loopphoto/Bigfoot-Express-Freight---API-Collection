#!/usr/bin/env python3
"""
Bigfoot Express Freight API - end-to-end quickstart (Python)

Walks through: authenticate -> look up places -> request a quote ->
lock in a service -> convert the quote to a collection.

Requirements: Python 3.8+, the `requests` library (`pip install requests`).
Run: BASE_URL=... EMAIL=... PASSWORD=... python3 quickstart.py

See ../../README.md for the full concept walkthrough (auth flow, request
format, API reference table).
"""

import datetime
import hashlib
import json
import os
import sys

import requests

BASE_URL = os.environ.get("BASE_URL", "http://adpdemo.pperfect.com/ecomService/v10/Json/")
EMAIL = os.environ.get("EMAIL", "username@parcelperfect.com")
PASSWORD = os.environ.get("PASSWORD", "password")
ACCNUM = os.environ.get("ACCNUM", "PPO")
ORIGIN_POSTCODE = os.environ.get("ORIGIN_POSTCODE", "6730")
DEST_POSTCODE = os.environ.get("DEST_POSTCODE", "7700")


class ApiError(Exception):
    pass


def call_api(cls, method, params, token=None):
    """Every call is a GET with class/method/params(/token_id) query parameters."""
    query = {"params": json.dumps(params), "method": method, "class": cls}
    if token:
        query["token_id"] = token

    response = requests.get(BASE_URL, params=query, timeout=15)
    response.raise_for_status()
    body = response.json()

    if body["errorcode"] != 0:
        raise ApiError(f"{cls}.{method} failed: {body['errormessage']}")
    return body["results"]


def md5(value):
    return hashlib.md5(value.encode("utf-8")).hexdigest()


def main():
    print("1. Authenticating...")
    salt = call_api("Auth", "getSalt", {"email": EMAIL})[0]["salt"]
    password_hash = md5(PASSWORD + salt)
    token_result = call_api("Auth", "getSecureToken", {"email": EMAIL, "password": password_hash})[0]
    # API docs and sample code disagree on the field name, handle both
    token = token_result.get("tokenid") or token_result.get("token_id")
    print(f"   Authenticated. Token: {token}")

    print("2. Looking up places...")
    origin_places = call_api("Quote", "getPlacesByPostcode", {"postcode": ORIGIN_POSTCODE}, token)
    dest_places = call_api("Quote", "getPlacesByPostcode", {"postcode": DEST_POSTCODE}, token)
    if not origin_places or not dest_places:
        raise ApiError("No places found for the configured postcodes - try different ORIGIN_POSTCODE/DEST_POSTCODE values.")
    origin_place, dest_place = origin_places[0], dest_places[0]
    print(f"   Origin: {origin_place['town']} (place {origin_place['place']})")
    print(f"   Destination: {dest_place['town']} (place {dest_place['place']})")

    print("3. Requesting a quote...")
    quote = call_api(
        "Quote",
        "requestQuote",
        {
            "details": {
                "specinstruction": "This is a test",
                "reference": "Test reference",
                "origperadd1": "Address line 1",
                "origperphone": "0123456789",
                "origplace": origin_place["place"],
                "origtown": origin_place["town"],
                "origpers": "TESTCUSTOMER",
                "origpercontact": "Origin contact",
                "origperpcode": ORIGIN_POSTCODE,
                "destperadd1": "Address line 1",
                "destperphone": "0123456789",
                "destplace": dest_place["place"],
                "desttown": dest_place["town"],
                "destpers": "TESTCUSTOMER",
                "destpercontact": "Destination contact",
                "destperpcode": DEST_POSTCODE,
            },
            # At least one contents line with actmass > 0 is required, or no rate will calculate.
            "contents": [
                {"item": 1, "description": "Test parcel", "pieces": 1, "dim1": 10, "dim2": 10, "dim3": 10, "actmass": 1}
            ],
            "s_ttype": "I",
        },
        token,
    )[0]
    print(f"   Quote {quote['quoteno']}, {len(quote['rates'])} service(s) available")

    chosen_service = quote["rates"][0]  # pick the first available service - customise as needed
    print(f"4. Locking in service {chosen_service['service']} ({chosen_service['name']})...")
    updated = call_api(
        "Quote", "updateService", {"quoteno": quote["quoteno"], "service": chosen_service["service"]}, token
    )[0]
    print(f"   Total: {updated['total']}")

    print("5. Converting quote to a collection...")
    collection = call_api(
        "Collection",
        "quoteToCollection",
        {
            "quoteno": quote["quoteno"],
            "starttime": "08:00",
            "endtime": "16:30",
            "quoteCollectionDate": datetime.date.today().strftime("%d.%m.%Y"),
            "notes": "Booked via Python quickstart",
            "printWaybill": 0,
            "printLabels": 0,
        },
        token,
    )[0]
    print(f"   Collection number: {collection['collectno']}, waybill: {collection['waybillno']}")

    print("\nDone.")


if __name__ == "__main__":
    try:
        main()
    except (ApiError, requests.RequestException) as err:
        print(f"Failed: {err}", file=sys.stderr)
        sys.exit(1)
