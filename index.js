#! /usr/bin/env node

// @ts-check
import u from "ak-tools";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
dayjs.extend(utc);
import mp from "mixpanel-import";
import md5 from "md5";
import path from "path";
import esMain from "es-main";
import yargs from "yargs";
import { lstatSync } from "fs";
const fileExt = ["json", "jsonl", "ndjson"];

/**
 * @typedef {Object<string, *>} StringKeyedObject
 * An object with string keys and values of any type.
 */

/**
 * @typedef {Array<StringKeyedObject>} arrObj
 * An array of objects with string keys.
 */


/*
----
MAIN
----
*/

/**
 * takes a heap export and imports it into mixpanel
 * @param  {import('./types.js').Config} config
 */
async function main(config) {
	const {
		project,
		dir = "",
		file = "",
		secret,
		token,
		strict = true,
		region = "US",
		verbose = false,
		logs = false,
		type = "event",
		groups = false,
		custom_user_id = "",
		aliases = {},
		tags = {},
		stream = null,
		device_id_map_file = null,
		...otherOpts
	} = config;

	const l = log(verbose);
	l("start!\n\nsettings:\n");
	l({ project, dir, file, stream, secret, token, strict, region, verbose, logs, type, groups, custom_user_id, aliases, tags, device_id_map_file, ...otherOpts });

	// device_id hash map
	let device_id_map = null;
	if (device_id_map_file) device_id_map = await buildDeviceIdMap(device_id_map_file);
	const transformOpts = { custom_user_id, device_id_map };


	/** @type {import('mixpanel-import').Creds} */
	const mpCreds = {
		project,
		token,
		secret
	};

	/** @type {import('mixpanel-import').Options} */
	const commonOptions = {
		region,
		abridged: true,
		removeNulls: true,
		logs: false,
		forceStream: true,
		streamFormat: "jsonl",
		workers: 25,
		verbose: verbose,
		strict: false,
		...otherOpts
	};

	/** @type {import('mixpanel-import').Options} */
	const optionsEvents = {
		recordType: "event",
		compress: true,
		//@ts-ignore
		transformFunc: heapEventsToMp(transformOpts),
		...commonOptions
	};

	/** @type {import('mixpanel-import').Options} */
	const optionsUsers = {
		...commonOptions,
		recordType: "user",
		fixData: true,
		//@ts-ignore
		transformFunc: heapUserToMp(transformOpts),

	};

	/** @type {import('mixpanel-import').Options} */
	const optionsGroup = {
		recordType: "group",
		fixData: true,
		//@ts-ignore
		transformFunc: heapGroupToMp,
		...commonOptions
	};


	let options;
	switch (type) {
		case "event":
			options = optionsEvents;
			break;
		case "user":
			options = optionsUsers;
			break;
		case "group":
			options = optionsGroup;
			break;
		default:
			throw `unknown type: ${type}`;
			break;
	}

	const data = dir || file ? path.resolve(dir || file) : stream;
	if (typeof data === "string") {
		let pathInfos;
		try {
			pathInfos = lstatSync(data);
		} catch (e) {
			throw `path ${data} not found; file or folder does not exist`;
		}


		if (verbose) {
			//file case
			if (pathInfos.isFile()) {
				l(`\nfound 1 file... starting import\n\n`);
			}
			//folder case
			if (pathInfos.isDirectory()) {
				const numFiles = (await u.ls(data)).filter(f => fileExt.some(ext => f.endsWith(ext)));
				l(`\nfound ${numFiles.length} files... starting import\n\n`);
			}
		}
	}

	// @ts-ignore
	const results = await mp(mpCreds, data, options);

	if (logs) {
		await u.mkdir(path.resolve("./logs"));
		await u.touch(path.resolve(`./logs/heap-import-log-${Date.now()}.json`), results, true);
	}
	l("\n\nfinish\n\n");

	return results;
}

/*
----
CLI
----
*/

function cli() {
	const args = yargs(process.argv.splice(2))
		.scriptName("")
		.command("$0", "usage:\nnpx heap-to-mp --dir ./data --token bar --secret qux --project foo ", () => { })
		.option("dir", {
			alias: "file",
			demandOption: true,
			describe: "path to (or file of) UNCOMPRESSED amplitude event json",
			type: "string"
		})
		.option("token", {
			demandOption: true,
			describe: "mp token",
			type: "string"
		})
		.option("secret", {
			demandOption: true,
			describe: "mp secret",
			type: "string"
		})
		.option("project", {
			demandOption: true,
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
			describe: "baz",
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
		.help().argv;
	/** @type {import('./types.d.ts').Config} */
	return args;
}

/*
----
EXPORTS
----
*/
export default main;

const hero = String.raw`

██╗  ██╗███████╗ █████╗ ██████╗       ██╗██╗      ███╗   ███╗██████╗ 
██║  ██║██╔════╝██╔══██╗██╔══██╗     ██╔╝╚██╗     ████╗ ████║██╔══██╗
███████║█████╗  ███████║██████╔╝    ██╔╝  ╚██╗    ██╔████╔██║██████╔╝
██╔══██║██╔══╝  ██╔══██║██╔═══╝     ╚██╗  ██╔╝    ██║╚██╔╝██║██╔═══╝ 
██║  ██║███████╗██║  ██║██║          ╚██╗██╔╝     ██║ ╚═╝ ██║██║     
╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝           ╚═╝╚═╝      ╚═╝     ╚═╝╚═╝     
                                                                     
	r&r by AK
`;


if (esMain(import.meta)) {
	console.log(hero);
	//@ts-ignore
	const params = cli();
	//@ts-ignore
	main(params)
		.then(() => {
			console.log(`\n\nhooray! all done!\n\n`);
			process.exit(0);
		})
		.catch(e => {
			console.log(`\n\nuh oh! something didn't work...\nthe error message is:\n\n\t${e.message}\n\n@\n\n${e.stack}\n\n`);
			process.exit(1);
		})
		.finally(() => {
			console.log("\n\nhave a great day!\n\n");
			process.exit(0);
		});
}


/*
----
TRANSFORMS
----
*/


const heapMpPairs = [
	//heap default to mp default props
	// ? https://help.mixpanel.com/hc/en-us/articles/115004613766-Default-Properties-Collected-by-Mixpanel
	["joindate", "$created"],
	["initial_utm_term", "$initial_utm_term"],
	["initial_utm_source", "$initial_utm_source"],
	["initial_utm_medium", "$initial_utm_medium"],
	["initial_utm_content", "$initial_utm_content"],
	["initial_utm_campaign", "$initial_utm_campaign"],
	["initial_search_keyword", "$initial_search_keyword"],
	["initial_region", "$region"],
	["initial_referrer", "$initial_referrer"],

	["initial_platform", "$os"],
	["initial_browser", "$browser"],

	["app_version", "$app_version_string"],

	["device_brand", "$brand"],
	["device_manufacturer", "$manufacturer"],
	["device_model", "$model"],
	["region", "$region"],
	["initial_city", "$city"],
	["initial_country", "$country_code"],
	["email", "$email"],
	["_email", "$email"],
	["last_modified", "$last_seen"],
	["Name", "$name"],
	["city", "$city"],
	["country", "$country_code"],
	["ip", "$ip"]
];

function heapEventsToMp(options) {
	const { custom_user_id = "", device_id_map = new Map() } = options;
	return function transform(heapEvent) {
		const insert_id = md5(JSON.stringify(heapEvent));

		//some heap events have user_id, some have a weird tuple under id
		const anon_id = heapEvent?.id?.split(",")?.[1]?.replace(")", ""); //ex: { "id": "(2008543124,4810060720600030)"} ... first # is project_id
		const device_id = heapEvent.user_id.toString() || anon_id.toString();
		if (!device_id) return {};

		// event name
		const eventName = heapEvent.type || heapEvent.object || `unknown action`;

		// time
		const time = dayjs.utc(heapEvent.time).valueOf();
		delete heapEvent.time;

		// props
		const customProps = { ...heapEvent.properties };
		delete heapEvent.properties;

		//template
		const mixpanelEvent = {
			event: eventName,
			properties: {
				$device_id: device_id,
				time,
				$insert_id: insert_id,
				$source: `heap-to-mixpanel`
			}
		};

		//get all custom props + group props + user props
		mixpanelEvent.properties = { ...heapEvent, ...customProps, ...mixpanelEvent.properties };

		//relabel for default pairing
		for (let heapMpPair of heapMpPairs) {
			if (mixpanelEvent.properties[heapMpPair[0]]) {
				mixpanelEvent.properties[heapMpPair[1]] = mixpanelEvent.properties[heapMpPair[0]];
				delete mixpanelEvent.properties[heapMpPair[0]];
			}
		}

		// if the event has an identity prop, it's a heap $identify event, so set $user_id too
		if (heapEvent.identity && !custom_user_id) {
			mixpanelEvent.event = "identity association";
			const knownId = heapEvent.identity.toString();
			mixpanelEvent.properties.$device_id = device_id;
			mixpanelEvent.properties.$user_id = knownId;
		}

		// if we have a device_id map, look up the device_id in the map and use the mapped value for $user_id
		else if (device_id_map && !custom_user_id) {
			const knownId = device_id_map.get(device_id) || null;
			if (knownId) {
				mixpanelEvent.properties.$user_id = knownId;
			}
		}

		// use the custom user id if it exists on the event
		if (custom_user_id && heapEvent[custom_user_id]) {
			if (typeof heapEvent[custom_user_id] === "string" || typeof heapEvent[custom_user_id] === "number") {
				mixpanelEvent.properties.$user_id = heapEvent[custom_user_id].toString();
			}
		}

		return mixpanelEvent;
	};
}

function heapUserToMp(options) {
	const { custom_user_id = "" } = options;
	return function (heapUser) {
		//todo... users might have multiple identities
		//distinct_id
		let customId = null;
		// use the custom user id if it exists on the event
		if (custom_user_id && heapUser[custom_user_id]) {
			if (typeof heapUser[custom_user_id] === "string" || typeof heapUser[custom_user_id] === "number") {
				customId = heapUser[custom_user_id].toString();
			}
		}
		const anonId = heapUser.id.split(",")[1].replace(")", "");
		const userId = heapUser.identity;
		if (!userId && !customId) {
			return {}; //no identifiable info; skip profile
		}

		// heapUser.anonymous_heap_uuid = anonId;

		// timestamps
		if (heapUser.last_modified) heapUser.last_modified = dayjs.utc(heapUser.last_modified).toISOString();
		if (heapUser.joindate) heapUser.joindate = dayjs.utc(heapUser.joindate).toISOString();
		if (heapUser.identity_time) heapUser.identity_time = dayjs.utc(heapUser.identity_time).toISOString();

		// props
		const customProps = { ...heapUser.properties };
		delete heapUser.properties;
		const defaultProps = { ...heapUser };

		//template
		const mixpanelProfile = {
			$distinct_id: customId || userId || anonId,
			$ip: heapUser.initial_ip,
			$set: { ...defaultProps, ...customProps }
		};

		//relabel
		for (let heapMpPair of heapMpPairs) {
			if (mixpanelProfile.$set[heapMpPair[0]]) {
				mixpanelProfile.$set[heapMpPair[1]] = mixpanelProfile.$set[heapMpPair[0]];
				delete mixpanelProfile.$set[heapMpPair[0]];
			}
		}

		return mixpanelProfile;
	};
}

function heapGroupToMp(heapEvent) {
	//todo

}

async function buildDeviceIdMap(file) {
	if (file) {
		const data = /** @type {arrObj} */ (await u.load(file, true));
		const hashmap = data.reduce((map, item) => {
			map.set(item.id, item.distinct_id);
			return map;
		}, new Map());
		return hashmap;
	}
	else {
		throw new Error("No file provided for device_id_map");
	}
}

function appendHeapUserIdsToMp(heapUser) {
	const anonId = heapUser.id.split(",")[1].replace(")", "");
	const userId = heapUser.identity;
	if (!userId) return {};

	const mixpanelProfile = {
		$distinct_id: userId || anonId,
		$union: { anon_heap_ids: [anonId] }
	};
	return mixpanelProfile;
}

function heapMpIdentityResolution(mpProfile) {
	//todo need a way to explode multiple events here
	if (mpProfile.$properties.anon_heap_ids) {
		const event = {
			event: "identity association",
			properties: {
				$device_id: mpProfile.$properties.anon_heap_ids[0],
				$user_id: mpProfile.$distinct_id
			}
		};
		return event;
	}

	else {
		return {};
	}

}

function log(verbose) {
	return function (data) {
		if (verbose) console.log(data);
	};
}

