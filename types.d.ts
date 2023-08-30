/**
 * a module to import amplitude data into mixpanel
 */
export default async function main(config: Config): Promise<Results>;

import { ImportResults, Options } from "mixpanel-import";
import { Readable } from "stream";
import { ReadStream } from "fs";

interface Results {
    events: ImportResults;
    users: ImportResults;
    groups: {};
}

/**
 * an object to store configuration params
 */
interface Config extends Options {
    /**
     * a directory containing UNCOMPRESSED amplitude event json
     */
    dir?: string;
    /**
     * a file containing UNCOMPRESSED amplitude event json
     */
    file?: string;
    /**
     * a file stream of UNCOMPRESSED amplitude event json
     */
    stream?: ReadStream;
    /**
     * mixpanel secret
     */
    secret: string;
    /**
     * mixpanel project id
     */
    project: number | string;
    /**
     * mixpanel token
     */
    token: string;
    /**
     * use strict mode?
     */
    strict?: boolean;
    /**
     * a custom key to use for $user_id instead of amplitude default (user_id)
     * see //? https://www.docs.developers.amplitude.com/analytics/apis/export-api/
     */
    custom_user_id?: string;
    /**
     * US or EU residency
     */
    region?: "US" | "EU" | undefined;
    /**
     * group keys (if applicable)
     */
    group_keys?: string[];
    /**
     * verbosely log to the console
     */
    verbose?: boolean;
    /**
     * write logs to file
     */
    logs?: boolean;
    /**
     * type of data to import
     */
    type: "event" | "user" | "group";
    /**
     * rename prop keys
     */
    aliases?: Options["aliases"];
    /**
     * add arbitrary k:v pairs to records
     */
    tags?: Options["tags"];
    /**
     * a local path to a file containing data of the form:
     *
     *  `{"distinct_id":"pli:191","id":"6198042366195748"}`
     *
     * where `distinct_id` is `$user_id` and `id` is `$device_id`
     *
     *
     * if provided, this will be used to map $device_id to $user_id
     *
     * for help generating this file, see: get-device-user-map.js
     *
     * while this is optional, it is HIGHLY recommended
     */
    device_id_map_file?: string;

    [x: string]: unknown;
}

interface HeapExtras {}

interface CustomTransformOptions {
    /**
     * a custom key to use for $user_id instead of amplitude default (user_id)
     * see //? https://www.docs.developers.amplitude.com/analytics/apis/export-api/
     */
    custom_user_id?: string;
}
