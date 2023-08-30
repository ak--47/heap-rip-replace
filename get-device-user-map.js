#! /usr/bin/env node

/**
 * ok... so this is a bit of a hack... but it works reliably
 * in heap's raw data, the events DO NOT contain a canonical user id... they only contain anonymous ids 
 * the user profiles DO contain both the anonymous id and the user id
 * it's too much to join these at ingestion time, since you may have MANY users
 * so, FIRST you need to load your heap user profiles
 * THEN, you can export them from mixpanel (to a local file)... that's what this script does!
 * once exported, you THEN plug that mapping file back into the heap events import
 * this ensures that all of your events are associated with the correct user profile
 * and going forward if you use the same user_id in mixpanel via identify()
 * the events will also be associated with the correct user profile
 * if you need help with this, let me know
 * ak@mixpanel.com
 */


import fs from 'fs';
import path from 'path';
import mp from 'mixpanel-import';
import u from 'ak-tools'

/**
 * @param  {string} secret
 */
export default async function main(secret) {

	// download all the heap user profiles, from mixpanel
	/** @type {import('mixpanel-import').Creds} */
	const creds = {
		secret: secret || "your-secret",
	};

	if (creds.secret === "your-secret") throw new Error('you need to set your secret in this file');

	/** @type {import('mixpanel-import').Options} */
	const opts = {
		recordType: 'peopleExport',
		verbose: false,
	};

	console.log(`\nDownloading User Profiles from Mixpanel\n`);
	await mp(creds, null, opts);


	const directoryPath = './mixpanel-exports'; // Adjust this to your directory path

	// List all files in the directory
	const files = fs.readdirSync(directoryPath);

	// Filter JSON files and read them into an array
	const jsonArray = files
		.filter(file => path.extname(file) === '.json')
		.map(file => {
			const filePath = path.join(directoryPath, file);
			const fileContent = fs.readFileSync(filePath, 'utf8');
			return JSON.parse(fileContent);
		});

	const allUsers = jsonArray.flat().map(user => {
		return {
			distinct_id: user.$distinct_id,
			id: user.$properties.id?.split(',')?.[1]?.replace(')', ''),
		};
	});

	const outputPath = path.resolve(path.join('./', 'user-device-mappings.json'));
	console.log(`\nWriting ${allUsers.length} user mappings to ${outputPath}\n`);
	fs.writeFileSync(outputPath, JSON.stringify(allUsers));
	console.log(`\nDeleting temporary files\n`);
	await u.rm(directoryPath);
	console.log('\nDone!\nyou can now use this file to map heap events to user profiles by passing it as the device_id_map_file \n');
	return outputPath;

}