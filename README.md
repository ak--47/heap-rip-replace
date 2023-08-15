# heap-to-mp
 this module will take in (uncompressed) heap raw json files, transform them, and send them to mixpanel.

 it is implemented as a CLI and requires [Node.js](https://nodejs.org/en/download).

## usage:
```bash
npx heap-to-mp --dir ./data --type event --token bar --secret qux --project 123
```

### help / options
```bash
npx heap-to-mp --help
```
