import yargs from "yargs";

/*
----
CLI
----
*/

export function cli() {
	const args = yargs(process.argv.splice(2))
		.scriptName("")
		.command("$0", "usage:\nnpx heap-to-mp --dir ./data --token bar --secret qux --project foo ", () => { })
		.option("get_device_map", {
			alias: "get_map",
			demandOption: false,
			describe: "get a device_id to user_id map file from mixpanel; this is required for importing events",
			type: "boolean",
			default: false
		})
		.option("dir", {
			alias: "file",
			demandOption: false,
			describe: "path to (or file of) UNCOMPRESSED amplitude event json",
			type: "string"
		})
		.option("token", {
			demandOption: false,
			describe: "mp token",
			type: "string"
		})
		.option("secret", {
			demandOption: false,
			describe: "mp secret",
			type: "string"
		})
		.option("project", {
			demandOption: false,
			describe: "mp project id",
			type: "number"
		})
		.option("region", {
			demandOption: false,
			default: "US",
			describe: "US or EU",
			type: "string"
		})
		.option("strict", {
			demandOption: false,
			default: false,
			describe: "use strict mode when importing",
			type: "boolean"
		})
		.option("custom_user_id", {
			demandOption: false,
			default: "",
			describe: "a custom key to use for $user_id instead of heap default (user_id)",
			type: "string"
		})
		.option("type", {
			demandOption: false,
			default: 'event',
			describe: "type of data to import: event user or group",
			type: "string"
		})
		.option("verbose", {
			demandOption: false,
			default: true,
			describe: "log messages",
			type: "boolean"
		})
		.option("logs", {
			demandOption: false,
			default: true,
			describe: "write logfile",
			type: "boolean"
		})
		.options("epoch-start", {
			demandOption: false,
			alias: 'epochStart',
			default: 0,
			describe: 'don\'t import data before this timestamp (UNIX EPOCH)',
			type: 'number'
		})
		.options("epoch-end", {
			demandOption: false,
			default: 9991427224,
			alias: 'epochEnd',
			describe: 'don\'t import data after this timestamp (UNIX EPOCH)',
			type: 'number'
		})
		.options("device_id_map", {
			demandOption: false,
			alias: 'id_map',
			default: '',
			describe: 'path to a file mapping device_id user_id',
			type: 'string'
		})
		.options("tags", {
			demandOption: false,
			default: "{}",
			describe: 'tags to add to each record; {"key": "value"}',
			type: 'string'
		})
		.options("aliases", {
			demandOption: false,
			default: "{}",
			describe: 'rename property keys on each record; {"oldPropKey": "newPropKey"}',
			type: 'string'
		})
		.check(argv => {
			if (argv.get_device_map) {
				if (!argv.secret) {
					throw new Error('--secret is required when --get_device_map is provided');
				}
				// Optionally clear out demandOptions for other fields
				['dir', 'token', 'project'].forEach(opt => {
					if (argv[opt]) {
						throw new Error(`--${opt} should not be provided when --get_device_map is specified.`);
					}
				});
			} else {
				// Check for mandatory flags when get_device_map is not provided
				['secret', 'dir', 'token', 'project'].forEach(opt => {
					if (!argv[opt]) {
						throw new Error(`--${opt} is required`);
					}
				});
			}
			return true; // If no errors are thrown, validation passed
		})
		.help()
		.wrap(null)
		.argv;
	
	return args;
}

export const hero = String.raw`

██╗  ██╗███████╗ █████╗ ██████╗       ██╗██╗      ███╗   ███╗██████╗ 
██║  ██║██╔════╝██╔══██╗██╔══██╗     ██╔╝╚██╗     ████╗ ████║██╔══██╗
███████║█████╗  ███████║██████╔╝    ██╔╝  ╚██╗    ██╔████╔██║██████╔╝
██╔══██║██╔══╝  ██╔══██║██╔═══╝     ╚██╗  ██╔╝    ██║╚██╔╝██║██╔═══╝ 
██║  ██║███████╗██║  ██║██║          ╚██╗██╔╝     ██║ ╚═╝ ██║██║     
╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝           ╚═╝╚═╝      ╚═╝     ╚═╝╚═╝     
                                                                     
	r&r by AK
`;
