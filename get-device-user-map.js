/**
 * ok... so this is a bit of a hack... but it works
 * in heap, the events do not contain the user id... they only contain anonymous events 
 * the user profiles DO contain both the anonymous id and the user id
 * it's too much to join these at ingestion time
 * so, first you need to load your heap user profiles
 * then, you can export them from mixpanel (to a local file)... that's what this script does!
 * then you plug that file back into the heap events
 * if you need help with this, let me know
 * ak@mixpanel.com
 */


import fs  from 'fs';
import path  from 'path';
import mp from 'mixpanel-import'

// download all the heap user profiles, from mixpanel
/** @type {import('mixpanel-import').Creds} */
const creds = {
	secret : "your-secret",
}

/** @type {import('mixpanel-import').Options} */
const opts = {
	recordType: 'peopleExport',
	verbose: true,
}
// @ts-ignore
await mp(creds, null, opts)


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

const allUsers = jsonArray.flat().map(user => { return {
	distinct_id: user.$distinct_id,
	id: user.$properties.id?.split(',')?.[1]?.replace(')', ''),
}});

const outputPath = path.resolve(path.join('./', 'user-device-mappings.json'));
console.log(`\nWriting ${allUsers.length} user mappings to ${outputPath}\n`);
fs.writeFileSync(outputPath, JSON.stringify(allUsers));
console.log('\nDone!\nyou can now use this file to map heap events to user profiles by passing it as the \n');


