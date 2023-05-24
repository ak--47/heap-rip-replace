#! /usr/bin/env node

// @ts-check
import u from "ak-tools";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
dayjs.extend(utc);
import path from "path";
import functions from "@google-cloud/functions-framework";
import os from "os";
import mp from "mixpanel-import";
import bunyan from "bunyan";
import { LoggingBunyan } from "@google-cloud/logging-bunyan";
import lzo from "lzo";
import { Storage } from "@google-cloud/storage";
import md5 from "md5";
const MODULE_NAME = `heap-rip-replace`;
const loggingBunyan = new LoggingBunyan({ logName: MODULE_NAME });
const log = bunyan.createLogger({
	name: MODULE_NAME,
	streams: [
		// Log to the console at 'info' and above
		{ stream: process.stdout, level: "debug" },
		// And log to Cloud Logging, logging at 'info' and above
		loggingBunyan.stream("debug")
	]
});

const logDateFmt = "MM-DD-YYYY THH";


/*
----
CLOUD ENTRY POINT
----
*/

functions.cloudEvent("start", async cloudEvent => {
	/** @type {Config}  */
	//@ts-ignore
	const config = JSON.parse(Buffer.from(cloudEvent.data.message.data, "base64").toString());
	const logLabel = `${config?.name || "unnamed"} | ${config?.project || ""} | ${path.basename(config.filePath)}`;
	const timer = u.time("ETL");
	timer.start();
	log.info(config, `START: ${logLabel}`);

	try {
		const receipt = await main(config, false);
		timer.stop(false);
		const duration = timer.report(false).human;
		log.info({ results: receipt, ...config }, `SUCCESS: ${logLabel} | ${duration}`);
		return receipt;
	} catch (error) {
		timer.stop(false);
		const duration = timer.report(false).human;
		log.error({ error: error, ...config }, `FAILURE: ${error.message} | ${logLabel} | ${duration}`);
		throw error;
	}
});

/*
----
MAIN
----
*/

/**
 * takes a heap export and imports it into mixpanel
 * @param  {Config} config
 */
async function main(config, isLocal = false) {
	const TEMP_FILE = `temp.jsonl`;
	const TEMP_DIR = isLocal ? path.resolve("./tmp") : os.tmpdir();
	const { id, name, filePath, region, verbose = false, type, cleanup = true } = config;
	const { project: mpProject, secret: mpSecret, token: mpToken } = config;

	let importPath = path.join(TEMP_DIR, TEMP_FILE);
	if (isLocal) {
		const copy = await u.load(filePath);
		await u.touch(importPath, copy);
	} else {
		const { bucket, file } = parseGCSUri(filePath);
		//load from cloud storage
		const storage = new Storage();
		const options = {
			destination: importPath
		};

		// Downloads the file locally
		await storage.bucket(bucket).file(file).download(options);
	}


	/** @type {import('mixpanel-import').Creds} */
	const mpCreds = {
		project: mpProject,
		token: mpToken,
		secret: mpSecret
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
		strict: false
	};

	/** @type {import('mixpanel-import').Options} */
	const optionsEvents = {
		recordType: "event",
		//@ts-ignore
		transformFunc: heapEventsToMp,
		...commonOptions
	};

	/** @type {import('mixpanel-import').Options} */
	const optionsUsers = {
		recordType: "user",
		fixData: true,
		//@ts-ignore
		transformFunc: heapUserToMp,
		...commonOptions
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

	const dataImport = await mp(mpCreds, importPath, options);

	if (cleanup) {
		await u.rm(importPath);
	}

	return dataImport;
}

/*
----
EXPORTS
----
*/
export default main;

/*
----
TRANSFORMS
----
*/

const heapMpPairs = [
	//amp to mp default props
	// ? https://developers.amplitude.com/docs/identify-api
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
	["last_modified", "$last_seen"],
	["Name", "$name"],
	["city", "$city"],
	["country", "$country_code"],
	["ip", "$ip"]
];


function heapEventsToMp(heapEvent) {
	const insert_id = md5(JSON.stringify(heapEvent));
	//distinct_id
	const anonId = heapEvent.id.split(",")[1].replace(")", ""); //ex: { "id": "(2008543124,4810060720600030)"}
	const userId = heapEvent.identity;
	const distinct_id = userId || anonId;

	// event name
	const eventName = heapEvent.type || heapEvent.object || `unknown`;

	// time
	const time = dayjs.utc(heapEvent.time).valueOf();
	delete heapEvent.object;
	delete heapEvent.type;
	delete heapEvent.id;
	delete heapEvent.time;

	// props
	const customProps = { ...heapEvent.properties };
	delete heapEvent.properties;

	//template
	const mixpanelEvent = {
		event: eventName,
		properties: {
			distinct_id,
			time,
			$insert_id: insert_id,
			$source: `heap-to-mixpanel`
		}
	};

	//get all custom props + group props + user props
	mixpanelEvent.properties = { ...heapEvent, ...customProps, ...mixpanelEvent.properties };

	//relabel
	for (let heapMpPair of heapMpPairs) {
		if (mixpanelEvent.properties[heapMpPair[0]]) {
			mixpanelEvent.properties[heapMpPair[1]] = mixpanelEvent.properties[heapMpPair[0]];
			delete mixpanelEvent.properties[heapMpPair[0]];
		}
	}


	return mixpanelEvent;

}

function heapUserToMp(heapUser) {
	//distinct_id
	const anonId = heapUser.id.split(",")[1].replace(")", "");
	const userId = heapUser.identity;
	if (!userId) return {};
	delete heapUser.id;
	delete heapUser.identity;
	heapUser.anonymous_heap_uuid = anonId;

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
		$distinct_id: userId || anonId,
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
}

function heapGroupToMp(heapEvent) {
	//todo

}

/*
----
OPTIONS
----
*/



/*
----
UTILS
----
*/

function validate(config) {
	//todo
	/** @type {Config} */
	const { id = "", name = "", project = "", token = "", secret = "" } = config;
	if (!id) throw `missing job id`;
	if (!name) throw `missing job name`;
	if (!project) throw `missing mixpanel project id`;
	if (!token) throw `missing mixpanel token`;
	if (!secret) throw `missing mixpanel secret`;
	return;
}

function parseGCSUri(uri) {
	// ? https://www.npmjs.com/package/google-cloud-storage-uri-parser
	const REG_EXP = new RegExp("^gs://([^/]+)/(.+)$");
	const bucket = uri.replace(REG_EXP, "$1");
	const file = uri.replace(REG_EXP, "$2");
	return {
		uri,
		bucket,
		file
	};

}
