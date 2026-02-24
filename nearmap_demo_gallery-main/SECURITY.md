# Security

## API Keys

- **Never commit** `examples/keys.js` – it is listed in `.gitignore`
- Copy `examples/keys.js.example` to `examples/keys.js` and add your keys locally
- Rotate any keys that may have been exposed in previous commits

## If Keys Were Exposed

If this repo or a fork was ever public with real API keys:

1. **Rotate all keys** in the respective developer portals (Nearmap, Mapbox, Google Cloud, Cesium Ion)
2. Revoke the old keys
3. Use new keys only in your local `keys.js` file
