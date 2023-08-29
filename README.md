# heap-to-mp
 this module will take in (uncompressed) heap raw json files, transform them, and send them to mixpanel.

 it is implemented as a CLI and requires [Node.js](https://nodejs.org/en/download).

 it expects that you are using Mixpanel's [simplified identity management](https://docs.mixpanel.com/docs/tracking/how-tos/identifying-users#simplified-vs-original-id-merge)

## usage:
```bash
npx heap-to-mp --dir ./data --type event --token bar --secret qux --project 123
```

## help / options
```bash
npx heap-to-mp --help
```

## e2e
```bash
# first import user profiles
npx heap-to-mp --dir ./heap-user-export/ --type user --token bar --secret qux --project 123
```

```bash
# clone the repo
git clone https://github.com/ak--47/heap-to-mp.git
npm install

# plug your project secret into get-device-user-map.js
nano get-device-user-map.js

# then run get-device-user-map.js
node get-device-user-map.js # this will EXPORT profiles and save a device_id mapping to disk
```

```bash
# finally import events, using the device mappings
npx heap-to-mp --device_id_map ./user-device-mappings.json --dir ./heap-event-export --type event --token bar --secret qux --project 123
```

for the full reasoning of why this workflow is necessary, see comments in [get-device-user-map.js](https://github.com/ak--47/heap-to-mp/blob/main/get-device-user-map.js)
