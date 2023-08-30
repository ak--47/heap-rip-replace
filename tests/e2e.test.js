/* cSpell:disable */
// @ts-nocheck
/* eslint-disable no-undef */
/* eslint-disable no-debugger */
/* eslint-disable no-unused-vars */
import main from "../index.js";
import dotenv from 'dotenv';
import { execSync } from "child_process";
import u from 'ak-tools';
import path from 'path';
dotenv.config();

const timeout = 60000;

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
};


describe('e2e', () => {

	test('events', async () => {
		const { success, failed } = await main({ ...CONFIG, type: "event", file: './testData/heap-events-ex.json' });
		expect(success).toBe(10000);
		expect(failed).toBe(0);

	}, timeout);


	test('events (custom user id)', async () => {
		const { success, failed } = await main({ ...CONFIG, type: "event", custom_user_id: "event_id", file: './testData/heap-events-ex.json' });
		expect(success).toBe(10000);
		expect(failed).toBe(0);

	}, timeout);


	test('users', async () => {
		const { success, failed } = await main({ ...CONFIG, type: "user", file: './testData/heap-users-ex.json' });
		expect(success).toBe(1500);
		expect(failed).toBe(0);

	}, timeout);

	test('users (big)', async () => {
		const res = await main({ ...CONFIG, type: "user", file: './testData/users-ass.json', tags: { "heap-user-parse": true } });
		const { success, failed, total, empty } = res;
		expect(success).toBe(1169);
		expect(total).toBe(135530);
		expect(empty).toBe(134361);
		expect(failed).toBe(0);

	}, timeout);

	test('users (custom user id)', async () => {
		const { success, failed } = await main({ ...CONFIG, type: "user", custom_user_id: "email", file: './testData/heap-users-ex.json' });
		expect(success).toBe(1500);
		expect(failed).toBe(0);

	}, timeout);

	test('events with device mapping', async () => {
		const { success, failed } = await main({
			...CONFIG, type: "event", file: './testData/ass-events.json', device_id_map_file: './testData/merged-users-mappings-test.json'
		});
		expect(success).toBe(12685);
		expect(failed).toBe(0);

	}, timeout);

	test('CLI', async () => {
		const { dir = './testData/heap-events-ex.json',
			token,
			secret,
			project,
			strict,
			region,
			verbose } = CONFIG;
		const run = execSync(`node ./index.js --dir ${dir} --token ${token} --secret ${secret} --project ${project} --region ${region} --strict ${strict} --type event --verbose ${verbose}`);
		expect(run.toString().trim().includes('hooray! all done!')).toBe(true);
	}, timeout);

	test('CLI (device map)', async () => {
		execSync(`node ./index.js --get_map --secret ${CONFIG.secret}`);
		const file = path.resolve(`./user-device-mappings.json`);
		const result = await u.load(file, true);
		expect(result.length).toBeGreaterThan(10000);
		expect(result[0]).toHaveProperty('distinct_id');
		expect(result[0]).toHaveProperty('id');
		await u.rm(file);

	}, timeout);


});



afterAll(() => {
	console.log('clearing logs...');
	execSync(`npm run prune`);
	console.log('...logs cleared 👍');
});