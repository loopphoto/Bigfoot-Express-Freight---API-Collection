# cURL Quickstart

Copy-pasteable `curl` commands for the Bigfoot Express Freight API, for
testing from a terminal or scripting outside Postman. See the main
[README](../README.md) for the full concept walkthrough (auth flow, request
format, API reference table) — this doc is just the runnable version of it.

## Requirements

- `curl`
- `jq` (to parse JSON responses) — `brew install jq` or `apt install jq`
- `openssl` (to compute the MD5 password hash) — preinstalled on macOS/Linux

## 0. Configuration

Set these once per terminal session:

```bash
export BASE_URL="http://adpdemo.pperfect.com/ecomService/v10/Json/"  # replace with your production URL
export EMAIL="username@parcelperfect.com"
export PASSWORD="password"
export ACCNUM="PPO"
```

Every command below uses `curl -G --data-urlencode ...`, which lets curl do
the JSON/URL-encoding for you — you never need to hand-encode the `params`
JSON yourself.

## 1. Authenticate

```bash
# Get salt
SALT=$(curl -sG "$BASE_URL" \
  --data-urlencode "params={\"email\":\"$EMAIL\"}" \
  --data-urlencode "method=getSalt" \
  --data-urlencode "class=Auth" \
  | tee /dev/stderr | jq -r '.results[0].salt')

# Hash password + salt
MD5PASSWORD=$(printf '%s' "${PASSWORD}${SALT}" | openssl dgst -md5 -r | awk '{print $1}')

# Get secure token (response field is "tokenid" per the spec, but sample
# code has also used "token_id" - the line below handles either)
TOKEN=$(curl -sG "$BASE_URL" \
  --data-urlencode "params={\"email\":\"$EMAIL\",\"password\":\"$MD5PASSWORD\"}" \
  --data-urlencode "method=getSecureToken" \
  --data-urlencode "class=Auth" \
  | tee /dev/stderr | jq -r '.results[0].tokenid // .results[0].token_id')

echo "Token: $TOKEN"
```

Every command from here on appends `&token_id=$TOKEN`, so make sure `$TOKEN`
is set before continuing. Tokens last roughly 24 hours — re-run this section
if you start getting authentication errors.

## 2. Look up places

```bash
# By postcode
curl -sG "$BASE_URL" \
  --data-urlencode "params={\"postcode\":\"7700\"}" \
  --data-urlencode "method=getPlacesByPostcode" \
  --data-urlencode "class=Quote" \
  --data-urlencode "token_id=$TOKEN" | jq .

# By name
curl -sG "$BASE_URL" \
  --data-urlencode "params={\"name\":\"Claremont\"}" \
  --data-urlencode "method=getPlacesByName" \
  --data-urlencode "class=Quote" \
  --data-urlencode "token_id=$TOKEN" | jq .
```

Note the `place` and `town` values from the result you want — you'll need
them as `origplace`/`origtown` and `destplace`/`desttown` below.

```bash
export ORIG_PLACE="4969"
export ORIG_TOWN="CLAREMONT Cape Town"
export DEST_PLACE="5437"
export DEST_TOWN="CLAREMONT (Cape Town)"
```

## 3. Request a quote

```bash
QUOTE_PARAMS=$(cat <<EOF
{
  "details": {
    "specinstruction": "This is a test",
    "reference": "Test reference",
    "origperadd1": "Address line 1",
    "origperphone": "0123456789",
    "origplace": $ORIG_PLACE,
    "origtown": "$ORIG_TOWN",
    "origpers": "TESTCUSTOMER",
    "origpercontact": "Origin contact",
    "origperpcode": "6730",
    "destperadd1": "Address line 1",
    "destperphone": "0123456789",
    "destplace": $DEST_PLACE,
    "desttown": "$DEST_TOWN",
    "destpers": "TESTCUSTOMER",
    "destpercontact": "Destination contact",
    "destperpcode": "3340"
  },
  "contents": [
    { "item": 1, "description": "Test parcel", "pieces": 1, "dim1": 10, "dim2": 10, "dim3": 10, "actmass": 1 }
  ],
  "s_ttype": "I"
}
EOF
)

QUOTE_RESPONSE=$(curl -sG "$BASE_URL" \
  --data-urlencode "params=$QUOTE_PARAMS" \
  --data-urlencode "method=requestQuote" \
  --data-urlencode "class=Quote" \
  --data-urlencode "token_id=$TOKEN")

echo "$QUOTE_RESPONSE" | jq .

QUOTENO=$(echo "$QUOTE_RESPONSE" | jq -r '.results[0].quoteno')
SERVICE=$(echo "$QUOTE_RESPONSE" | jq -r '.results[0].rates[0].service')  # first available service
echo "Quote: $QUOTENO, cheapest/first service: $SERVICE"
```

At least one contents line with `actmass` > 0 is required, or no rate will
calculate.

## 4. Lock in a service

```bash
curl -sG "$BASE_URL" \
  --data-urlencode "params={\"quoteno\":\"$QUOTENO\",\"service\":\"$SERVICE\"}" \
  --data-urlencode "method=updateService" \
  --data-urlencode "class=Quote" \
  --data-urlencode "token_id=$TOKEN" | jq .
```

## 5. Convert the quote

Either convert to a waybill (you deliver/drop off):

```bash
curl -sG "$BASE_URL" \
  --data-urlencode "params={\"quoteno\":\"$QUOTENO\",\"printWaybill\":0,\"printLabels\":0}" \
  --data-urlencode "method=quoteToWaybill" \
  --data-urlencode "class=Quote" \
  --data-urlencode "token_id=$TOKEN" | jq .
```

...or to a collection (Bigfoot Express Freight collects from you):

```bash
curl -sG "$BASE_URL" \
  --data-urlencode "params={\"quoteno\":\"$QUOTENO\",\"starttime\":\"08:00\",\"endtime\":\"16:30\",\"quoteCollectionDate\":\"27.01.2026\",\"notes\":\"Some notes\",\"printWaybill\":0,\"printLabels\":0}" \
  --data-urlencode "method=quoteToCollection" \
  --data-urlencode "class=Collection" \
  --data-urlencode "token_id=$TOKEN" | jq .
```

## 6. Or submit a collection directly (skip the quote step)

```bash
COLLECT_PARAMS=$(cat <<EOF
{
  "details": {
    "service": "$SERVICE",
    "accnum": "$ACCNUM",
    "collectiondate": "27.01.2026",
    "origperadd1": "Address line 1",
    "origperphone": "0123456789",
    "origplace": $ORIG_PLACE,
    "origtown": "$ORIG_TOWN",
    "origpers": "TESTCUSTOMER",
    "origpercontact": "Origin contact",
    "origperpcode": "6730",
    "destperadd1": "Address line 1",
    "destperphone": "0123456789",
    "destplace": $DEST_PLACE,
    "desttown": "$DEST_TOWN",
    "destpers": "TESTCUSTOMER",
    "destpercontact": "Destination contact",
    "destperpcode": "3340",
    "starttime": "08:00",
    "endtime": "16:30",
    "notes": "Collection note"
  },
  "contents": [
    { "item": 1, "description": "Test parcel", "pieces": 1, "dim1": 10, "dim2": 10, "dim3": 10, "actmass": 1 }
  ],
  "s_ttype": "I",
  "printWaybill": 0,
  "printLabels": 0
}
EOF
)

curl -sG "$BASE_URL" \
  --data-urlencode "params=$COLLECT_PARAMS" \
  --data-urlencode "method=submitCollection" \
  --data-urlencode "class=Collection" \
  --data-urlencode "token_id=$TOKEN" | jq .
```

## 7. Check a waybill afterwards

```bash
curl -sG "$BASE_URL" \
  --data-urlencode "params={\"waybillno\":\"$WAYBILLNO\"}" \
  --data-urlencode "method=getSingleWaybill" \
  --data-urlencode "class=Waybill" \
  --data-urlencode "token_id=$TOKEN" | jq .
```

## 8. Expire the token when you're done

```bash
curl -sG "$BASE_URL" \
  --data-urlencode "params={\"token_id\":\"$TOKEN\"}" \
  --data-urlencode "method=expireToken" \
  --data-urlencode "class=Auth" | jq .
```

## Reading errors

Every response has the same envelope. Check `errorcode` before trusting
`results`:

```bash
echo "$QUOTE_RESPONSE" | jq 'if .errorcode != 0 then "ERROR: " + .errormessage else .results end'
```
