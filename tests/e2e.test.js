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

/** @type {Config} */
const CONFIG = {
	bucket: "foo",
	
	region: 'US',
	id: "2337",
	name: "HEAP RIP!",
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
		const { success, failed } = await main({...CONFIG, type: "event", filePath: './testData/heap-events-ex.json'}, true);
		expect(success).toBe(10000);
		expect(failed).toBe(0);

	}, timeout);

	test('users', async () => {
		const { success, failed } = await main({...CONFIG, type: "user", filePath: './testData/heap-users-ex.json',}, true);
		expect(success).toBe(4998);
		expect(failed).toBe(0);

	}, timeout);

});




afterAll(() => {
	console.log('clearing logs...');
	execSync(`npm run prune`);
	console.log('...logs cleared 👍');
});