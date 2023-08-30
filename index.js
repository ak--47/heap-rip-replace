#! /usr/bin/env node

// @ts-check
// @ts-ignore
import u from "ak-tools";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
dayjs.extend(utc);
import mp from "mixpanel-import";
import md5 from "md5";
import path from "path";
import esMain from "es-main";
import { cli, hero } from "./cli.js";
import { lstatSync } from "fs";
import get_id_map from "./get-device-user-map.js";
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
	let device_id_map;
	if (device_id_map_file && type === 'event') device_id_map = await buildDeviceIdMap(device_id_map_file);
	const transformOpts = { custom_user_id, device_id_map };

	// note: heap exports which contain nested objects are DOUBLE escaped;
	// we therefore need to fix the string so it's parseable
	// @ts-ignore
	function parseErrorHandler(err, record) {
		let attemptedParse;
		try {
			attemptedParse = JSON.parse(record.replace(/\\\\/g, '\\'));
		}
		catch (e) {
			attemptedParse = {};
		}
		return attemptedParse;
	}


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
		verbose,
		strict: false,
		aliases,
		tags,
		parseErrorHandler,
		...otherOpts
	};

	/** @type {import('mixpanel-import').Options} */
	const optionsEvents = {
		recordType: "event",
		compress: true,
		transformFunc: heapEventsToMp(transformOpts),
		...commonOptions
	};

	/** @type {import('mixpanel-import').Options} */
	const optionsUsers = {
		...commonOptions,
		recordType: "user",
		fixData: true,
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
			// @ts-ignore
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
EXPORTS
----
*/
export default main;


if (esMain(import.meta)) {
	console.log(hero);
	const params = cli();
	// @ts-ignore
	if (params.get_device_map) {
		// @ts-ignore
		get_id_map(params.secret)
			.then(() => {
				process.exit(0);
			})
			.catch(e => {
				console.log(`\n\nuh oh! something didn't work...\nthe error message is:\n\n\t${e.message}\n\n@\n\n${e.stack}\n\n`);
				process.exit(1);
			})
			.finally(() => {
				process.exit(0);
			});
	}

	else {
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
	["firstName", "$first_name"],
	["lastName", "$last_name"],
	["last_modified", "$last_seen"],
	["Name", "$name"],
	["city", "$city"],
	["country", "$country_code"],
	["ip", "$ip"]
];

function heapEventsToMp(options) {
	const { custom_user_id = "", device_id_map = new Map() } = options;
	return function transform(heapEvent) {
		let insert_id;
		if (heapEvent.event_id) insert_id = heapEvent.event_id.toString();
		else insert_id = md5(JSON.stringify(heapEvent));


		//some heap events have user_id, some have a weird tuple under id
		const anon_id = heapEvent?.id?.split(",")?.[1]?.replace(")", ""); //ex: { "id": "(2008543124,4810060720600030)"} ... first # is project_id
		let device_id;
		if (heapEvent.user_id) device_id = heapEvent.user_id.toString();
		else device_id = anon_id.toString();

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
		if (!custom_user_id) {
			// if the event has an identity prop, it's a heap $identify event, so set $user_id too
			if (heapEvent.identity) {
				mixpanelEvent.event = "identity association";
				const knownId = heapEvent.identity.toString();
				mixpanelEvent.properties.$device_id = device_id;
				mixpanelEvent.properties.$user_id = knownId;
			}

			// if we have a device_id map, look up the device_id in the map and use the mapped value for $user_id
			else if (device_id_map.size) {
				const knownId = device_id_map.get(device_id) || null;
				if (knownId) {
					mixpanelEvent.properties.$user_id = knownId;
				}
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
		//todo... users might have multiple anon identities... for now we can't support that
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

// @ts-ignore
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


// UNUSED

// @ts-ignore
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

// @ts-ignore
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

