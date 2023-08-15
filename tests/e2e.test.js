/* cSpell:disable */
// @ts-nocheck
/* eslint-disable no-undef */
/* eslint-disable no-debugger */
/* eslint-disable no-unused-vars */
import main from "../index.js";
import dotenv from 'dotenv';
import { execSync } from "child_process";
dotenv.config();

const timeout = 300000;

const MP_PROJECT = process.env.MP_PROJECT;
const MP_TOKEN = process.env.MP_TOKEN;
const MP_SECRET = process.env.MP_SECRET;

/** @type {import('../types.js').Config} */
const CONFIG = {
	region: 'US',
	project: MP_PROJECT,
	token: MP_TOKEN,
	secret: MP_SECRET,
	verbose: false,
}


describe('do tests work?', () => {
	test('a = a', () => {
		expect(true).toBe(true);
	});
});


describe('e2e', () => {

	test('events', async () => {
		const { success, failed } = await main({...CONFIG, type: "event", file: './testData/heap-events-ex.json'}, true);
		expect(success).toBe(10000);
		expect(failed).toBe(0);

	}, timeout);


	test('events (custom user id)', async () => {
		const { success, failed } = await main({...CONFIG, type: "event", custom_user_id: "event_id" , file: './testData/heap-events-ex.json'}, true);
		expect(success).toBe(10000);
		expect(failed).toBe(0);

	}, timeout);


	test('users', async () => {
		const { success, failed } = await main({...CONFIG, type: "user", file: './testData/heap-users-ex.json'}, true);
		expect(success).toBe(1500);
		expect(failed).toBe(0);

	}, timeout);

	test('users (custom user id)', async () => {
		const { success, failed } = await main({...CONFIG, type: "user", custom_user_id: "email", file: './testData/heap-users-ex.json'}, true);
		expect(success).toBe(1500);
		expect(failed).toBe(0);

	}, timeout);


	// test('works as module', async () => {
	// 	console.log('MODULE TEST');
	// 	const { events, users, groups } = await main(CONFIG);
	// 	expect(events.success).toBe(8245);
	// 	expect(events.failed).toBe(0);
	// 	expect(users.success).toBe(5168);
	// 	expect(users.failed).toBe(0);
	// 	expect(JSON.stringify(groups)).toBe('{}');

	// }, timeout);

	// test('works as CLI', async () => {
	// 	console.log('CLI TEST');
	// 	const { dir,
	// 		token,
	// 		secret,
	// 		project,
	// 		strict,
	// 		region,
	// 		events,
	// 		users,
	// 		groups,
	// 		verbose } = CONFIG;
	// 	const run = execSync(`node ./index.js --dir ${dir} --token ${token} --secret ${secret} --project ${project} --region ${region} --strict ${strict} --events ${events} --users ${users} --grouos ${groups} --verbose ${verbose}`);
	// 	expect(run.toString().trim().includes('hooray! all done!')).toBe(true);
	// }, timeout);

	// //todo test custom id resolution


	// test('works with individual files', async () => {
	// 	console.log('INDIVIDUAL FILES TEST');
	// 	const { events, users, groups } = await main({
	// 		...CONFIG,
	// 		file: './data/sample/'
	// 	});
	// 	expect(events.success).toBe(8245);
	// 	expect(events.failed).toBe(0);
	// 	expect(users.success).toBe(5168);
	// 	expect(users.failed).toBe(0);
	// 	expect(JSON.stringify(groups)).toBe('{}');
	// }, timeout);

	// test('works with streams', async () => {
	// 	console.log('STREAM TEST');
	// 	const { events, users, groups } = await main({
	// 		...CONFIG,
	// 		stream: createReadStream('./data/sample/pintara/2023-04-10_12#0.json')
	// 	});
	// 	expect(events.success).toBe(8245);
	// 	expect(events.failed).toBe(0);
	// 	expect(users.success).toBe(5168);
	// 	expect(users.failed).toBe(0);
	// 	expect(JSON.stringify(groups)).toBe('{}');
	// }, timeout);
});



afterAll(() => {
	console.log('clearing logs...');
	execSync(`npm run prune`);
	console.log('...logs cleared 👍');
});